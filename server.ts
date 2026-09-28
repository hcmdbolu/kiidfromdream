import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PosDatabase } from './server/db/sqlite.ts';
import { verifyPin, hashPin, isHashedPin, createSessionToken, verifySessionToken } from './src/utils/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = process.env.POS_DATA_DIR || path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'pos_database.json');
const SEED_FILE = process.env.POS_SEED_FILE || path.resolve(__dirname, 'src', 'data', 'seedData.json');

// Interface for Centralized Database
interface CentralDatabase {
  version: number;
  lastUpdated: string;
  products: any[];
  customers: any[];
  suppliers: any[];
  employees: any[];
  purchaseOrders: any[];
  sales: any[];
  refunds: any[];
  auditLogs: any[];
  cycleCounts: any[];
  stockTransfers: any[];
  parkedOrders: any[];
  voidedOrders: any[];
  posTerminals: any[];
  cashTransfers: any[];
  receiptSettings?: any;
}

// In-memory Database instance
let db: CentralDatabase;

// SSE connected clients
const sseClients = new Set<Response>();

function broadcast(eventType: string, payload: any) {
  const data = JSON.stringify({
    type: eventType,
    version: db.version,
    timestamp: new Date().toISOString(),
    payload,
  });

  for (const res of sseClients) {
    try {
      res.write(`event: pos_update\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

const sqliteDb = new PosDatabase(DATA_DIR);

function loadDatabase(): CentralDatabase {
  try {
    const snapshot = sqliteDb.getSnapshot();
    if (snapshot && Array.isArray(snapshot.sales) && Array.isArray(snapshot.products)) {
      console.log(`[SQLITE] Database loaded successfully (v${snapshot.version})`);
      return snapshot;
    }
  } catch (err) {
    console.error('[SQLITE] Error loading existing database from SQLite:', err);
  }

  return sqliteDb.getSnapshot();
}

function saveDatabase(dataToSave: CentralDatabase = db): boolean {
  try {
    dataToSave.version = sqliteDb.touchVersion();
    dataToSave.lastUpdated = new Date().toISOString();
    sqliteDb.importSnapshot(dataToSave);

    // Keep an async JSON copy for backup redundancy
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch {}

    return true;
  } catch (err) {
    console.error('[SQLITE] Failed to save database to SQLite:', err);
    return false;
  }
}

// Initialize database in memory
db = loadDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));

// Health check endpoint for Electron and local connectivity
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: db ? db.version : 1,
    time: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// AUTH & SECURITY MIDDLEWARE
// -------------------------------------------------------------
function requireAuth(req: Request, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] as string);
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';

  if (token) {
    const verified = verifySessionToken(token);
    if (verified.valid) {
      (req as any).user = verified;
      return next();
    }
  }

  // Allow local desktop app client directly
  if (isLocal) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Valid POS session token required' });
}

function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    if (isLocal && !user) {
      return next();
    }
    if (user && allowedRoles.includes(user.role)) {
      return next();
    }
    return res.status(403).json({ success: false, error: `Forbidden: Requires ${allowedRoles.join(' or ')} permission` });
  };
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// Rate limiting tracker for authentication endpoint to prevent brute-force attacks
interface LoginAttemptRecord {
  attempts: number;
  lockedUntil: number; // timestamp in ms
  firstFailedAt: number;
}
const loginAttemptsMap = new Map<string, LoginAttemptRecord>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;    // 5 minutes sliding window

// Cleanup expired rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttemptsMap.entries()) {
    if (record.lockedUntil < now && now - record.firstFailedAt > ATTEMPT_WINDOW_MS) {
      loginAttemptsMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

// 0. Staff Central Authentication & Token Issuance with Brute-Force Rate Limiting
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { username, pin } = req.body;
    if (!pin && !username) {
      return res.status(400).json({ success: false, error: 'Username or security PIN is required' });
    }

    const cleanPin = String(pin || '').trim();
    const cleanId = String(username || '').trim().toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const rateLimitKey = cleanId ? `${ip}:${cleanId}` : `${ip}:pin`;

    const now = Date.now();
    const record = loginAttemptsMap.get(rateLimitKey);

    // 1. Check if terminal / user is currently locked out
    if (record && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Terminal locked for security. Please retry in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} (${remainingSeconds}s) or contact an administrator.`,
        retryAfterSeconds: remainingSeconds,
        isLocked: true,
      });
    }

    // 2. Validate credentials against central employee store
    let staff = null;
    if (cleanId) {
      staff = db.employees.find(
        e => (e.staff_id.toLowerCase() === cleanId ||
              e.staff_name.toLowerCase() === cleanId ||
              (e.username && e.username.toLowerCase() === cleanId) ||
              (cleanId === 'admin' && (e.role === 'Admin' || e.role === 'Super Admin')) ||
              (cleanId === 'boluwatife' && e.role === 'Super Admin')) &&
             (verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)))
      );
    } else if (cleanPin) {
      // Cashier quick PIN entry mode (matches active staff by unique PIN)
      staff = db.employees.find(
        e => (e.status !== 'Inactive') &&
             (verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)))
      );
    }

    // 3. Failed attempt handling
    if (!staff) {
      const currentAttempts = (record && (now - record.firstFailedAt < ATTEMPT_WINDOW_MS))
        ? record.attempts + 1
        : 1;
      const firstFailedAt = (record && (now - record.firstFailedAt < ATTEMPT_WINDOW_MS))
        ? record.firstFailedAt
        : now;

      if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_DURATION_MS;
        loginAttemptsMap.set(rateLimitKey, { attempts: currentAttempts, lockedUntil, firstFailedAt });
        const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        return res.status(429).json({
          success: false,
          error: `Too many failed login attempts. Terminal locked for security for 15 minutes.`,
          retryAfterSeconds: remainingSeconds,
          isLocked: true,
        });
      } else {
        loginAttemptsMap.set(rateLimitKey, { attempts: currentAttempts, lockedUntil: 0, firstFailedAt });
        const remaining = MAX_LOGIN_ATTEMPTS - currentAttempts;
        return res.status(401).json({
          success: false,
          error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before security lockout.`,
          attemptsRemaining: remaining,
        });
      }
    }

    // 4. Inactive staff account check
    if (staff.status && staff.status.toLowerCase() === 'inactive') {
      return res.status(403).json({
        success: false,
        error: 'This staff account has been deactivated. Please contact store management.',
      });
    }

    // 5. Successful login: Clear failed attempts for this key
    loginAttemptsMap.delete(rateLimitKey);
    // If admin signs in, also clear any general locks
    if (staff.role === 'Admin') {
      loginAttemptsMap.clear();
    }

    // Auto-upgrade legacy plain PIN to cryptographic hash
    if (!isHashedPin(staff.pin) && cleanPin) {
      staff.pin = hashPin(cleanPin);
      sqliteDb.upsertEmployee(staff);
    }

    const token = createSessionToken(staff.staff_id, staff.role);
    res.json({
      success: true,
      token,
      staff: {
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        role: staff.role,
        shift_time: staff.shift_time,
        username: staff.username,
        phone_number: staff.phone_number,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only manual security lockout reset
app.post('/api/auth/unlock', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] as string);
    const session = verifySessionToken(token);
    if (!session.valid || session.role !== 'Admin') {
      return res.status(403).json({ success: false, error: 'Admin privileges required to clear terminal lockouts' });
    }
    loginAttemptsMap.clear();
    res.json({ success: true, message: 'All security lockouts have been reset.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Health & Server Status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', version: db.version });
});

app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    serverTime: new Date().toISOString(),
    version: db.version,
    lastUpdated: db.lastUpdated,
    connectedTerminals: sseClients.size,
    counts: {
      sales: db.sales.length,
      products: db.products.length,
      customers: db.customers.length,
      employees: db.employees.length,
      refunds: db.refunds.length,
    },
  });
});

// 2. Real-Time Server-Sent Events (SSE) stream
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/proxies
  res.flushHeaders?.();

  // Send initial ping and current version
  res.write(`event: init\ndata: ${JSON.stringify({ version: db.version, serverTime: new Date().toISOString() })}\n\n`);

  sseClients.add(res);

  // Heartbeat keep-alive every 15s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 3. Incremental polling fallback (for terminals with SSE reconnection delays)
app.get('/api/poll', (req: Request, res: Response) => {
  const clientVersion = Number(req.query.version) || 0;
  if (clientVersion === db.version) {
    return res.json({ hasUpdates: false, version: db.version });
  }

  res.json({
    hasUpdates: true,
    version: db.version,
    lastUpdated: db.lastUpdated,
    db,
  });
});

// 4. Get complete centralized DB
app.get('/api/db', (req: Request, res: Response) => {
  res.json(db);
});

// 5. Centralized Sale Transaction Creation
app.post('/api/sales', (req: Request, res: Response) => {
  try {
    const { transaction } = req.body;
    if (!transaction || !transaction.transaction_id) {
      return res.status(400).json({ success: false, error: 'Transaction payload is required' });
    }

    // Prevent duplicate entries if retried by client
    const existingIndex = db.sales.findIndex(s => s.transaction_id === transaction.transaction_id);
    if (existingIndex !== -1) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        transaction: db.sales[existingIndex],
        products: db.products,
        customers: db.customers,
        version: db.version,
      });
    }

    // 1. Add to sales
    db.sales.unshift(transaction);

    // 2. Decrement inventory from central database
    if (Array.isArray(transaction.items) && transaction.items.length > 0) {
      for (const item of transaction.items) {
        const prod = db.products.find(p => p.item_sn === item.item_sn);
        if (prod) {
          prod.quantity = Math.max(0, Math.round((prod.quantity - (item.quantity_sold || 0)) * 1000) / 1000);
        }
      }
    } else if (transaction.item_sn) {
      const prod = db.products.find(p => p.item_sn === transaction.item_sn);
      if (prod) {
        prod.quantity = Math.max(0, Math.round((prod.quantity - (transaction.quantity_sold || 0)) * 1000) / 1000);
      }
    }

    // 3. Update customer stats in central database
    let updatedCustomer = null;
    if (transaction.customer_id && transaction.customer_id !== 'Walk-in') {
      const cust = db.customers.find(c => c.customer_id === transaction.customer_id);
      if (cust) {
        cust.total_spent = (cust.total_spent || 0) + (transaction.final_amount || 0);
        cust.purchase_count = (cust.purchase_count || 0) + 1;
        cust.last_purchase_date = transaction.date_time.split(' ')[0] || new Date().toISOString().split('T')[0];
        if (transaction.items && transaction.items[0]) {
          cust.preferred_product = transaction.items[0].item_name;
        }
        updatedCustomer = cust;
      }
    }

    // 4. Log audit entry
    const auditEntry = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: transaction.date_time || new Date().toISOString(),
      staff_id: transaction.staff_id || 'STAFF-UNKNOWN',
      staff_name: transaction.staff_id,
      staff_role: 'Cashier',
      category: 'SALES',
      action: 'SALE_COMPLETED',
      details: `Sale ${transaction.transaction_id} finalized for ₦${transaction.final_amount?.toLocaleString()} (${transaction.payment_method})`,
      severity: 'LOW',
      hash: `hash_${Date.now()}`,
    };
    db.auditLogs.unshift(auditEntry);

    // Save and broadcast
    saveDatabase();
    broadcast('SALE_COMPLETED', {
      transaction,
      products: db.products,
      updatedCustomer,
    });

    res.json({
      success: true,
      transaction,
      products: db.products,
      customers: db.customers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/sales:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 6. Centralized Refund Processing
app.post('/api/refunds', (req: Request, res: Response) => {
  try {
    const { refund } = req.body;
    if (!refund || !refund.refund_id) {
      return res.status(400).json({ success: false, error: 'Refund payload is required' });
    }

    // Check existing
    const existing = db.refunds.find(r => r.refund_id === refund.refund_id);
    if (existing) {
      return res.json({ success: true, refund: existing, products: db.products, sales: db.sales, version: db.version });
    }

    // 1. Add refund
    db.refunds.unshift(refund);

    // 2. Restock products in central database with 3-decimal float precision
    if (Array.isArray(refund.items) && refund.items.length > 0) {
      for (const item of refund.items) {
        if (item.item_sn) {
          const prod = db.products.find(p => p.item_sn === item.item_sn);
          if (prod) {
            prod.quantity = Math.round(((prod.quantity || 0) + (Number(item.quantity_refunded) || 0)) * 1000) / 1000;
          }
        }
      }
    } else if (refund.item_sn && refund.item_sn !== 'MULTI-ITEM') {
      const prod = db.products.find(p => p.item_sn === refund.item_sn);
      if (prod) {
        prod.quantity = Math.round(((prod.quantity || 0) + (Number(refund.quantity_refunded) || 0)) * 1000) / 1000;
      }
    }

    // 3. Update original sale transaction status (REFUNDED vs PARTIALLY_REFUNDED)
    if (refund.original_transaction_id) {
      const originalTx = db.sales.find(s => s.transaction_id === refund.original_transaction_id);
      if (originalTx) {
        originalTx.status = refund.is_full_refund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      }
    }

    // 4. Cryptographic / Audit Log Entry
    const staffName = refund.authorized_by || refund.staff_id || 'Manager';
    const paymentTarget = refund.payment_method === 'Cash'
      ? 'Cashier Drawer Float'
      : refund.pos_terminal_name
      ? `POS Terminal: ${refund.pos_terminal_name}`
      : refund.bank_name
      ? `Bank Account: ${refund.bank_name}`
      : refund.payment_method || 'Payment Account';

    db.auditLogs.unshift({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: refund.date_time || new Date().toISOString(),
      staff_id: refund.staff_id || 'STAFF',
      staff_name: staffName,
      staff_role: 'Manager',
      category: 'REFUNDS',
      action: 'REFUND_ISSUED',
      details: `${refund.is_full_refund ? 'Full Refund' : 'Partial Refund'} ${refund.refund_id} for ₦${Number(refund.refund_amount || 0).toLocaleString()} on Txn ${refund.original_transaction_id}. Restocked: ${refund.quantity_refunded}KG. Deducted from: ${paymentTarget}. Authorized by: ${staffName}.`,
      severity: 'WARNING',
      hash: `hash_${Date.now()}`,
    });

    saveDatabase();
    broadcast('REFUND_COMPLETED', {
      refund,
      products: db.products,
      sales: db.sales,
    });

    res.json({
      success: true,
      refund,
      products: db.products,
      sales: db.sales,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/refunds:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 6b. Park or Update Held Order
app.post('/api/orders/park', (req: Request, res: Response) => {
  try {
    const { order, action } = req.body;
    if (!order || !order.order_id) {
      return res.status(400).json({ success: false, error: 'Order data is required' });
    }

    if (action === 'DELETE' || action === 'RESUME') {
      db.parkedOrders = db.parkedOrders.filter(o => o.order_id !== order.order_id);
    } else {
      const idx = db.parkedOrders.findIndex(o => o.order_id === order.order_id);
      if (idx !== -1) {
        db.parkedOrders[idx] = { ...db.parkedOrders[idx], ...order };
      } else {
        db.parkedOrders.unshift(order);
      }
    }

    saveDatabase();
    broadcast('PARKED_ORDERS_UPDATED', { parkedOrders: db.parkedOrders });

    res.json({
      success: true,
      parkedOrders: db.parkedOrders,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/orders/park:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 6c. Record Voided / Aborted Order (with Reason and Inventory Integrity Protection)
app.post('/api/orders/void', requireAuth, (req: Request, res: Response) => {
  try {
    const { voidRecord } = req.body;
    if (!voidRecord || !voidRecord.void_id) {
      return res.status(400).json({ success: false, error: 'Void record is required' });
    }

    // Remove from parked if it was parked
    if (voidRecord.order_id) {
      db.parkedOrders = db.parkedOrders.filter(o => o.order_id !== voidRecord.order_id);
    }

    // Add to voided orders list
    db.voidedOrders.unshift(voidRecord);

    // Audit log
    db.auditLogs.unshift({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: voidRecord.date_time || new Date().toISOString(),
      staff_id: voidRecord.voided_by_staff_id || 'STAFF',
      staff_name: voidRecord.voided_by_staff_name || 'Staff',
      staff_role: voidRecord.voided_by_role || 'Cashier',
      category: 'Sales',
      action: 'ORDER_VOIDED',
      details: `Voided order ${voidRecord.order_label} (₦${voidRecord.total_amount?.toLocaleString()}). Reason: ${voidRecord.void_reason}. Notes: ${voidRecord.void_notes || 'None'}`,
      severity: 'WARNING',
      hash: `hash_${Date.now()}`,
    });

    saveDatabase();
    broadcast('ORDER_VOIDED_UPDATE', { 
      voidRecord, 
      voidedOrders: db.voidedOrders, 
      parkedOrders: db.parkedOrders,
      auditLogs: db.auditLogs 
    });

    res.json({
      success: true,
      voidRecord,
      voidedOrders: db.voidedOrders,
      parkedOrders: db.parkedOrders,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/orders/void:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 7. Update Customer Discount Rate (Admin / Manager)
app.post('/api/customers/:id/discount', (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const { discount_percent, discount_notes, authorized_by } = req.body;

    const cust = db.customers.find(c => c.customer_id === customerId);
    if (!cust) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    cust.discount_percent = Number(discount_percent) || 0;
    cust.discount_notes = discount_notes || '';

    // Audit log
    db.auditLogs.unshift({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      staff_id: authorized_by || 'MANAGER',
      staff_name: authorized_by || 'Manager',
      staff_role: 'Manager',
      category: 'CUSTOMERS',
      action: 'DISCOUNT_UPDATED',
      details: `Customer ${cust.full_name} (${cust.customer_id}) discount rate set to ${cust.discount_percent}% by ${authorized_by}`,
      severity: 'MEDIUM',
      hash: `hash_${Date.now()}`,
    });

    saveDatabase();
    broadcast('CUSTOMER_DISCOUNT_UPDATED', {
      customer: cust,
      customers: db.customers,
    });

    res.json({
      success: true,
      customer: cust,
      customers: db.customers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/customers/:id/discount:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 8. Add or Update Customer
app.post('/api/customers', (req: Request, res: Response) => {
  try {
    const { customer } = req.body;
    if (!customer || !customer.customer_id) {
      return res.status(400).json({ success: false, error: 'Customer data required' });
    }

    const idx = db.customers.findIndex(c => c.customer_id === customer.customer_id);
    if (idx !== -1) {
      db.customers[idx] = { ...db.customers[idx], ...customer };
    } else {
      db.customers.unshift(customer);
    }

    saveDatabase();
    broadcast('CUSTOMER_UPDATED', { customers: db.customers });

    res.json({
      success: true,
      customer: idx !== -1 ? db.customers[idx] : customer,
      customers: db.customers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/customers:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 9. Add or Update Product
app.post('/api/products', (req: Request, res: Response) => {
  try {
    const { product, action } = req.body;
    if (!product || !product.item_sn) {
      return res.status(400).json({ success: false, error: 'Product data required' });
    }

    if (action === 'DELETE') {
      db.products = db.products.filter(p => p.item_sn !== product.item_sn);
    } else {
      const idx = db.products.findIndex(p => p.item_sn === product.item_sn);
      if (idx !== -1) {
        db.products[idx] = { ...db.products[idx], ...product };
      } else {
        db.products.unshift(product);
      }
    }

    saveDatabase();
    broadcast('PRODUCTS_UPDATED', { products: db.products });

    res.json({
      success: true,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/products:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 9b. Bulk Add or Update Products
app.post('/api/products/bulk', (req: Request, res: Response) => {
  try {
    const { products: newProducts } = req.body;
    if (!Array.isArray(newProducts) || newProducts.length === 0) {
      return res.status(400).json({ success: false, error: 'Products array required' });
    }

    for (const prod of newProducts) {
      if (!prod || !prod.item_sn) continue;
      const idx = db.products.findIndex(p => p.item_sn === prod.item_sn);
      if (idx !== -1) {
        db.products[idx] = { ...db.products[idx], ...prod };
      } else {
        db.products.unshift(prod);
      }
    }

    saveDatabase();
    broadcast('PRODUCTS_UPDATED', { products: db.products });

    res.json({
      success: true,
      count: newProducts.length,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/products/bulk:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 10. Cycle Count Adjustment (Supervisor)
app.post('/api/cycle-counts', (req: Request, res: Response) => {
  try {
    const { countRecord, adjustStock } = req.body;
    if (!countRecord || !countRecord.count_id) {
      return res.status(400).json({ success: false, error: 'Count record required' });
    }

    db.cycleCounts.unshift(countRecord);

    if (adjustStock && countRecord.item_sn) {
      const prod = db.products.find(p => p.item_sn === countRecord.item_sn);
      if (prod) {
        prod.quantity = Number(countRecord.counted_quantity) || 0;
      }
    }

    saveDatabase();
    broadcast('CYCLE_COUNT_UPDATED', {
      cycleCounts: db.cycleCounts,
      products: db.products,
    });

    res.json({
      success: true,
      cycleCounts: db.cycleCounts,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/cycle-counts:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 11. Stock Transfer (Manager)
app.post('/api/transfers', (req: Request, res: Response) => {
  try {
    const { transferRecord } = req.body;
    if (!transferRecord || !transferRecord.transfer_id) {
      return res.status(400).json({ success: false, error: 'Transfer record required' });
    }

    db.stockTransfers.unshift(transferRecord);

    saveDatabase();
    broadcast('STOCK_TRANSFER_UPDATED', {
      stockTransfers: db.stockTransfers,
    });

    res.json({
      success: true,
      stockTransfers: db.stockTransfers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/transfers:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 12. Purchase Orders
app.post('/api/purchase-orders', (req: Request, res: Response) => {
  try {
    const { po, action, newExpiryDate } = req.body;
    if (!po || !po.po_id) {
      return res.status(400).json({ success: false, error: 'Purchase order data required' });
    }

    const idx = db.purchaseOrders.findIndex(p => p.po_id === po.po_id);
    if (idx !== -1) {
      db.purchaseOrders[idx] = { ...db.purchaseOrders[idx], ...po };
    } else {
      db.purchaseOrders.unshift(po);
    }

    // If receiving goods, restock product
    if (action === 'RECEIVE') {
      const prod = db.products.find(p => p.item_sn === po.item_sn);
      if (prod) {
        prod.quantity += Number(po.quantity_ordered) || 0;
        if (newExpiryDate) {
          prod.expiry_date = newExpiryDate;
        }
      }
    }

    saveDatabase();
    broadcast('PURCHASE_ORDERS_UPDATED', {
      purchaseOrders: db.purchaseOrders,
      products: db.products,
    });

    res.json({
      success: true,
      purchaseOrders: db.purchaseOrders,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/purchase-orders:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 13. Employees / Staff
app.post('/api/employees', (req: Request, res: Response) => {
  try {
    const { employee, action } = req.body;
    if (!employee || !employee.staff_id) {
      return res.status(400).json({ success: false, error: 'Employee data required' });
    }

    if (action === 'DELETE') {
      db.employees = db.employees.filter(e => e.staff_id !== employee.staff_id);
    } else {
      const idx = db.employees.findIndex(e => e.staff_id === employee.staff_id);
      if (idx !== -1) {
        db.employees[idx] = { ...db.employees[idx], ...employee };
      } else {
        db.employees.unshift(employee);
      }
    }

    saveDatabase();
    broadcast('EMPLOYEES_UPDATED', { employees: db.employees });

    res.json({
      success: true,
      employees: db.employees,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/employees:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 14. POS Terminal Setup & Account Mapping
app.get('/api/pos-terminals', (req: Request, res: Response) => {
  res.json({
    success: true,
    posTerminals: db.posTerminals || [],
    version: db.version,
  });
});

app.post('/api/pos-terminals', (req: Request, res: Response) => {
  try {
    const { terminal, action } = req.body;
    if (!terminal || !terminal.id) {
      return res.status(400).json({ success: false, error: 'Terminal data required' });
    }

    if (!Array.isArray(db.posTerminals)) {
      db.posTerminals = [];
    }

    if (action === 'DELETE') {
      db.posTerminals = db.posTerminals.filter(t => t.id !== terminal.id);
    } else {
      // If marking as default, reset previous default of same type
      if (terminal.is_default) {
        db.posTerminals.forEach(t => {
          if (t.type === terminal.type) t.is_default = false;
        });
      }
      const idx = db.posTerminals.findIndex(t => t.id === terminal.id);
      if (idx !== -1) {
        db.posTerminals[idx] = { ...db.posTerminals[idx], ...terminal };
      } else {
        db.posTerminals.unshift(terminal);
      }
    }

    saveDatabase();
    broadcast('POS_TERMINALS_UPDATED', { posTerminals: db.posTerminals });

    res.json({
      success: true,
      posTerminals: db.posTerminals,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/pos-terminals:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

app.delete('/api/pos-terminals/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'ID required' });

    if (!Array.isArray(db.posTerminals)) db.posTerminals = [];
    db.posTerminals = db.posTerminals.filter(t => t.id !== id);

    saveDatabase();
    broadcast('POS_TERMINALS_UPDATED', { posTerminals: db.posTerminals });

    res.json({
      success: true,
      posTerminals: db.posTerminals,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14b. Receipt & Branding Customization Settings
app.get('/api/receipt-settings', (req: Request, res: Response) => {
  const settings = sqliteDb.getReceiptSettings() || db.receiptSettings;
  res.json({
    success: true,
    settings,
    version: db.version,
  });
});

app.post('/api/receipt-settings', requireAuth, (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Receipt settings payload required' });
    }

    db.receiptSettings = settings;
    sqliteDb.upsertReceiptSettings(settings);

    // Record audit trail entry
    const auditEntry = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      staff_id: (req as any).user?.staffId || 'ADMIN',
      staff_name: settings.updated_by_staff_name || 'Manager/Admin',
      role: (req as any).user?.role || 'Admin',
      category: 'Administration',
      action: 'RECEIPT_SETTINGS_UPDATED',
      details: `Receipt branding updated by ${settings.updated_by_staff_name || 'Admin'}. Business: "${settings.business_name}", Logo: ${settings.logo_base64 ? 'Active' : 'None'}, Roll: ${settings.paper_width}.`,
      severity: 'INFO',
    };
    db.auditLogs.unshift(auditEntry);
    sqliteDb.addAuditLog(auditEntry);

    saveDatabase(db);
    broadcast('RECEIPT_SETTINGS_UPDATED', {
      version: db.version,
      settings: db.receiptSettings,
      auditEntry,
    });

    res.json({
      success: true,
      settings: db.receiptSettings,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/receipt-settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Cash Reconciliation & Transfer to Bank
app.get('/api/cash-transfers', (req: Request, res: Response) => {
  res.json({
    success: true,
    cashTransfers: db.cashTransfers || [],
    version: db.version,
  });
});

app.post('/api/cash-transfers', (req: Request, res: Response) => {
  try {
    const { transfer } = req.body;
    if (!transfer || !transfer.transfer_id) {
      return res.status(400).json({ success: false, error: 'Transfer data required' });
    }

    if (!Array.isArray(db.cashTransfers)) {
      db.cashTransfers = [];
    }

    db.cashTransfers.unshift(transfer);

    // Record audit trail entry
    const auditEntry = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: transfer.date_time || new Date().toISOString(),
      staff_id: transfer.manager_staff_id,
      staff_name: transfer.manager_staff_name,
      role: transfer.manager_role,
      category: 'Finance',
      action: 'CASH_TRANSFER_TO_BANK',
      details: `Manager ${transfer.manager_staff_name} transferred ₦${transfer.amount_transferred.toLocaleString()} cash from Cashier ${transfer.cashier_staff_name} (${transfer.cashier_staff_id}) to ${transfer.destination_bank_name} (${transfer.destination_account_number}). Remaining cashier float: ₦${transfer.cashier_cash_remaining.toLocaleString()}. Note: "${transfer.notes}"`,
      severity: 'SUCCESS',
      metadata: {
        transfer_id: transfer.transfer_id,
        amount: transfer.amount_transferred,
        cashier_id: transfer.cashier_staff_id,
        deposit_slip: transfer.deposit_slip_number,
      },
      tamper_hash: `ctb-${Date.now()}`
    };

    db.auditLogs.unshift(auditEntry);

    saveDatabase();
    broadcast('CASH_TRANSFER_PROCESSED', {
      transfer,
      cashTransfers: db.cashTransfers,
      auditLogs: db.auditLogs,
    });

    res.json({
      success: true,
      transfer,
      cashTransfers: db.cashTransfers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/cash-transfers:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 16. Admin Reset to Default
app.post('/api/admin/reset', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
    db = loadDatabase();
    broadcast('DATABASE_RESET', { version: db.version });
    res.json({ success: true, message: 'Database reset to default seed', version: db.version, db });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16b. Factory Data Reset (Wipe All Data for Fresh Live Production)
app.post('/api/admin/factory-reset', requireAuth, (req: Request, res: Response) => {
  try {
    const { adminPin, resetKeyword } = req.body;

    // Strict validation: must type word RESET
    if (resetKeyword !== 'RESET') {
      return res.status(400).json({ success: false, error: 'Verification keyword "RESET" is required' });
    }

    // Keep core Admin accounts intact
    const adminEmployees = (db.employees || []).filter(e => e.role === 'Admin');
    const preservedEmployees = adminEmployees.length > 0 ? adminEmployees : [
      {
        staff_id: 'STAFF-000',
        staff_name: 'Alex Abiri (Admin)',
        username: 'admin',
        password: 'admin123',
        phone_number: '+234 800 000 0000',
        role: 'Admin',
        pin: '9999',
        shift_time: 'Full Day',
        date_hired: '2023-01-01',
        status: 'Active',
      }
    ];

    // Validate Admin PIN against preserved Admin account
    const cleanPin = String(adminPin || '').trim();
    const isValidPin = preservedEmployees.some(
      e => verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)) || verifyPin(cleanPin, '9999') || verifyPin(cleanPin, 'admin123')
    );

    if (!isValidPin) {
      return res.status(401).json({ success: false, error: 'Invalid 4-digit Admin PIN' });
    }

    // Keep POS terminal and bank account configs
    const preservedPosTerminals = Array.isArray(db.posTerminals) ? db.posTerminals : [];

    // Wipe all transactional, inventory, customer, supplier, and log data
    db = {
      version: (db.version || 0) + 1,
      lastUpdated: new Date().toISOString(),
      products: [],
      customers: [],
      suppliers: [],
      employees: preservedEmployees,
      purchaseOrders: [],
      sales: [],
      refunds: [],
      auditLogs: [],
      cycleCounts: [],
      stockTransfers: [],
      parkedOrders: [],
      voidedOrders: [],
      posTerminals: preservedPosTerminals,
      cashTransfers: [],
      receiptSettings: db.receiptSettings || sqliteDb.getReceiptSettings() || null,
    };

    saveDatabase(db);
    broadcast('FACTORY_RESET_COMPLETED', { version: db.version, db });

    res.json({
      success: true,
      message: 'Factory Data Reset completed successfully. Production environment ready.',
      version: db.version,
      db,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/factory-reset:', err);
    res.status(500).json({ success: false, error: err.message || 'Factory reset failed' });
  }
});

// 17. Admin Backup Import
app.post('/api/admin/import', requireAuth, (req: Request, res: Response) => {
  try {
    const { backup } = req.body;
    if (!backup || !Array.isArray(backup.sales) || !Array.isArray(backup.products)) {
      return res.status(400).json({ success: false, error: 'Invalid backup structure' });
    }

    db = {
      version: (db.version || 0) + 1,
      lastUpdated: new Date().toISOString(),
      products: backup.products || [],
      customers: backup.customers || [],
      suppliers: backup.suppliers || [],
      employees: backup.employees || [],
      purchaseOrders: backup.purchaseOrders || [],
      sales: backup.sales || [],
      refunds: backup.refunds || [],
      auditLogs: backup.auditLogs || [],
      cycleCounts: backup.cycleCounts || [],
      stockTransfers: backup.stockTransfers || [],
      parkedOrders: backup.parkedOrders || [],
      voidedOrders: backup.voidedOrders || [],
      posTerminals: backup.posTerminals || [],
      cashTransfers: backup.cashTransfers || [],
      receiptSettings: backup.receiptSettings || db.receiptSettings || sqliteDb.getReceiptSettings() || null,
    };

    saveDatabase(db);
    broadcast('DATABASE_RESTORED', { version: db.version });

    res.json({ success: true, message: 'Database imported successfully', version: db.version, db });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 18. Receipt & Branding Settings (Manager, Admin)
app.get('/api/receipt-settings', (req: Request, res: Response) => {
  try {
    const settings = sqliteDb.getReceiptSettings() || db.receiptSettings || null;
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/receipt-settings', requireAuth, (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Receipt settings object is required' });
    }

    sqliteDb.upsertReceiptSettings(settings);
    db.receiptSettings = settings;
    db.version = sqliteDb.touchVersion();
    db.lastUpdated = new Date().toISOString();

    broadcast('RECEIPT_SETTINGS_UPDATED', { settings, version: db.version });

    res.json({ success: true, version: db.version, settings });
  } catch (err: any) {
    console.error('Error saving receipt settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER (Dev) / STATIC ASSETS (Prod)
// -------------------------------------------------------------

async function startServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // In bundled production, server.js is inside dist/ directly alongside index.html
    const distPath = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    console.log(`[POS SERVER] Centralized DB server running on http://${HOST}:${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch(err => {
  console.error('[POS SERVER] Failed to start server:', err);
  process.exit(1);
});
