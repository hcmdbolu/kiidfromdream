import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { PosDatabase, DEFAULT_CATEGORIES, DEFAULT_MANAGEMENT_DISCOUNT_RULES } from '../server/db/sqlite.ts';
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
  Supplier,
  Employee,
  PurchaseOrder,
  SaleTransaction, 
  RefundRecord,
  SplitPaymentDetail,
  UserRole,
  PosTerminalConfig,
  CashToBankTransfer,
  ReceiptBrandingConfig
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function runComprehensiveAudit() {
  console.log('\n================================================================');
  console.log('  KIID FROM DREAM POS - COMPREHENSIVE END-TO-END SYSTEM AUDIT');
  console.log('================================================================\n');

  // Create an isolated sandbox directory for the test run so live production data is untouched
  const sandboxDir = path.join(os.tmpdir(), `pos_audit_sandbox_${Date.now()}`);
  fs.mkdirSync(sandboxDir, { recursive: true });

  console.log(`[AUDIT SANDBOX] Created isolated database runtime in: ${sandboxDir}\n`);

  let db = new PosDatabase(sandboxDir);

  // -------------------------------------------------------------------------
  // SUITE 1: FRESH INSTALL SEEDING & UPGRADE SAFETY
  // -------------------------------------------------------------------------
  console.log('▶ SUITE 1: Fresh Setup vs. Upgrade Safety (setup.exe)');

  runTest('Suite 1: Fresh Setup', 'Verify Super Admin Boluwatife is seeded with correct password hash', () => {
    const employees = db.getTable('employees');
    const superAdmin = employees.find((e: any) => e.username?.toLowerCase() === 'boluwatife');
    assert(superAdmin !== undefined, 'Super Admin Boluwatife must be seeded automatically in clean database');
    assertEqual(superAdmin.role, 'Super Admin', 'Boluwatife must have Super Admin role');
    assert(verifyPin('2030170611', superAdmin.pin), 'Super Admin password "2030170611" must verify against stored hash');
  });

  runTest('Suite 1: Fresh Setup', 'Verify clean state has zero transactional junk (clean slate for new stores)', () => {
    const products = db.getTable('products');
    const sales = db.getTable('sales');
    const customers = db.getTable('customers');
    const suppliers = db.getTable('suppliers');
    const purchaseOrders = db.getTable('purchase_orders');
    const refunds = db.getTable('refunds');

    assertEqual(products.length, 0, 'Clean database must have 0 products');
    assertEqual(sales.length, 0, 'Clean database must have 0 sales');
    assertEqual(customers.length, 0, 'Clean database must have 0 customers');
    assertEqual(suppliers.length, 0, 'Clean database must have 0 suppliers');
    assertEqual(purchaseOrders.length, 0, 'Clean database must have 0 purchase orders');
    assertEqual(refunds.length, 0, 'Clean database must have 0 refunds');
  });

  runTest('Suite 1: Fresh Setup', 'Verify standard initial categories and discount rules are seeded', () => {
    const categories = db.getCategories();
    assert(categories.length >= 12, `Must seed standard categories (found ${categories.length})`);
    assert(categories.some((c: any) => c.name === 'Freshwater Fish'), 'Must include Freshwater Fish category');
    assert(categories.some((c: any) => c.name === 'Groceries'), 'Must include Groceries category');

    const rules = db.getDiscountRules();
    assert(rules.length >= 3, `Must seed default discount rules (found ${rules.length})`);
  });

  runTest('Suite 1: Upgrade Safety', 'Verify re-opening existing database preserves user data without overwriting', () => {
    // Add custom staff and a category
    const customStaff: Employee = {
      staff_id: 'STAFF-TEST-01',
      staff_name: 'Test Cashier Jane',
      username: 'jane_pos',
      role: 'Cashier',
      pin: hashPin('1234'),
      status: 'Active',
      shift_time: 'Morning',
      date_hired: '2026-10-01',
      phone_number: '08012345678',
    };
    db.upsertEmployee(customStaff);

    // Close and simulate app restart / update
    db.close();
    db = new PosDatabase(sandboxDir);

    const reloadedStaff = db.getById('employees', 'staff_id', 'STAFF-TEST-01');
    assert(reloadedStaff !== null, 'Custom staff must persist across database restarts');
    assertEqual(reloadedStaff.staff_name, 'Test Cashier Jane', 'Staff name must remain intact');
    assert(verifyPin('1234', reloadedStaff.pin), 'Staff PIN must remain valid');
  });

  // -------------------------------------------------------------------------
  // SUITE 2: RBAC PERMISSION MATRIX & ALL-STAFF BACKUP ACCESS
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 2: Role-Based Access Control (RBAC) & Backup Access');

  runTest('Suite 2: RBAC', 'Universal Data Backup & Restore permission (CAN_BACKUP_RESTORE) granted to all roles', () => {
    const allRoles: UserRole[] = ['Cashier', 'Supervisor', 'Manager', 'Admin', 'Super Admin'];
    for (const role of allRoles) {
      assert(
        hasRolePermission(role, 'CAN_BACKUP_RESTORE'),
        `Role "${role}" must have permission CAN_BACKUP_RESTORE`
      );
    }
  });

  runTest('Suite 2: RBAC', 'Security role boundaries and strict segregation', () => {
    // Cashier restricted from administrative modules
    assert(hasRolePermission('Cashier', 'CAN_POS_SALE'), 'Cashier can perform POS sales');
    assert(!hasRolePermission('Cashier', 'CAN_VIEW_REPORTS'), 'Cashier cannot view financial reports');
    assert(!hasRolePermission('Cashier', 'CAN_MANAGE_STAFF'), 'Cashier cannot manage staff');
    assert(!hasRolePermission('Cashier', 'CAN_FACTORY_RESET'), 'Cashier cannot factory reset');

    // Supervisor privileges
    assert(hasRolePermission('Supervisor', 'CAN_RECEIVE_GOODS'), 'Supervisor can receive PO goods');
    assert(hasRolePermission('Supervisor', 'CAN_CYCLE_COUNT'), 'Supervisor can perform cycle counts');
    assert(!hasRolePermission('Supervisor', 'CAN_VIEW_REPORTS'), 'Supervisor cannot view executive reports');

    // Manager privileges
    assert(hasRolePermission('Manager', 'CAN_REFUND'), 'Manager can process refunds');
    assert(hasRolePermission('Manager', 'CAN_CREATE_PO'), 'Manager can create POs');
    assert(hasRolePermission('Manager', 'CAN_VIEW_REPORTS'), 'Manager can view reports');
    assert(!hasRolePermission('Manager', 'CAN_MANAGE_STAFF'), 'Manager cannot edit staff');

    // Super Admin root privileges
    assert(hasRolePermission('Super Admin', 'CAN_FACTORY_RESET'), 'Super Admin exclusively has CAN_FACTORY_RESET');
    assert(hasRolePermission('Super Admin', 'CAN_MANAGE_ADMINS'), 'Super Admin exclusively has CAN_MANAGE_ADMINS');
  });

  // -------------------------------------------------------------------------
  // SUITE 3: INVENTORY & OPERATIONS (CRUD, BATCH EXPIRIES, POs)
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 3: Inventory & Operations (Products, Categories, POs)');

  const testProduct1: Product = {
    item_sn: 'ITEM-CATFISH-01',
    item_name: 'Fresh Live Catfish (Point & Kill)',
    item_picture: '',
    quantity: 100.0,
    expiry_date: '2026-10-30',
    item_cost: 2500,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 3500,
    product_category: 'Freshwater Fish',
    reorder_level: 20,
    supplier_id: 'SUP-001',
    status: 'Active',
  };

  const testProduct2: Product = {
    item_sn: 'ITEM-MACKEREL-02',
    item_name: 'Dutch Frozen Mackerel (Titus)',
    item_picture: '',
    quantity: 40.0,
    expiry_date: '2026-12-31',
    item_cost: 45000,
    product_measure_unit: 'CARTON',
    quantity_per_unit: 1,
    selling_price: 55000,
    product_category: 'Frozen Fish',
    reorder_level: 10,
    supplier_id: 'SUP-002',
    status: 'Active',
  };

  runTest('Suite 3: Inventory', 'Insert and query products with custom categories and expiry dates', () => {
    db.upsertProduct(testProduct1);
    db.upsertProduct(testProduct2);

    const p1 = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assert(p1 !== null, 'Product 1 must exist in database');
    assertEqual(p1.quantity, 100.0, 'Initial quantity must be 100');
    assertEqual(p1.expiry_date, '2026-10-30', 'Expiry date must match');

    const p2 = db.getById('products', 'item_sn', 'ITEM-MACKEREL-02');
    assert(p2 !== null, 'Product 2 must exist in database');
    assertEqual(p2.selling_price, 55000, 'Selling price must match');
  });

  runTest('Suite 3: Inventory', 'Supplier registration, updates and persistence in SQLite', () => {
    const supplier: Supplier = {
      supplier_id: 'SUP-001',
      supplier_name: 'Metro Farms & Fisheries Ltd',
      contact_person: 'Emeka Nwosu',
      phone_number: '08023456789',
      email: 'sales@metrofarms.com',
      address: '15 Fishery Wharf, Epe, Lagos',
      products_supplied: ['Freshwater Fish', 'Catfish Feed'],
      lead_time_days: 2,
      payment_terms: 'Cash on Delivery',
      average_unit_cost: 2500,
      reliability_rating: 4.9,
      status: 'Active',
    };
    db.upsertSupplier(supplier);

    const savedSupp = db.getById('suppliers', 'supplier_id', 'SUP-001');
    assert(savedSupp !== null, 'Supplier must be saved in database');
    assertEqual(savedSupp.supplier_name, 'Metro Farms & Fisheries Ltd', 'Supplier name must match');

    // Update supplier
    db.upsertSupplier({ ...savedSupp, contact_person: 'Emeka Nwosu (Senior Mgr)' });
    const updatedSupp = db.getById('suppliers', 'supplier_id', 'SUP-001');
    assertEqual(updatedSupp.contact_person, 'Emeka Nwosu (Senior Mgr)', 'Supplier updates must persist');
  });

  runTest('Suite 3: Inventory', 'Critical Partial Shipment & Cumulative Backorder Delivery: Accurate Inventory Increments', () => {
    // Starting condition: testProduct1 has quantity = 100.0
    const initialProduct = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(initialProduct.quantity, 100.0, 'Baseline stock should be 100 kg');

    // 1. Create Purchase Order for 50 kg
    const po: PurchaseOrder = {
      po_id: 'PO-2026-001',
      supplier_id: 'SUP-001',
      status: 'PENDING',
      order_date: '2026-10-01',
      expected_delivery_date: '2026-10-10',
      total_cost: 125000,
      items: [
        {
          item_sn: 'ITEM-CATFISH-01',
          item_name: 'Fresh Live Catfish (Point & Kill)',
          quantity_ordered: 50.0,
          quantity_received: 0,
          quantity_pending: 50.0,
          unit_cost: 2500,
          total_cost: 125000,
          expiry_date: '2026-11-15',
        },
      ],
      receiving_history: [],
    };
    db.upsertPurchaseOrder(po);

    let createdPo = db.getById('purchase_orders', 'id', 'PO-2026-001');
    assertEqual(createdPo.status, 'PENDING', 'PO starts as PENDING');
    assertEqual(createdPo.items[0].quantity_ordered, 50.0, 'Ordered qty is 50');
    assertEqual(createdPo.items[0].quantity_received, 0, 'Received qty starts at 0');
    assertEqual(createdPo.items[0].quantity_pending, 50.0, 'Pending qty starts at 50');

    // 2. PARTIAL DELIVERY #1: Receive 20 kg out of 50 kg
    const batch1Qty = 20.0;
    const batch1Item = createdPo.items[0];
    const prevReceived1 = batch1Item.quantity_received || 0;
    batch1Item.quantity_received = prevReceived1 + batch1Qty;
    batch1Item.quantity_pending = Math.max(0, batch1Item.quantity_ordered - batch1Item.quantity_received);
    batch1Item.expiry_date = '2026-11-20';

    createdPo.status = 'PARTIALLY_RECEIVED';
    createdPo.quantity_received = batch1Item.quantity_received;
    createdPo.quantity_pending = batch1Item.quantity_pending;
    createdPo.receiving_history = [
      {
        receipt_id: 'GRN-001',
        received_at: new Date().toISOString(),
        received_by_staff_id: 'STAFF-001',
        received_by_staff_name: 'Boluwatife (Admin)',
        received_by_role: 'Super Admin',
        delivery_note_ref: 'WAYBILL-8901',
        notes: 'First partial batch arrived in aerated truck',
        items: [
          {
            item_sn: 'ITEM-CATFISH-01',
            item_name: 'Fresh Live Catfish (Point & Kill)',
            quantity_received: batch1Qty,
            expiry_date: '2026-11-20',
          },
        ],
      },
    ];
    db.upsertPurchaseOrder(createdPo);

    // Atomically increment product inventory by exact batch delta (+20 kg)
    const pAfterBatch1 = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    pAfterBatch1.quantity = (pAfterBatch1.quantity || 0) + batch1Qty;
    pAfterBatch1.expiry_date = '2026-11-20';
    db.upsertProduct(pAfterBatch1);

    // Verify after Partial Delivery #1
    const p1Check = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(p1Check.quantity, 120.0, 'Stock must increment by 20 kg (100 + 20 = 120)');
    assertEqual(p1Check.expiry_date, '2026-11-20', 'Expiry date must update to batch 1 expiry');

    const poCheck1 = db.getById('purchase_orders', 'id', 'PO-2026-001');
    assertEqual(poCheck1.status, 'PARTIALLY_RECEIVED', 'PO status must be PARTIALLY_RECEIVED');
    assertEqual(poCheck1.items[0].quantity_received, 20.0, 'Received quantity must be 20');
    assertEqual(poCheck1.items[0].quantity_pending, 30.0, 'Pending quantity must be 30 remaining backorders');
    assertEqual(poCheck1.receiving_history.length, 1, 'Receiving history must have 1 receipt');

    // 3. CUMULATIVE DELIVERY #2 (Backorder resolution): Receive remaining 30 kg
    const batch2Qty = 30.0;
    const batch2Item = poCheck1.items[0];
    const prevReceived2 = batch2Item.quantity_received || 0; // 20
    batch2Item.quantity_received = prevReceived2 + batch2Qty; // 20 + 30 = 50
    batch2Item.quantity_pending = Math.max(0, batch2Item.quantity_ordered - batch2Item.quantity_received); // 0
    batch2Item.expiry_date = '2026-12-05';

    poCheck1.status = 'RECEIVED'; // Fully received
    poCheck1.actual_delivery_date = '2026-10-04';
    poCheck1.quantity_received = batch2Item.quantity_received;
    poCheck1.quantity_pending = 0;
    poCheck1.receiving_history.push({
      receipt_id: 'GRN-002',
      received_at: new Date().toISOString(),
      received_by_staff_id: 'STAFF-001',
      received_by_staff_name: 'Boluwatife (Admin)',
      received_by_role: 'Super Admin',
      delivery_note_ref: 'WAYBILL-8945',
      notes: 'Final remaining balance / backorder delivered',
      items: [
        {
          item_sn: 'ITEM-CATFISH-01',
          item_name: 'Fresh Live Catfish (Point & Kill)',
          quantity_received: batch2Qty,
          expiry_date: '2026-12-05',
        },
      ],
    });
    db.upsertPurchaseOrder(poCheck1);

    // Atomically increment product inventory by second batch delta (+30 kg)
    const pAfterBatch2 = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    pAfterBatch2.quantity = (pAfterBatch2.quantity || 0) + batch2Qty;
    pAfterBatch2.expiry_date = '2026-12-05';
    db.upsertProduct(pAfterBatch2);

    // Verify after Cumulative Delivery #2
    const p2Check = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(p2Check.quantity, 150.0, 'Stock must accurately accumulate to 150 kg (100 + 20 + 30 = 150) without overwriting or double counting');
    assertEqual(p2Check.expiry_date, '2026-12-05', 'Expiry date must update to batch 2 expiry');

    const poCheck2 = db.getById('purchase_orders', 'id', 'PO-2026-001');
    assertEqual(poCheck2.status, 'RECEIVED', 'PO status must now be fully RECEIVED');
    assertEqual(poCheck2.items[0].quantity_received, 50.0, 'Total received must be 50');
    assertEqual(poCheck2.items[0].quantity_pending, 0, 'Total pending must be 0');
    assertEqual(poCheck2.receiving_history.length, 2, 'Receiving history must have 2 distinct receipt batches');
  });

  runTest('Suite 3: Inventory', 'Database Restart Simulation: Cumulative deliveries and PO status survive app restart', () => {
    // Checkpoint SQLite WAL and close database connection
    db.checkpoint('PASSIVE');
    db.close();

    // Reopen brand new database instance on the same file path (simulating app close and restart)
    db = new PosDatabase(sandboxDir);

    // Verify product stock persisted
    const restoredProduct = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assert(restoredProduct !== null, 'Product must persist across app restart');
    assertEqual(restoredProduct.quantity, 150.0, 'Stock of 150.0 kg must survive app restarts');
    assertEqual(restoredProduct.expiry_date, '2026-12-05', 'Batch expiry must survive app restarts');

    // Verify PO persisted
    const restoredPo = db.getById('purchase_orders', 'id', 'PO-2026-001');
    assert(restoredPo !== null, 'Purchase Order must persist across app restart');
    assertEqual(restoredPo.status, 'RECEIVED', 'PO status must remain RECEIVED after restart');
    assertEqual(restoredPo.items[0].quantity_ordered, 50.0, 'Ordered qty persists');
    assertEqual(restoredPo.items[0].quantity_received, 50.0, 'Received qty persists');
    assertEqual(restoredPo.items[0].quantity_pending, 0, 'Pending qty persists as 0');
    assertEqual(restoredPo.receiving_history.length, 2, 'All receipt batches persist');
    assertEqual(restoredPo.receiving_history[0].delivery_note_ref, 'WAYBILL-8901', 'First receipt docket ref intact');
    assertEqual(restoredPo.receiving_history[1].delivery_note_ref, 'WAYBILL-8945', 'Second receipt docket ref intact');
  });

  runTest('Suite 3: Inventory', 'Multi-item PO creation and delete operations', () => {
    const multiPo: PurchaseOrder = {
      po_id: 'PO-2026-MULTI',
      supplier_id: 'SUP-001',
      status: 'CANCELLED',
      order_date: '2026-10-02',
      expected_delivery_date: '2026-10-15',
      total_cost: 80000,
      items: [
        {
          item_sn: 'ITEM-CATFISH-01',
          item_name: 'Fresh Live Catfish (Point & Kill)',
          quantity_ordered: 10.0,
          quantity_received: 0,
          unit_cost: 2500,
          total_cost: 25000,
        },
        {
          item_sn: 'ITEM-MACKEREL-02',
          item_name: 'Dutch Frozen Mackerel (Titus)',
          quantity_ordered: 1.0,
          quantity_received: 0,
          unit_cost: 55000,
          total_cost: 55000,
        },
      ],
    };
    db.upsertPurchaseOrder(multiPo);

    const saved = db.getById('purchase_orders', 'id', 'PO-2026-MULTI');
    assert(saved !== null, 'Multi-item PO must be saved');
    assertEqual(saved.items.length, 2, 'Must have 2 items');

    // Delete PO
    const deleteResult = db.deletePurchaseOrder('PO-2026-MULTI');
    assert(deleteResult.success, 'Deleting PO should succeed');
    const afterDelete = db.getById('purchase_orders', 'id', 'PO-2026-MULTI');
    assert(afterDelete === null, 'PO must be completely removed from database after deletion');
  });

  // -------------------------------------------------------------------------
  // SUITE 4: INTER-MODULE POS CHECKOUT & PERSISTENCE
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 4: POS Checkout, Stock Deduction & Inter-Module Sync');

  runTest('Suite 4: POS Checkout', 'Complete sale transaction with stock deduction, customer updates, and audit logging', () => {
    // 1. Register Customer
    const testCustomer: Customer = {
      customer_id: 'CUST-001',
      full_name: 'Alhaji Musa Ibrahim',
      phone_number: '08031112233',
      customer_type: 'Retail',
      discount_percent: 5,
      total_spent: 0,
      purchase_count: 0,
      preferred_product: 'ITEM-CATFISH-01',
      last_purchase_date: '',
      registration_date: new Date().toISOString(),
    };
    db.upsertCustomer(testCustomer);

    // 2. Perform POS Checkout
    const initialStock = db.getById('products', 'item_sn', 'ITEM-CATFISH-01').quantity; // 150.0
    const qtySold = 10.0;
    const unitPrice = 3500;
    const subtotal = qtySold * unitPrice; // 35,000
    const discountAmount = subtotal * 0.05; // 1,750 (5% loyalty)
    const finalAmount = subtotal - discountAmount; // 33,250

    const sale: SaleTransaction = {
      transaction_id: 'TXN-2026-001',
      date_time: new Date().toISOString(),
      staff_id: 'STAFF-SUPER-001',
      customer_id: 'CUST-001',
      total_amount: subtotal,
      discount_applied: discountAmount,
      final_amount: finalAmount,
      payment_method: 'POS',
      pos_terminal_name: 'Moniepoint POS - Counter 1',
      status: 'COMPLETED',
      items: [
        {
          item_sn: 'ITEM-CATFISH-01',
          item_name: 'Fresh Live Catfish (Point & Kill)',
          unit: 'KG',
          unit_price: unitPrice,
          cost_price: 2500,
          quantity_sold: qtySold,
          total_amount: subtotal,
        },
      ],
    };

    // Save sale transaction
    db.upsertSale(sale);

    // Deduct stock atomically
    const prod = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    prod.quantity -= qtySold;
    db.upsertProduct(prod);

    // Update customer stats
    const cust = db.getById('customers', 'customer_id', 'CUST-001');
    cust.total_spent += finalAmount;
    cust.purchase_count += 1;
    cust.last_purchase_date = sale.date_time;
    db.upsertCustomer(cust);

    // Record audit log
    db.addAuditLog({
      id: 'AUDIT-TXN-001',
      timestamp: sale.date_time,
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife',
      staff_role: 'Super Admin',
      category: 'Sales',
      action: 'POS_CHECKOUT',
      details: `Completed sale TXN-2026-001 for ₦${finalAmount.toLocaleString()} to ${cust.full_name}. Deducted ${qtySold} KG from ITEM-CATFISH-01.`,
      severity: 'INFO',
    });

    // Verification
    const updatedProd = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(updatedProd.quantity, initialStock - qtySold, `Stock must be deducted from ${initialStock} to ${initialStock - qtySold}`);

    const savedSale = db.getById('sales', 'transaction_id', 'TXN-2026-001');
    assert(savedSale !== null, 'Sale transaction must be permanently persisted');
    assertEqual(savedSale.final_amount, 33250, 'Final amount must be ₦33,250');

    const updatedCust = db.getById('customers', 'customer_id', 'CUST-001');
    assertEqual(updatedCust.purchase_count, 1, 'Customer purchase count must increment to 1');
    assertEqual(updatedCust.total_spent, 33250, 'Customer total spent must be ₦33,250');

    const logs = db.getTable('audit_logs');
    assert(logs.some((l: any) => l.action === 'POS_CHECKOUT'), 'Audit log must record POS checkout');
  });

  // -------------------------------------------------------------------------
  // SUITE 5: TREASURY & FINANCIAL INTELLIGENCE (P&L & RECONCILIATION)
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 5: Treasury & Financial Intelligence (P&L, Terminals, Reconciliation)');

  runTest('Suite 5: Treasury', 'POS Terminal registration & bank reconciliation configuration', () => {
    const posTerminal: PosTerminalConfig = {
      id: 'POS-001',
      name: 'Moniepoint POS - Main Counter',
      type: 'POS_TERMINAL',
      provider: 'Moniepoint',
      terminal_id: 'MP-882019',
      account_name: 'Kiid From Dream Enterprises',
      account_number: '8031112233',
      bank_name: 'Moniepoint MFB',
      status: 'Active',
      created_at: new Date().toISOString(),
    };
    db.upsertPosTerminal(posTerminal);

    const term = db.getById('pos_terminals', 'id', 'POS-001');
    assert(term !== null, 'POS Terminal must be stored in database');
    assertEqual(term.provider, 'Moniepoint', 'Provider must match');
  });

  runTest('Suite 5: Treasury', 'Cash-to-Bank Transfer logging & Cash Drawer Till tracking', () => {
    const transfer: CashToBankTransfer = {
      transfer_id: 'CASH-TRF-001',
      date_time: new Date().toISOString(),
      amount_transferred: 50000,
      cashier_staff_id: 'STAFF-SUPER-001',
      cashier_staff_name: 'Boluwatife',
      cashier_role: 'Super Admin',
      manager_staff_id: 'STAFF-SUPER-001',
      manager_staff_name: 'Boluwatife',
      manager_role: 'Super Admin',
      cashier_cash_before: 58000,
      cashier_cash_remaining: 8000,
      destination_bank_name: 'Moniepoint MFB',
      destination_account_name: 'Kiid From Dream Enterprises',
      destination_account_number: '8031112233',
      deposit_slip_number: 'DEP-884920',
      notes: 'Midday cash drop to bank',
      status: 'COMPLETED',
    };
    db.addCashTransfer(transfer);

    const trf = db.getById('cash_transfers', 'id', 'CASH-TRF-001');
    assert(trf !== null, 'Cash transfer record must be stored');
  });

  runTest('Suite 5: Financials', 'Calculate Gross Revenue, Cost of Goods Sold (COGS), Gross Profit & Margin %', () => {
    const sales: SaleTransaction[] = db.getTable('sales');
    let totalRevenue = 0;
    let totalCogs = 0;

    for (const sale of sales) {
      totalRevenue += sale.final_amount;
      for (const item of sale.items || []) {
        totalCogs += (item.cost_price || 0) * (item.quantity_sold || 0);
      }
    }

    assertEqual(totalRevenue, 33250, 'Total revenue should be ₦33,250');
    assertEqual(totalCogs, 25000, 'Total COGS should be 10 * ₦2,500 = ₦25,000');
    const grossProfit = totalRevenue - totalCogs;
    assertEqual(grossProfit, 8250, 'Gross profit must be ₦8,250');
    const margin = Math.round((grossProfit / totalRevenue) * 1000) / 10;
    assertEqual(margin, 24.8, 'Margin percent must be 24.8%');
  });

  // -------------------------------------------------------------------------
  // SUITE 7: CYCLE COUNT AUDIT & STOCK RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 7: Cycle Count Stock Audit & Immediate Reconciliation');

  runTest('Suite 7: Cycle Count', 'Perform audit count without stock adjustment (audit trail only)', () => {
    const initialProduct = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    const initialQty = initialProduct.quantity;

    const countRecord = {
      count_id: 'CC-AUDIT-001',
      date_time: new Date().toISOString(),
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife',
      role: 'Super Admin',
      item_sn: 'ITEM-CATFISH-01',
      item_name: 'Fresh Live Catfish (Point & Kill)',
      system_qty: initialQty,
      counted_qty: initialQty - 2,
      discrepancy: -2,
      unit: 'KG',
      reason: 'Physical inspection - routine shrinkage audit',
      adjusted: false,
    };

    db.recordCycleCount(countRecord, false);

    // Verify stock was NOT altered
    const postProduct = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(postProduct.quantity, initialQty, 'Stock quantity must remain unchanged when adjustStock is false');

    // Verify record in cycle_counts
    const counts = db.getTable('cycle_counts');
    assert(counts.some((c: any) => c.count_id === 'CC-AUDIT-001'), 'Cycle count record must be recorded in SQLite');

    // Verify audit log
    const auditLogs = db.getTable('audit_logs');
    assert(auditLogs.some((a: any) => a.action === 'CYCLE_COUNT_RECONCILED' && a.metadata?.count_id === 'CC-AUDIT-001'), 'Audit log must record cycle count');
  });

  runTest('Suite 7: Cycle Count', 'Perform audit count WITH stock adjustment (reconciles SQLite stock immediately)', () => {
    const initialProduct = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    const countedQty = 55;

    const countRecord = {
      count_id: 'CC-RECONCILE-002',
      date_time: new Date().toISOString(),
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife',
      role: 'Super Admin',
      item_sn: 'ITEM-CATFISH-01',
      item_name: 'Fresh Live Catfish (Point & Kill)',
      system_qty: initialProduct.quantity,
      counted_qty: countedQty,
      discrepancy: countedQty - initialProduct.quantity,
      unit: 'KG',
      reason: 'Year-end physical count reconciliation',
      adjusted: true,
    };

    db.recordCycleCount(countRecord, true);

    // Verify stock was updated in SQLite
    const updatedProd = db.getById('products', 'item_sn', 'ITEM-CATFISH-01');
    assertEqual(updatedProd.quantity, 55, 'Product quantity must be updated to 55 in SQLite');

    const counts = db.getTable('cycle_counts');
    const recorded = counts.find((c: any) => c.count_id === 'CC-RECONCILE-002');
    assert(recorded !== undefined, 'Reconciled cycle count must exist in cycle_counts');
    assertEqual(recorded.counted_qty, 55, 'Counted qty must match');
  });

  // -------------------------------------------------------------------------
  // SUITE 8: CUSTOMER CREDIT / PAY LATER & DEBT REPAYMENT LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 8: Customer Credit / Pay Later & Debt Settlement Lifecycle');

  runTest('Suite 8: Credit & Debt', 'Complete Credit Sale with ₦0 down payment (100% on credit)', () => {
    const custBefore = db.getById('customers', 'customer_id', 'CUST-001');
    const initialBal = Number(custBefore.balance) || 0;

    const creditSale = {
      transaction_id: 'TXN-CREDIT-001',
      invoice_number: 'INV-CR-001',
      date_time: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      customer_id: 'CUST-001',
      customer_name: custBefore.full_name,
      cashier_id: 'STAFF-SUPER-001',
      cashier_name: 'Boluwatife',
      total_amount: 15000,
      discount_applied: 0,
      final_amount: 15000,
      payment_method: 'Credit / Pay Later',
      deposit_amount: 0,
      credit_amount: 15000,
      credit_due_date: '2026-11-01',
      credit_status: 'OUTSTANDING',
      items: [
        {
          item_sn: 'ITEM-CATFISH-01',
          item_name: 'Fresh Live Catfish (Point & Kill)',
          unit: 'KG',
          unit_price: 3500,
          cost_price: 2500,
          quantity_sold: 4,
          total_amount: 14000,
        },
      ],
      status: 'Completed',
    };

    db.recordSale(creditSale);

    // Verify sale is persisted
    const savedSale = db.getById('sales', 'transaction_id', 'TXN-CREDIT-001');
    assert(savedSale !== null, 'Credit sale transaction must be saved to SQLite');
    assertEqual(savedSale.payment_method, 'Credit / Pay Later', 'Payment method must be Credit / Pay Later');

    // Verify customer balance increased by ₦15,000
    const custAfter = db.getById('customers', 'customer_id', 'CUST-001');
    assertEqual(custAfter.balance, initialBal + 15000, 'Customer balance must increase by ₦15,000');
    assert(Array.isArray(custAfter.credit_history) && custAfter.credit_history.length > 0, 'Customer credit history must record credit entry');
  });

  runTest('Suite 8: Credit & Debt', 'Partial debt repayment (repayment logged, debt decremented in SQLite)', () => {
    const custBefore = db.getById('customers', 'customer_id', 'CUST-001');
    const startBal = custBefore.balance;
    const paymentAmount = 5000;

    const repayment = {
      repayment_id: 'PAY-DEBT-001',
      customer_id: 'CUST-001',
      customer_name: custBefore.full_name,
      amount_paid: paymentAmount,
      payment_method: 'Cash',
      date_time: new Date().toISOString(),
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife',
      notes: 'First installment cash payment',
    };

    db.recordCustomerDebtRepayment(repayment);

    // Verify customer balance decreased by ₦5,000
    const custAfter = db.getById('customers', 'customer_id', 'CUST-001');
    assertEqual(custAfter.balance, startBal - paymentAmount, `Customer debt balance must decrease from ${startBal} to ${startBal - paymentAmount}`);

    // Verify customer_debt_repayments table contains record
    const repayments = db.getTable('customer_debt_repayments');
    const rep = repayments.find((r: any) => r.repayment_id === 'PAY-DEBT-001');
    assert(rep !== undefined, 'Repayment must be logged in customer_debt_repayments table');
    assertEqual(rep.amount_paid, 5000, 'Amount paid must be 5000');
    assertEqual(rep.previous_balance, startBal, 'Previous balance must match');
    assertEqual(rep.remaining_balance, startBal - paymentAmount, 'Remaining balance must match');
  });

  runTest('Suite 8: Credit & Debt', 'Full debt settlement (clears remaining debt balance to ₦0)', () => {
    const custBefore = db.getById('customers', 'customer_id', 'CUST-001');
    const remainingDebt = custBefore.balance;
    assert(remainingDebt > 0, 'Customer should have remaining debt');

    const repayment = {
      repayment_id: 'PAY-DEBT-002',
      customer_id: 'CUST-001',
      customer_name: custBefore.full_name,
      amount_paid: remainingDebt,
      payment_method: 'Bank Transfer',
      bank_name: 'Moniepoint MFB',
      date_time: new Date().toISOString(),
      staff_id: 'STAFF-SUPER-001',
      staff_name: 'Boluwatife',
      notes: 'Final balance clearance via Bank Transfer',
    };

    db.recordCustomerDebtRepayment(repayment);

    // Verify balance is now exactly 0
    const custAfter = db.getById('customers', 'customer_id', 'CUST-001');
    assertEqual(custAfter.balance, 0, 'Customer debt balance must be fully cleared to ₦0');
  });

  // -------------------------------------------------------------------------
  // SUITE 9: BIDIRECTIONAL CASH TRANSFERS & FLOAT REPLENISHMENT
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 9: Bidirectional Cash Transfers (POS to Bank & Bank to POS Float)');

  runTest('Suite 9: Cash Transfers', 'Manager transfers till cash to bank account (POS_TO_BANK)', () => {
    const transfer = {
      transfer_id: 'CTB-001',
      transfer_type: 'POS_TO_BANK',
      date_time: new Date().toISOString(),
      amount_transferred: 40000,
      cashier_staff_id: 'STAFF-002',
      cashier_staff_name: 'Cashier Mary',
      cashier_role: 'Cashier',
      manager_staff_id: 'STAFF-SUPER-001',
      manager_staff_name: 'Boluwatife',
      manager_role: 'Super Admin',
      cashier_cash_before: 50000,
      cashier_cash_remaining: 10000,
      destination_bank_name: 'Access Bank',
      destination_account_name: 'Kiid From Dream Ltd',
      destination_account_number: '0123456789',
      deposit_slip_number: 'SLIP-9901',
      notes: 'End of shift bank deposit',
      status: 'COMPLETED',
    };

    db.addCashTransfer(transfer);

    const saved = db.getById('cash_transfers', 'id', 'CTB-001');
    assert(saved !== null, 'POS_TO_BANK transfer must be saved to SQLite');
    assertEqual(saved.transfer_type, 'POS_TO_BANK', 'Transfer type must be POS_TO_BANK');
  });

  runTest('Suite 9: Cash Transfers', 'Manager replenishes cashier float from bank account (BANK_TO_POS)', () => {
    const transfer = {
      transfer_id: 'BTP-001',
      transfer_type: 'BANK_TO_POS',
      date_time: new Date().toISOString(),
      amount_transferred: 25000,
      cashier_staff_id: 'STAFF-002',
      cashier_staff_name: 'Cashier Mary',
      cashier_role: 'Cashier',
      manager_staff_id: 'STAFF-SUPER-001',
      manager_staff_name: 'Boluwatife',
      manager_role: 'Super Admin',
      cashier_cash_before: 5000,
      cashier_cash_remaining: 30000,
      destination_bank_name: 'Access Bank',
      destination_account_name: 'Kiid From Dream Ltd',
      destination_account_number: '0123456789',
      notes: 'Morning float cash injection',
      status: 'COMPLETED',
    };

    db.addCashTransfer(transfer);

    const saved = db.getById('cash_transfers', 'id', 'BTP-001');
    assert(saved !== null, 'BANK_TO_POS transfer must be saved to SQLite');
    assertEqual(saved.transfer_type, 'BANK_TO_POS', 'Transfer type must be BANK_TO_POS');
  });

  // -------------------------------------------------------------------------
  // SUITE 10: STOCK TRANSFERS BETWEEN LOCATIONS
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 10: Stock Transfers Between Locations');

  runTest('Suite 10: Stock Transfer', 'Record stock transfer between locations in SQLite', () => {
    const transferRecord = {
      transfer_id: 'TRF-001',
      date_time: new Date().toISOString(),
      item_sn: 'ITEM-CATFISH-01',
      item_name: 'Fresh Live Catfish (Point & Kill)',
      quantity: 10,
      unit: 'KG',
      from_location: 'Main Cold Room Store',
      to_location: 'Sales Display Counter',
      authorized_by_id: 'STAFF-SUPER-001',
      authorized_by_name: 'Boluwatife (Super Admin)',
      notes: 'Replenishing display tank for weekend sales',
    };

    db.addStockTransfer(transferRecord);

    const transfers = db.getTable('stock_transfers');
    const trf = transfers.find((t: any) => t.transfer_id === 'TRF-001');
    assert(trf !== undefined, 'Stock transfer must be recorded in SQLite stock_transfers');
    assertEqual(trf.quantity, 10, 'Transfer quantity must be 10');
    assertEqual(trf.to_location, 'Sales Display Counter', 'To location must match');
  });

  // -------------------------------------------------------------------------
  // SUITE 6: DATA BACKUP & RESTORE COMPLETE ROUNDTRIP
  // -------------------------------------------------------------------------
  console.log('\n▶ SUITE 6: Data Backup & Restore Complete Roundtrip (All 18 Collections)');

  let exportedSnapshotData: any = null;

  runTest('Suite 6: Backup & Restore', 'Export full database snapshot containing all 18 collections', () => {
    const snapshot = db.getSnapshot();
    assert(Array.isArray(snapshot.products), 'Snapshot must contain products');
    assert(Array.isArray(snapshot.customers), 'Snapshot must contain customers');
    assert(Array.isArray(snapshot.suppliers), 'Snapshot must contain suppliers');
    assert(Array.isArray(snapshot.employees), 'Snapshot must contain employees');
    assert(Array.isArray(snapshot.purchaseOrders), 'Snapshot must contain purchaseOrders');
    assert(Array.isArray(snapshot.sales), 'Snapshot must contain sales');
    assert(Array.isArray(snapshot.refunds), 'Snapshot must contain refunds');
    assert(Array.isArray(snapshot.auditLogs), 'Snapshot must contain auditLogs');
    assert(Array.isArray(snapshot.cycleCounts), 'Snapshot must contain cycleCounts');
    assert(Array.isArray(snapshot.stockTransfers), 'Snapshot must contain stockTransfers');
    assert(Array.isArray(snapshot.customerDebtRepayments), 'Snapshot must contain customerDebtRepayments');
    assert(Array.isArray(snapshot.posTerminals), 'Snapshot must contain posTerminals');
    assert(Array.isArray(snapshot.cashTransfers), 'Snapshot must contain cashTransfers');
    assert(snapshot.receiptSettings !== undefined, 'Snapshot must contain receiptSettings');
    assert(snapshot.discountSecurityConfig !== undefined, 'Snapshot must contain discountSecurityConfig');
    assert(Array.isArray(snapshot.categories), 'Snapshot must contain categories');
    assert(Array.isArray(snapshot.discountRules), 'Snapshot must contain discountRules');

    exportedSnapshotData = snapshot;
  });

  runTest('Suite 6: Backup & Restore', 'Restore full database snapshot and verify atomic reconstitution', () => {
    // Modify database to simulate data loss or migration to new PC
    const newSandboxDir = path.join(os.tmpdir(), `pos_migration_test_${Date.now()}`);
    fs.mkdirSync(newSandboxDir, { recursive: true });

    const newDb = new PosDatabase(newSandboxDir);

    // Initial state of new PC has 0 products and 0 sales
    assertEqual(newDb.getTable('products').length, 0, 'New PC starts with 0 products');
    assertEqual(newDb.getTable('sales').length, 0, 'New PC starts with 0 sales');

    // Import the exported backup
    newDb.importSnapshot(exportedSnapshotData);
    newDb.checkpoint('TRUNCATE');

    // Verify all restored data
    const restoredProducts = newDb.getTable('products');
    const restoredSales = newDb.getTable('sales');
    const restoredCustomers = newDb.getTable('customers');
    const restoredTerminals = newDb.getTable('pos_terminals');

    assertEqual(restoredProducts.length, exportedSnapshotData.products.length, 'Restored products count must match export');
    assertEqual(restoredSales.length, exportedSnapshotData.sales.length, 'Restored sales count must match export');
    assertEqual(restoredCustomers.length, exportedSnapshotData.customers.length, 'Restored customers count must match export');
    assertEqual(restoredTerminals.length, exportedSnapshotData.posTerminals.length, 'Restored POS terminals count must match export');

    // Verify Super Admin access survives restoration
    const superAdmin = newDb.getTable('employees').find((e: any) => e.username?.toLowerCase() === 'boluwatife');
    assert(superAdmin !== undefined, 'Super Admin Boluwatife must remain present after restore');
    assert(verifyPin('2030170611', superAdmin.pin), 'Super Admin PIN must verify after restore');

    newDb.close();
    fs.rmSync(newSandboxDir, { recursive: true, force: true });
  });

  // Clean up main sandbox
  db.close();
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch {}

  // -------------------------------------------------------------------------
  // AUDIT SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 AUDIT EXECUTION SUMMARY');
  console.log('================================================================');
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
    console.log('ALL AUDIT SUITES PASSED WITH 100% SUCCESS RATE!\n');
    process.exit(0);
  }
}

runComprehensiveAudit().catch(err => {
  console.error('[AUDIT RUNNER FATAL ERROR]:', err);
  process.exit(1);
});
