import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PosDatabase } from '../server/db/sqlite.ts';
import { 
  Product, 
  Customer, 
  Supplier, 
  Employee, 
  PurchaseOrder, 
  SaleTransaction, 
  RefundRecord,
  CycleCountRecord, 
  StockTransferRecord, 
  PosTerminalConfig, 
  CashToBankTransfer, 
  ReceiptBrandingConfig,
  AuditLogEntry
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const SEED_FILE = path.resolve(__dirname, '..', 'src', 'data', 'seedData.json');

console.log('[SEED AUDIT] Initializing database seeder in:', DATA_DIR);
const db = new PosDatabase(DATA_DIR);

// 1. PRODUCTS (12 Diverse cold room seafood catalog items)
const SEED_PRODUCTS: Product[] = [
  {
    item_sn: 'FISH-00001',
    item_name: 'Fresh Live Catfish (Point & Kill)',
    item_picture: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&auto=format&fit=crop&q=60',
    quantity: 145.5,
    expiry_date: '2026-10-15',
    item_cost: 2600,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 3600,
    product_category: 'Freshwater Fish',
    reorder_level: 30,
    supplier_id: 'SUP-00012',
    status: 'Active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    item_sn: 'FISH-00002',
    item_name: 'Dutch Frozen Mackerel (Titus 20kg Carton)',
    item_picture: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&auto=format&fit=crop&q=60',
    quantity: 42,
    expiry_date: '2026-12-31',
    item_cost: 48000,
    product_measure_unit: 'PIECES',
    quantity_per_unit: 1,
    selling_price: 58000,
    product_category: 'Frozen Fish',
    reorder_level: 10,
    supplier_id: 'SUP-00014',
    status: 'Active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    item_sn: 'FISH-00003',
    item_name: 'Norwegian Salmon Fresh Steaks',
    item_picture: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=200&auto=format&fit=crop&q=60',
    quantity: 28.0,
    expiry_date: '2026-10-08',
    item_cost: 9500,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 13500,
    product_category: 'Saltwater Fish',
    reorder_level: 15,
    supplier_id: 'SUP-00014',
    status: 'Active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    item_sn: 'FISH-00004',
    item_name: 'Red Snapper (Whole Gutted)',
    item_picture: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=200&auto=format&fit=crop&q=60',
    quantity: 65.0,
    expiry_date: '2026-10-25',
    item_cost: 4200,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 5900,
    product_category: 'Saltwater Fish',
    reorder_level: 20,
    supplier_id: 'SUP-00012',
    status: 'Active',
    created_at: '2026-09-02T08:00:00Z',
  },
  {
    item_sn: 'FISH-00005',
    item_name: 'Freshwater Tilapia (Cleaned)',
    item_picture: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&auto=format&fit=crop&q=60',
    quantity: 85.0,
    expiry_date: '2026-10-18',
    item_cost: 2900,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 4100,
    product_category: 'Freshwater Fish',
    reorder_level: 25,
    supplier_id: 'SUP-00013',
    status: 'Active',
    created_at: '2026-09-02T08:00:00Z',
  },
  {
    item_sn: 'FISH-00006',
    item_name: 'Atlantic Croaker (Large Cut)',
    item_picture: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&auto=format&fit=crop&q=60',
    quantity: 12.0, // Low stock on purpose for testing alert badge!
    expiry_date: '2026-10-04', // Expiring soon for alert badge!
    item_cost: 4600,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 6400,
    product_category: 'Saltwater Fish',
    reorder_level: 20,
    supplier_id: 'SUP-00014',
    status: 'Active',
    created_at: '2026-09-03T08:00:00Z',
  },
  {
    item_sn: 'FISH-00007',
    item_name: 'Premium Smoked Catfish (Vacuum Pack)',
    item_picture: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&auto=format&fit=crop&q=60',
    quantity: 110,
    expiry_date: '2027-01-15',
    item_cost: 3200,
    product_measure_unit: 'PIECES',
    quantity_per_unit: 1,
    selling_price: 4800,
    product_category: 'Dried Fish',
    reorder_level: 20,
    supplier_id: 'SUP-00013',
    status: 'Active',
    created_at: '2026-09-03T08:00:00Z',
  },
  {
    item_sn: 'FISH-00008',
    item_name: 'Jumbo Tiger Prawns (Blast Frozen 1kg)',
    item_picture: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=200&auto=format&fit=crop&q=60',
    quantity: 35,
    expiry_date: '2026-11-20',
    item_cost: 11000,
    product_measure_unit: 'PIECES',
    quantity_per_unit: 1,
    selling_price: 15500,
    product_category: 'Frozen Fish',
    reorder_level: 10,
    supplier_id: 'SUP-00014',
    status: 'Active',
    created_at: '2026-09-04T08:00:00Z',
  },
  {
    item_sn: 'FISH-00009',
    item_name: 'Smoked Mangrove Barracuda Cut',
    item_picture: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=200&auto=format&fit=crop&q=60',
    quantity: 48.0,
    expiry_date: '2026-12-10',
    item_cost: 5100,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 7200,
    product_category: 'Dried Fish',
    reorder_level: 15,
    supplier_id: 'SUP-00013',
    status: 'Active',
    created_at: '2026-09-04T08:00:00Z',
  },
  {
    item_sn: 'FISH-00010',
    item_name: 'Horse Mackerel (Kote Frozen Block)',
    item_picture: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&auto=format&fit=crop&q=60',
    quantity: 6, // Low stock threshold test!
    expiry_date: '2026-11-05',
    item_cost: 32000,
    product_measure_unit: 'PIECES',
    quantity_per_unit: 1,
    selling_price: 39500,
    product_category: 'Frozen Fish',
    reorder_level: 12,
    supplier_id: 'SUP-00012',
    status: 'Active',
    created_at: '2026-09-05T08:00:00Z',
  },
  {
    item_sn: 'FISH-00011',
    item_name: 'Silver Hake Fish (Imported Carton)',
    item_picture: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=200&auto=format&fit=crop&q=60',
    quantity: 55,
    expiry_date: '2026-11-28',
    item_cost: 36000,
    product_measure_unit: 'PIECES',
    quantity_per_unit: 1,
    selling_price: 44000,
    product_category: 'Frozen Fish',
    reorder_level: 10,
    supplier_id: 'SUP-00014',
    status: 'Active',
    created_at: '2026-09-05T08:00:00Z',
  },
  {
    item_sn: 'FISH-00012',
    item_name: 'Live Mud Crab (Special Order)',
    item_picture: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=200&auto=format&fit=crop&q=60',
    quantity: 18.0,
    expiry_date: '2026-10-06',
    item_cost: 7500,
    product_measure_unit: 'KG',
    quantity_per_unit: 1,
    selling_price: 11000,
    product_category: 'Freshwater Fish',
    reorder_level: 5,
    supplier_id: 'SUP-00012',
    status: 'Active',
    created_at: '2026-09-06T08:00:00Z',
  },
];

// 2. CUSTOMERS (6 Diverse Accounts)
const SEED_CUSTOMERS: Customer[] = [
  {
    customer_id: 'CUST-00101',
    full_name: 'Chief Babatunde Balogun',
    phone_number: '+234 802 334 5566',
    email: 'babatunde@lagosvip.ng',
    address: 'Plot 12, Admiralty Way, Lekki Phase 1',
    customer_type: 'Wholesale',
    discount_percent: 5,
    discount_notes: 'Long-standing VIP client. 5% discount on all purchases.',
    total_spent: 485000,
    purchase_count: 14,
    preferred_product: 'Norwegian Salmon Fresh Steaks',
    last_purchase_date: '2026-09-26 11:20 AM',
    registration_date: '2026-01-10',
    notes: 'Requires delivery packing with dry ice.',
  },
  {
    customer_id: 'CUST-00102',
    full_name: 'Ocean Pearl Bistro & Grill (Lekki)',
    phone_number: '+234 818 776 5432',
    email: 'chef@oceanpearl.ng',
    address: 'Block 4, Victoria Island Waterfront, Lagos',
    customer_type: 'Restaurant',
    discount_percent: 10,
    discount_notes: 'Commercial Restaurant Agreement - 10% wholesale rate.',
    total_spent: 1250000,
    purchase_count: 28,
    preferred_product: 'Fresh Live Catfish (Point & Kill)',
    last_purchase_date: '2026-09-27 09:15 AM',
    registration_date: '2025-11-15',
    notes: 'Standing weekly order: 50kg Catfish + 10kg Salmon on Thursdays.',
  },
  {
    customer_id: 'CUST-00103',
    full_name: 'Mrs. Folake Adebayo',
    phone_number: '+234 803 998 8776',
    email: 'folake.adebayo@gmail.com',
    address: 'Flat 3B, Chevy View Estate, Chevron Drive',
    customer_type: 'Retail',
    discount_percent: 0,
    total_spent: 165000,
    purchase_count: 9,
    preferred_product: 'Red Snapper (Whole Gutted)',
    last_purchase_date: '2026-09-25 04:45 PM',
    registration_date: '2026-03-20',
  },
  {
    customer_id: 'CUST-00104',
    full_name: 'Prime Coldstore Supermarket Ltd',
    phone_number: '+234 805 112 2334',
    email: 'procurement@primesuper.ng',
    address: 'Shop 8, Palms Mall, Lekki',
    customer_type: 'Supermarket',
    discount_percent: 8,
    discount_notes: 'Approved supermarket vendor discount.',
    total_spent: 2450000,
    purchase_count: 36,
    preferred_product: 'Dutch Frozen Mackerel (Titus 20kg Carton)',
    last_purchase_date: '2026-09-28 08:30 AM',
    registration_date: '2025-08-10',
    notes: 'Official purchase orders issued prior to collection.',
  },
  {
    customer_id: 'CUST-00105',
    full_name: 'Alhaji Mansur Danbaba',
    phone_number: '+234 809 445 6677',
    email: 'mansur@danbabagroup.com',
    address: 'Ikoyi Crescent, Ikoyi, Lagos',
    customer_type: 'Wholesale',
    discount_percent: 6,
    discount_notes: 'Wholesale fish distribution agreement.',
    total_spent: 890000,
    purchase_count: 18,
    preferred_product: 'Premium Smoked Catfish (Vacuum Pack)',
    last_purchase_date: '2026-09-24 02:10 PM',
    registration_date: '2026-02-12',
  },
  {
    customer_id: 'CUST-00106',
    full_name: 'Mama Nkechi Seafood Kitchen',
    phone_number: '+234 807 556 7788',
    email: 'nkechikitchen@yahoo.com',
    address: 'Ajah Market Road, Lagos',
    customer_type: 'Restaurant',
    discount_percent: 7,
    discount_notes: 'Catering and soup kitchen tier discount.',
    total_spent: 420000,
    purchase_count: 15,
    preferred_product: 'Freshwater Tilapia (Cleaned)',
    last_purchase_date: '2026-09-26 05:30 PM',
    registration_date: '2026-04-05',
  }
];

// 3. HISTORICAL SALES (15 Realistic multi-tender, multi-cashier transactions)
const SEED_SALES: SaleTransaction[] = [
  {
    transaction_id: 'TXN-20260925-001',
    date_time: '2026-09-25 09:15 AM',
    items: [
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 5.5,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 19800,
        cost_price: 2600,
      }
    ],
    total_amount: 19800,
    discount_applied: 0,
    final_amount: 19800,
    payment_method: 'Cash',
    amount_paid: 20000,
    change_due: 200,
    staff_id: 'STAFF-001', // Kola
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260925-002',
    date_time: '2026-09-25 10:45 AM',
    items: [
      {
        item_sn: 'FISH-00003',
        item_name: 'Norwegian Salmon Fresh Steaks',
        quantity_sold: 3.0,
        unit: 'KG',
        unit_price: 13500,
        total_amount: 40500,
        cost_price: 9500,
      },
      {
        item_sn: 'FISH-00004',
        item_name: 'Red Snapper (Whole Gutted)',
        quantity_sold: 2.5,
        unit: 'KG',
        unit_price: 5900,
        total_amount: 14750,
        cost_price: 4200,
      }
    ],
    total_amount: 55250,
    discount_applied: 2762.5,
    discount_reason: 'VIP Customer 5% Rate',
    discount_authorized_by: 'Babatunde Agreement',
    final_amount: 52487.5,
    payment_method: 'POS',
    pos_terminal_id: 'POS-001',
    pos_terminal_name: 'Moniepoint Wireless Counter 1',
    payment_reference: 'MP-RRN-992810',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00101',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260925-003',
    date_time: '2026-09-25 01:30 PM',
    items: [
      {
        item_sn: 'FISH-00002',
        item_name: 'Dutch Frozen Mackerel (Titus 20kg Carton)',
        quantity_sold: 2,
        unit: 'PIECES',
        unit_price: 58000,
        total_amount: 116000,
        cost_price: 48000,
      }
    ],
    total_amount: 116000,
    discount_applied: 0,
    final_amount: 116000,
    payment_method: 'Bank Transfer',
    bank_name: 'Guaranty Trust Bank',
    bank_account_number: '0123456789',
    payment_reference: 'GTB-TRF-48291039',
    staff_id: 'STAFF-002', // Tayo
    customer_id: 'CUST-00104',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260925-004',
    date_time: '2026-09-25 03:50 PM',
    items: [
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 10.0,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 36000,
        cost_price: 2600,
      },
      {
        item_sn: 'FISH-00007',
        item_name: 'Premium Smoked Catfish (Vacuum Pack)',
        quantity_sold: 5,
        unit: 'PIECES',
        unit_price: 4800,
        total_amount: 24000,
        cost_price: 3200,
      }
    ],
    total_amount: 60000,
    discount_applied: 6000,
    discount_reason: 'Restaurant 10% Rate',
    discount_authorized_by: 'Contract Agreement',
    final_amount: 54000,
    payment_method: 'Split Payment',
    payment_splits: [
      {
        method: 'Cash',
        amount: 24000,
      },
      {
        method: 'POS',
        amount: 30000,
        pos_terminal_id: 'POS-001',
        pos_terminal_name: 'Moniepoint Wireless Counter 1',
        reference: 'MP-881920',
      }
    ],
    amount_paid: 24000,
    change_due: 0,
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00102',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260926-001',
    date_time: '2026-09-26 10:10 AM',
    items: [
      {
        item_sn: 'FISH-00008',
        item_name: 'Jumbo Tiger Prawns (Blast Frozen 1kg)',
        quantity_sold: 3,
        unit: 'PIECES',
        unit_price: 15500,
        total_amount: 46500,
        cost_price: 11000,
      }
    ],
    total_amount: 46500,
    discount_applied: 0,
    final_amount: 46500,
    payment_method: 'POS',
    pos_terminal_id: 'POS-002',
    pos_terminal_name: 'OPay Smart POS Counter 2',
    payment_reference: 'OPAY-8829102',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260926-002',
    date_time: '2026-09-26 11:40 AM',
    items: [
      {
        item_sn: 'FISH-00005',
        item_name: 'Freshwater Tilapia (Cleaned)',
        quantity_sold: 8.0,
        unit: 'KG',
        unit_price: 4100,
        total_amount: 32800,
        cost_price: 2900,
      }
    ],
    total_amount: 32800,
    discount_applied: 2296,
    discount_reason: 'Customer Tier Discount 7%',
    discount_authorized_by: 'Nkechi Approved',
    final_amount: 30504,
    payment_method: 'Cash',
    amount_paid: 31000,
    change_due: 496,
    staff_id: 'STAFF-002',
    customer_id: 'CUST-00106',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260926-003',
    date_time: '2026-09-26 02:15 PM',
    items: [
      {
        item_sn: 'FISH-00009',
        item_name: 'Smoked Mangrove Barracuda Cut',
        quantity_sold: 4.0,
        unit: 'KG',
        unit_price: 7200,
        total_amount: 28800,
        cost_price: 5100,
      },
      {
        item_sn: 'FISH-00004',
        item_name: 'Red Snapper (Whole Gutted)',
        quantity_sold: 3.5,
        unit: 'KG',
        unit_price: 5900,
        total_amount: 20650,
        cost_price: 4200,
      }
    ],
    total_amount: 49450,
    discount_applied: 2967,
    discount_reason: 'VIP Wholesale 6%',
    discount_authorized_by: 'Danbaba Rate',
    final_amount: 46483,
    payment_method: 'Bank Transfer',
    bank_name: 'Guaranty Trust Bank',
    bank_account_number: '0123456789',
    payment_reference: 'GTB-SESSION-7729104',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00105',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260926-004',
    date_time: '2026-09-26 04:30 PM',
    items: [
      {
        item_sn: 'FISH-00006',
        item_name: 'Atlantic Croaker (Large Cut)',
        quantity_sold: 4.0,
        unit: 'KG',
        unit_price: 6400,
        total_amount: 25600,
        cost_price: 4600,
      }
    ],
    total_amount: 25600,
    discount_applied: 0,
    final_amount: 25600,
    payment_method: 'Cash',
    amount_paid: 30000,
    change_due: 4400,
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00103',
    status: 'PARTIALLY_REFUNDED', // Has refund record!
  },
  {
    transaction_id: 'TXN-20260927-001',
    date_time: '2026-09-27 09:30 AM',
    items: [
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 12.0,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 43200,
        cost_price: 2600,
      }
    ],
    total_amount: 43200,
    discount_applied: 4320,
    discount_reason: 'Restaurant 10%',
    discount_authorized_by: 'Standing Rate',
    final_amount: 38880,
    payment_method: 'POS',
    pos_terminal_id: 'POS-001',
    pos_terminal_name: 'Moniepoint Wireless Counter 1',
    payment_reference: 'MP-8839201',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00102',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260927-002',
    date_time: '2026-09-27 11:20 AM',
    items: [
      {
        item_sn: 'FISH-00003',
        item_name: 'Norwegian Salmon Fresh Steaks',
        quantity_sold: 2.0,
        unit: 'KG',
        unit_price: 13500,
        total_amount: 27000,
        cost_price: 9500,
      },
      {
        item_sn: 'FISH-00008',
        item_name: 'Jumbo Tiger Prawns (Blast Frozen 1kg)',
        quantity_sold: 2,
        unit: 'PIECES',
        unit_price: 15500,
        total_amount: 31000,
        cost_price: 11000,
      }
    ],
    total_amount: 58000,
    discount_applied: 2900,
    discount_reason: 'VIP 5%',
    discount_authorized_by: 'Babatunde Card',
    final_amount: 55100,
    payment_method: 'POS',
    pos_terminal_id: 'POS-001',
    pos_terminal_name: 'Moniepoint Wireless Counter 1',
    payment_reference: 'MP-7729104',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00101',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260927-003',
    date_time: '2026-09-27 02:40 PM',
    items: [
      {
        item_sn: 'FISH-00011',
        item_name: 'Silver Hake Fish (Imported Carton)',
        quantity_sold: 1,
        unit: 'PIECES',
        unit_price: 44000,
        total_amount: 44000,
        cost_price: 36000,
      }
    ],
    total_amount: 44000,
    discount_applied: 0,
    final_amount: 44000,
    payment_method: 'Cash',
    amount_paid: 50000,
    change_due: 6000,
    staff_id: 'STAFF-002',
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260927-004',
    date_time: '2026-09-27 04:15 PM',
    items: [
      {
        item_sn: 'FISH-00007',
        item_name: 'Premium Smoked Catfish (Vacuum Pack)',
        quantity_sold: 8,
        unit: 'PIECES',
        unit_price: 4800,
        total_amount: 38400,
        cost_price: 3200,
      }
    ],
    total_amount: 38400,
    discount_applied: 2304,
    discount_reason: 'Wholesale 6%',
    discount_authorized_by: 'Alhaji Mansur',
    final_amount: 36096,
    payment_method: 'Split Payment',
    payment_splits: [
      {
        method: 'Cash',
        amount: 16096,
      },
      {
        method: 'POS',
        amount: 20000,
        pos_terminal_id: 'POS-002',
        pos_terminal_name: 'OPay Smart POS Counter 2',
        reference: 'OPAY-991823',
      }
    ],
    amount_paid: 16096,
    change_due: 0,
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00105',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260928-001',
    date_time: '2026-09-28 08:30 AM',
    items: [
      {
        item_sn: 'FISH-00002',
        item_name: 'Dutch Frozen Mackerel (Titus 20kg Carton)',
        quantity_sold: 3,
        unit: 'PIECES',
        unit_price: 58000,
        total_amount: 174000,
        cost_price: 48000,
      }
    ],
    total_amount: 174000,
    discount_applied: 13920,
    discount_reason: 'Supermarket 8%',
    discount_authorized_by: 'Prime Super Agreement',
    final_amount: 160080,
    payment_method: 'Bank Transfer',
    bank_name: 'Guaranty Trust Bank',
    bank_account_number: '0123456789',
    payment_reference: 'GTB-CORP-991820',
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00104',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260928-002',
    date_time: '2026-09-28 09:45 AM',
    items: [
      {
        item_sn: 'FISH-00005',
        item_name: 'Freshwater Tilapia (Cleaned)',
        quantity_sold: 5.0,
        unit: 'KG',
        unit_price: 4100,
        total_amount: 20500,
        cost_price: 2900,
      },
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 3.0,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 10800,
        cost_price: 2600,
      }
    ],
    total_amount: 31300,
    discount_applied: 0,
    final_amount: 31300,
    payment_method: 'Cash',
    amount_paid: 32000,
    change_due: 700,
    staff_id: 'STAFF-001',
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  },
  {
    transaction_id: 'TXN-20260928-003',
    date_time: '2026-09-28 10:15 AM',
    items: [
      {
        item_sn: 'FISH-00012',
        item_name: 'Live Mud Crab (Special Order)',
        quantity_sold: 2.0,
        unit: 'KG',
        unit_price: 11000,
        total_amount: 22000,
        cost_price: 7500,
      }
    ],
    total_amount: 22000,
    discount_applied: 0,
    final_amount: 22000,
    payment_method: 'POS',
    pos_terminal_id: 'POS-001',
    pos_terminal_name: 'Moniepoint Wireless Counter 1',
    payment_reference: 'MP-9948201',
    staff_id: 'STAFF-002',
    customer_id: 'CUST-00103',
    status: 'COMPLETED',
  }
];

// 4. REFUNDS
const SEED_REFUNDS: RefundRecord[] = [
  {
    refund_id: 'REF-20260926-001',
    original_transaction_id: 'TXN-20260926-004',
    item_sn: 'FISH-00006',
    item_name: 'Atlantic Croaker (Large Cut)',
    quantity_refunded: 2.0, // Partial return of 2 KG
    refund_amount: 12800,
    reason: 'Defective/Damaged Goods',
    date_time: '2026-09-26 05:15 PM',
    staff_id: 'STAFF-004',
    customer_id: 'CUST-00201',
    authorized_by: 'Chidinma',
  }
];

// 5. PARKED ORDERS
const SEED_PARKED_ORDERS = [
  {
    id: 'PARK-20260928-001',
    customer_id: 'CUST-00103',
    customer_name: 'Mrs. Folake Adebayo',
    parked_at: '2026-09-28 10:20 AM',
    staff_id: 'STAFF-001',
    staff_name: 'Kola',
    items: [
      {
        item_sn: 'FISH-00001',
        item_name: 'Fresh Live Catfish (Point & Kill)',
        quantity_sold: 4.25,
        unit: 'KG',
        unit_price: 3600,
        total_amount: 15300,
        cost_price: 2600,
      }
    ],
    subtotal: 15300,
    discount_amount: 0,
    final_total: 15300,
    notes: 'Customer stepped to car to fetch cash',
  }
];

// 6. VOIDED ORDERS
const SEED_VOIDED_ORDERS = [
  {
    id: 'VOID-20260927-001',
    date_time: '2026-09-27 12:45 PM',
    voided_by: 'Chidinma (Manager)',
    voided_by_staff_id: 'STAFF-004',
    voided_by_role: 'Manager',
    total_amount: 27000,
    items_count: 1,
    void_reason: 'Customer payment declined / Card chip error',
    void_notes: 'Customer card declined three times; customer aborted sale.',
    restored_to_inventory: true,
  }
];

// 7. CASH TRANSFERS (Shift Banking)
const SEED_CASH_TRANSFERS: CashToBankTransfer[] = [
  {
    transfer_id: 'CASH-TRF-20260926-001',
    date_time: '2026-09-26 05:45 PM',
    cashier_staff_id: 'STAFF-001',
    cashier_staff_name: 'Kola',
    cashier_role: 'Cashier',
    manager_staff_id: 'STAFF-004',
    manager_staff_name: 'Chidinma',
    manager_role: 'Manager',
    amount_transferred: 50000,
    cashier_cash_before: 58000,
    cashier_cash_remaining: 8000,
    destination_bank_name: 'Guaranty Trust Bank',
    destination_account_name: 'Kiid From Dream Enterprises - Sales Main',
    destination_account_number: '0123456789',
    deposit_slip_number: 'GTB-SLIP-491028',
    notes: 'Evening shift cash banking. ₦8,000 retained as morning float.',
    status: 'COMPLETED',
  }
];

// 8. RECEIPT BRANDING
const SEED_RECEIPT_CONFIG: ReceiptBrandingConfig = {
  id: 'DEFAULT_RECEIPT_CONFIG',
  business_name: 'KIID FROM DREAM LTD',
  tagline: 'Premium Cold Room & Seafood Terminal',
  address_line1: 'Shop 14, Lekki Fish Market Phase 1',
  address_line2: 'Lekki-Epe Expressway, Lagos, Nigeria',
  phone_numbers: '+234 803 123 4567 / 0800-FISH-POS',
  email: 'sales@kiidfromdream.com',
  tax_or_cac_number: 'RC: 1984201 | TIN: 248109-0001',
  footer_thank_you: 'Thank you for choosing KIID FROM DREAM!',
  footer_policy_notice: 'Fresh fish guaranteed. Inspect fish before cold-chain handover. No returns on thawed frozen goods.',
  custom_notes: 'For wholesale freezer bookings and delivery inquiries, contact our customer desk.',
  logo_base64: null,
  show_logo: true,
  show_barcode: true,
  show_cashier_name: true,
  show_tax_details: true,
  paper_width: '80mm',
  updated_at: new Date().toISOString(),
  updated_by_staff_name: 'Alex Abiri (Admin)',
};

// 9. EXECUTE SEEDING INTO SQLITE
console.log('Inserting seed products...');
for (const prod of SEED_PRODUCTS) {
  db.upsertProduct(prod);
}

console.log('Inserting seed customers...');
for (const cust of SEED_CUSTOMERS) {
  db.upsertCustomer(cust);
}

console.log('Inserting seed sales...');
for (const sale of SEED_SALES) {
  db.recordSale(sale);
}

console.log('Inserting seed refunds...');
for (const ref of SEED_REFUNDS) {
  db.recordRefund(ref);
}

console.log('Inserting parked orders...');
for (const park of SEED_PARKED_ORDERS) {
  db.upsertParkedOrder(park);
}

console.log('Inserting voided orders...');
for (const v of SEED_VOIDED_ORDERS) {
  db.addVoidedOrder(v);
}

console.log('Inserting cash transfers...');
for (const ct of SEED_CASH_TRANSFERS) {
  db.addCashTransfer(ct);
}

console.log('Inserting receipt branding configuration...');
db.upsertReceiptSettings(SEED_RECEIPT_CONFIG);

console.log('Inserting seed audit log entries...');
db.addAuditLog({
  id: 'AUDIT-SEED-001',
  timestamp: new Date().toISOString(),
  user_id: 'STAFF-SUPER-001',
  staff_id: 'STAFF-SUPER-001',
  staff_name: 'Boluwatife (Super Admin)',
  category: 'System',
  action: 'DATABASE_INITIALIZED',
  severity: 'INFO',
  details: 'Comprehensive system seed database created with demo inventory, customers, and sales.',
  metadata: { version: 1 }
});

// 10. Update seedData.json file for permanent persistence
try {
  const currentSnapshot = db.getSnapshot();
  fs.writeFileSync(SEED_FILE, JSON.stringify(currentSnapshot, null, 2), 'utf-8');
  console.log('[SEED AUDIT] Successfully synchronized snapshot to seedData.json');
} catch (err) {
  console.warn('[SEED AUDIT] Warning: could not write seedData.json:', err);
}

db.close();
console.log('[SEED AUDIT] Seeding complete! Database is now fully populated.');
