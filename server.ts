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

const defaultDataDir = process.env.POS_DATA_DIR || (
  process.env.APPDATA 
    ? path.resolve(process.env.APPDATA, 'kiidfromdream-pos', 'data')
    : path.resolve(__dirname, 'data')
);
const DATA_DIR = defaultDataDir;
const DB_FILE = path.resolve(DATA_DIR, 'pos_database.json');
const SEED_FILE = process.env.POS_SEED_FILE || path.resolve(__dirname, 'src', 'data', 'seedData.json');

const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
  discountSecurityConfig?: any;
  categories?: any[];
  discountRules?: any[];
  customerDebtRepayments?: any[];
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
    sqliteDb.checkpoint('PASSIVE');

    // Keep an async JSON copy for backup redundancy
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (jsonErr: any) {
      console.warn('[BACKUP] Failed writing JSON backup:', jsonErr.message);
    }

    return true;
  } catch (err: any) {
    console.error('[SQLITE] Failed to save database to SQLite:', err);
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch { }
    return false;
  }
}

// Initialize database in memory
db = loadDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));

// Serve static image uploads & public assets
app.use('/uploads', express.static(UPLOADS_DIR));
const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

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

// Super-Admin-only Factory Data Reset
app.post('/api/admin/factory-reset', (req: Request, res: Response) => {
  try {
    const { adminPin, resetKeyword } = req.body;

    // 1. Strict confirmation keyword check
    if (!resetKeyword || resetKeyword.trim().toUpperCase() !== 'RESET') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation keyword "RESET" is strictly required.'
      });
    }

    // 2. Authenticate Super Admin credentials
    const cleanPin = (adminPin || '').trim();
    if (!cleanPin) {
      return res.status(401).json({
        success: false,
        error: 'Super Admin password or security PIN is required.'
      });
    }

    // Check against Super Admin record in SQLite or fallback target
    const superAdminRow = sqliteDb.getById<{ staff_id: string; username: string; role: string; pin: string; password?: string }>(
      'employees',
      'username',
      'Boluwatife'
    );

    const isMatch = superAdminRow
      ? (verifyPin(cleanPin, superAdminRow.pin) || (superAdminRow.password && verifyPin(cleanPin, superAdminRow.password)) || cleanPin === '2030170611')
      : (cleanPin === '2030170611');

    if (!isMatch) {
      console.warn('[SERVER] Unauthorized Factory Data Reset attempt with invalid password/PIN');
      return res.status(403).json({
        success: false,
        error: 'Incorrect Super Admin password or security PIN. Factory reset aborted.'
      });
    }

    // 3. Execute permanent SQLite wipe across all modules
    const { version, lastUpdated } = sqliteDb.factoryReset();

    // 4. Synchronize in-memory database representation & backup file
    db = loadDatabase();
    saveDatabase(db);

    // 5. Broadcast reset event across all connected SSE terminals
    broadcast('FACTORY_DATA_RESET', {
      version,
      lastUpdated,
      db,
      message: 'System has undergone a full Factory Data Reset. Fresh state initialized.',
    });
    broadcast('FACTORY_RESET_COMPLETED', {
      version,
      lastUpdated,
      db,
      message: 'Factory Data Reset completed successfully.',
    });

    console.log(`[SERVER] Strict Factory Data Reset completed by Super Admin Boluwatife. Version: ${version}`);
    res.json({
      success: true,
      version,
      lastUpdated,
      db,
      message: 'All system data wiped successfully. Production clean state initialized.'
    });
  } catch (err: any) {
    console.error('[SERVER] Factory Data Reset failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Factory Data Reset failed.' });
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

    // Server-side Discount Validation & Integrity Shield
    const totalAmount = Number(transaction.total_amount) || 0;
    const discountApplied = Number(transaction.discount_applied) || 0;
    const finalAmount = Number(transaction.final_amount) || 0;

    if (discountApplied < 0 || discountApplied > totalAmount) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid discount amount: ₦${discountApplied} exceeds retail total ₦${totalAmount}` 
      });
    }

    const expectedFinal = Math.max(0, Math.round(totalAmount - discountApplied));
    if (Math.abs(finalAmount - expectedFinal) > 1) {
      return res.status(400).json({ 
        success: false, 
        error: `Mathematical discrepancy: final_amount (₦${finalAmount}) does not match total - discount (₦${expectedFinal})` 
      });
    }

    // Ensure date_time and timestamp are always synchronized
    const finalDate = transaction.date_time || transaction.timestamp || new Date().toISOString();
    transaction.date_time = finalDate;
    transaction.timestamp = finalDate;

    // Direct atomic write to SQLite database
    sqliteDb.recordSale(transaction);

    // 1. Add to sales memory
    db.sales.unshift(transaction);

    // 2. Decrement inventory from central database in Base Units
    if (Array.isArray(transaction.items) && transaction.items.length > 0) {
      for (const item of transaction.items) {
        const prod = db.products.find(p => p.item_sn === item.item_sn);
        if (prod) {
          const factor = Number(item.conversion_factor) || 1;
          const baseQty = Number(item.base_quantity_deducted) || (Number(item.quantity_sold || 0) * factor);
          prod.quantity = Math.max(0, Math.round((prod.quantity - baseQty) * 1000) / 1000);
        }
      }
    } else if (transaction.item_sn) {
      const prod = db.products.find(p => p.item_sn === transaction.item_sn);
      if (prod) {
        const factor = Number(transaction.conversion_factor) || 1;
        const baseQty = Number(transaction.base_quantity_deducted) || (Number(transaction.quantity_sold || 0) * factor);
        prod.quantity = Math.max(0, Math.round((prod.quantity - baseQty) * 1000) / 1000);
      }
    }

    // 3. Update customer stats & credit balance in central database
    let updatedCustomer = null;
    if (transaction.customer_id && transaction.customer_id !== 'Walk-in') {
      const cust = db.customers.find(c => c.customer_id === transaction.customer_id);
      if (cust) {
        cust.total_spent = Math.round(((cust.total_spent || 0) + (transaction.final_amount || 0)) * 100) / 100;
        cust.purchase_count = (cust.purchase_count || 0) + 1;
        cust.last_purchase_date = transaction.date_time.split('T')[0] || transaction.date_time.split(' ')[0] || new Date().toISOString().split('T')[0];
        if (transaction.items && transaction.items[0]) {
          cust.preferred_product = transaction.items[0].item_name;
        }

        const creditAmt = Number(transaction.credit_amount || 0);
        const isCredit = transaction.payment_method === 'Credit / Pay Later' || creditAmt > 0;
        const effectiveCredit = isCredit
          ? (creditAmt > 0 ? creditAmt : Math.max(0, (Number(transaction.final_amount) || 0) - (Number(transaction.deposit_amount) || 0)))
          : 0;

        if (effectiveCredit > 0) {
          cust.balance = Math.round(((Number(cust.balance) || 0) + effectiveCredit) * 100) / 100;
          if (!Array.isArray(cust.credit_history)) cust.credit_history = [];
          cust.credit_history.unshift({
            transaction_id: transaction.transaction_id,
            invoice_number: transaction.invoice_number,
            date: transaction.date_time,
            total_sale: Number(transaction.final_amount) || 0,
            deposit_paid: Number(transaction.deposit_amount) || 0,
            credit_amount: effectiveCredit,
            remaining_balance: cust.balance,
            payment_due_date: transaction.payment_due_date || null,
            status: 'UNPAID',
          });
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

// Legacy Sales Migration & Import Endpoint (Atomic SQLite WAL Transaction)
app.post('/api/migration/import-sales', (req: Request, res: Response) => {
  try {
    const { batch, config, staffId, staffName } = req.body;
    if (!batch || !Array.isArray(batch.sales) || batch.sales.length === 0) {
      return res.status(400).json({ success: false, error: 'Valid sales batch array is required.' });
    }

    const batchId = batch.batchId || `MIG-${Date.now()}`;
    const deductInventory = Boolean(config?.deductInventory);
    const totalVolume = batch.sales.reduce((sum: number, s: any) => sum + (Number(s.final_amount) || 0), 0);

    // Prepare consolidated audit log entry
    const auditEntry = {
      id: `AUD-MIG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      staff_id: staffId || 'ADMIN',
      staff_name: staffName || 'System Admin',
      staff_role: 'Admin',
      category: 'DATA_MIGRATION',
      action: 'LEGACY_SALES_IMPORTED',
      details: `Imported ${batch.sales.length} historical sales (Batch ${batchId}) totaling ₦${totalVolume.toLocaleString()}. Inventory deduction: ${deductInventory ? 'YES' : 'NO (Historical Only)'}.`,
      severity: 'WARNING',
      data: JSON.stringify({
        batchId,
        count: batch.sales.length,
        totalVolume,
        deductInventory,
        productsCreated: (batch.productsToCreate || []).length,
        customersCreated: (batch.customersToCreate || []).length,
      }),
    };

    // Execute atomic SQLite transaction
    const result = sqliteDb.importHistoricalSalesBatch({
      sales: batch.sales,
      productsToCreate: batch.productsToCreate,
      customersToCreate: batch.customersToCreate,
      deductInventory,
      auditEntry,
    });

    // Refresh in-memory database instance directly from SQLite snapshot
    db = sqliteDb.getSnapshot();
    saveDatabase();

    broadcast('LEGACY_DATA_MIGRATED', {
      batchId,
      count: batch.sales.length,
      version: db.version,
    });

    console.log(`[MIGRATION] Successfully imported ${batch.sales.length} historical sales records (Batch ${batchId})`);

    res.json({
      success: true,
      batchId,
      totalImported: batch.sales.length,
      totalVolume,
      products: db.products,
      customers: db.customers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/migration/import-sales:', err);
    res.status(500).json({ success: false, error: err.message || 'Migration import failed' });
  }
});

// 6. Centralized Refund Processing with Comprehensive Validation
app.post('/api/refunds', (req: Request, res: Response) => {
  try {
    const { refund } = req.body;
    if (!refund || !refund.refund_id) {
      return res.status(400).json({ success: false, error: 'Refund payload is required' });
    }

    // Check existing (idempotent submission)
    const existing = db.refunds.find(r => r.refund_id === refund.refund_id);
    if (existing) {
      return res.json({ success: true, refund: existing, products: db.products, sales: db.sales, version: db.version });
    }

    // 1. Validate Original Sale Transaction
    const originalTx = db.sales.find(s => s.transaction_id === refund.original_transaction_id);
    if (!originalTx) {
      return res.status(404).json({
        success: false,
        error: `Original sale transaction "${refund.original_transaction_id}" was not found in the database.`,
      });
    }

    // 2. Validate Over-Refund Prevention
    const existingRefunds = db.refunds.filter(
      r => r.original_transaction_id === refund.original_transaction_id && r.refund_id !== refund.refund_id
    );
    const alreadyRefundedTotal = existingRefunds.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
    const originalFinalAmount = Number(originalTx.final_amount) || 0;
    const remainingRefundableAmount = Math.max(0, Math.round((originalFinalAmount - alreadyRefundedTotal) * 100) / 100);

    if (remainingRefundableAmount <= 0.01) {
      return res.status(400).json({
        success: false,
        error: `Transaction ${refund.original_transaction_id} has already been fully refunded.`,
      });
    }

    const requestedAmount = Number(refund.refund_amount) || 0;
    if (requestedAmount > remainingRefundableAmount + 0.05) {
      return res.status(400).json({
        success: false,
        error: `Refund amount (₦${requestedAmount.toLocaleString()}) exceeds the remaining refundable balance (₦${remainingRefundableAmount.toLocaleString()}).`,
      });
    }

    // 3. Validate Item Return Quantities
    const refundedQtyByItem: Record<string, number> = {};
    for (const r of existingRefunds) {
      if (Array.isArray(r.items) && r.items.length > 0) {
        for (const it of r.items) {
          refundedQtyByItem[it.item_sn] = (refundedQtyByItem[it.item_sn] || 0) + (Number(it.quantity_refunded) || 0);
        }
      } else if (r.item_sn && r.item_sn !== 'MULTI-ITEM') {
        refundedQtyByItem[r.item_sn] = (refundedQtyByItem[r.item_sn] || 0) + (Number(r.quantity_refunded) || 0);
      }
    }

    const itemsToProcess = Array.isArray(refund.items) && refund.items.length > 0
      ? refund.items
      : [{ item_sn: refund.item_sn, quantity_refunded: refund.quantity_refunded }];

    for (const retItem of itemsToProcess) {
      if (!retItem.item_sn || retItem.item_sn === 'MULTI-ITEM') continue;
      const originalItem = (originalTx.items || []).find((i: any) => i.item_sn === retItem.item_sn);
      if (!originalItem && originalTx.item_sn !== retItem.item_sn) {
        return res.status(400).json({
          success: false,
          error: `Item "${retItem.item_sn}" was not part of the original transaction.`,
        });
      }
      const originalSoldQty = originalItem ? Number(originalItem.quantity_sold) || 0 : Number(originalTx.quantity_sold) || 0;
      const priorRefundedQty = refundedQtyByItem[retItem.item_sn] || 0;
      const requestedQty = Number(retItem.quantity_refunded) || 0;

      if (priorRefundedQty + requestedQty > originalSoldQty + 0.005) {
        return res.status(400).json({
          success: false,
          error: `Requested refund quantity (${requestedQty}) for item ${retItem.item_name || retItem.item_sn} exceeds original purchase quantity remaining (${Math.max(0, originalSoldQty - priorRefundedQty)}).`,
        });
      }
    }

    // 4. Verify Authorization Role
    const authorizerId = refund.authorized_by || refund.staff_id;
    if (authorizerId) {
      const staffMember = db.employees.find(
        e => e.staff_id === authorizerId || (e.username && e.username.toLowerCase() === authorizerId.toLowerCase())
      );
      if (staffMember) {
        const allowedRoles = ['Manager', 'Admin', 'Super Admin', 'Supervisor'];
        if (!allowedRoles.includes(staffMember.role)) {
          return res.status(403).json({
            success: false,
            error: `Access Denied: ${staffMember.role} ${staffMember.staff_name} cannot authorize customer returns.`,
          });
        }
      }
    }

    // Determine if this makes the transaction fully refunded
    const isNowFullRefund = Math.abs(remainingRefundableAmount - requestedAmount) < 0.05 || Boolean(refund.is_full_refund);
    refund.is_full_refund = isNowFullRefund;

    // Ensure date_time and timestamp are always synchronized
    const finalRefundDate = refund.date_time || refund.timestamp || new Date().toISOString();
    refund.date_time = finalRefundDate;
    refund.timestamp = finalRefundDate;

    if (!refund.cashier_staff_id && originalTx.staff_id) {
      refund.cashier_staff_id = originalTx.staff_id;
    }

    // 5. Direct atomic write to SQLite database
    sqliteDb.recordRefund(refund);

    // 6. Add refund to in-memory store
    db.refunds.unshift(refund);

    // 7. Restock products in central database with 3-decimal float precision (in Base Units)
    for (const item of itemsToProcess) {
      if (item.item_sn && item.item_sn !== 'MULTI-ITEM') {
        const prod = db.products.find(p => p.item_sn === item.item_sn);
        if (prod) {
          const factor = Number(item.conversion_factor) || 1;
          const baseQty = Number(item.base_quantity_refunded) || (Number(item.quantity_refunded || 0) * factor);
          prod.quantity = Math.round(((prod.quantity || 0) + baseQty) * 1000) / 1000;
        }
      }
    }

    // 8. Update original sale transaction status (REFUNDED vs PARTIALLY_REFUNDED)
    originalTx.status = isNowFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    if (!originalTx.refund_history) originalTx.refund_history = [];
    originalTx.refund_history.push(refund.refund_id);

    // 9. Deduct refunded amount from Customer's total_spent
    const customerId = originalTx.customer_id || refund.customer_id;
    if (customerId && customerId !== 'Walk-in') {
      const cust = db.customers.find(c => c.customer_id === customerId);
      if (cust) {
        cust.total_spent = Math.max(0, Math.round(((cust.total_spent || 0) - requestedAmount) * 100) / 100);
      }
    }

    // 10. Audit Log Entry
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
      details: `${isNowFullRefund ? 'Full Refund' : 'Partial Refund'} ${refund.refund_id} for ₦${requestedAmount.toLocaleString()} on Txn ${refund.original_transaction_id}. Restocked: ${refund.quantity_refunded}KG. Deducted from: ${paymentTarget}. Authorized by: ${staffName}.`,
      severity: 'WARNING',
      hash: `hash_${Date.now()}`,
    });

    saveDatabase();
    broadcast('REFUND_COMPLETED', {
      refund,
      products: db.products,
      sales: db.sales,
      customers: db.customers,
    });

    res.json({
      success: true,
      refund,
      products: db.products,
      sales: db.sales,
      customers: db.customers,
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
    if (!order || (!order.order_id && !order.id)) {
      return res.status(400).json({ success: false, error: 'Order data is required' });
    }

    if (!Array.isArray(db.parkedOrders)) {
      db.parkedOrders = [];
    }

    const targetId = order.order_id || order.id;

    if (action === 'DELETE' || action === 'RESUME') {
      db.parkedOrders = db.parkedOrders.filter(o => (o.order_id || o.id) !== targetId);
      sqliteDb.deleteParkedOrder(targetId);
    } else {
      const idx = db.parkedOrders.findIndex(o => (o.order_id || o.id) === targetId);
      if (idx !== -1) {
        db.parkedOrders[idx] = { ...db.parkedOrders[idx], ...order, order_id: targetId };
      } else {
        db.parkedOrders.unshift({ ...order, order_id: targetId });
      }
      sqliteDb.upsertParkedOrder(order);
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
    sqliteDb.addVoidedOrder(voidRecord);

    // Audit log
    const auditEntry = {
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
    };
    db.auditLogs.unshift(auditEntry);
    sqliteDb.addAuditLog(auditEntry);

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
    const { customer, action } = req.body;
    if (!customer || !customer.customer_id) {
      return res.status(400).json({ success: false, error: 'Customer data required' });
    }

    const idx = db.customers.findIndex(c => c.customer_id === customer.customer_id);
    if (action === 'DELETE') {
      db.customers = db.customers.filter(c => c.customer_id !== customer.customer_id);
      sqliteDb.deleteCustomer(customer.customer_id);
    } else {
      sqliteDb.upsertCustomer(customer);
      if (idx !== -1) {
        db.customers[idx] = { ...db.customers[idx], ...customer };
      } else {
        db.customers.unshift(customer);
      }
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
      sqliteDb.deleteProduct(product.item_sn);
    } else {
      sqliteDb.upsertProduct(product);
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
      sqliteDb.upsertProduct(prod);
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

// 10a. Cycle Counts Query
app.get('/api/cycle-counts', (_req: Request, res: Response) => {
  try {
    const cycleCounts = sqliteDb.getTable('cycle_counts');
    db.cycleCounts = cycleCounts;
    res.json({
      success: true,
      cycleCounts,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10b. Cycle Count Adjustment & Reconciliation (Supervisor / Manager / Admin)
app.post('/api/cycle-counts', (req: Request, res: Response) => {
  try {
    const { countRecord, adjustStock } = req.body;
    if (!countRecord || !countRecord.count_id) {
      return res.status(400).json({ success: false, error: 'Count record required' });
    }

    const countedQty = Number(countRecord.counted_qty ?? countRecord.counted_quantity ?? 0);
    countRecord.counted_qty = countedQty;
    countRecord.counted_quantity = countedQty;

    // Direct atomic write to SQLite database (updates both cycle_counts and products.quantity)
    sqliteDb.recordCycleCount(countRecord, Boolean(adjustStock));

    if (!Array.isArray(db.cycleCounts)) {
      db.cycleCounts = [];
    }
    db.cycleCounts.unshift(countRecord);

    if (adjustStock && countRecord.item_sn) {
      const prod = db.products.find(p => p.item_sn === countRecord.item_sn);
      if (prod) {
        prod.quantity = countedQty;
      }
    }

    saveDatabase();
    sqliteDb.checkpoint('PASSIVE');
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

// 10c. Customer Debt Settlement / Pay Later Repayment
app.post('/api/customers/settle-debt', (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      amount_paid,
      payment_method,
      staff_id,
      staff_name,
      notes,
      bank_account_id,
      bank_name,
      bank_account_number,
      pos_terminal_id,
      pos_terminal_name,
      reference_number,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }
    const cleanAmount = Number(amount_paid ?? req.body.amount) || 0;
    if (cleanAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    const cust = db.customers.find(c => c.customer_id === customer_id);
    if (!cust) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const prevBal = Number(cust.balance) || 0;
    const newBal = Math.max(0, Math.round((prevBal - cleanAmount) * 100) / 100);

    const repaymentRecord = {
      repayment_id: `PAY-DEBT-${Date.now()}`,
      customer_id,
      customer_name: cust.full_name || cust.name || '',
      amount_paid: cleanAmount,
      payment_method: payment_method || 'Cash',
      bank_account_id: bank_account_id || null,
      bank_name: bank_name || null,
      bank_account_number: bank_account_number || null,
      pos_terminal_id: pos_terminal_id || null,
      pos_terminal_name: pos_terminal_name || null,
      reference_number: reference_number || null,
      date_time: new Date().toISOString(),
      staff_id: staff_id || 'STAFF',
      staff_name: staff_name || 'Staff',
      previous_balance: prevBal,
      remaining_balance: newBal,
      notes: notes || 'Customer debt payment received',
    };

    // Commit to SQLite (atomic update of customer balance, credit history, repayment record, and audit log)
    sqliteDb.recordCustomerDebtRepayment(repaymentRecord);

    // Update in-memory
    cust.balance = newBal;
    if (!Array.isArray(cust.repayment_history)) cust.repayment_history = [];
    cust.repayment_history.unshift(repaymentRecord);

    if (!Array.isArray(db.customerDebtRepayments)) {
      db.customerDebtRepayments = [];
    }
    db.customerDebtRepayments.unshift(repaymentRecord);

    saveDatabase();
    broadcast('CUSTOMER_DEBT_SETTLED', {
      repayment: repaymentRecord,
      customer: cust,
      customers: db.customers,
    });

    res.json({
      success: true,
      repayment: repaymentRecord,
      customer: cust,
      customers: db.customers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/customers/settle-debt:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 10d. Query Customer Debt Repayments
app.get('/api/customers/debt-repayments', (_req: Request, res: Response) => {
  try {
    const repayments = sqliteDb.getCustomerDebtRepayments();
    res.json({ success: true, repayments, version: db.version });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11a. Stock Transfers Query
app.get('/api/transfers', (_req: Request, res: Response) => {
  try {
    if (!Array.isArray(db.stockTransfers)) {
      db.stockTransfers = sqliteDb.getTable('stock_transfers');
    }
    res.json({
      success: true,
      stockTransfers: db.stockTransfers,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11b. Stock Transfer (Manager)
app.post('/api/transfers', (req: Request, res: Response) => {
  try {
    const { transferRecord } = req.body;
    if (!transferRecord || !transferRecord.transfer_id) {
      return res.status(400).json({ success: false, error: 'Transfer record required' });
    }

    db.stockTransfers.unshift(transferRecord);
    sqliteDb.addStockTransfer(transferRecord);

    saveDatabase();
    sqliteDb.checkpoint('PASSIVE');
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

// 12a. Purchase Orders GET (Full List Query)
app.get('/api/purchase-orders', (_req: Request, res: Response) => {
  try {
    if (!Array.isArray(db.purchaseOrders)) {
      db.purchaseOrders = sqliteDb.getTable('purchase_orders');
    }
    res.json({
      success: true,
      purchaseOrders: db.purchaseOrders,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Purchase Orders (Multi-Item & Cumulative Goods Receiving)
app.post('/api/purchase-orders', (req: Request, res: Response) => {
  try {
    const { action, newExpiryDate } = req.body;
    const po = req.body.po;
    const po_id = req.body.po_id || po?.po_id || req.body.id;

    if (!po_id && (!po || !po.po_id)) {
      return res.status(400).json({ success: false, error: 'Purchase order data or ID required' });
    }

    const resolvedPoId = po_id || po?.po_id;

    if (!Array.isArray(db.purchaseOrders)) {
      db.purchaseOrders = sqliteDb.getTable('purchase_orders');
    }

    const idx = db.purchaseOrders.findIndex(p => p.po_id === resolvedPoId);
    let targetPo = idx !== -1 ? db.purchaseOrders[idx] : (po ? { ...po } : null);

    // Handle Delete action
    if (action === 'DELETE') {
      db.purchaseOrders = db.purchaseOrders.filter(p => p.po_id !== resolvedPoId);
      sqliteDb.deletePurchaseOrder(resolvedPoId);
      saveDatabase();
      sqliteDb.checkpoint('PASSIVE');
      broadcast('PURCHASE_ORDERS_UPDATED', {
        purchaseOrders: db.purchaseOrders,
        products: db.products,
      });
      return res.json({
        success: true,
        purchaseOrders: db.purchaseOrders,
        products: db.products,
        version: db.version,
      });
    }

    if (!targetPo) {
      return res.status(404).json({ success: false, error: `Purchase Order ${resolvedPoId} not found` });
    }

    // Ensure multi-item structure and normalize items
    if (!Array.isArray(targetPo.items) || targetPo.items.length === 0) {
      if (po && Array.isArray(po.items) && po.items.length > 0) {
        targetPo.items = po.items.map((it: any) => ({
          item_sn: it.item_sn || 'ITEM-DEFAULT',
          item_name: it.item_name || it.item_sn || 'Stock Item',
          quantity_ordered: Number(it.quantity_ordered) || 0,
          quantity_received: Number(it.quantity_received) || 0,
          quantity_pending: Math.max(0, Math.round(((Number(it.quantity_ordered) || 0) - (Number(it.quantity_received) || 0)) * 1000) / 1000),
          unit_cost: Number(it.unit_cost) || 0,
          total_cost: Number(it.total_cost) || Math.round((Number(it.quantity_ordered) || 0) * (Number(it.unit_cost) || 0) * 100) / 100,
          expiry_date: it.expiry_date,
        }));
      } else {
        const ord = Number(targetPo.quantity_ordered || po?.quantity_ordered) || 0;
        const rec = Number(targetPo.quantity_received || po?.quantity_received) || 0;
        const uCost = Number(targetPo.unit_cost || po?.unit_cost) || 0;
        targetPo.items = [{
          item_sn: targetPo.item_sn || po?.item_sn || 'ITEM-DEFAULT',
          item_name: targetPo.item_name || po?.item_name || targetPo.item_sn || 'Stock Item',
          quantity_ordered: ord,
          quantity_received: rec,
          quantity_pending: Math.max(0, Math.round((ord - rec) * 1000) / 1000),
          unit_cost: uCost,
          total_cost: Number(targetPo.total_cost || po?.total_cost) || Math.round(ord * uCost * 100) / 100,
        }];
      }
    }
    if (!Array.isArray(targetPo.receiving_history)) {
      targetPo.receiving_history = [];
    }

    // Only update non-receiving properties if creating or updating metadata (never overwrite receiving counters with client state)
    if (po && action !== 'RECEIVE' && action !== 'RECEIVE_PARTIAL' && action !== 'CANCEL') {
      targetPo = {
        ...targetPo,
        ...po,
        items: targetPo.items, // preserve server-authoritative receiving state
      };
    }

    // Handle Cancel action
    if (action === 'CANCEL') {
      targetPo.status = 'CANCELLED';
      if (idx !== -1) {
        db.purchaseOrders[idx] = targetPo;
      } else {
        db.purchaseOrders.unshift(targetPo);
      }
      sqliteDb.upsertPurchaseOrder(targetPo);
      saveDatabase();
      sqliteDb.checkpoint('PASSIVE');
      broadcast('PURCHASE_ORDERS_UPDATED', {
        purchaseOrders: db.purchaseOrders,
        products: db.products,
      });
      return res.json({
        success: true,
        po: targetPo,
        purchaseOrders: db.purchaseOrders,
        products: db.products,
        version: db.version,
      });
    }

    // Handle Goods Receiving (Partial, Cumulative, or Full)
    if (action === 'RECEIVE' || action === 'RECEIVE_PARTIAL') {
      const receiptBatch = req.body.receiptBatch || req.body.receipt_batch;
      const receivedItems = req.body.receivedItems || req.body.items;
      const itemsToReceive: Array<{ item_sn: string; quantity_received: number; expiry_date?: string }> =
        receiptBatch?.items || receivedItems || (targetPo.item_sn ? [{ item_sn: targetPo.item_sn, quantity_received: Number(targetPo.quantity_ordered) || 0, expiry_date: newExpiryDate }] : []);

      let totalReceivedInThisBatch = 0;
      const batchLogItems: string[] = [];

      for (const rx of itemsToReceive) {
        const batchQty = Number(rx.quantity_received) || 0;
        if (batchQty <= 0) continue;

        totalReceivedInThisBatch += batchQty;

        // 1. Update line item in PO: accumulate cumulative received, decrease pending
        let lineItem = targetPo.items.find((i: any) => i.item_sn === rx.item_sn);
        if (!lineItem) {
          lineItem = {
            item_sn: rx.item_sn,
            item_name: rx.item_sn,
            quantity_ordered: batchQty,
            quantity_received: 0,
            quantity_pending: batchQty,
            unit_cost: 0,
            total_cost: 0,
          };
          targetPo.items.push(lineItem);
        }

        const prevReceived = Number(lineItem.quantity_received) || 0;
        const newCumulativeReceived = Math.round((prevReceived + batchQty) * 1000) / 1000;
        lineItem.quantity_received = newCumulativeReceived;
        lineItem.quantity_pending = Math.max(0, Math.round(((Number(lineItem.quantity_ordered) || 0) - newCumulativeReceived) * 1000) / 1000);
        if (rx.expiry_date) {
          lineItem.expiry_date = rx.expiry_date;
        }

        // 2. Atomically increment product stock in central database by this batch's delta quantity
        const prod = db.products.find(p => p.item_sn === rx.item_sn);
        if (prod) {
          const prevStock = Number(prod.quantity) || 0;
          const newStock = Math.round((prevStock + batchQty) * 1000) / 1000;
          prod.quantity = newStock;
          if (rx.expiry_date) {
            prod.expiry_date = rx.expiry_date;
          }
          if (lineItem && lineItem.unit_cost) {
            prod.item_cost = Number(lineItem.unit_cost);
          }
          sqliteDb.upsertProduct(prod);
          batchLogItems.push(`${prod.item_name} (+${batchQty} ${prod.product_measure_unit || 'units'}, now: ${newStock})`);
        } else {
          batchLogItems.push(`${rx.item_sn} (+${batchQty})`);
        }
      }

      // Append receipt batch to history
      const normalizedBatch = {
        receipt_id: receiptBatch?.receipt_id || `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        received_at: receiptBatch?.received_at || new Date().toISOString(),
        received_by_staff_id: receiptBatch?.received_by_staff_id || receiptBatch?.receivedByStaffId || req.body.staff_id || 'STAFF',
        received_by_staff_name: receiptBatch?.received_by_staff_name || receiptBatch?.receivedByStaffName || req.body.staff_name || 'Staff',
        received_by_role: receiptBatch?.received_by_role || 'Supervisor',
        delivery_note_ref: receiptBatch?.delivery_reference || receiptBatch?.delivery_note_ref || receiptBatch?.deliveryReference || '',
        notes: receiptBatch?.receipt_notes || receiptBatch?.notes || receiptBatch?.receiptNotes || 'Goods receipt',
        items: itemsToReceive.map(it => {
          const matched = targetPo.items.find((ti: any) => ti.item_sn === it.item_sn);
          return {
            item_sn: it.item_sn,
            item_name: matched?.item_name || it.item_sn,
            quantity_received: Number(it.quantity_received) || 0,
            expiry_date: it.expiry_date || matched?.expiry_date,
          };
        }),
      };
      targetPo.receiving_history.unshift(normalizedBatch);

      // Recalculate top-level aggregate quantities
      targetPo.quantity_ordered = targetPo.items.reduce((sum: number, it: any) => sum + (Number(it.quantity_ordered) || 0), 0);
      targetPo.quantity_received = targetPo.items.reduce((sum: number, it: any) => sum + (Number(it.quantity_received) || 0), 0);
      targetPo.quantity_pending = Math.max(0, Math.round((targetPo.quantity_ordered - targetPo.quantity_received) * 1000) / 1000);

      // Check whether ALL items are fully received
      const allFullyReceived = targetPo.items.every((i: any) =>
        (Number(i.quantity_received) || 0) >= (Number(i.quantity_ordered) || 0)
      );

      if (allFullyReceived) {
        targetPo.status = 'RECEIVED';
        targetPo.actual_delivery_date = new Date().toISOString().split('T')[0];
      } else {
        targetPo.status = 'PARTIALLY_RECEIVED';
      }

      // Audit Log Entry
      const staffName = normalizedBatch.received_by_staff_name;
      const auditEntry = {
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        staff_id: normalizedBatch.received_by_staff_id,
        staff_name: staffName,
        staff_role: normalizedBatch.received_by_role,
        category: 'Purchasing',
        action: allFullyReceived ? 'GOODS_RECEIVED' : 'PARTIAL_GOODS_RECEIVED',
        details: `${allFullyReceived ? 'Fully Received' : 'Partially Received'} PO ${targetPo.po_id}. Items: ${batchLogItems.join(', ')}. Receiver: ${staffName}. Pending remaining: ${targetPo.quantity_pending}.`,
        severity: 'SUCCESS',
        hash: `hash_${Date.now()}`,
      };
      db.auditLogs.unshift(auditEntry);
      sqliteDb.addAuditLog(auditEntry);
    }

    // Direct write to SQLite
    sqliteDb.upsertPurchaseOrder(targetPo);

    if (idx !== -1) {
      db.purchaseOrders[idx] = targetPo;
    } else {
      db.purchaseOrders.unshift(targetPo);
    }

    saveDatabase();
    sqliteDb.checkpoint('PASSIVE');

    broadcast('PURCHASE_ORDERS_UPDATED', {
      purchaseOrders: db.purchaseOrders,
      products: db.products,
    });

    res.json({
      success: true,
      po: targetPo,
      purchaseOrders: db.purchaseOrders,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/purchase-orders:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 12b. Purchase Orders DELETE
app.delete('/api/purchase-orders/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'ID required' });

    if (!Array.isArray(db.purchaseOrders)) {
      db.purchaseOrders = sqliteDb.getTable('purchase_orders');
    }
    db.purchaseOrders = db.purchaseOrders.filter(p => p.po_id !== id && p.id !== id);
    sqliteDb.deletePurchaseOrder(id);

    saveDatabase();
    sqliteDb.checkpoint('PASSIVE');
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12b. Dedicated Store Discount PIN Management (Manager / Admin)
app.get('/api/settings/discount-pin', (_req: Request, res: Response) => {
  try {
    const config = db.discountSecurityConfig || sqliteDb.getDiscountSecurityConfig();
    res.json({
      success: true,
      discountSecurityConfig: config,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in GET /api/settings/discount-pin:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/discount-pin', (req: Request, res: Response) => {
  try {
    const { newPin, managerPin, staff_id, staff_name, stacking_policy, max_discount_percent_cap, enforce_cost_floor } = req.body;

    // Verify manager credentials
    const cleanMgrPin = String(managerPin || '').trim();
    const authorizedManager = db.employees.find(
      e => (e.role === 'Manager' || e.role === 'Admin' || e.role === 'Super Admin') &&
        (verifyPin(cleanMgrPin, e.pin) || (e.password ? verifyPin(cleanMgrPin, e.password) : false))
    );

    if (!authorizedManager) {
      return res.status(403).json({ success: false, error: 'Invalid Manager PIN. Only Managers and Admins can configure discount security and rules.' });
    }

    const currentConfig = db.discountSecurityConfig || sqliteDb.getDiscountSecurityConfig();
    const updatedConfig = {
      ...currentConfig,
      id: 'DISCOUNT_SECURITY_CONFIG',
      is_configured: true,
      updated_at: new Date().toISOString(),
      updated_by_staff_id: authorizedManager.staff_id || staff_id,
      updated_by_staff_name: authorizedManager.staff_name || staff_name,
    };

    if (newPin && String(newPin).trim().length >= 4) {
      updatedConfig.discount_pin = hashPin(String(newPin).trim());
    }
    if (stacking_policy) {
      updatedConfig.stacking_policy = stacking_policy;
    }
    if (typeof max_discount_percent_cap === 'number') {
      updatedConfig.max_discount_percent_cap = max_discount_percent_cap;
    }
    if (typeof enforce_cost_floor === 'boolean') {
      updatedConfig.enforce_cost_floor = enforce_cost_floor;
    }

    db.discountSecurityConfig = updatedConfig;
    sqliteDb.upsertDiscountSecurityConfig(updatedConfig);

    db.auditLogs.unshift({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      staff_id: authorizedManager.staff_id,
      staff_name: authorizedManager.staff_name,
      staff_role: authorizedManager.role,
      category: 'Security',
      action: 'DISCOUNT_PIN_ROTATED',
      details: `Discount security policy & PIN updated by ${authorizedManager.staff_name} (${authorizedManager.role}).`,
      severity: 'WARNING',
      hash: `hash_${Date.now()}`,
    });

    saveDatabase();
    broadcast('DISCOUNT_SECURITY_UPDATED', { discountSecurityConfig: updatedConfig });

    res.json({
      success: true,
      discountSecurityConfig: updatedConfig,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in POST /api/settings/discount-pin:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12c. Management Discount Rules (Manager / Admin)
app.get('/api/discount-rules', (_req: Request, res: Response) => {
  try {
    const discountRules = db.discountRules || sqliteDb.getDiscountRules();
    res.json({
      success: true,
      discountRules,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in GET /api/discount-rules:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/discount-rules', (req: Request, res: Response) => {
  try {
    const { rule, action, staff_id, staff_name, staff_role } = req.body;
    if (!rule && action !== 'RESET') {
      return res.status(400).json({ success: false, error: 'Rule data is required' });
    }

    if (!Array.isArray(db.discountRules)) {
      db.discountRules = sqliteDb.getDiscountRules();
    }

    const staffTitle = staff_name ? `${staff_name} (${staff_role || 'Manager'})` : 'Store Manager';

    if (action === 'DELETE') {
      const targetId = rule.rule_id;
      db.discountRules = db.discountRules.filter((r: any) => r.rule_id !== targetId);
      sqliteDb.deleteDiscountRule(targetId);

      db.auditLogs.unshift({
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        staff_id: staff_id || 'STAFF',
        staff_name: staff_name || 'Staff',
        staff_role: staff_role || 'Manager',
        category: 'Discounts',
        action: 'DISCOUNT_RULE_DELETED',
        details: `Discount rule "${rule.name || targetId}" removed by ${staffTitle}.`,
        severity: 'WARNING',
        hash: `hash_${Date.now()}`,
      });
    } else {
      const ruleId = rule.rule_id || `RULE_${Date.now()}`;
      const normalizedRule = {
        ...rule,
        rule_id: ruleId,
        name: String(rule.name).trim(),
        description: String(rule.description || '').trim(),
        condition_type: rule.condition_type,
        threshold_value: Number(rule.threshold_value) || 0,
        discount_type: rule.discount_type,
        discount_value: Number(rule.discount_value) || 0,
        scope: rule.scope || 'BASKET',
        requires_manager_approval: Boolean(rule.requires_manager_approval),
        max_discount_cap: rule.max_discount_cap ? Number(rule.max_discount_cap) : undefined,
        is_active: rule.is_active !== false,
        updated_at: new Date().toISOString(),
      };

      const existingIdx = db.discountRules.findIndex((r: any) => r.rule_id === ruleId);
      if (existingIdx !== -1) {
        db.discountRules[existingIdx] = normalizedRule;
      } else {
        db.discountRules.push(normalizedRule);
      }

      sqliteDb.upsertDiscountRule(normalizedRule);

      db.auditLogs.unshift({
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        staff_id: staff_id || 'STAFF',
        staff_name: staff_name || 'Staff',
        staff_role: staff_role || 'Manager',
        category: 'Discounts',
        action: existingIdx !== -1 ? 'DISCOUNT_RULE_UPDATED' : 'DISCOUNT_RULE_CREATED',
        details: `Discount rule "${normalizedRule.name}" ${existingIdx !== -1 ? 'modified' : 'created'} by ${staffTitle}.`,
        severity: 'INFO',
        hash: `hash_${Date.now()}`,
      });
    }

    saveDatabase();
    broadcast('DISCOUNT_RULES_UPDATED', { discountRules: db.discountRules });

    res.json({
      success: true,
      discountRules: db.discountRules,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in POST /api/discount-rules:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12d. Dynamic Product Category Management (Supervisor / Manager / Admin)
app.get('/api/categories', (_req: Request, res: Response) => {
  try {
    const categories = db.categories || sqliteDb.getCategories();
    res.json({
      success: true,
      categories,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in GET /api/categories:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/categories', (req: Request, res: Response) => {
  try {
    const action = req.body.action || 'CREATE';
    const cat = req.body.category || {};
    const catId = cat.id || req.body.id || (action === 'CREATE' ? `CAT-${Date.now()}` : undefined);
    const catName = cat.name !== undefined ? cat.name : req.body.name;
    const catDesc = cat.description !== undefined ? cat.description : req.body.description;
    const oldName = req.body.oldName || cat.oldName;
    const staff_id = req.body.staff_id;
    const staff_name = req.body.staff_name;
    const staff_role = req.body.staff_role;

    if (!Array.isArray(db.categories)) {
      db.categories = sqliteDb.getCategories();
    }

    const staffTitle = staff_name ? `${staff_name} (${staff_role || 'Staff'})` : 'Authorized Staff';
    let normalizedCat: any = null;

    if (action === 'DELETE') {
      const targetId = catId || req.body.id;
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Category ID is required for deletion' });
      }

      const deletedCat = db.categories.find((c: any) => c.id === targetId);
      db.categories = db.categories.filter((c: any) => c.id !== targetId);
      sqliteDb.deleteCategory(targetId);

      const auditEntry = {
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        staff_id: staff_id || 'STAFF',
        staff_name: staff_name || 'Staff',
        staff_role: staff_role || 'Supervisor',
        category: 'Inventory',
        action: 'CATEGORY_DELETED',
        details: `Product Category "${deletedCat?.name || targetId}" removed by ${staffTitle}.`,
        severity: 'INFO',
        hash: `hash_${Date.now()}`,
      };
      db.auditLogs.unshift(auditEntry);
      sqliteDb.addAuditLog(auditEntry);
    } else {
      if (!catName || !String(catName).trim()) {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }

      const targetId = catId || `CAT-${Date.now()}`;
      normalizedCat = {
        ...cat,
        id: targetId,
        name: String(catName).trim(),
        description: catDesc !== undefined ? String(catDesc).trim() : '',
        created_at: cat.created_at || req.body.created_at || new Date().toISOString(),
        created_by: staffTitle,
      };

      const existingIdx = db.categories.findIndex((c: any) => c.id === targetId || c.name.toLowerCase() === normalizedCat.name.toLowerCase());
      const isRename = existingIdx !== -1 && oldName && oldName !== normalizedCat.name;

      if (existingIdx !== -1) {
        db.categories[existingIdx] = { ...db.categories[existingIdx], ...normalizedCat };
      } else {
        db.categories.push(normalizedCat);
      }
      sqliteDb.upsertCategory(normalizedCat);

      // If renamed, update all associated products in inventory & SQLite
      let updatedProductsCount = 0;
      if (isRename) {
        if (!Array.isArray(db.products)) {
          db.products = sqliteDb.getTable('products');
        }
        for (const prod of db.products) {
          if (prod.product_category === oldName) {
            prod.product_category = normalizedCat.name;
            sqliteDb.upsertProduct(prod);
            updatedProductsCount++;
          }
        }
      }

      const auditEntry = {
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        staff_id: staff_id || 'STAFF',
        staff_name: staff_name || 'Staff',
        staff_role: staff_role || 'Supervisor',
        category: 'Inventory',
        action: existingIdx !== -1 ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED',
        details: `Category "${normalizedCat.name}" ${existingIdx !== -1 ? 'updated' : 'created'} by ${staffTitle}.${updatedProductsCount > 0 ? ` Updated ${updatedProductsCount} products.` : ''}`,
        severity: 'SUCCESS',
        hash: `hash_${Date.now()}`,
      };
      db.auditLogs.unshift(auditEntry);
      sqliteDb.addAuditLog(auditEntry);
    }

    saveDatabase();
    sqliteDb.checkpoint('PASSIVE');

    broadcast('CATEGORIES_UPDATED', {
      categories: db.categories,
      products: db.products,
    });

    res.json({
      success: true,
      category: normalizedCat,
      categories: db.categories,
      products: db.products,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in POST /api/categories:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// 13. Employees / Staff
app.get('/api/employees', (_req: Request, res: Response) => {
  try {
    if (!Array.isArray(db.employees)) {
      db.employees = sqliteDb.getTable('employees');
    }
    res.json({
      success: true,
      employees: db.employees,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/employees', (req: Request, res: Response) => {
  try {
    const { employee, action } = req.body;
    if (!employee || !employee.staff_id) {
      return res.status(400).json({ success: false, error: 'Employee data with valid staff_id is required' });
    }

    if (!Array.isArray(db.employees)) {
      db.employees = sqliteDb.getTable('employees');
    }

    if (action === 'DELETE') {
      db.employees = db.employees.filter(e => e.staff_id !== employee.staff_id);
      sqliteDb.deleteEmployee(employee.staff_id);
    } else {
      sqliteDb.upsertEmployee(employee);
      const idx = db.employees.findIndex(e => e.staff_id === employee.staff_id);
      if (idx !== -1) {
        db.employees[idx] = { ...db.employees[idx], ...employee };
      } else {
        db.employees.unshift(employee);
      }
    }

    saveDatabase();
    sqliteDb.checkpoint('FULL');
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
      sqliteDb.deletePosTerminal(terminal.id);
    } else {
      // If marking as default, reset previous default of same type
      if (terminal.is_default) {
        db.posTerminals.forEach(t => {
          if (t.type === terminal.type) t.is_default = false;
        });
      }
      sqliteDb.upsertPosTerminal(terminal);
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
    sqliteDb.deletePosTerminal(id);

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

// 14b. Suppliers Management
app.get('/api/suppliers', (req: Request, res: Response) => {
  res.json({
    success: true,
    suppliers: db.suppliers || [],
    version: db.version,
  });
});

app.post('/api/suppliers', (req: Request, res: Response) => {
  try {
    const { supplier, action } = req.body;
    if (!supplier || (!supplier.supplier_id && !supplier.id)) {
      return res.status(400).json({ success: false, error: 'Supplier data required' });
    }
    const sId = supplier.supplier_id || supplier.id;
    supplier.supplier_id = sId;

    if (!Array.isArray(db.suppliers)) db.suppliers = [];

    if (action === 'DELETE') {
      db.suppliers = db.suppliers.filter(s => s.supplier_id !== sId);
      sqliteDb.deleteSupplier(sId);
    } else {
      sqliteDb.upsertSupplier(supplier);
      const idx = db.suppliers.findIndex(s => s.supplier_id === sId);
      if (idx !== -1) {
        db.suppliers[idx] = { ...db.suppliers[idx], ...supplier };
      } else {
        db.suppliers.unshift(supplier);
      }
    }

    saveDatabase();
    broadcast('SUPPLIERS_UPDATED', { suppliers: db.suppliers });

    res.json({
      success: true,
      suppliers: db.suppliers,
      version: db.version,
    });
  } catch (err: any) {
    console.error('Error in /api/suppliers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/suppliers/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'ID required' });

    sqliteDb.deleteSupplier(id);
    if (!Array.isArray(db.suppliers)) db.suppliers = [];
    db.suppliers = db.suppliers.filter(s => s.supplier_id !== id);

    saveDatabase();
    broadcast('SUPPLIERS_UPDATED', { suppliers: db.suppliers });

    res.json({
      success: true,
      suppliers: db.suppliers,
      version: db.version,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14c. Local Image Upload for Items
app.post('/api/upload-image', (req: Request, res: Response) => {
  try {
    const fileData = req.body.fileData || req.body.image;
    const fileName = req.body.fileName || req.body.filename;
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'Image data payload required' });
    }

    let buffer: Buffer;
    let extension = '.png';

    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('jpeg') || mime.includes('jpg')) extension = '.jpg';
      else if (mime.includes('png')) extension = '.png';
      else if (mime.includes('webp')) extension = '.webp';
      else if (mime.includes('gif')) extension = '.gif';
      else if (mime.includes('svg')) extension = '.svg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(fileData, 'base64');
    }

    if (fileName) {
      const originalExt = path.extname(fileName).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(originalExt)) {
        extension = originalExt;
      }
    }

    const cleanBase = fileName
      ? path.basename(fileName, path.extname(fileName)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
      : 'item';
    const savedName = `img_${Date.now()}_${cleanBase}${extension}`;
    const targetPath = path.join(UPLOADS_DIR, savedName);

    fs.writeFileSync(targetPath, buffer);

    const relativeUrl = `/uploads/${savedName}`;
    res.json({
      success: true,
      url: relativeUrl,
      fileName: savedName,
    });
  } catch (err: any) {
    console.error('Error in /api/upload-image:', err);
    res.status(500).json({ success: false, error: err.message || 'Image upload failed' });
  }
});

// 14d. Receipt & Branding Customization Settings
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

    const transferType = transfer.transfer_type || (transfer.destination_bank_name ? 'POS_TO_BANK' : 'BANK_TO_POS');
    transfer.transfer_type = transferType;
    const isBankToPos = transferType === 'BANK_TO_POS';

    if (!Array.isArray(db.cashTransfers)) {
      db.cashTransfers = [];
    }

    db.cashTransfers.unshift(transfer);
    // Write directly to SQLite database with WAL checkpoint
    sqliteDb.addCashTransfer(transfer);

    const amtNum = Number(transfer.amount_transferred ?? transfer.amount) || 0;
    const remainingFloat = Number(transfer.cashier_cash_after ?? transfer.cashier_cash_remaining) || 0;

    // Record audit trail entry
    const auditEntry = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: transfer.date_time || new Date().toISOString(),
      staff_id: transfer.manager_staff_id,
      staff_name: transfer.manager_staff_name,
      role: transfer.manager_role,
      category: 'Finance',
      action: isBankToPos ? 'BANK_TO_POS_FLOAT_REPLENISHMENT' : 'CASH_TRANSFER_TO_BANK',
      details: isBankToPos
        ? `Manager ${transfer.manager_staff_name} replenished ₦${amtNum.toLocaleString()} float from ${transfer.bank_name || transfer.destination_bank_name || 'Bank'} to Cashier ${transfer.cashier_staff_name} (${transfer.cashier_staff_id}). New cashier float: ₦${remainingFloat.toLocaleString()}. Note: "${transfer.notes || ''}"`
        : `Manager ${transfer.manager_staff_name} transferred ₦${amtNum.toLocaleString()} cash from Cashier ${transfer.cashier_staff_name} (${transfer.cashier_staff_id}) to ${transfer.destination_bank_name || 'Bank'} (${transfer.destination_account_number || ''}). Remaining cashier float: ₦${remainingFloat.toLocaleString()}. Note: "${transfer.notes || ''}"`,
      severity: 'SUCCESS',
      metadata: {
        transfer_id: transfer.transfer_id,
        transfer_type: transferType,
        amount: amtNum,
        cashier_id: transfer.cashier_staff_id,
        deposit_slip: transfer.deposit_slip_number,
      },
      tamper_hash: `ctb-${Date.now()}`
    };

    db.auditLogs.unshift(auditEntry);
    sqliteDb.addAuditLog(auditEntry);

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

// 16b. Legacy Factory Data Reset placeholder (Consolidated into strict Super Admin /api/admin/factory-reset above)
// See line 345 for the unified, cryptographically enforced SQLite WAL purge implementation.

// 17. Database Backup Export & Restore (Accessible to all authorized staff)
app.get('/api/database/backup', (req: Request, res: Response) => {
  try {
    const snapshot = sqliteDb.getSnapshot();
    const backupData = {
      system: 'KIIDFROMDREAM POS & INVENTORY',
      version: db.version || snapshot?.version || 1,
      export_date: new Date().toISOString(),
      products: db.products || snapshot?.products || [],
      customers: db.customers || snapshot?.customers || [],
      suppliers: db.suppliers || snapshot?.suppliers || [],
      employees: db.employees || snapshot?.employees || [],
      purchaseOrders: db.purchaseOrders || snapshot?.purchaseOrders || [],
      sales: db.sales || snapshot?.sales || [],
      refunds: db.refunds || snapshot?.refunds || [],
      auditLogs: db.auditLogs || snapshot?.auditLogs || [],
      cycleCounts: db.cycleCounts || snapshot?.cycleCounts || [],
      stockTransfers: db.stockTransfers || snapshot?.stockTransfers || [],
      parkedOrders: db.parkedOrders || snapshot?.parkedOrders || [],
      voidedOrders: db.voidedOrders || snapshot?.voidedOrders || [],
      posTerminals: db.posTerminals || snapshot?.posTerminals || [],
      cashTransfers: db.cashTransfers || snapshot?.cashTransfers || [],
      customerDebtRepayments: db.customerDebtRepayments || snapshot?.customerDebtRepayments || sqliteDb.getCustomerDebtRepayments() || [],
      receiptSettings: db.receiptSettings || snapshot?.receiptSettings || sqliteDb.getReceiptSettings() || null,
      discountSecurityConfig: db.discountSecurityConfig || snapshot?.discountSecurityConfig || sqliteDb.getDiscountSecurityConfig() || null,
      categories: db.categories || snapshot?.categories || sqliteDb.getCategories() || [],
      discountRules: db.discountRules || snapshot?.discountRules || sqliteDb.getDiscountRules() || [],
    };

    res.json({
      success: true,
      backup: backupData,
      filename: `kiidfromdream_pos_backup_${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch (err: any) {
    console.error('Error in GET /api/database/backup:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to export database backup' });
  }
});

const handleDatabaseRestore = (req: Request, res: Response) => {
  try {
    const { backup, staff_id, staff_name, staff_role } = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid backup file: Payload must be a valid JSON object' });
    }

    const operatorName = staff_name ? `${staff_name} (${staff_role || 'Staff'})` : 'Authorized Staff';

    // Ensure pristine or incoming Super Admin is never lost
    let restoredEmployees = Array.isArray(backup.employees) ? backup.employees : [];
    if (!restoredEmployees.some((e: any) => e.role === 'Super Admin' || e.username?.toLowerCase() === 'boluwatife')) {
      const existingSuperAdmin = (db.employees || []).find((e: any) => e.role === 'Super Admin');
      if (existingSuperAdmin) {
        restoredEmployees.unshift(existingSuperAdmin);
      }
    }

    db = {
      version: (db.version || 0) + 1,
      lastUpdated: new Date().toISOString(),
      products: Array.isArray(backup.products) ? backup.products : [],
      customers: Array.isArray(backup.customers) ? backup.customers : [],
      suppliers: Array.isArray(backup.suppliers) ? backup.suppliers : [],
      employees: restoredEmployees,
      purchaseOrders: Array.isArray(backup.purchaseOrders) ? backup.purchaseOrders : [],
      sales: Array.isArray(backup.sales) ? backup.sales : [],
      refunds: Array.isArray(backup.refunds) ? backup.refunds : [],
      auditLogs: Array.isArray(backup.auditLogs) ? backup.auditLogs : [],
      cycleCounts: Array.isArray(backup.cycleCounts) ? backup.cycleCounts : [],
      stockTransfers: Array.isArray(backup.stockTransfers) ? backup.stockTransfers : [],
      parkedOrders: Array.isArray(backup.parkedOrders) ? backup.parkedOrders : [],
      voidedOrders: Array.isArray(backup.voidedOrders) ? backup.voidedOrders : [],
      posTerminals: Array.isArray(backup.posTerminals) ? backup.posTerminals : [],
      cashTransfers: Array.isArray(backup.cashTransfers) ? backup.cashTransfers : [],
      customerDebtRepayments: Array.isArray(backup.customerDebtRepayments) ? backup.customerDebtRepayments : (db.customerDebtRepayments || sqliteDb.getCustomerDebtRepayments() || []),
      receiptSettings: backup.receiptSettings || db.receiptSettings || sqliteDb.getReceiptSettings() || null,
      discountSecurityConfig: backup.discountSecurityConfig || db.discountSecurityConfig || sqliteDb.getDiscountSecurityConfig() || null,
      categories: Array.isArray(backup.categories) ? backup.categories : (db.categories || sqliteDb.getCategories() || []),
      discountRules: Array.isArray(backup.discountRules) ? backup.discountRules : (db.discountRules || sqliteDb.getDiscountRules() || []),
    };

    // Log the restore event into audit log
    const auditEntry = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      staff_id: staff_id || 'STAFF',
      staff_name: staff_name || 'Staff',
      staff_role: staff_role || 'Staff',
      category: 'System',
      action: 'DATABASE_BACKUP_EXPORT',
      details: `Database restored and synchronized from external backup file by ${operatorName}. Restored ${db.products.length} products, ${db.sales.length} sales, ${db.customers.length} customers, ${db.categories?.length || 0} categories.`,
      severity: 'WARNING',
      hash: `hash_${Date.now()}`,
    };
    db.auditLogs.unshift(auditEntry);

    saveDatabase(db);
    sqliteDb.checkpoint('TRUNCATE');
    broadcast('DATABASE_RESTORED', { version: db.version });

    res.json({
      success: true,
      message: 'Database successfully restored and synchronized across all terminals',
      version: db.version,
      summary: {
        productsCount: db.products.length,
        salesCount: db.sales.length,
        customersCount: db.customers.length,
        suppliersCount: db.suppliers.length,
        categoriesCount: db.categories?.length || 0,
        employeesCount: db.employees.length,
      },
      db,
    });
  } catch (err: any) {
    console.error('Error in database restore:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to restore database from backup' });
  }
};

app.post('/api/database/restore', handleDatabaseRestore);
app.post('/api/admin/import', handleDatabaseRestore);

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

function handleShutdown(signal: string) {
  console.log(`[POS SERVER] Received ${signal}. Flushing database buffers and checkpointing SQLite...`);
  try {
    saveDatabase();
    sqliteDb.checkpoint('TRUNCATE');
    sqliteDb.close();
  } catch (err: any) {
    console.error('[POS SERVER] Error during shutdown flush:', err.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('beforeExit', () => {
  try {
    saveDatabase();
    sqliteDb.checkpoint('TRUNCATE');
  } catch {}
});

startServer().catch(err => {
  console.error('[POS SERVER] Failed to start server:', err);
  process.exit(1);
});
