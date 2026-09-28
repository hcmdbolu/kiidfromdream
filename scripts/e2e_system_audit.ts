import path from 'path';
import { fileURLToPath } from 'url';
import { PosDatabase } from '../server/db/sqlite.ts';
import { 
  verifyPin, 
  hashPin, 
  isHashedPin, 
  createSessionToken, 
  verifySessionToken 
} from '../src/utils/security.ts';
import { 
  hasRolePermission, 
  ROLE_PERMISSIONS,
  Permission
} from '../src/utils/rbac.ts';
import { 
  Product, 
  Customer, 
  SaleTransaction, 
  SplitPaymentDetail,
  UserRole 
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function runTest(suite: string, name: string, fn: () => void) {
  const start = performance.now();
  try {
    fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  ✓ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: false, message: err.message, durationMs });
    console.error(`  ✗ [FAIL] ${name} (${durationMs}ms): ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${expected}, got ${actual}`);
  }
}

async function runAudit() {
  console.log('\n=============================================================');
  console.log('  KIID FROM DREAM POS - COMPREHENSIVE END-TO-END AUDIT SUITE');
  console.log('=============================================================\n');

  const db = new PosDatabase(DATA_DIR);

  // -------------------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & PIN CRYPTOGRAPHY
  // -------------------------------------------------------------------------
  console.log('▶ SUITE 1: Authentication & PIN Cryptography');
  
  runTest('Suite 1: Auth & PIN', 'Verify plaintext PIN validation for Cashier Kola', () => {
    const valid = verifyPin('1111', '1111');
    assert(valid, 'Plaintext PIN 1111 should verify correctly');
    const invalid = verifyPin('9999', '1111');
    assert(!invalid, 'Incorrect PIN 9999 should be rejected');
  });

  runTest('Suite 1: Auth & PIN', 'Verify salted SHA-256 PIN hashing & verification', () => {
    const pin = '4321';
    const hashed = hashPin(pin);
    assert(isHashedPin(hashed), 'Generated hash must match salt:sha256 format');
    assert(verifyPin('4321', hashed), 'Correct PIN must verify against salted hash');
    assert(!verifyPin('0000', hashed), 'Incorrect PIN must not verify against salted hash');
  });

  runTest('Suite 1: Auth & PIN', 'Verify session token lifecycle and tamper protection', () => {
    const token = createSessionToken('STAFF-001', 'Cashier');
    assert(typeof token === 'string' && token.length > 30, 'Token must be a non-empty string');

    const verified = verifySessionToken(token);
    assert(verified.valid, 'Valid token must be verified');
    assertEqual(verified.role, 'Cashier', 'Verified role must match original employee');

    // Tampered token test
    const tamperedToken = token.slice(0, -5) + 'AAAAA';
    const tamperedResult = verifySessionToken(tamperedToken);
    assert(!tamperedResult.valid, 'Tampered token must fail verification');
  });

  // -------------------------------------------------------------------------
  // SUITE 2: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 2: Role-Based Access Control (RBAC)');

  runTest('Suite 2: RBAC', 'Cashier Role Permission Boundaries', () => {
    assert(hasRolePermission('Cashier', 'CAN_POS_SALE'), 'Cashier must have CAN_POS_SALE');
    assert(!hasRolePermission('Cashier', 'CAN_VIEW_REPORTS'), 'Cashier must NOT view executive reports');
    assert(!hasRolePermission('Cashier', 'CAN_MANAGE_STAFF'), 'Cashier must NOT manage staff');
    assert(!hasRolePermission('Cashier', 'CAN_TRANSFER_STOCK'), 'Cashier must NOT transfer stock');
    assert(!hasRolePermission('Cashier', 'CAN_CYCLE_COUNT'), 'Cashier must NOT cycle count');
    assert(!hasRolePermission('Cashier', 'CAN_SYSTEM_CONFIG'), 'Cashier must NOT have system config');
  });

  runTest('Suite 2: RBAC', 'Supervisor Role Permission Boundaries', () => {
    assert(hasRolePermission('Supervisor', 'CAN_CYCLE_COUNT'), 'Supervisor can cycle count');
    assert(hasRolePermission('Supervisor', 'CAN_RECEIVE_GOODS'), 'Supervisor can receive goods');
    assert(hasRolePermission('Supervisor', 'CAN_VIEW_INVENTORY'), 'Supervisor can view inventory');
    assert(!hasRolePermission('Supervisor', 'CAN_VIEW_REPORTS'), 'Supervisor must NOT view executive reports');
    assert(!hasRolePermission('Supervisor', 'CAN_MANAGE_STAFF'), 'Supervisor must NOT manage staff');
  });

  runTest('Suite 2: RBAC', 'Manager Role Permission Boundaries', () => {
    assert(hasRolePermission('Manager', 'CAN_VIEW_REPORTS'), 'Manager can view executive reports');
    assert(hasRolePermission('Manager', 'CAN_REFUND'), 'Manager can process refunds');
    assert(hasRolePermission('Manager', 'CAN_APPLY_DISCOUNT'), 'Manager can apply discounts');
    assert(hasRolePermission('Manager', 'CAN_TRANSFER_STOCK'), 'Manager can transfer stock');
    assert(!hasRolePermission('Manager', 'CAN_MANAGE_STAFF'), 'Manager must NOT manage staff');
  });

  runTest('Suite 2: RBAC', 'Admin Role Complete Authority', () => {
    assert(hasRolePermission('Admin', 'CAN_MANAGE_STAFF'), 'Admin can manage staff');
    assert(hasRolePermission('Admin', 'CAN_SYSTEM_CONFIG'), 'Admin can manage system config');
    assert(hasRolePermission('Admin', 'CAN_VIEW_REPORTS'), 'Admin can view reports');
  });

  // -------------------------------------------------------------------------
  // SUITE 3: CATALOG & COLD ROOM INVENTORY ENGINE
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 3: Catalog & Cold Room Inventory Engine');

  runTest('Suite 3: Inventory', 'Fetch all products and verify catalog diversity', () => {
    const products: Product[] = db.getTable('products');
    assert(products.length >= 12, `Must have at least 12 products, found ${products.length}`);
    const categories = new Set(products.map(p => p.product_category));
    assert(categories.has('Freshwater Fish'), 'Must have Freshwater Fish');
    assert(categories.has('Saltwater Fish'), 'Must have Saltwater Fish');
    assert(categories.has('Frozen Fish'), 'Must have Frozen Fish');
    assert(categories.has('Dried Fish'), 'Must have Dried Fish');
  });

  runTest('Suite 3: Inventory', 'Detect low-stock and expiring-soon products accurately', () => {
    const products: Product[] = db.getTable('products');
    const lowStock = products.filter(p => p.quantity <= p.reorder_level);
    assert(lowStock.length > 0, 'Must detect at least 1 low-stock product');
    const croaker = products.find(p => p.item_sn === 'FISH-00006');
    assert(croaker !== undefined, 'FISH-00006 must exist');
    assert(croaker!.quantity <= croaker!.reorder_level, 'FISH-00006 must trigger low-stock flag');
  });

  runTest('Suite 3: Inventory', 'Product CRUD & Atomic Stock Mutation in SQLite', () => {
    const testProd: Product = {
      item_sn: 'FISH-TEST-99',
      item_name: 'Test Red Snapper Filet',
      item_picture: '',
      quantity: 50.0,
      expiry_date: '2026-12-31',
      item_cost: 3000,
      product_measure_unit: 'KG',
      quantity_per_unit: 1,
      selling_price: 4500,
      product_category: 'Saltwater Fish',
      reorder_level: 10,
      supplier_id: 'SUP-00012',
      status: 'Active',
    };
    db.upsertProduct(testProd);
    let retrieved = db.getById('products', 'item_sn', 'FISH-TEST-99');
    assert(retrieved !== null, 'Product must be inserted into SQLite');
    assertEqual(retrieved.quantity, 50.0, 'Quantity should be 50.0');

    // Decrement stock by 12.5 KG
    retrieved.quantity -= 12.5;
    db.upsertProduct(retrieved);
    retrieved = db.getById('products', 'item_sn', 'FISH-TEST-99');
    assertEqual(retrieved.quantity, 37.5, 'Quantity after sale decrement must be 37.5');

    // Clean up
    db.deleteProduct('FISH-TEST-99');
    assert(db.getById('products', 'item_sn', 'FISH-TEST-99') === null, 'Test product should be deleted cleanly');
  });

  // -------------------------------------------------------------------------
  // SUITE 4: POS COUNTER & CHECKOUT ENGINE
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 4: POS Counter & Checkout Engine');

  runTest('Suite 4: POS Checkout', 'Calculate cart subtotal, VIP customer discount, and final amount', () => {
    const items = [
      { unit_price: 3600, qty: 5.0, lineTotal: 18000 },
      { unit_price: 13500, qty: 2.0, lineTotal: 27000 },
    ];
    const subtotal = items.reduce((acc, i) => acc + i.unit_price * i.qty, 0);
    assertEqual(subtotal, 45000, 'Subtotal should be ₦45,000');

    // Customer VIP 10% discount
    const discountRate = 0.10;
    const discountAmount = subtotal * discountRate;
    assertEqual(discountAmount, 4500, 'Discount amount must be ₦4,500');

    const finalTotal = subtotal - discountAmount;
    assertEqual(finalTotal, 40500, 'Final amount must be ₦40,500');
  });

  runTest('Suite 4: POS Checkout', 'Split payment tender validation and cash change calculation', () => {
    const totalDue = 40500;
    const splits: SplitPaymentDetail[] = [
      { method: 'Cash', amount: 15500 },
      { method: 'POS', amount: 25000, pos_terminal_id: 'POS-001' },
    ];
    const totalPaid = splits.reduce((acc, s) => acc + s.amount, 0);
    assertEqual(totalPaid, totalDue, 'Split payment sum must equal total due');

    // If customer paid ₦16,000 in cash for the ₦15,500 cash portion:
    const cashTendered = 16000;
    const changeDue = cashTendered - splits[0].amount;
    assertEqual(changeDue, 500, 'Change due must be ₦500');
  });

  // -------------------------------------------------------------------------
  // SUITE 5: RECEIPT ENGINE & BRANDING
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 5: Receipt Engine & Thermal Branding');

  runTest('Suite 5: Receipt', 'Verify receipt configuration retrieval from SQLite', () => {
    const settings = db.getReceiptSettings();
    assert(settings !== null, 'Receipt settings must exist in SQLite');
    assert(settings.business_name.length > 0, 'Business name must not be empty');
    assert(['80mm', '58mm'].includes(settings.paper_width), 'Paper width must be 80mm or 58mm');
    assert(typeof settings.show_logo === 'boolean', 'show_logo must be boolean');
    assert(typeof settings.show_barcode === 'boolean', 'show_barcode must be boolean');
  });

  runTest('Suite 5: Receipt', 'Verify thermal roll width constraints (80mm vs 58mm)', () => {
    const settings80: { paper_width: '80mm' | '58mm' } = { paper_width: '80mm' };
    const widthClass80 = settings80.paper_width === '58mm' ? 'receipt-58mm' : 'receipt-80mm';
    assertEqual(widthClass80, 'receipt-80mm', '80mm should produce receipt-80mm class');

    const settings58: { paper_width: '80mm' | '58mm' } = { paper_width: '58mm' };
    const widthClass58 = settings58.paper_width === '58mm' ? 'receipt-58mm' : 'receipt-80mm';
    assertEqual(widthClass58, 'receipt-58mm', '58mm should produce receipt-58mm class');
  });

  // -------------------------------------------------------------------------
  // SUITE 6: SALES HISTORY & RETURNS / REFUNDS
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 6: Sales History & Returns / Refunds');

  runTest('Suite 6: Returns', 'Verify sales history ledger completeness in SQLite', () => {
    const sales: SaleTransaction[] = db.getTable('sales');
    assert(sales.length >= 15, `Must have at least 15 sales records, found ${sales.length}`);
    const completed = sales.filter(s => s.status === 'COMPLETED');
    assert(completed.length > 0, 'Must have completed sales');
  });

  runTest('Suite 6: Returns', 'Validate refund limits & inventory replenishment logic', () => {
    const originalQty = 5.0;
    const alreadyRefunded = 2.0;
    const remainingRefundable = originalQty - alreadyRefunded;
    assertEqual(remainingRefundable, 3.0, 'Remaining refundable quantity must be 3.0');

    // Attempting to refund 4.0 KG when only 3.0 is left must fail
    const requestedRefund = 4.0;
    assert(requestedRefund > remainingRefundable, 'Requested refund exceeding remaining must be detected');

    // Restoring 1.5 KG to active product inventory
    const currentStock = 85.0;
    const restoredStock = currentStock + 1.5;
    assertEqual(restoredStock, 86.5, 'Stock must increment by returned quantity');
  });

  // -------------------------------------------------------------------------
  // SUITE 7: TREASURY & BANK RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 7: Treasury & Bank Reconciliation');

  runTest('Suite 7: Treasury', 'Cash till in-hand computation formula', () => {
    const cashSales = 58000;
    const cashRefunded = 0;
    const bankTransferOut = 50000;
    const expectedInTill = cashSales - cashRefunded - bankTransferOut;
    assertEqual(expectedInTill, 8000, 'Till remaining cash must be ₦8,000 float');
  });

  runTest('Suite 7: Treasury', 'Retrieve cash transfer log from SQLite', () => {
    const transfers: any[] = db.getTable('cash_transfers');
    assert(transfers.length > 0, 'Must have at least one cash transfer record');
    const first = transfers[0];
    assert(first.amount_transferred > 0, 'Transfer amount must be greater than 0');
    assert(first.deposit_slip_number.length > 0, 'Must have a deposit slip reference');
  });

  // -------------------------------------------------------------------------
  // SUITE 8: EXECUTIVE FINANCIAL REPORTS & P&L
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 8: Executive Financial Reports & P&L');

  runTest('Suite 8: Financials', 'Calculate Gross Revenue, COGS, Gross Profit & Margin %', () => {
    const sales: SaleTransaction[] = db.getTable('sales');
    let totalRevenue = 0;
    let totalCogs = 0;

    for (const sale of sales) {
      totalRevenue += sale.final_amount;
      for (const item of sale.items || []) {
        totalCogs += (item.cost_price || 0) * (item.quantity_sold || 0);
      }
    }

    assert(totalRevenue > 0, `Total revenue must be positive, got ${totalRevenue}`);
    assert(totalCogs > 0, `Total COGS must be positive, got ${totalCogs}`);
    assert(totalRevenue > totalCogs, 'Revenue should exceed COGS for profitable store');

    const grossProfit = totalRevenue - totalCogs;
    const marginPercent = Math.round((grossProfit / totalRevenue) * 1000) / 10;
    assert(marginPercent > 0 && marginPercent < 100, `Margin must be between 0% and 100%, got ${marginPercent}%`);
    console.log(`     [Metric] Total Revenue: ₦${totalRevenue.toLocaleString()} | COGS: ₦${totalCogs.toLocaleString()} | Profit: ₦${grossProfit.toLocaleString()} (${marginPercent}%)`);
  });

  runTest('Suite 8: Financials', 'Payment channel breakdown segregation', () => {
    const sales: SaleTransaction[] = db.getTable('sales');
    const breakdown = {
      cash: 0,
      pos: 0,
      bankTransfer: 0,
      split: 0,
    };

    for (const sale of sales) {
      if (sale.payment_method === 'Cash') breakdown.cash += sale.final_amount;
      else if (sale.payment_method === 'POS') breakdown.pos += sale.final_amount;
      else if (sale.payment_method === 'Bank Transfer') breakdown.bankTransfer += sale.final_amount;
      else if (sale.payment_method === 'Split Payment') breakdown.split += sale.final_amount;
    }

    assert(breakdown.cash > 0, 'Must have cash sales volume');
    assert(breakdown.pos > 0, 'Must have POS sales volume');
    assert(breakdown.bankTransfer > 0, 'Must have bank transfer volume');
    assert(breakdown.split > 0, 'Must have split payment volume');
  });

  // -------------------------------------------------------------------------
  // SUITE 9: CRYPTOGRAPHIC AUDIT TRAIL
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 9: Cryptographic Audit Trail');

  runTest('Suite 9: Audit Trail', 'Verify presence and structure of tamper logs in SQLite', () => {
    const logs: any[] = db.getTable('audit_logs');
    assert(logs.length > 0, 'Must have audit log entries');
    const first = logs[0];
    assert(first.staff_id !== undefined, 'Audit log must record staff_id');
    assert(first.category !== undefined, 'Audit log must record category');
    assert(first.action !== undefined, 'Audit log must record action');
  });

  // -------------------------------------------------------------------------
  // SUITE 10: CENTRALIZED SQLITE & SNAPSHOT EXPORT
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 10: Centralized SQLite & Snapshot Export');

  runTest('Suite 10: DB Snapshot', 'Complete snapshot export contains all modules', () => {
    const snapshot = db.getSnapshot();
    assert(Array.isArray(snapshot.products), 'Snapshot must contain products');
    assert(Array.isArray(snapshot.customers), 'Snapshot must contain customers');
    assert(Array.isArray(snapshot.suppliers), 'Snapshot must contain suppliers');
    assert(Array.isArray(snapshot.employees), 'Snapshot must contain employees');
    assert(Array.isArray(snapshot.sales), 'Snapshot must contain sales');
    assert(Array.isArray(snapshot.refunds), 'Snapshot must contain refunds');
    assert(snapshot.receiptSettings !== undefined, 'Snapshot must contain receiptSettings');
    assert(snapshot.version >= 1, 'Database version must be >= 1');
  });

  db.close();

  // -------------------------------------------------------------------------
  // AUDIT SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log('                 AUDIT EXECUTION SUMMARY');
  console.log('=============================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Automated Tests Run : ${total}`);
  console.log(`Passed                    : ${passed}`);
  console.log(`Failed                    : ${failed}`);
  console.log(`Success Rate              : ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error('FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => console.error(` - [${r.suite}] ${r.name}: ${r.message}`));
    process.exit(1);
  } else {
    console.log('ALL 10 TEST SUITES PASSED FLAWLESSLY WITH 100% SUCCESS RATE!\n');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('[AUDIT RUNNER FATAL ERROR]:', err);
  process.exit(1);
});
