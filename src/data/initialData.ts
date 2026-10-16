import { 
  Product, 
  Customer, 
  Supplier, 
  Employee, 
  PurchaseOrder, 
  SaleTransaction,
  AuditLogEntry,
  CycleCountRecord,
  StockTransferRecord,
  PosTerminalConfig,
  CashToBankTransfer,
  ReceiptBrandingConfig,
  ProductCategoryItem
} from '../types';

export const INITIAL_PRODUCT_CATEGORIES: ProductCategoryItem[] = [
  { id: 'CAT-001', name: 'Freshwater Fish', description: 'Fresh catfish, tilapia, and carp varieties', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-002', name: 'Saltwater Fish', description: 'Croaker, mackerel, salmon, and sea bass', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-003', name: 'Frozen Fish', description: 'Blast frozen and packaged seafood cuts', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-004', name: 'Dried Fish', description: 'Smoked and sun-dried fish stock', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-005', name: 'General', description: 'General grocery and household items', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-006', name: 'Groceries', description: 'Pantry staples and grains', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-007', name: 'Beverages', description: 'Cold drinks, juices, and water', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-008', name: 'Food & Snacks', description: 'Packaged snacks and edibles', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-009', name: 'Perishables', description: 'Fresh vegetables and perishables', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'CAT-010', name: 'Frozen Goods', description: 'Frozen foods and poultry', created_at: '2026-01-01T00:00:00.000Z' },
];

export const INITIAL_PRODUCTS: Product[] = [];


export const INITIAL_CUSTOMERS: Customer[] = [];


export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
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
  },
];

export const INITIAL_CYCLE_COUNTS: CycleCountRecord[] = [];

export const INITIAL_STOCK_TRANSFERS: StockTransferRecord[] = [];

export const INITIAL_AUDIT_LOG: AuditLogEntry[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_SALES: SaleTransaction[] = [];


export const INITIAL_POS_TERMINALS: PosTerminalConfig[] = [];

export const INITIAL_CASH_TRANSFERS: CashToBankTransfer[] = [];

export const INITIAL_RECEIPT_CONFIG: ReceiptBrandingConfig = {
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

