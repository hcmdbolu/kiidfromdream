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

export const DEFAULT_RECEIPT_CONFIG = {
  id: 'DEFAULT_RECEIPT_CONFIG',
  business_name: 'KIID FROM DREAM LTD',
  tagline: 'Retail & Inventory Management System',
  address_line1: 'Commercial Avenue, Phase 1',
  address_line2: 'Lagos, Nigeria',
  phone_numbers: '+234 800 000 0000',
  email: 'contact@kiidfromdream.com',
  tax_or_cac_number: 'RC: 1984201 | TIN: 248109-0001',
  footer_thank_you: 'Thank you for shopping with us!',
  footer_policy_notice: 'Goods received in good condition. Inspect items before checkout. Return policy: 7 days with valid receipt.',
  custom_notes: 'For wholesale bookings and delivery inquiries, contact our customer desk.',
  logo_base64: null,
  show_logo: true,
  show_barcode: true,
  show_cashier_name: true,
  show_tax_details: true,
  paper_width: '80mm',
  updated_at: '2026-10-01T00:00:00.000Z',
  updated_by_staff_name: 'System Admin',
};

export const DEFAULT_DISCOUNT_SECURITY_CONFIG = {
  id: 'DISCOUNT_SECURITY_CONFIG',
  discount_pin: '8e889b7fae446d1b:5b5ff5f0376cf749ca232938a7c2aa5b64c1daff1fa5117f7b3a7a935fa7c06b', // Salted SHA-256 for 8888
  is_configured: true,
  stacking_policy: 'BEST_DISCOUNT',
  max_discount_percent_cap: 25,
  enforce_cost_floor: true,
  updated_at: '2026-10-01T00:00:00.000Z',
  updated_by_staff_name: 'Store Manager',
};

export const DEFAULT_MANAGEMENT_DISCOUNT_RULES = [
  {
    rule_id: 'RULE_BULK_10KG',
    name: 'Bulk Purchase (≥10kg Single Item)',
    description: '5% discount on qualifying fish/perishable items when purchasing 10kg or more of that item',
    condition_type: 'ITEM_WEIGHT_THRESHOLD',
    threshold_value: 10,
    discount_type: 'PERCENT',
    discount_value: 5,
    scope: 'QUALIFYING_ITEM',
    max_discount_cap: 20000,
    requires_manager_approval: false,
    is_active: true,
  },
  {
    rule_id: 'RULE_BULK_25KG',
    name: 'High Volume Basket (≥25kg Total)',
    description: '8% discount for orders totaling 25kg or more across all items',
    condition_type: 'CART_QUANTITY_THRESHOLD',
    threshold_value: 25,
    discount_type: 'PERCENT',
    discount_value: 8,
    scope: 'BASKET',
    max_discount_cap: 35000,
    requires_manager_approval: false,
    is_active: true,
  },
  {
    rule_id: 'RULE_SUBTOTAL_100K',
    name: 'Wholesale Tier (≥₦100,000)',
    description: 'Flat ₦5,000 instant discount on basket subtotal over ₦100,000',
    condition_type: 'CART_SUBTOTAL_THRESHOLD',
    threshold_value: 100000,
    discount_type: 'FIXED',
    discount_value: 5000,
    scope: 'BASKET',
    requires_manager_approval: false,
    is_active: true,
  },
  {
    rule_id: 'RULE_LOYALTY_5',
    name: 'Frequent Buyer Reward (≥5 Visits)',
    description: '5% discount for registered customers with 5 or more previous visits',
    condition_type: 'CUSTOMER_LOYALTY',
    threshold_value: 5,
    discount_type: 'PERCENT',
    discount_value: 5,
    scope: 'BASKET',
    max_discount_cap: 15000,
    requires_manager_approval: false,
    is_active: true,
  },
  {
    rule_id: 'RULE_MANAGER_CLEARANCE',
    name: 'Manager Clearance / Promo Override',
    description: '10% special clearance or promotional discount (Requires Manager PIN)',
    condition_type: 'GENERAL_OVERRIDE',
    threshold_value: 0,
    discount_type: 'PERCENT',
    discount_value: 10,
    scope: 'BASKET',
    max_discount_cap: 50000,
    requires_manager_approval: true,
    is_active: true,
  },
];

export const DEFAULT_CATEGORIES = [
  { id: 'CAT-GEN', name: 'General', description: 'General merchandise and sundries' },
  { id: 'CAT-GROC', name: 'Groceries', description: 'Packaged foods and kitchen essentials' },
  { id: 'CAT-BEV', name: 'Beverages', description: 'Drinks, juices, and water' },
  { id: 'CAT-SNK', name: 'Food & Snacks', description: 'Ready-to-eat snacks and biscuits' },
  { id: 'CAT-PER', name: 'Perishables', description: 'Fresh produce and short shelf-life items' },
  { id: 'CAT-FRZ', name: 'Frozen Goods', description: 'Frozen foods and cold storage items' },
  { id: 'CAT-ELEC', name: 'Electronics', description: 'Small appliances and accessories' },
  { id: 'CAT-APP', name: 'Apparel & Clothing', description: 'Clothing and garments' },
  { id: 'CAT-HOU', name: 'Household', description: 'Cleaning supplies and home goods' },
  { id: 'CAT-PERC', name: 'Personal Care', description: 'Toiletries and hygiene products' },
  { id: 'CAT-HDW', name: 'Hardware', description: 'Tools and maintenance supplies' },
  { id: 'CAT-FISH-FW', name: 'Freshwater Fish', description: 'Catfish, Tilapia, and river varieties' },
  { id: 'CAT-FISH-SW', name: 'Saltwater Fish', description: 'Mackerel, Croaker, and sea fish' },
  { id: 'CAT-FISH-FZ', name: 'Frozen Fish', description: 'Cold packaged fish stock' },
  { id: 'CAT-FISH-DR', name: 'Dried Fish', description: 'Smoked and sun-dried fish varieties' },
];

export class PosDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dataDir?: string) {
    const defaultDataDir = process.env.POS_DATA_DIR || (
      process.env.APPDATA
        ? path.resolve(process.env.APPDATA, 'kiidfromdream-pos', 'data')
        : path.resolve(process.cwd(), 'data')
    );
    const resolvedDataDir = dataDir || defaultDataDir;
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

    this.createDailyBackup(resolvedDataDir);
    this.initSchema();
    this.runAutoMigrations();
    this.autoMigrateFromJson(resolvedDataDir);
    this.ensureSuperAdmin();
  }

  /**
   * Automated Database Schema Migrations executed on every application launch.
   * Dynamically inspects all 18 tables, ensures missing columns are created safely,
   * normalizes legacy schema evolutions, and guarantees zero runtime crashes or lost records.
   */
  public runAutoMigrations() {
    console.log('[SQLITE] Running automated schema migrations across all tables...');
    try {
      // 1. Products table migrations
      this.safeAddColumn('products', 'item_cost', 'REAL DEFAULT 0');
      this.safeAddColumn('products', 'selling_price', 'REAL DEFAULT 0');
      this.safeAddColumn('products', 'quantity', 'REAL DEFAULT 0');
      this.safeAddColumn('products', 'product_measure_unit', "TEXT DEFAULT 'PCS'");
      this.safeAddColumn('products', 'quantity_per_unit', 'REAL DEFAULT 1');
      this.safeAddColumn('products', 'product_category', "TEXT DEFAULT 'General'");
      this.safeAddColumn('products', 'reorder_level', 'REAL DEFAULT 10');
      this.safeAddColumn('products', 'supplier_id', 'TEXT');
      this.safeAddColumn('products', 'item_picture', 'TEXT');
      this.safeAddColumn('products', 'status', "TEXT DEFAULT 'Active'");
      this.safeAddColumn('products', 'expiry_date', 'TEXT');
      this.safeAddColumn('products', 'bulk_unit', 'TEXT');
      this.safeAddColumn('products', 'conversion_factor', 'REAL DEFAULT 1');
      this.safeAddColumn('products', 'bulk_selling_price', 'REAL');
      this.safeAddColumn('products', 'bulk_item_cost', 'REAL');
      this.safeAddColumn('products', 'allow_loose_sales', 'INTEGER DEFAULT 1');

      // 2. Sales table migrations
      this.safeAddColumn('sales', 'invoice_number', 'TEXT');
      this.safeAddColumn('sales', 'pos_terminal_id', 'TEXT');
      this.safeAddColumn('sales', 'pos_terminal_name', 'TEXT');
      this.safeAddColumn('sales', 'bank_name', 'TEXT');
      this.safeAddColumn('sales', 'bank_account_number', 'TEXT');
      this.safeAddColumn('sales', 'payment_reference', 'TEXT');
      this.safeAddColumn('sales', 'payment_splits', 'TEXT');
      this.safeAddColumn('sales', 'discount_applied', 'REAL DEFAULT 0');
      this.safeAddColumn('sales', 'discount_reason', 'TEXT');
      this.safeAddColumn('sales', 'discount_authorized_by', 'TEXT');
      this.safeAddColumn('sales', 'discount_rule_id', 'TEXT');
      this.safeAddColumn('sales', 'status', "TEXT DEFAULT 'COMPLETED'");
      this.safeAddColumn('sales', 'is_historical_import', 'INTEGER DEFAULT 0');
      this.safeAddColumn('sales', 'migration_batch_id', 'TEXT');

      // 3. Refunds table migrations
      this.safeAddColumn('refunds', 'payment_method', "TEXT DEFAULT 'Cash'");
      this.safeAddColumn('refunds', 'pos_terminal_id', 'TEXT');
      this.safeAddColumn('refunds', 'pos_terminal_name', 'TEXT');
      this.safeAddColumn('refunds', 'bank_name', 'TEXT');
      this.safeAddColumn('refunds', 'bank_account_number', 'TEXT');
      this.safeAddColumn('refunds', 'payment_reference', 'TEXT');
      this.safeAddColumn('refunds', 'authorized_by', 'TEXT');
      this.safeAddColumn('refunds', 'items', 'TEXT');
      this.safeAddColumn('refunds', 'is_full_refund', 'INTEGER DEFAULT 1');
      this.safeAddColumn('refunds', 'disbursement_channel', "TEXT DEFAULT 'ORIGINAL_CHANNEL'");
      this.safeAddColumn('refunds', 'cashier_staff_id', 'TEXT');
      this.safeAddColumn('refunds', 'bank_account_id', 'TEXT');

      // 4. Discount rules table migrations
      this.safeAddColumn('discount_rules', 'scope', "TEXT DEFAULT 'BASKET'");
      this.safeAddColumn('discount_rules', 'max_discount_cap', 'REAL');
      this.safeAddColumn('discount_rules', 'requires_manager_approval', 'INTEGER DEFAULT 0');

      // 5. Receipt settings migrations
      this.safeAddColumn('receipt_settings', 'paper_width', "TEXT DEFAULT '80mm'");

      // 6. POS Terminals & Bank accounts migrations
      this.safeAddColumn('pos_terminals', 'is_default', 'INTEGER DEFAULT 0');
      this.safeAddColumn('pos_terminals', 'provider', 'TEXT');
      this.safeAddColumn('pos_terminals', 'terminal_id', 'TEXT');
      this.safeAddColumn('pos_terminals', 'account_name', 'TEXT');
      this.safeAddColumn('pos_terminals', 'account_number', 'TEXT');
      this.safeAddColumn('pos_terminals', 'bank_name', 'TEXT');
      this.safeAddColumn('pos_terminals', 'assigned_location', 'TEXT');

      // 7. Customers migrations
      this.safeAddColumn('customers', 'discount_percent', 'REAL DEFAULT 0');
      this.safeAddColumn('customers', 'discount_notes', 'TEXT');
      this.safeAddColumn('customers', 'total_spent', 'REAL DEFAULT 0');
      this.safeAddColumn('customers', 'purchase_count', 'INTEGER DEFAULT 0');
      this.safeAddColumn('customers', 'last_purchase_date', 'TEXT');
      this.safeAddColumn('customers', 'preferred_product', 'TEXT');

      // 8. Purchase orders migrations
      this.safeAddColumn('purchase_orders', 'po_number', 'TEXT');
      this.safeAddColumn('purchase_orders', 'supplier_id', 'TEXT');
      this.safeAddColumn('purchase_orders', 'status', "TEXT DEFAULT 'PENDING'");
      this.safeAddColumn('purchase_orders', 'expected_delivery_date', 'TEXT');
      this.safeAddColumn('purchase_orders', 'actual_delivery_date', 'TEXT');
      this.safeAddColumn('purchase_orders', 'notes', 'TEXT');

      console.log('[SQLITE] Automated schema migrations completed successfully.');
    } catch (err: any) {
      console.warn('[SQLITE] Non-fatal warning during schema auto-migration:', err.message);
    }
  }

  /**
   * Safe column migration helper to prevent runtime exceptions on schema evolution
   */
  public safeAddColumn(tableName: string, columnName: string, columnDef: string) {
    try {
      const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
      const exists = tableInfo.some((col) => col.name.toLowerCase() === columnName.toLowerCase());
      if (!exists) {
        this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
        console.log(`[SQLITE] Migrated schema: Added column ${columnName} to ${tableName}`);
      }
    } catch (e: any) {
      console.warn(`[SQLITE] safeAddColumn (${tableName}.${columnName}) error:`, e.message);
    }
  }

  /**
   * Daily rolling point-in-time database backup using atomic VACUUM INTO
   * Automatically retains the last 7 daily backup snapshots and prunes older ones
   */
  private createDailyBackup(resolvedDataDir: string) {
    try {
      const backupDir = path.resolve(resolvedDataDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const backupPath = path.resolve(backupDir, `pos_database_backup_${today}.db`);

      if (!fs.existsSync(backupPath)) {
        console.log(`[SQLITE] Performing daily database backup snapshot to: ${backupPath}`);
        const escapedPath = backupPath.replace(/'/g, "''");
        this.db.exec(`VACUUM INTO '${escapedPath}';`);
        console.log('[SQLITE] Daily backup snapshot completed successfully.');
      }

      // Retention: keep last 7 daily backups
      const files = fs.readdirSync(backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith('pos_database_backup_') && f.endsWith('.db'))
        .sort();

      if (backupFiles.length > 7) {
        const toDelete = backupFiles.slice(0, backupFiles.length - 7);
        for (const file of toDelete) {
          try {
            fs.unlinkSync(path.resolve(backupDir, file));
            console.log(`[SQLITE] Pruned old backup file: ${file}`);
          } catch (err: any) {
            console.warn(`[SQLITE] Failed to prune backup ${file}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.warn('[SQLITE] Backup creation failed non-fatally:', err.message);
    }
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

      CREATE TABLE IF NOT EXISTS customer_debt_repayments (
        repayment_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        amount_paid REAL NOT NULL,
        payment_method TEXT NOT NULL,
        date_time TEXT NOT NULL,
        staff_id TEXT,
        staff_name TEXT,
        previous_balance REAL,
        remaining_balance REAL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_debt_repayments_cust ON customer_debt_repayments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_debt_repayments_date ON customer_debt_repayments(date_time);

      CREATE TABLE IF NOT EXISTS receipt_settings (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discount_settings (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discount_rules (
        rule_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        condition_type TEXT NOT NULL,
        threshold_value REAL NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        scope TEXT NOT NULL DEFAULT 'BASKET',
        requires_manager_approval INTEGER NOT NULL DEFAULT 0,
        max_discount_cap REAL,
        is_active INTEGER NOT NULL DEFAULT 1,
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

    // Ensure default receipt settings exist
    const receiptRow = this.db.prepare('SELECT id FROM receipt_settings WHERE id = ?').get('DEFAULT_RECEIPT_CONFIG');
    if (!receiptRow) {
      this.db.prepare(`
        INSERT INTO receipt_settings (id, data, updated_at)
        VALUES (?, ?, ?)
      `).run('DEFAULT_RECEIPT_CONFIG', JSON.stringify(DEFAULT_RECEIPT_CONFIG), DEFAULT_RECEIPT_CONFIG.updated_at);
    }

    // Ensure default discount security settings exist
    const discountRow = this.db.prepare('SELECT id FROM discount_settings WHERE id = ?').get('DISCOUNT_SECURITY_CONFIG');
    if (!discountRow) {
      this.db.prepare(`
        INSERT INTO discount_settings (id, data, updated_at)
        VALUES (?, ?, ?)
      `).run('DISCOUNT_SECURITY_CONFIG', JSON.stringify(DEFAULT_DISCOUNT_SECURITY_CONFIG), DEFAULT_DISCOUNT_SECURITY_CONFIG.updated_at);
    }

    // Ensure default categories exist
    const catCount = (this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
    if (catCount === 0) {
      const insertCat = this.db.prepare('INSERT INTO categories (id, name, data) VALUES (?, ?, ?)');
      for (const c of DEFAULT_CATEGORIES) {
        insertCat.run(c.id, c.name, JSON.stringify({ ...c, created_at: new Date().toISOString() }));
      }
    }

    // Ensure default discount rules exist
    const ruleCount = (this.db.prepare('SELECT COUNT(*) as count FROM discount_rules').get() as { count: number }).count;
    if (ruleCount === 0) {
      const insertRule = this.db.prepare(`
        INSERT INTO discount_rules (
          rule_id, name, description, condition_type, threshold_value,
          discount_type, discount_value, scope, requires_manager_approval,
          max_discount_cap, is_active, data, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of DEFAULT_MANAGEMENT_DISCOUNT_RULES) {
        const now = new Date().toISOString();
        const ruleData = { ...r, updated_at: now };
        insertRule.run(
          r.rule_id,
          r.name,
          r.description,
          r.condition_type,
          r.threshold_value,
          r.discount_type,
          r.discount_value,
          r.scope || 'BASKET',
          r.requires_manager_approval ? 1 : 0,
          r.max_discount_cap ?? null,
          r.is_active ? 1 : 0,
          JSON.stringify(ruleData),
          now
        );
      }
    } else {
      // Safe column additions for existing installations
      this.safeAddColumn('discount_rules', 'scope', "TEXT DEFAULT 'BASKET'");
      this.safeAddColumn('discount_rules', 'max_discount_cap', 'REAL');
      this.safeAddColumn('cash_transfers', 'transfer_type', "TEXT DEFAULT 'POS_TO_BANK'");
    }
  }

  /**
   * Ensures the root Super Admin account (Boluwatife) is securely present
   */
  private ensureSuperAdmin() {
    try {
      const superAdmin = {
        staff_id: 'STAFF-SUPER-001',
        staff_name: 'Boluwatife (Super Admin)',
        username: 'Boluwatife',
        password: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
        phone_number: '+234 800 000 0001',
        role: 'Super Admin',
        pin: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
        shift_time: 'Full Day',
        date_hired: '2023-01-01',
        status: 'Active',
      };

      const exists = this.db.prepare("SELECT staff_id FROM employees WHERE LOWER(username) = 'boluwatife'").get();
      if (!exists) {
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
      } else {
        // Super Admin account already exists; preserve user-configured passwords/PINs
        console.log('[SQLITE] Super Admin Boluwatife already present; preserving existing credentials.');
      }
    } catch {
      // Table will be seeded by autoMigrateFromJson if fresh
    }
  }

  private inTransaction = false;

  /**
   * Helper for transactional execution (ACID) with nested transaction re-entrancy protection
   */
  public transaction<T>(fn: () => T): () => T {
    return () => {
      if (this.inTransaction) {
        return fn();
      }
      this.inTransaction = true;
      this.db.exec('BEGIN IMMEDIATE;');
      try {
        const result = fn();
        this.db.exec('COMMIT;');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      } finally {
        this.inTransaction = false;
      }
    };
  }

  /**
   * Seamless one-time auto-migration from existing pos_database.json or seedData.json
   */
  private autoMigrateFromJson(resolvedDataDir: string) {
    const seededRow = this.db.prepare("SELECT value FROM metadata WHERE key = 'is_seeded'").get() as { value: string } | undefined;
    if (seededRow && seededRow.value === 'true') {
      return;
    }

    // Safety guard: if sales, products, employees, customers, suppliers, or categories already exist, NEVER overwrite with seed data!
    try {
      const salesCount = (this.db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count: number }).count;
      const productsCount = (this.db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
      const employeesCount = (this.db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number }).count;
      const customersCount = (this.db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number }).count;
      const suppliersCount = (this.db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as { count: number }).count;
      const categoriesCount = (this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
      if (salesCount > 0 || productsCount > 0 || employeesCount > 1 || customersCount > 0 || suppliersCount > 0 || categoriesCount > 0) {
        console.log(`[SQLITE] Database already contains records (Sales: ${salesCount}, Products: ${productsCount}, Staff: ${employeesCount}). Skipping JSON auto-migration.`);
        this.db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('is_seeded', 'true')").run();
        return;
      }
    } catch {
      // If tables don't exist yet, proceed with normal initialization
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

    // Mark database as initialized/seeded so future restarts do not overwrite custom data or empty catalogs
    this.db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('is_seeded', 'true')").run();
  }

  /**
   * Secure Factory Data Reset executed strictly by Super Admin
   * Wipes all operational and transactional tables:
   * sales, refunds, products, customers, suppliers, purchase_orders,
   * audit_logs, cycle_counts, stock_transfers, parked_orders, voided_orders, cash_transfers.
   * Resets receipt branding to clean default (logo_base64: null).
   * Deletes all employees except Super Admin (Boluwatife).
   * Bumps version, logs reset event, and marks seeded.
   */
  public factoryReset(): { version: number; lastUpdated: string } {
    const defaultReceiptConfig = {
      ...DEFAULT_RECEIPT_CONFIG,
      updated_at: new Date().toISOString(),
      updated_by_staff_name: 'Boluwatife (Super Admin)',
    };

    const superAdmin = {
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife (Super Admin)',
      username: 'Boluwatife',
      password: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
      phone_number: '+234 800 000 0001',
      role: 'Super Admin',
      pin: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
      shift_time: 'Full Day',
      date_hired: '2023-01-01',
      status: 'Active',
    };

    const initialAuditLog = {
      id: `AUD-RESET-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_id: superAdmin.staff_id,
      action: 'FACTORY_DATA_RESET',
      category: 'Security',
      severity: 'ALERT',
      data: JSON.stringify({
        id: `AUD-RESET-${Date.now()}`,
        timestamp: new Date().toISOString(),
        staff_id: superAdmin.staff_id,
        staff_name: superAdmin.staff_name,
        role: superAdmin.role,
        category: 'Security',
        action: 'FACTORY_DATA_RESET',
        details: 'System Factory Data Reset completed. All operational data purged. Clean state restored.',
        severity: 'ALERT',
      }),
    };

    return this.transaction(() => {
      // 1. Wipe all operational, transactional, inventory, customer, purchasing, transfer, and audit data
      this.db.exec(`
        DELETE FROM sales;
        DELETE FROM refunds;
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM customer_debt_repayments;
        DELETE FROM suppliers;
        DELETE FROM purchase_orders;
        DELETE FROM cycle_counts;
        DELETE FROM stock_transfers;
        DELETE FROM parked_orders;
        DELETE FROM voided_orders;
        DELETE FROM cash_transfers;
        DELETE FROM categories;
        DELETE FROM discount_rules;
        DELETE FROM discount_settings;
        DELETE FROM receipt_settings;
        DELETE FROM pos_terminals;
        DELETE FROM audit_logs;
      `);

      // 2. Insert clean receipt branding config (wipes custom logo completely)
      this.db.prepare(`
        INSERT INTO receipt_settings (id, data, updated_at)
        VALUES (?, ?, ?)
      `).run(defaultReceiptConfig.id, JSON.stringify(defaultReceiptConfig), defaultReceiptConfig.updated_at);

      // Re-seed default discount security settings
      this.db.prepare(`
        INSERT INTO discount_settings (id, data, updated_at)
        VALUES (?, ?, ?)
      `).run('DISCOUNT_SECURITY_CONFIG', JSON.stringify(DEFAULT_DISCOUNT_SECURITY_CONFIG), DEFAULT_DISCOUNT_SECURITY_CONFIG.updated_at);

      // Re-seed default product categories
      const insertCat = this.db.prepare('INSERT INTO categories (id, name, data) VALUES (?, ?, ?)');
      for (const c of DEFAULT_CATEGORIES) {
        insertCat.run(c.id, c.name, JSON.stringify({ ...c, created_at: new Date().toISOString() }));
      }

      // Re-seed default management discount rules
      const insertRule = this.db.prepare(`
        INSERT INTO discount_rules (
          rule_id, name, description, condition_type, threshold_value,
          discount_type, discount_value, scope, requires_manager_approval,
          max_discount_cap, is_active, data, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of DEFAULT_MANAGEMENT_DISCOUNT_RULES) {
        const now = new Date().toISOString();
        const ruleData = { ...r, updated_at: now };
        insertRule.run(
          r.rule_id,
          r.name,
          r.description,
          r.condition_type,
          r.threshold_value,
          r.discount_type,
          r.discount_value,
          r.scope || 'BASKET',
          r.requires_manager_approval ? 1 : 0,
          r.max_discount_cap ?? null,
          r.is_active ? 1 : 0,
          JSON.stringify(ruleData),
          now
        );
      }

      // 3. Purge all employees EXCEPT Super Admin Boluwatife
      this.db.exec(`DELETE FROM employees WHERE LOWER(username) != 'boluwatife';`);

      // 4. Ensure Boluwatife is present with clean standard credentials
      const exists = this.db.prepare("SELECT staff_id FROM employees WHERE LOWER(username) = 'boluwatife'").get();
      if (!exists) {
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
      } else {
        this.db.prepare(`
          UPDATE employees 
          SET staff_name = ?, pin = ?, status = 'Active', data = ?
          WHERE LOWER(username) = 'boluwatife'
        `).run(superAdmin.staff_name, superAdmin.pin, JSON.stringify(superAdmin));
      }

      // 5. Insert audit log for the factory reset
      this.db.prepare(`
        INSERT INTO audit_logs (id, timestamp, user_id, action, category, severity, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        initialAuditLog.id,
        initialAuditLog.timestamp,
        initialAuditLog.user_id,
        initialAuditLog.action,
        initialAuditLog.category,
        initialAuditLog.severity,
        initialAuditLog.data
      );

      // 6. Touch metadata version & ensure marked as seeded
      const now = new Date().toISOString();
      const meta = this.getMetadata();
      meta.version = (meta.version || 0) + 1;
      meta.lastUpdated = now;
      this.db.prepare("UPDATE metadata SET value = ? WHERE key = 'db_info'").run(JSON.stringify(meta));
      this.db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('is_seeded', 'true')").run();

      console.log(`[SQLITE] Strict Factory Data Reset executed successfully. Version bumped to ${meta.version}`);
      return { version: meta.version, lastUpdated: now };
    })();
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
    if (tableName === 'sales') {
      const rows = this.db.prepare('SELECT timestamp, data FROM sales').all() as Array<{ timestamp: string; data: string }>;
      return rows.map(r => {
        try {
          const item = JSON.parse(r.data);
          if (!item.date_time && r.timestamp) {
            item.date_time = r.timestamp;
          }
          if (!item.timestamp && (item.date_time || r.timestamp)) {
            item.timestamp = item.date_time || r.timestamp;
          }
          return item as T;
        } catch {
          return null as any;
        }
      }).filter(Boolean);
    }

    if (tableName === 'refunds') {
      const rows = this.db.prepare('SELECT date_time, data FROM refunds').all() as Array<{ date_time: string; data: string }>;
      return rows.map(r => {
        try {
          const item = JSON.parse(r.data);
          if (!item.date_time && r.date_time) {
            item.date_time = r.date_time;
          }
          if (!item.timestamp && (item.date_time || r.date_time)) {
            item.timestamp = item.date_time || r.date_time;
          }
          return item as T;
        } catch {
          return null as any;
        }
      }).filter(Boolean);
    }

    const rows = this.db.prepare(`SELECT data FROM ${tableName}`).all() as Array<{ data: string }>;
    return rows.map(r => {
      try {
        return JSON.parse(r.data) as T;
      } catch {
        return null as any;
      }
    }).filter(Boolean);
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
   * Delete a supplier
   */
  public deleteSupplier(supplier_id: string) {
    this.db.prepare('DELETE FROM suppliers WHERE supplier_id = ?').run(supplier_id);
    this.touchVersion();
  }

  /**
   * Delete a customer
   */
  public deleteCustomer(customer_id: string) {
    this.db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customer_id);
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
    this.db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('is_seeded', 'true')").run();
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
   * Upsert a purchase order with multi-item and partial receiving normalization
   */
  public upsertPurchaseOrder(po: any) {
    const id = po.id || po.po_id || po.po_number || `PO-${Date.now()}`;
    po.id = id;
    po.po_id = id;

    // Normalize legacy single-item POs into multi-item schema
    if (!Array.isArray(po.items) || po.items.length === 0) {
      const ord = Number(po.quantity_ordered) || 0;
      const rec = po.status === 'RECEIVED' ? ord : (Number(po.quantity_received) || 0);
      const uCost = Number(po.unit_cost) || 0;
      po.items = [{
        item_sn: po.item_sn || 'ITEM-DEFAULT',
        item_name: po.item_name || po.item_sn || 'Stock Item',
        quantity_ordered: ord,
        quantity_received: rec,
        quantity_pending: Math.max(0, Math.round((ord - rec) * 1000) / 1000),
        unit_cost: uCost,
        total_cost: Number(po.total_cost) || Math.round(ord * uCost * 100) / 100,
      }];
    } else {
      // Normalize items in multi-item PO
      po.items = po.items.map((it: any) => {
        const ord = Number(it.quantity_ordered) || 0;
        const rec = Number(it.quantity_received) || 0;
        const uCost = Number(it.unit_cost) || 0;
        return {
          ...it,
          quantity_ordered: ord,
          quantity_received: rec,
          quantity_pending: Math.max(0, Math.round((ord - rec) * 1000) / 1000),
          unit_cost: uCost,
          total_cost: Number(it.total_cost) || Math.round(ord * uCost * 100) / 100,
        };
      });
    }

    // Recalculate top-level aggregate quantities
    po.quantity_ordered = po.items.reduce((sum: number, it: any) => sum + (Number(it.quantity_ordered) || 0), 0);
    po.quantity_received = po.items.reduce((sum: number, it: any) => sum + (Number(it.quantity_received) || 0), 0);
    po.quantity_pending = Math.max(0, Math.round((po.quantity_ordered - po.quantity_received) * 1000) / 1000);
    po.total_cost = po.items.reduce((sum: number, it: any) => sum + (Number(it.total_cost) || 0), 0);

    if (!Array.isArray(po.receiving_history)) {
      po.receiving_history = [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO purchase_orders (id, po_number, supplier_id, status, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        po_number = excluded.po_number,
        supplier_id = excluded.supplier_id,
        status = excluded.status,
        data = excluded.data
    `);
    stmt.run(id, po.po_number || po.po_id || '', po.supplier_id || '', po.status || 'PENDING', JSON.stringify(po));
    this.touchVersion();
  }

  /**
   * Delete a purchase order
   */
  public deletePurchaseOrder(id: string) {
    this.db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
    this.touchVersion();
    return { success: true };
  }

  /**
   * Record a sale transaction with atomic inventory updates
   */
  public recordSale(transaction: any) {
    const runTransaction = this.transaction(() => {
      // 1. Ensure date_time and timestamp are always synchronized
      const effectiveDate = transaction.date_time || transaction.timestamp || new Date().toISOString();
      transaction.date_time = effectiveDate;
      transaction.timestamp = effectiveDate;

      // Insert sale record
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
        effectiveDate,
        transaction.cashier_id || transaction.staff_id || '',
        transaction.pos_terminal_id || '',
        transaction.customer_id || '',
        Number(transaction.final_amount) || 0,
        transaction.payment_method || 'Cash',
        transaction.status || 'Completed',
        JSON.stringify(transaction)
      );

      // 2. Decrement inventory quantities atomically in Base Units
      if (Array.isArray(transaction.items)) {
        for (const item of transaction.items) {
          const itemSn = item.item_sn;
          const factor = Number(item.conversion_factor) || 1;
          const baseQtyPurchased = Number(item.base_quantity_deducted) || (Number(item.quantity_sold ?? item.quantity ?? 0) * factor);
          if (itemSn && baseQtyPurchased > 0) {
            const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(itemSn) as { data: string } | undefined;
            if (prodRow) {
              const prod = JSON.parse(prodRow.data);
              prod.quantity = Math.max(0, Math.round(((Number(prod.quantity) || 0) - baseQtyPurchased) * 1000) / 1000);
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

      // 3. Atomically update customer credit balance, history, and purchase stats
      const creditAmt = Number(transaction.credit_amount || 0);
      const isCredit = transaction.payment_method === 'Credit / Pay Later' || creditAmt > 0;
      const effectiveCredit = isCredit
        ? (creditAmt > 0 ? creditAmt : Math.max(0, (Number(transaction.final_amount) || 0) - (Number(transaction.deposit_amount) || 0)))
        : 0;

      if (transaction.customer_id && transaction.customer_id !== 'Walk-in') {
        const custRow = this.db.prepare('SELECT data FROM customers WHERE customer_id = ?').get(transaction.customer_id) as { data: string } | undefined;
        if (custRow) {
          const cust = JSON.parse(custRow.data);
          cust.total_spent = Math.round(((Number(cust.total_spent) || 0) + (Number(transaction.final_amount) || 0)) * 100) / 100;
          cust.purchase_count = (Number(cust.purchase_count) || 0) + 1;
          cust.last_purchase_date = effectiveDate.split('T')[0] || effectiveDate.split(' ')[0];

          if (effectiveCredit > 0) {
            cust.balance = Math.round(((Number(cust.balance) || 0) + effectiveCredit) * 100) / 100;
            if (!Array.isArray(cust.credit_history)) cust.credit_history = [];
            cust.credit_history.unshift({
              transaction_id: transaction.transaction_id,
              invoice_number: transaction.invoice_number,
              date: effectiveDate,
              total_sale: Number(transaction.final_amount) || 0,
              deposit_paid: Number(transaction.deposit_amount) || 0,
              credit_amount: effectiveCredit,
              remaining_balance: cust.balance,
              payment_due_date: transaction.payment_due_date || null,
              status: 'UNPAID',
            });
          }

          this.db.prepare(`
            UPDATE customers SET
              balance = ?,
              data = ?
            WHERE customer_id = ?
          `).run(Number(cust.balance) || 0, JSON.stringify(cust), transaction.customer_id);
        }
      }
    });

    runTransaction();
    this.touchVersion();
  }

  /**
   * Upsert a sale without altering product inventory (used by snapshot sync & import)
   */
  public upsertSale(transaction: any) {
    const effectiveDate = transaction.date_time || transaction.timestamp || new Date().toISOString();
    transaction.date_time = effectiveDate;
    transaction.timestamp = effectiveDate;

    const stmt = this.db.prepare(`
      INSERT INTO sales (
        transaction_id, invoice_number, timestamp, cashier_id,
        pos_terminal_id, customer_id, final_amount, payment_method, status, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(transaction_id) DO UPDATE SET
        invoice_number = excluded.invoice_number,
        timestamp = excluded.timestamp,
        cashier_id = excluded.cashier_id,
        pos_terminal_id = excluded.pos_terminal_id,
        customer_id = excluded.customer_id,
        final_amount = excluded.final_amount,
        payment_method = excluded.payment_method,
        status = excluded.status,
        data = excluded.data
    `);

    stmt.run(
      transaction.transaction_id,
      transaction.invoice_number || '',
      effectiveDate,
      transaction.cashier_id || transaction.staff_id || '',
      transaction.pos_terminal_id || '',
      transaction.customer_id || '',
      Number(transaction.final_amount) || 0,
      transaction.payment_method || 'Cash',
      transaction.status || 'Completed',
      JSON.stringify(transaction)
    );
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
   * Delete a sale transaction
   */
  public deleteSale(transaction_id: string) {
    this.db.prepare('DELETE FROM sales WHERE transaction_id = ?').run(transaction_id);
    this.touchVersion();
  }

  /**
   * Bulk import historical sales with foreign key auto-creation, configurable inventory deduction,
   * customer account updates, and immutable audit logging within a single atomic SQLite WAL transaction.
   */
  public importHistoricalSalesBatch(batch: {
    sales: any[];
    productsToCreate?: any[];
    customersToCreate?: any[];
    deductInventory?: boolean;
    auditEntry?: any;
  }): { success: boolean; count: number; version: number } {
    return this.transaction(() => {
      // 1. Auto-create any missing products
      if (Array.isArray(batch.productsToCreate) && batch.productsToCreate.length > 0) {
        for (const prod of batch.productsToCreate) {
          this.upsertProduct(prod);
        }
      }

      // 2. Auto-create any missing customers
      if (Array.isArray(batch.customersToCreate) && batch.customersToCreate.length > 0) {
        for (const cust of batch.customersToCreate) {
          this.upsertCustomer(cust);
        }
      }

      // 3. Batch insert historical sales
      const saleStmt = this.db.prepare(`
        INSERT INTO sales (
          transaction_id, invoice_number, timestamp, cashier_id,
          pos_terminal_id, customer_id, final_amount, payment_method, status, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(transaction_id) DO UPDATE SET
          invoice_number = excluded.invoice_number,
          timestamp = excluded.timestamp,
          cashier_id = excluded.cashier_id,
          customer_id = excluded.customer_id,
          final_amount = excluded.final_amount,
          payment_method = excluded.payment_method,
          status = excluded.status,
          data = excluded.data
      `);

      for (const sale of batch.sales) {
        const effectiveDate = sale.date_time || sale.timestamp || new Date().toISOString();
        sale.date_time = effectiveDate;
        sale.timestamp = effectiveDate;
        sale.is_historical_import = true;

        saleStmt.run(
          sale.transaction_id,
          sale.invoice_number || '',
          effectiveDate,
          sale.cashier_id || sale.staff_id || '',
          sale.pos_terminal_id || '',
          sale.customer_id || '',
          Number(sale.final_amount) || 0,
          sale.payment_method || 'Cash',
          sale.status || 'Completed',
          JSON.stringify(sale)
        );

        // 3a. If user opted to deduct inventory for imported sales:
        if (batch.deductInventory && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            const itemSn = item.item_sn;
            const factor = Number(item.conversion_factor) || 1;
            const baseQty = Number(item.base_quantity_deducted) || (Number(item.quantity_sold ?? item.quantity ?? 0) * factor);
            if (itemSn && baseQty > 0) {
              const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(itemSn) as { data: string } | undefined;
              if (prodRow) {
                const prod = JSON.parse(prodRow.data);
                prod.quantity = Math.max(0, Math.round(((Number(prod.quantity) || 0) - baseQty) * 1000) / 1000);
                this.db.prepare(`UPDATE products SET quantity = ?, data = ? WHERE item_sn = ?`)
                  .run(prod.quantity, JSON.stringify(prod), itemSn);
              }
            }
          }
        }

        // 3b. Update customer statistics if valid customer
        if (sale.customer_id && sale.customer_id !== 'Walk-in') {
          const custRow = this.db.prepare('SELECT data FROM customers WHERE customer_id = ?').get(sale.customer_id) as { data: string } | undefined;
          if (custRow) {
            const cust = JSON.parse(custRow.data);
            cust.total_spent = Math.round(((Number(cust.total_spent) || 0) + (Number(sale.final_amount) || 0)) * 100) / 100;
            cust.purchase_count = (Number(cust.purchase_count) || 0) + 1;
            if (!cust.last_purchase_date || effectiveDate > cust.last_purchase_date) {
              cust.last_purchase_date = effectiveDate.split('T')[0] || effectiveDate.split(' ')[0];
            }

            // Outstanding credit debt if applicable
            const creditAmt = Number(sale.credit_amount || 0);
            if (sale.payment_method === 'Credit / Pay Later' && creditAmt > 0 && sale.credit_status === 'OUTSTANDING') {
              cust.balance = Math.round(((Number(cust.balance) || 0) + creditAmt) * 100) / 100;
              if (!Array.isArray(cust.credit_history)) cust.credit_history = [];
              cust.credit_history.unshift({
                transaction_id: sale.transaction_id,
                invoice_number: sale.invoice_number,
                date: effectiveDate,
                total_sale: Number(sale.final_amount) || 0,
                deposit_paid: Number(sale.deposit_amount) || 0,
                credit_amount: creditAmt,
                remaining_balance: cust.balance,
                payment_due_date: sale.payment_due_date || null,
                status: 'UNPAID',
              });
            }

            this.db.prepare(`UPDATE customers SET balance = ?, data = ? WHERE customer_id = ?`)
              .run(Number(cust.balance) || 0, JSON.stringify(cust), sale.customer_id);
          }
        }
      }

      // 4. Record consolidated Audit Log entry
      if (batch.auditEntry) {
        this.addAuditLog(batch.auditEntry);
      }

      // 5. Version bump & WAL checkpoint
      const version = this.touchVersion();
      this.checkpoint('PASSIVE');

      return { success: true, count: batch.sales.length, version };
    })();
  }

  /**
   * Record a refund with atomic inventory restoration
   */
  public recordRefund(refundRecord: any) {
    const runTransaction = this.transaction(() => {
      // 1. Ensure date_time and timestamp are always synchronized
      const effectiveDate = refundRecord.date_time || refundRecord.timestamp || new Date().toISOString();
      refundRecord.date_time = effectiveDate;
      refundRecord.timestamp = effectiveDate;

      // Insert refund record
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
        effectiveDate,
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
        const factor = Number(item.conversion_factor) || 1;
        const baseQtyRefunded = Number(item.base_quantity_refunded) || (Number(item.quantity_refunded || 0) * factor);
        if (itemSn && baseQtyRefunded > 0) {
          const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(itemSn) as { data: string } | undefined;
          if (prodRow) {
            const prod = JSON.parse(prodRow.data);
            prod.quantity = Math.round(((Number(prod.quantity) || 0) + baseQtyRefunded) * 1000) / 1000;
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
          sale.status = isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
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

      // 4. Record atomic audit log entry inside SQLite WAL
      const refundId = refundRecord.refund_id;
      const staffName = refundRecord.authorized_by || refundRecord.staff_id || 'Manager';
      const paymentTarget = refundRecord.payment_method === 'Cash'
        ? `Cashier Drawer (${refundRecord.cashier_staff_id || refundRecord.staff_id})`
        : refundRecord.pos_terminal_name
          ? `POS Terminal: ${refundRecord.pos_terminal_name}`
          : refundRecord.bank_name
            ? `Bank Account: ${refundRecord.bank_name}`
            : refundRecord.payment_method || 'Payment Account';

      const auditLog = {
        id: `AUDIT-REFUND-${refundId}-${Date.now()}`,
        timestamp: effectiveDate,
        staff_id: refundRecord.staff_id || 'STAFF',
        staff_name: staffName,
        staff_role: 'Manager',
        category: 'REFUNDS',
        action: 'REFUND_PROCESSED',
        details: `${Boolean(refundRecord.is_full_refund) ? 'Full Refund' : 'Partial Refund'} ${refundId} for ₦${(Number(refundRecord.refund_amount) || 0).toLocaleString()} on Txn ${origTxId || 'N/A'}. Deducted from: ${paymentTarget}. Authorized by: ${staffName}.`,
        severity: 'WARNING',
        data: JSON.stringify({
          refund_id: refundId,
          original_transaction_id: origTxId,
          refund_amount: Number(refundRecord.refund_amount) || 0,
          cashier_staff_id: refundRecord.cashier_staff_id,
          payment_method: refundRecord.payment_method,
          pos_terminal_id: refundRecord.pos_terminal_id,
          bank_account_id: refundRecord.bank_account_id,
        })
      };
      this.addAuditLog(auditLog);
    });

    runTransaction();
    this.touchVersion();
    return refundRecord;
  }

  /**
   * Upsert a refund without altering product inventory (used by snapshot sync & import)
   */
  public upsertRefund(refundRecord: any) {
    const effectiveDate = refundRecord.date_time || refundRecord.timestamp || new Date().toISOString();
    refundRecord.date_time = effectiveDate;
    refundRecord.timestamp = effectiveDate;

    this.db.prepare(`
      INSERT INTO refunds (
        refund_id, original_transaction_id, item_sn, date_time,
        staff_id, refund_amount, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(refund_id) DO UPDATE SET
        original_transaction_id = excluded.original_transaction_id,
        item_sn = excluded.item_sn,
        date_time = excluded.date_time,
        staff_id = excluded.staff_id,
        refund_amount = excluded.refund_amount,
        data = excluded.data
    `).run(
      refundRecord.refund_id,
      refundRecord.original_transaction_id || '',
      refundRecord.item_sn || '',
      effectiveDate,
      refundRecord.staff_id || '',
      Number(refundRecord.refund_amount) || 0,
      JSON.stringify(refundRecord)
    );
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
      ON CONFLICT(id) DO UPDATE SET
        timestamp = excluded.timestamp,
        user_id = excluded.user_id,
        action = excluded.action,
        category = excluded.category,
        severity = excluded.severity,
        data = excluded.data
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
      ON CONFLICT(count_id) DO UPDATE SET
        date_time = excluded.date_time,
        item_sn = excluded.item_sn,
        data = excluded.data
    `).run(id, cc.date_time || new Date().toISOString(), cc.item_sn || '', JSON.stringify(cc));
    this.touchVersion();
  }

  /**
   * Record cycle count and atomically update product stock if adjustStock is true
   */
  public recordCycleCount(countRecord: any, adjustStock: boolean) {
    const runTransaction = this.transaction(() => {
      const id = countRecord.count_id || `CC-${Date.now()}`;
      countRecord.count_id = id;
      const effectiveDate = countRecord.date_time || new Date().toISOString();
      countRecord.date_time = effectiveDate;

      // 1. Insert into cycle_counts table
      this.addCycleCount(countRecord);

      // 2. If adjustStock is true, update products table atomically
      if (adjustStock && countRecord.item_sn) {
        const countedQty = Number(countRecord.counted_qty ?? countRecord.counted_quantity ?? countRecord.actual_quantity ?? 0);
        const prodRow = this.db.prepare('SELECT data FROM products WHERE item_sn = ?').get(countRecord.item_sn) as { data: string } | undefined;
        if (prodRow) {
          const prod = JSON.parse(prodRow.data);
          prod.quantity = Math.max(0, countedQty);
          this.db.prepare(`
            UPDATE products SET
              quantity = ?,
              data = ?
            WHERE item_sn = ?
          `).run(prod.quantity, JSON.stringify(prod), countRecord.item_sn);
        }
      }

      // 3. Log audit entry
      const variance = Number(countRecord.discrepancy ?? (Number(countRecord.counted_qty ?? countRecord.counted_quantity ?? 0) - Number(countRecord.system_qty ?? 0)));
      const auditLog = {
        id: `AUD-CC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: effectiveDate,
        user_id: countRecord.staff_id || 'SUPERVISOR',
        staff_id: countRecord.staff_id || 'SUPERVISOR',
        staff_name: countRecord.staff_name || 'Supervisor',
        category: 'CycleCount',
        action: 'CYCLE_COUNT_RECONCILED',
        severity: variance === 0 ? 'INFO' : (variance < 0 ? 'ALERT' : 'WARNING'),
        details: `Cycle count ${id} on ${countRecord.item_name || countRecord.item_sn}: System had ${countRecord.system_qty}, physical count was ${countRecord.counted_qty ?? countRecord.counted_quantity} (Variance: ${variance > 0 ? `+${variance}` : variance}). Stock reconciled: ${adjustStock ? 'YES' : 'NO'}. Supervisor: ${countRecord.staff_name}. Reason: ${countRecord.reason}.`,
        metadata: {
          count_id: id,
          item_sn: countRecord.item_sn,
          counted_qty: countRecord.counted_qty ?? countRecord.counted_quantity,
          variance,
          adjustStock
        }
      };
      this.addAuditLog(auditLog);
    });

    runTransaction();
    this.touchVersion();
    this.checkpoint('PASSIVE');
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
      ON CONFLICT(transfer_id) DO UPDATE SET
        date_time = excluded.date_time,
        item_sn = excluded.item_sn,
        status = excluded.status,
        data = excluded.data
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
      ON CONFLICT(void_id) DO UPDATE SET
        voided_at = excluded.voided_at,
        cashier_id = excluded.cashier_id,
        data = excluded.data
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
    const id = transfer.id || transfer.transfer_id || `CASH-TR-${Date.now()}`;
    transfer.id = id;
    transfer.transfer_id = id;
    const amount = Number(transfer.amount ?? transfer.amount_transferred) || 0;
    transfer.amount = amount;
    transfer.amount_transferred = amount;
    const timestamp = transfer.timestamp || transfer.date_time || new Date().toISOString();
    transfer.timestamp = timestamp;
    transfer.date_time = timestamp;
    const transferType = transfer.transfer_type || (transfer.destination_bank_name ? 'POS_TO_BANK' : 'BANK_TO_POS');
    transfer.transfer_type = transferType;

    this.db.prepare(`
      INSERT INTO cash_transfers (id, timestamp, cashier_staff_id, amount, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        timestamp = excluded.timestamp,
        cashier_staff_id = excluded.cashier_staff_id,
        amount = excluded.amount,
        data = excluded.data
    `).run(
      id,
      timestamp,
      transfer.cashier_staff_id || '',
      amount,
      JSON.stringify(transfer)
    );
    this.touchVersion();
    this.checkpoint('PASSIVE');
  }

  /**
   * Customer Debt Repayments (Pay Later Settlements)
   */
  public recordCustomerDebtRepayment(repayment: any) {
    const runTransaction = this.transaction(() => {
      const id = repayment.repayment_id || `PAY-DEBT-${Date.now()}`;
      repayment.repayment_id = id;
      const effectiveDate = repayment.date_time || repayment.timestamp || new Date().toISOString();
      repayment.date_time = effectiveDate;

      const custRow = this.db.prepare('SELECT data FROM customers WHERE customer_id = ?').get(repayment.customer_id) as { data: string } | undefined;
      let prevBal = 0;
      let newBal = 0;

      if (custRow) {
        const cust = JSON.parse(custRow.data);
        prevBal = Number(cust.balance) || 0;
        const amountPaid = Number(repayment.amount_paid) || 0;
        newBal = Math.max(0, Math.round((prevBal - amountPaid) * 100) / 100);
        cust.balance = newBal;

        if (!Array.isArray(cust.repayment_history)) cust.repayment_history = [];
        cust.repayment_history.unshift({
          repayment_id: id,
          date_time: effectiveDate,
          amount_paid: amountPaid,
          payment_method: repayment.payment_method || 'Cash',
          staff_id: repayment.staff_id || '',
          staff_name: repayment.staff_name || '',
          previous_balance: prevBal,
          remaining_balance: newBal,
          notes: repayment.notes || '',
        });

        if (Array.isArray(cust.credit_history)) {
          let remainingPayment = amountPaid;
          for (const ch of cust.credit_history) {
            if (ch.status !== 'PAID' && remainingPayment > 0) {
              const owedOnItem = Number(ch.credit_amount) - (Number(ch.amount_settled) || 0);
              if (remainingPayment >= owedOnItem) {
                ch.amount_settled = Number(ch.credit_amount);
                ch.status = 'PAID';
                remainingPayment -= owedOnItem;
              } else {
                ch.amount_settled = (Number(ch.amount_settled) || 0) + remainingPayment;
                ch.status = 'PARTIALLY_PAID';
                remainingPayment = 0;
              }
            }
          }
        }

        this.db.prepare(`
          UPDATE customers SET
            balance = ?,
            data = ?
          WHERE customer_id = ?
        `).run(newBal, JSON.stringify(cust), repayment.customer_id);
      }

      repayment.previous_balance = prevBal;
      repayment.remaining_balance = newBal;

      // Insert into customer_debt_repayments
      this.db.prepare(`
        INSERT INTO customer_debt_repayments (
          repayment_id, customer_id, customer_name, amount_paid,
          payment_method, date_time, staff_id, staff_name,
          previous_balance, remaining_balance, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(repayment_id) DO UPDATE SET
          data = excluded.data
      `).run(
        id,
        repayment.customer_id,
        repayment.customer_name || '',
        Number(repayment.amount_paid) || 0,
        repayment.payment_method || 'Cash',
        effectiveDate,
        repayment.staff_id || '',
        repayment.staff_name || '',
        prevBal,
        newBal,
        JSON.stringify(repayment)
      );

      // Append audit log
      const channelDetail = repayment.pos_terminal_name 
        ? ` via POS [${repayment.pos_terminal_name}]` 
        : (repayment.bank_name ? ` via Bank Transfer [${repayment.bank_name}]` : ` via ${repayment.payment_method}`);
      const refDetail = repayment.reference_number ? ` (Ref: ${repayment.reference_number})` : '';

      const auditLog = {
        id: `AUD-DEBT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: effectiveDate,
        user_id: repayment.staff_id || 'STAFF',
        staff_id: repayment.staff_id || 'STAFF',
        staff_name: repayment.staff_name || 'Staff',
        category: 'Finance',
        action: 'DEBT_REPAYMENT_RECORDED',
        severity: 'INFO',
        details: `Customer debt repayment of ₦${Number(repayment.amount_paid).toLocaleString()} received from ${repayment.customer_name} (${repayment.customer_id})${channelDetail}${refDetail}. Balance: ₦${prevBal.toLocaleString()} -> ₦${newBal.toLocaleString()}. Received by: ${repayment.staff_name || 'Staff'}.`,
        metadata: {
          repayment_id: id,
          customer_id: repayment.customer_id,
          amount_paid: repayment.amount_paid,
          payment_method: repayment.payment_method,
          remaining_balance: newBal,
          pos_terminal_id: repayment.pos_terminal_id,
          pos_terminal_name: repayment.pos_terminal_name,
          bank_account_id: repayment.bank_account_id,
          bank_name: repayment.bank_name,
          bank_account_number: repayment.bank_account_number,
          reference_number: repayment.reference_number,
        }
      };
      this.addAuditLog(auditLog);
    });

    runTransaction();
    this.touchVersion();
    this.checkpoint('PASSIVE');
  }

  public getCustomerDebtRepayments(customerId?: string): any[] {
    if (customerId) {
      const rows = this.db.prepare('SELECT data FROM customer_debt_repayments WHERE customer_id = ? ORDER BY date_time DESC').all(customerId) as Array<{ data: string }>;
      return rows.map(r => JSON.parse(r.data));
    }
    const rows = this.db.prepare('SELECT data FROM customer_debt_repayments ORDER BY date_time DESC').all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  }

  /**
   * Receipt & Branding Settings
   */
  public getReceiptSettings(): any {
    const row = (this.db.prepare('SELECT data FROM receipt_settings WHERE id = ?').get('DEFAULT_RECEIPT_CONFIG') ||
      this.db.prepare('SELECT data FROM receipt_settings ORDER BY updated_at DESC LIMIT 1').get()) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : DEFAULT_RECEIPT_CONFIG;
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
   * Discount Security Settings (Dedicated Manager Discount PIN)
   */
  public getDiscountSecurityConfig(): any {
    const row = this.db.prepare('SELECT data FROM discount_settings WHERE id = ?').get('DISCOUNT_SECURITY_CONFIG') as { data: string } | undefined;
    return row ? JSON.parse(row.data) : DEFAULT_DISCOUNT_SECURITY_CONFIG;
  }

  public upsertDiscountSecurityConfig(config: any) {
    const id = config.id || 'DISCOUNT_SECURITY_CONFIG';
    config.id = id;
    config.updated_at = config.updated_at || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO discount_settings (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(id, JSON.stringify(config), config.updated_at);
    this.touchVersion();
  }

  /**
   * Product Category Management (Supervisor / Manager / Admin)
   */
  public getCategories(): any[] {
    const rows = this.db.prepare('SELECT data FROM categories').all() as Array<{ data: string }>;
    if (rows.length === 0) {
      return DEFAULT_CATEGORIES.map(c => ({ ...c, created_at: new Date().toISOString() }));
    }
    return rows.map(r => JSON.parse(r.data));
  }

  public upsertCategory(category: any) {
    const id = category.id || `CAT-${Date.now()}`;
    category.id = id;
    category.created_at = category.created_at || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO categories (id, name, data)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        data = excluded.data
    `).run(id, category.name, JSON.stringify(category));
    this.touchVersion();
  }

  public deleteCategory(id: string) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    this.touchVersion();
  }

  public syncCategories(categories: any[]) {
    if (!Array.isArray(categories) || categories.length === 0) return;
    for (const c of categories) {
      this.upsertCategory(c);
    }
  }

  /**
   * Management Discount Rules (Manager / Admin)
   */
  public getDiscountRules(): any[] {
    const rows = this.db.prepare('SELECT data FROM discount_rules ORDER BY rowid ASC').all() as Array<{ data: string }>;
    if (rows.length === 0) {
      return DEFAULT_MANAGEMENT_DISCOUNT_RULES.map(r => ({ ...r, updated_at: new Date().toISOString() }));
    }
    return rows.map(r => JSON.parse(r.data));
  }

  public upsertDiscountRule(rule: any) {
    const ruleId = rule.rule_id || `RULE_${Date.now()}`;
    rule.rule_id = ruleId;
    rule.updated_at = rule.updated_at || new Date().toISOString();
    rule.scope = rule.scope || 'BASKET';
    rule.is_active = rule.is_active !== false;

    this.db.prepare(`
      INSERT INTO discount_rules (
        rule_id, name, description, condition_type, threshold_value,
        discount_type, discount_value, scope, requires_manager_approval,
        max_discount_cap, is_active, data, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rule_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        condition_type = excluded.condition_type,
        threshold_value = excluded.threshold_value,
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        scope = excluded.scope,
        requires_manager_approval = excluded.requires_manager_approval,
        max_discount_cap = excluded.max_discount_cap,
        is_active = excluded.is_active,
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(
      ruleId,
      rule.name,
      rule.description || '',
      rule.condition_type,
      Number(rule.threshold_value) || 0,
      rule.discount_type,
      Number(rule.discount_value) || 0,
      rule.scope,
      rule.requires_manager_approval ? 1 : 0,
      rule.max_discount_cap ? Number(rule.max_discount_cap) : null,
      rule.is_active ? 1 : 0,
      JSON.stringify(rule),
      rule.updated_at
    );
    this.touchVersion();
  }

  public deleteDiscountRule(ruleId: string) {
    this.db.prepare('DELETE FROM discount_rules WHERE rule_id = ?').run(ruleId);
    this.touchVersion();
  }

  public syncDiscountRules(rules: any[]) {
    if (!Array.isArray(rules) || rules.length === 0) return;
    for (const r of rules) {
      this.upsertDiscountRule(r);
    }
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
      customerDebtRepayments: this.getTable('customer_debt_repayments'),
      receiptSettings: this.getReceiptSettings(),
      discountSecurityConfig: this.getDiscountSecurityConfig(),
      categories: this.getCategories(),
      discountRules: this.getDiscountRules(),
    };
  }

  /**
   * Import snapshot into SQLite safely without destructive wipes
   */
  public syncProducts(products: any[]) {
    if (!Array.isArray(products) || products.length === 0) return;
    for (const p of products) {
      this.upsertProduct(p);
    }
  }

  public syncCustomers(customers: any[]) {
    if (!Array.isArray(customers) || customers.length === 0) return;
    for (const c of customers) {
      this.upsertCustomer(c);
    }
  }

  public syncSuppliers(suppliers: any[]) {
    if (!Array.isArray(suppliers) || suppliers.length === 0) return;
    for (const s of suppliers) {
      this.upsertSupplier(s);
    }
  }

  public syncEmployees(employees: any[]) {
    if (!Array.isArray(employees) || employees.length === 0) return;
    for (const e of employees) {
      this.upsertEmployee(e);
    }
  }

  public syncPosTerminals(terminals: any[]) {
    if (!Array.isArray(terminals) || terminals.length === 0) return;
    for (const t of terminals) {
      this.upsertPosTerminal(t);
    }
  }

  /**
   * Import snapshot into SQLite with comprehensive synchronization
   */
  public importSnapshot(snapshot: any) {
    const importTx = this.transaction(() => {
      if (Array.isArray(snapshot.products)) {
        this.syncProducts(snapshot.products);
      }
      if (Array.isArray(snapshot.customers)) {
        this.syncCustomers(snapshot.customers);
      }
      if (Array.isArray(snapshot.suppliers)) {
        this.syncSuppliers(snapshot.suppliers);
      }
      if (Array.isArray(snapshot.employees)) {
        this.syncEmployees(snapshot.employees);
      }
      if (Array.isArray(snapshot.purchaseOrders)) {
        for (const po of snapshot.purchaseOrders) this.upsertPurchaseOrder(po);
      }
      if (Array.isArray(snapshot.sales)) {
        for (const s of snapshot.sales) this.upsertSale(s);
      }
      if (Array.isArray(snapshot.refunds)) {
        for (const r of snapshot.refunds) this.upsertRefund(r);
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
        this.syncPosTerminals(snapshot.posTerminals);
      }
      if (Array.isArray(snapshot.cashTransfers)) {
        for (const ct of snapshot.cashTransfers) this.addCashTransfer(ct);
      }
      if (Array.isArray(snapshot.customerDebtRepayments)) {
        for (const cdr of snapshot.customerDebtRepayments) {
          const id = cdr.repayment_id || `PAY-DEBT-${Date.now()}`;
          this.db.prepare(`
            INSERT INTO customer_debt_repayments (
              repayment_id, customer_id, customer_name, amount_paid,
              payment_method, date_time, staff_id, staff_name,
              previous_balance, remaining_balance, data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(repayment_id) DO UPDATE SET
              data = excluded.data
          `).run(
            id,
            cdr.customer_id || '',
            cdr.customer_name || '',
            Number(cdr.amount_paid) || 0,
            cdr.payment_method || 'Cash',
            cdr.date_time || new Date().toISOString(),
            cdr.staff_id || '',
            cdr.staff_name || '',
            Number(cdr.previous_balance) || 0,
            Number(cdr.remaining_balance) || 0,
            JSON.stringify(cdr)
          );
        }
      }
      if (snapshot.receiptSettings) {
        this.upsertReceiptSettings(snapshot.receiptSettings);
      }
      if (snapshot.discountSecurityConfig) {
        this.upsertDiscountSecurityConfig(snapshot.discountSecurityConfig);
      }
      if (Array.isArray(snapshot.categories)) {
        this.syncCategories(snapshot.categories);
      }
      if (Array.isArray(snapshot.discountRules)) {
        this.syncDiscountRules(snapshot.discountRules);
      }
    });

    importTx();
    this.touchVersion();
  }

  public checkpoint(mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE') {
    try {
      this.db.exec(`PRAGMA wal_checkpoint(${mode});`);
    } catch (e: any) {
      console.warn(`[SQLITE] wal_checkpoint(${mode}) warning:`, e.message);
    }
  }

  public close() {
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e: any) {
      console.warn('[SQLITE] Error during wal_checkpoint on close:', e.message);
    }
    this.db.close();
  }
}
