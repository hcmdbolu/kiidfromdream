import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'pos_database.json');
const SEED_FILE = path.resolve(__dirname, 'src', 'data', 'seedData.json');

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

function loadDatabase(): CentralDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sales) && Array.isArray(parsed.products)) {
        if (!Array.isArray(parsed.parkedOrders)) parsed.parkedOrders = [];
        if (!Array.isArray(parsed.voidedOrders)) parsed.voidedOrders = [];
        if (!Array.isArray(parsed.posTerminals) || parsed.posTerminals.length === 0) {
          try {
            const rawSeed = fs.readFileSync(SEED_FILE, 'utf-8');
            const seed = JSON.parse(rawSeed);
            parsed.posTerminals = seed.posTerminals || [];
          } catch {}
        }
        if (!Array.isArray(parsed.cashTransfers) || parsed.cashTransfers.length === 0) {
          try {
            const rawSeed = fs.readFileSync(SEED_FILE, 'utf-8');
            const seed = JSON.parse(rawSeed);
            parsed.cashTransfers = seed.cashTransfers || [];
          } catch {}
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading existing database, falling back to seed:', err);
  }

  // Load from seedData.json
  try {
    const rawSeed = fs.readFileSync(SEED_FILE, 'utf-8');
    const seed = JSON.parse(rawSeed);
    const initialDb: CentralDatabase = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      products: seed.products || [],
      customers: seed.customers || [],
      suppliers: seed.suppliers || [],
      employees: seed.employees || [],
      purchaseOrders: seed.purchaseOrders || [],
      sales: seed.sales || [],
      refunds: seed.refunds || [],
      auditLogs: seed.auditLogs || [],
      cycleCounts: seed.cycleCounts || [],
      stockTransfers: seed.stockTransfers || [],
      parkedOrders: seed.parkedOrders || [],
      voidedOrders: seed.voidedOrders || [],
      posTerminals: seed.posTerminals || [],
      cashTransfers: seed.cashTransfers || [],
    };
    saveDatabase(initialDb);
    return initialDb;
  } catch (err) {
    console.error('Fatal error loading seedData.json:', err);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      products: [],
      customers: [],
      suppliers: [],
      employees: [],
      purchaseOrders: [],
      sales: [],
      refunds: [],
      auditLogs: [],
      cycleCounts: [],
      stockTransfers: [],
      parkedOrders: [],
      voidedOrders: [],
      posTerminals: [],
      cashTransfers: [],
    };
  }
}

function saveDatabase(dataToSave: CentralDatabase = db): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    dataToSave.version = (dataToSave.version || 0) + 1;
    dataToSave.lastUpdated = new Date().toISOString();

    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save database to disk:', err);
    return false;
  }
}

// Initialize database in memory
db = loadDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Health & Server Status
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

    // 2. Restock product in central database
    if (refund.item_sn) {
      const prod = db.products.find(p => p.item_sn === refund.item_sn);
      if (prod) {
        prod.quantity += Number(refund.quantity_refunded) || 0;
      }
    }

    // 3. Update original sale transaction status
    if (refund.original_transaction_id) {
      const originalTx = db.sales.find(s => s.transaction_id === refund.original_transaction_id);
      if (originalTx) {
        originalTx.status = 'REFUNDED';
      }
    }

    // 4. Audit
    db.auditLogs.unshift({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: refund.date_time || new Date().toISOString(),
      staff_id: refund.staff_id || 'STAFF',
      staff_name: refund.staff_id,
      staff_role: 'Supervisor',
      category: 'REFUNDS',
      action: 'REFUND_ISSUED',
      details: `Refund ${refund.refund_id} for ₦${refund.refund_amount?.toLocaleString()} processed (Restocked ${refund.quantity_refunded}KG ${refund.item_name})`,
      severity: 'MEDIUM',
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
app.post('/api/orders/void', (req: Request, res: Response) => {
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

// 17. Admin Backup Import
app.post('/api/admin/import', (req: Request, res: Response) => {
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
    };

    saveDatabase(db);
    broadcast('DATABASE_RESTORED', { version: db.version });

    res.json({ success: true, message: 'Database imported successfully', version: db.version, db });
  } catch (err: any) {
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[POS SERVER] Centralized DB server running on port ${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch(err => {
  console.error('[POS SERVER] Failed to start server:', err);
  process.exit(1);
});
