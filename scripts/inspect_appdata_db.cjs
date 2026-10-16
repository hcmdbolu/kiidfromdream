const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const appDataDbPath = path.join(process.env.APPDATA, 'kiidfromdream-pos', 'data', 'pos_database.db');
console.log('Inspecting DB at:', appDataDbPath);

if (!fs.existsSync(appDataDbPath)) {
  console.log('File does not exist at AppData path');
  process.exit(1);
}

const db = new DatabaseSync(appDataDbPath, { readOnly: true });

// 1. List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all();
console.log('\n--- TABLES IN EXISTING DATABASE ---');
tables.forEach(t => console.log(' • ' + t.name));

// 2. Count rows in all key tables
console.log('\n--- ROW COUNTS IN KEY TABLES ---');
const tableNames = [
  'products',
  'customers',
  'suppliers',
  'employees',
  'sales',
  'refunds',
  'purchase_orders',
  'pos_terminals',
  'cash_transfers',
  'parked_orders',
  'voided_orders',
  'audit_logs',
  'receipt_settings',
  'metadata'
];

for (const name of tableNames) {
  try {
    const row = db.prepare(`SELECT count(*) as count FROM ${name}`).get();
    console.log(` • ${name.padEnd(20)}: ${row.count} records`);
  } catch (e) {
    console.log(` • ${name.padEnd(20)}: TABLE NOT PRESENT (${e.message})`);
  }
}

// 3. Check metadata
console.log('\n--- METADATA ---');
try {
  const meta = db.prepare("SELECT key, value FROM metadata").all();
  meta.forEach(m => console.log(` • ${m.key}: ${m.value}`));
} catch (e) {
  console.log('Could not read metadata:', e.message);
}

// 4. Sample a product, customer, and sale if present
console.log('\n--- SAMPLE DATA INTEGRITY ---');
try {
  const prod = db.prepare("SELECT item_sn, item_name, quantity, selling_price, status FROM products LIMIT 1").get();
  console.log('Sample Product:', prod || 'No products');
} catch (e) { console.log('Products error:', e.message); }

try {
  const cust = db.prepare("SELECT customer_id, name, phone, balance FROM customers LIMIT 1").get();
  console.log('Sample Customer:', cust || 'No customers');
} catch (e) { console.log('Customers error:', e.message); }

try {
  const sale = db.prepare("SELECT transaction_id, invoice_number, timestamp, final_amount, status FROM sales LIMIT 1").get();
  console.log('Sample Sale:', sale || 'No sales yet');
} catch (e) { console.log('Sales error:', e.message); }

try {
  const term = db.prepare("SELECT id, name, type, status FROM pos_terminals LIMIT 3").all();
  console.log('Sample Terminals:', term.length ? term : 'No terminals');
} catch (e) { console.log('Terminals error:', e.message); }

console.log('\n--- DB READ SUCCESSFUL ---');
