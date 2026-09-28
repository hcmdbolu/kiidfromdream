import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabaseMetadata {
  version: number;
  lastUpdated: string;
}

export class PosDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dataDir?: string) {
    const resolvedDataDir = dataDir || process.env.POS_DATA_DIR || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(resolvedDataDir)) {
      fs.mkdirSync(resolvedDataDir, { recursive: true });
    }

    this.dbPath = path.resolve(resolvedDataDir, 'pos_database.db');
    console.log(`[SQLITE] Initializing database at: ${this.dbPath}`);

    this.db = new DatabaseSync(this.dbPath);

    // Performance and concurrency pragmas
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.initSchema();
    this.autoMigrateFromJson(resolvedDataDir);
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        item_sn TEXT PRIMARY KEY,
        item_name TEXT,
        quantity REAL,
        selling_price REAL,
        status TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(item_name);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

      CREATE TABLE IF NOT EXISTS customers (
        customer_id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        balance REAL,
        status TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

      CREATE TABLE IF NOT EXISTS suppliers (
        supplier_id TEXT PRIMARY KEY,
        supplier_name TEXT,
        status TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS employees (
        staff_id TEXT PRIMARY KEY,
        staff_name TEXT,
        username TEXT,
        role TEXT,
        pin TEXT,
        status TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
      CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        po_number TEXT,
        supplier_id TEXT,
        status TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sales (
        transaction_id TEXT PRIMARY KEY,
        invoice_number TEXT,
        timestamp TEXT,
        cashier_id TEXT,
        pos_terminal_id TEXT,
        customer_id TEXT,
        final_amount REAL,
        payment_method TEXT,
        status TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
      CREATE INDEX IF NOT EXISTS idx_sales_terminal ON sales(pos_terminal_id);

      CREATE TABLE IF NOT EXISTS refunds (
        refund_id TEXT PRIMARY KEY,
        original_transaction_id TEXT,
        item_sn TEXT,
        date_time TEXT,
        staff_id TEXT,
        refund_amount REAL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refunds_orig_tx ON refunds(original_transaction_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        user_id TEXT,
        action TEXT,
        category TEXT,
        severity TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);

      CREATE TABLE IF NOT EXISTS cycle_counts (
        count_id TEXT PRIMARY KEY,
        date_time TEXT,
        item_sn TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_transfers (
        transfer_id TEXT PRIMARY KEY,
        date_time TEXT,
        item_sn TEXT,
        status TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS parked_orders (
        id TEXT PRIMARY KEY,
        created_at TEXT,
        cashier_id TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS voided_orders (
        void_id TEXT PRIMARY KEY,
        voided_at TEXT,
        cashier_id TEXT,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pos_terminals (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        status TEXT,
        is_default INTEGER,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cash_transfers (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        cashier_staff_id TEXT,
        amount REAL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cash_transfers_cashier ON cash_transfers(cashier_staff_id);

      CREATE TABLE IF NOT EXISTS receipt_settings (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure metadata row exists
    const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('db_info') as { value: string } | undefined;
    if (!row) {
      const initialMeta: DatabaseMetadata = {
        version: 1,
        lastUpdated: new Date().toISOString(),
      };
      this.db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('db_info', JSON.stringify(initialMeta));
    }

    this.ensureSuperAdmin();
  }

  /**
   * Ensures the root Super Admin account (Boluwatife) is securely present
   */
  private ensureSuperAdmin() {
    try {
      const exists = this.db.prepare("SELECT staff_id FROM employees WHERE LOWER(username) = 'boluwatife'").get();
      if (!exists) {
        const superAdmin = {
          staff_id: 'STAFF-SUPER-001',
          staff_name: 'Boluwatife Abiri (Super Admin)',
          username: 'Boluwatife',
          password: 'be9b260d7fa78f63:dcee42f7e8b0bb932a5dd91c9d2d880551d1f12c9c3329e7cba23bce2adf1ded',
          phone_number: '+234 800 000 0001',
          role: 'Super Admin',
          pin: 'be9b260d7fa78f63:dcee42f7e8b0bb932a5dd91c9d2d880551d1f12c9c3329e7cba23bce2adf1ded',
          shift_time: 'Full Day',
          date_hired: '2023-01-01',
          status: 'Active',
        };
        this.db.prepare(`
          INSERT INTO employees (staff_id, staff_name, username, role, pin, status, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          superAdmin.staff_id,
          superAdmin.staff_name,
          superAdmin.username,
          superAdmin.role,
          superAdmin.pin,
          superAdmin.status,
          JSON.stringify(superAdmin)
        );
        console.log('[SQLITE] Super Admin Boluwatife auto-seeded successfully.');
      }
    } catch {
      // Table will be seeded by autoMigrateFromJson if fresh
    }
  }

  /**
   * Helper for transactional execution (ACID)
   */
  public transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.exec('BEGIN IMMEDIATE;');
      try {
        const result = fn();
        this.db.exec('COMMIT;');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    };
  }

  /**
   * Seamless one-time auto-migration from existing pos_database.json or seedData.json
   */
  private autoMigrateFromJson(resolvedDataDir: string) {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number | bigint };
    if (countRow && Number(countRow.count) > 0) {
      // Already has data
      return;
    }

    console.log('[SQLITE] Fresh database detected. Checking for JSON source data to migrate...');
    const jsonDbPath = path.resolve(resolvedDataDir, 'pos_database.json');
    const seedPath = process.env.POS_SEED_FILE || path.resolve(process.cwd(), 'src', 'data', 'seedData.json');

    let sourceData: any = null;

    if (fs.existsSync(jsonDbPath)) {
      try {
        console.log(`[SQLITE] Migrating data from existing JSON file: ${jsonDbPath}`);
        sourceData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));
      } catch (e: any) {
        console.warn('[SQLITE] Failed reading pos_database.json, falling back to seedData:', e.message);
      }
    }

    if (!sourceData && fs.existsSync(seedPath)) {
      try {
        console.log(`[SQLITE] Seeding database from: ${seedPath}`);
        sourceData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      } catch (e: any) {
        console.warn('[SQLITE] Failed reading seedData.json:', e.message);
      }
    }

    if (sourceData) {
      this.importSnapshot(sourceData);
      console.log('[SQLITE] Migration complete! All records securely stored in SQLite.');
    }
  }

  public getMetadata(): DatabaseMetadata {
    const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('db_info') as { value: string } | undefined;
    if (row) {
      return JSON.parse(row.value);
    }
    return { version: 1, lastUpdated: new Date().toISOString() };
  }

  public touchVersion(): number {
    const meta = this.getMetadata();
    meta.version = (meta.version || 0) + 1;
    meta.lastUpdated = new Date().toISOString();
    this.db.prepare('UPDATE metadata SET value = ? WHERE key = ?').run(JSON.stringify(meta), 'db_info');
    return meta.version;
  }

  /**
   * Helper to retrieve all records from a table as parsed objects
   */
  public getTable<T = any>(tableName: string): T[] {
    const rows = this.db.prepare(`SELECT data FROM ${tableName}`).all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  }

  /**
   * Helper to retrieve a single record by primary key
   */
  public getById<T = any>(tableName: string, pkColumn: string, id: string): T | null {
    const row = this.db.prepare(`SELECT data FROM ${tableName} WHERE ${pkColumn} = ?`).get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  /**
   * Upsert a product
   */
  public upsertProduct(product: any) {
    const stmt = this.db.prepare(`
      INSERT INTO products (item_sn, item_name, quantity, selling_price, status, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_sn) DO UPDATE SET
        item_name = excluded.item_name,
        quantity = excluded.quantity,
        selling_price = excluded.selling_price,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(
      product.item_sn,
      product.item_name || '',
      Number(product.quantity) || 0,
      Number(product.selling_price) || 0,
      product.status || 'Active',
      JSON.stringify(product)
    );
    this.touchVersion();
  }

  /**
   * Delete a product
   */
  public deleteProduct(item_sn: string) {
    this.db.prepare('DELETE FROM products WHERE item_sn = ?').run(item_sn);
    this.touchVersion();
  }

  /**
   * Upsert a customer
   */
  public upsertCustomer(customer: any) {
    const id = customer.id || customer.customer_id || `CUST-${Date.now()}`;
    customer.id = id;
    customer.customer_id = id;
    const stmt = this.db.prepare(`
      INSERT INTO customers (customer_id, name, phone, balance, status, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        balance = excluded.balance,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(
      id,
      customer.name || '',
      customer.phone || customer.phone_number || '',
      Number(customer.balance) || 0,
      customer.status || 'Active',
      JSON.stringify(customer)
    );
    this.touchVersion();
  }

  /**
   * Upsert a supplier
   */
  public upsertSupplier(supplier: any) {
    const id = supplier.supplier_id || supplier.id || `SUP-${Date.now()}`;
    supplier.supplier_id = id;
    supplier.id = id;
    const stmt = this.db.prepare(`
      INSERT INTO suppliers (supplier_id, supplier_name, status, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(supplier_id) DO UPDATE SET
        supplier_name = excluded.supplier_name,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(
      id,
      supplier.supplier_name || supplier.name || '',
      supplier.status || 'Active',
      JSON.stringify(supplier)
    );
    this.touchVersion();
  }

  /**
   * Upsert an employee
   */
  public upsertEmployee(employee: any) {
    const id = employee.staff_id || employee.id || `STAFF-${Date.now()}`;
    employee.staff_id = id;
    employee.id = id;
    const stmt = this.db.prepare(`
      INSERT INTO employees (staff_id, staff_name, username, role, pin, status, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(staff_id) DO UPDATE SET
        staff_name = excluded.staff_name,
        username = excluded.username,
        role = excluded.role,
        pin = excluded.pin,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(
      id,
      employee.staff_name || '',
      employee.username || '',
      employee.role || 'Cashier',
      employee.pin || '',
      employee.status || 'Active',
      JSON.stringify(employee)
    );
    this.touchVersion();
  }

  /**
   * Delete an employee
   */
  public deleteEmployee(staff_id: string) {
    this.db.prepare('DELETE FROM employees WHERE staff_id = ?').run(staff_id);
    this.touchVersion();
  }

  /**
   * Upsert a purchase order
   */
  public upsertPurchaseOrder(po: any) {
    const id = po.id || po.po_number || `PO-${Date.now()}`;
    po.id = id;
    const stmt = this.db.prepare(`
      INSERT INTO purchase_orders (id, po_number, supplier_id, status, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        po_number = excluded.po_number,
        supplier_id = excluded.supplier_id,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(id, po.po_number || '', po.supplier_id || '', po.status || 'Pending', JSON.stringify(po));
    this.touchVersion();
  }

  /**
   * Record a sale transaction with atomic inventory updates
   */
  public recordSale(transaction: any) {
    const runTransaction = this.transaction(() => {
      // 1. Insert sale record
      const stmt = this.db.prepare(`
        INSERT INTO sales (
          transaction_id, invoice_number, timestamp, cashier_id,
          pos_terminal_id, customer_id, final_amount, payment_method, status, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(transaction_id) DO UPDATE SET
          status = excluded.status,
          data = excluded.data
      `);

      stmt.run(
        transaction.transaction_id,
        transaction.invoice_number || '',
        transaction.timestamp || transaction.date_time || new Date().toISOString(),
        transaction.cashier_id || '',
        transaction.pos_terminal_id || '',
        transaction.customer_id || '',
        Number(transaction.final_amount) || 0,
        transaction.payment_method || 'Cash',
        transaction.status || 'Completed',
        JSON.stringify(transaction)
      );

      // 2. Decrement inventory quantities atomically
      if (Array.isArray(transaction.items)) {
        for (const item of transaction.items) {
          const itemSn = item.item_sn;
          const qtyPurchased = Number(item.quantity) || 0;
          if (itemSn && qtyPurchased > 0) {
            const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(itemSn) as { data: string } | undefined;
            if (prodRow) {
              const prod = JSON.parse(prodRow.data);
              prod.quantity = Math.max(0, Math.round(((Number(prod.quantity) || 0) - qtyPurchased) * 1000) / 1000);
              this.db.prepare(`
                UPDATE products SET
                  quantity = ?,
                  data = ?
                WHERE item_sn = ?
              `).run(prod.quantity, JSON.stringify(prod), itemSn);
            }
          }
        }
      }
    });

    runTransaction();
    this.touchVersion();
  }

  /**
   * Update sale status (e.g. for refund badges)
   */
  public updateSale(transaction: any) {
    this.db.prepare(`
      UPDATE sales SET
        status = ?,
        data = ?
      WHERE transaction_id = ?
    `).run(
      transaction.status || 'Completed',
      JSON.stringify(transaction),
      transaction.transaction_id
    );
    this.touchVersion();
  }

  /**
   * Record a refund with atomic inventory restoration
   */
  public recordRefund(refundRecord: any) {
    const runTransaction = this.transaction(() => {
      // 1. Insert refund record
      this.db.prepare(`
        INSERT INTO refunds (
          refund_id, original_transaction_id, item_sn, date_time,
          staff_id, refund_amount, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(refund_id) DO UPDATE SET
          data = excluded.data
      `).run(
        refundRecord.refund_id,
        refundRecord.original_transaction_id || '',
        refundRecord.item_sn || '',
        refundRecord.date_time || new Date().toISOString(),
        refundRecord.staff_id || '',
        Number(refundRecord.refund_amount) || 0,
        JSON.stringify(refundRecord)
      );

      // 2. Add refunded quantities back to products in inventory
      const itemsToRestore = Array.isArray(refundRecord.items) && refundRecord.items.length > 0
        ? refundRecord.items
        : [{ item_sn: refundRecord.item_sn, quantity_refunded: refundRecord.quantity_refunded }];

      for (const item of itemsToRestore) {
        const itemSn = item.item_sn;
        const qtyRefunded = Number(item.quantity_refunded) || 0;
        if (itemSn && qtyRefunded > 0) {
          const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(itemSn) as { data: string } | undefined;
          if (prodRow) {
            const prod = JSON.parse(prodRow.data);
            prod.quantity = Math.round(((Number(prod.quantity) || 0) + qtyRefunded) * 1000) / 1000;
            this.db.prepare(`
              UPDATE products SET
                quantity = ?,
                data = ?
              WHERE item_sn = ?
            `).run(prod.quantity, JSON.stringify(prod), itemSn);
          }
        }
      }

      // 3. Mark original transaction refund status if exists
      const origTxId = refundRecord.original_transaction_id;
      if (origTxId) {
        const saleRow = this.db.prepare('SELECT data FROM sales WHERE transaction_id = ?').get(origTxId) as { data: string } | undefined;
        if (saleRow) {
          const sale = JSON.parse(saleRow.data);
          const isFull = Boolean(refundRecord.is_full_refund);
          sale.status = isFull ? 'Fully Refunded' : 'Partially Refunded';
          if (!sale.refund_history) sale.refund_history = [];
          sale.refund_history.push(refundRecord.refund_id);
          this.db.prepare(`
            UPDATE sales SET
              status = ?,
              data = ?
            WHERE transaction_id = ?
          `).run(sale.status, JSON.stringify(sale), origTxId);
        }
      }
    });

    runTransaction();
    this.touchVersion();
  }

  /**
   * Append an audit log
   */
  public addAuditLog(entry: any) {
    const id = entry.id || `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    entry.id = id;
    this.db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_id, action, category, severity, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.timestamp || new Date().toISOString(),
      entry.user_id || '',
      entry.action || '',
      entry.category || '',
      entry.severity || 'low',
      JSON.stringify(entry)
    );
    this.touchVersion();
  }

  /**
   * Add cycle count
   */
  public addCycleCount(cc: any) {
    const id = cc.count_id || `CC-${Date.now()}`;
    cc.count_id = id;
    this.db.prepare(`
      INSERT INTO cycle_counts (count_id, date_time, item_sn, data)
      VALUES (?, ?, ?, ?)
    `).run(id, cc.date_time || new Date().toISOString(), cc.item_sn || '', JSON.stringify(cc));
    this.touchVersion();
  }

  /**
   * Add stock transfer
   */
  public addStockTransfer(st: any) {
    const id = st.transfer_id || `TR-${Date.now()}`;
    st.transfer_id = id;
    this.db.prepare(`
      INSERT INTO stock_transfers (transfer_id, date_time, item_sn, status, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, st.date_time || new Date().toISOString(), st.item_sn || '', st.status || 'Completed', JSON.stringify(st));
    this.touchVersion();
  }

  /**
   * Parked orders
   */
  public upsertParkedOrder(po: any) {
    if (!po) return;
    const id = po.order_id || po.id || `ORD-PARK-${Date.now()}`;
    const createdAt = po.created_at || po.parked_at || new Date().toISOString();
    const cashierId = po.staff_id || po.cashier_id || '';
    
    const normalized = {
      ...po,
      order_id: id,
      order_number: Number(po.order_number) || 1,
      order_label: po.order_label || po.label || (po.customer_name ? `${po.customer_name} (Held)` : `Held Order #${po.order_number || 1}`),
      created_at: createdAt,
      parked_at: po.parked_at || createdAt,
      park_reason: po.park_reason || po.notes || '',
      customer_id: po.customer_id || 'Walk-in',
      customer_name: po.customer_name || 'Walk-in',
      items: Array.isArray(po.items) ? po.items : [],
      customDiscount: Number(po.customDiscount || po.discount_amount) || 0,
      customDiscountReason: po.customDiscountReason || '',
      discountAuthorizedBy: po.discountAuthorizedBy || null,
      paymentMode: po.paymentMode === 'split' ? 'split' : 'single',
      selectedPaymentMethod: po.selectedPaymentMethod || 'Cash',
      cashTendered: String(po.cashTendered || ''),
      singleRef: String(po.singleRef || ''),
      splitCashAmount: String(po.splitCashAmount || ''),
      splitCashTendered: String(po.splitCashTendered || ''),
      splitSecondMethod: po.splitSecondMethod || 'POS',
      splitSecondAmount: String(po.splitSecondAmount || ''),
      splitSecondRef: String(po.splitSecondRef || ''),
      splitThirdMethod: po.splitThirdMethod || null,
      splitThirdAmount: String(po.splitThirdAmount || ''),
      splitThirdRef: String(po.splitThirdRef || ''),
      staff_id: cashierId,
      staff_name: po.staff_name || '',
      status: po.status || 'PARKED',
    };

    this.db.prepare(`
      INSERT INTO parked_orders (id, created_at, cashier_id, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        created_at = excluded.created_at,
        cashier_id = excluded.cashier_id,
        data = excluded.data
    `).run(id, createdAt, cashierId, JSON.stringify(normalized));
    this.touchVersion();
  }

  public deleteParkedOrder(id: string) {
    if (!id) return;
    this.db.prepare('DELETE FROM parked_orders WHERE id = ?').run(id);
    this.touchVersion();
  }

  public syncParkedOrders(orders: any[]) {
    if (!Array.isArray(orders)) return;
    const ids = orders.map(o => o.order_id || o.id).filter(Boolean);
    if (ids.length === 0) {
      this.db.prepare('DELETE FROM parked_orders').run();
    } else {
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM parked_orders WHERE id NOT IN (${placeholders})`).run(...ids);
      for (const po of orders) {
        this.upsertParkedOrder(po);
      }
    }
    this.touchVersion();
  }

  public getParkedOrders(): any[] {
    const rows = this.db.prepare('SELECT data FROM parked_orders ORDER BY created_at DESC').all() as Array<{ data: string }>;
    return rows.map(r => {
      try {
        const po = JSON.parse(r.data);
        const id = po.order_id || po.id || `ORD-PARK-${Date.now()}`;
        return {
          ...po,
          order_id: id,
          order_number: Number(po.order_number) || 1,
          order_label: po.order_label || po.label || (po.customer_name ? `${po.customer_name} (Held)` : `Held Order #${po.order_number || 1}`),
          created_at: po.created_at || po.parked_at || new Date().toISOString(),
          parked_at: po.parked_at || po.created_at || new Date().toISOString(),
          park_reason: po.park_reason || po.notes || '',
          customer_id: po.customer_id || 'Walk-in',
          customer_name: po.customer_name || 'Walk-in',
          items: Array.isArray(po.items) ? po.items : [],
          customDiscount: Number(po.customDiscount || po.discount_amount) || 0,
          customDiscountReason: po.customDiscountReason || '',
          discountAuthorizedBy: po.discountAuthorizedBy || null,
          paymentMode: po.paymentMode === 'split' ? 'split' : 'single',
          selectedPaymentMethod: po.selectedPaymentMethod || 'Cash',
          cashTendered: String(po.cashTendered || ''),
          singleRef: String(po.singleRef || ''),
          splitCashAmount: String(po.splitCashAmount || ''),
          splitCashTendered: String(po.splitCashTendered || ''),
          splitSecondMethod: po.splitSecondMethod || 'POS',
          splitSecondAmount: String(po.splitSecondAmount || ''),
          splitSecondRef: String(po.splitSecondRef || ''),
          splitThirdMethod: po.splitThirdMethod || null,
          splitThirdAmount: String(po.splitThirdAmount || ''),
          splitThirdRef: String(po.splitThirdRef || ''),
          staff_id: po.staff_id || '',
          staff_name: po.staff_name || '',
          status: po.status || 'PARKED',
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Voided orders
   */
  public addVoidedOrder(vo: any) {
    const id = vo.void_id || `VOID-${Date.now()}`;
    vo.void_id = id;
    this.db.prepare(`
      INSERT INTO voided_orders (void_id, voided_at, cashier_id, data)
      VALUES (?, ?, ?, ?)
    `).run(id, vo.voided_at || new Date().toISOString(), vo.cashier_id || '', JSON.stringify(vo));
    this.touchVersion();
  }

  /**
   * POS Terminals
   */
  public upsertPosTerminal(terminal: any) {
    const id = terminal.id || `POS-${Date.now()}`;
    terminal.id = id;
    this.db.prepare(`
      INSERT INTO pos_terminals (id, name, type, status, is_default, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        status = excluded.status,
        is_default = excluded.is_default,
        data = excluded.data
    `).run(
      id,
      terminal.name || '',
      terminal.type || 'POS_TERMINAL',
      terminal.status || 'Active',
      terminal.is_default ? 1 : 0,
      JSON.stringify(terminal)
    );
    this.touchVersion();
  }

  public deletePosTerminal(id: string) {
    this.db.prepare('DELETE FROM pos_terminals WHERE id = ?').run(id);
    this.touchVersion();
  }

  /**
   * Cash Transfers
   */
  public addCashTransfer(transfer: any) {
    const id = transfer.id || `CASH-TR-${Date.now()}`;
    transfer.id = id;
    this.db.prepare(`
      INSERT INTO cash_transfers (id, timestamp, cashier_staff_id, amount, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      transfer.timestamp || new Date().toISOString(),
      transfer.cashier_staff_id || '',
      Number(transfer.amount) || 0,
      JSON.stringify(transfer)
    );
    this.touchVersion();
  }

  /**
   * Receipt & Branding Settings
   */
  public getReceiptSettings(): any {
    const row = this.db.prepare('SELECT data FROM receipt_settings WHERE id = ?').get('DEFAULT_RECEIPT_CONFIG') as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  public upsertReceiptSettings(settings: any) {
    const id = settings.id || 'DEFAULT_RECEIPT_CONFIG';
    settings.id = id;
    settings.updated_at = settings.updated_at || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO receipt_settings (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(id, JSON.stringify(settings), settings.updated_at);
    this.touchVersion();
  }

  /**
   * Factory Data Reset (Wipe All Data)
   * Wipes transactional and catalog data while preserving Admin accounts and POS terminals.
   */
  public wipeAllData(preservedEmployees: any[], preservedTerminals: any[]): void {
    const resetTx = this.transaction(() => {
      this.db.exec(`
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM suppliers;
        DELETE FROM purchase_orders;
        DELETE FROM sales;
        DELETE FROM refunds;
        DELETE FROM audit_logs;
        DELETE FROM cycle_counts;
        DELETE FROM stock_transfers;
        DELETE FROM parked_orders;
        DELETE FROM voided_orders;
        DELETE FROM cash_transfers;
        DELETE FROM employees;
        DELETE FROM pos_terminals;
      `);

      // Re-insert preserved Admin accounts
      const empStmt = this.db.prepare(`
        INSERT INTO employees (staff_id, staff_name, username, role, pin, status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const emp of preservedEmployees) {
        empStmt.run(
          emp.staff_id,
          emp.staff_name || '',
          emp.username || '',
          emp.role || 'Admin',
          emp.pin || '',
          emp.status || 'Active',
          JSON.stringify(emp)
        );
      }

      // Re-insert preserved POS terminals
      const termStmt = this.db.prepare(`
        INSERT INTO pos_terminals (id, name, type, status, is_default, data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const term of preservedTerminals) {
        termStmt.run(
          term.id,
          term.name || '',
          term.type || 'POS_TERMINAL',
          term.status || 'Active',
          term.is_default ? 1 : 0,
          JSON.stringify(term)
        );
      }
    });

    resetTx();
    this.touchVersion();
  }

  /**
   * Returns a complete centralized snapshot of all tables
   */
  public getSnapshot(): any {
    const meta = this.getMetadata();
    return {
      version: meta.version,
      lastUpdated: meta.lastUpdated,
      products: this.getTable('products'),
      customers: this.getTable('customers'),
      suppliers: this.getTable('suppliers'),
      employees: this.getTable('employees'),
      purchaseOrders: this.getTable('purchase_orders'),
      sales: this.getTable('sales'),
      refunds: this.getTable('refunds'),
      auditLogs: this.getTable('audit_logs'),
      cycleCounts: this.getTable('cycle_counts'),
      stockTransfers: this.getTable('stock_transfers'),
      parkedOrders: this.getParkedOrders(),
      voidedOrders: this.getTable('voided_orders'),
      posTerminals: this.getTable('pos_terminals'),
      cashTransfers: this.getTable('cash_transfers'),
      receiptSettings: this.getReceiptSettings(),
    };
  }

  /**
   * Import snapshot into SQLite
   */
  public importSnapshot(snapshot: any) {
    const importTx = this.transaction(() => {
      if (Array.isArray(snapshot.products)) {
        for (const p of snapshot.products) this.upsertProduct(p);
      }
      if (Array.isArray(snapshot.customers)) {
        for (const c of snapshot.customers) this.upsertCustomer(c);
      }
      if (Array.isArray(snapshot.suppliers)) {
        for (const s of snapshot.suppliers) this.upsertSupplier(s);
      }
      if (Array.isArray(snapshot.employees)) {
        for (const e of snapshot.employees) this.upsertEmployee(e);
      }
      if (Array.isArray(snapshot.purchaseOrders)) {
        for (const po of snapshot.purchaseOrders) this.upsertPurchaseOrder(po);
      }
      if (Array.isArray(snapshot.sales)) {
        for (const s of snapshot.sales) this.recordSale(s);
      }
      if (Array.isArray(snapshot.refunds)) {
        for (const r of snapshot.refunds) this.recordRefund(r);
      }
      if (Array.isArray(snapshot.auditLogs)) {
        for (const a of snapshot.auditLogs) this.addAuditLog(a);
      }
      if (Array.isArray(snapshot.cycleCounts)) {
        for (const cc of snapshot.cycleCounts) this.addCycleCount(cc);
      }
      if (Array.isArray(snapshot.stockTransfers)) {
        for (const st of snapshot.stockTransfers) this.addStockTransfer(st);
      }
      if (Array.isArray(snapshot.parkedOrders)) {
        this.syncParkedOrders(snapshot.parkedOrders);
      }
      if (Array.isArray(snapshot.voidedOrders)) {
        for (const vo of snapshot.voidedOrders) this.addVoidedOrder(vo);
      }
      if (Array.isArray(snapshot.posTerminals)) {
        for (const term of snapshot.posTerminals) this.upsertPosTerminal(term);
      }
      if (Array.isArray(snapshot.cashTransfers)) {
        for (const ct of snapshot.cashTransfers) this.addCashTransfer(ct);
      }
      if (snapshot.receiptSettings) {
        this.upsertReceiptSettings(snapshot.receiptSettings);
      }
    });

    importTx();
  }

  public close() {
    this.db.close();
  }
}
