export type ProductCategory = 
  | 'Freshwater Fish' 
  | 'Saltwater Fish' 
  | 'Frozen Fish' 
  | 'Dried Fish';

export type ProductUnit = 'KG' | 'LITERS' | 'PIECES' | 'TONS';

export type ProductStatus = 'Active' | 'Inactive';

export interface Product {
  item_sn: string; // e.g. FISH-00045
  item_name: string; // e.g. Catfish, Tilapia
  item_picture: string;
  quantity: number; // Current stock
  expiry_date: string; // YYYY-MM-DD
  item_cost: number; // Wholesale cost in ₦
  product_measure_unit: ProductUnit;
  quantity_per_unit: number; // e.g. 25
  selling_price: number; // Selling price in ₦
  product_category: ProductCategory;
  reorder_level: number; // Low stock threshold
  supplier_id: string; // Links to Supplier
  status: ProductStatus;
  created_at?: string;
}

export type PaymentMethod = 
  | 'Cash' 
  | 'Bank Transfer' 
  | 'POS' 
  | 'Debit/Credit Card' 
  | 'Mobile Money' 
  | 'Check'
  | 'Split Payment';

export type PosAccountType = 'POS_TERMINAL' | 'BANK_TRANSFER_ACCOUNT';
export type PosProvider = 'Moniepoint' | 'OPay' | 'GTBank' | 'Zenith Bank' | 'Access Bank' | 'PalmPay' | 'FirstBank' | 'Stanbic IBTC' | 'Kuda' | 'Other';

export interface PosTerminalConfig {
  id: string; // e.g. "POS-001", "BANK-001"
  name: string; // e.g. "Moniepoint POS - Counter 1", "GTBank Commercial Account"
  type: PosAccountType;
  provider: PosProvider;
  terminal_id?: string; // Terminal Serial or Merchant ID (e.g. "MP-882019", "OPAY-7721")
  account_name: string; // e.g. "Kiid From Dream Frozen Foods Ltd"
  account_number: string; // e.g. "0123456789"
  bank_name: string; // e.g. "Moniepoint Microfinance Bank", "Guaranty Trust Bank"
  assigned_location?: string; // e.g. "Counter 1 - Retail Counter", "Cold Room Express"
  status: 'Active' | 'Inactive';
  is_default?: boolean;
  notes?: string;
  created_at: string;
}

export interface SplitPaymentDetail {
  method: 'Cash' | 'Bank Transfer' | 'POS' | 'Debit/Credit Card' | 'Mobile Money' | 'Check';
  amount: number;
  reference?: string;
  notes?: string;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  bank_account_number?: string;
  bank_name?: string;
}

export interface CashToBankTransfer {
  transfer_id: string; // e.g. "CASH-TRF-20260926-001"
  date_time: string;
  cashier_staff_id: string;
  cashier_staff_name: string;
  cashier_role: UserRole;
  manager_staff_id: string;
  manager_staff_name: string;
  manager_role: UserRole;
  amount_transferred: number;
  cashier_cash_before: number;
  cashier_cash_remaining: number;
  destination_bank_name: string;
  destination_account_name: string;
  destination_account_number: string;
  bank_account_id?: string;
  deposit_slip_number?: string; // Bank slip number or transaction reference
  notes: string; // Mandatory explanation/notes
  status: 'COMPLETED';
}

export interface CashierDrawerSummary {
  staff_id: string;
  staff_name: string;
  role: UserRole;
  phone_number: string;
  shift_time: string;
  total_cash_collected: number;
  total_cash_refunded: number;
  total_transferred_to_bank: number;
  current_cash_in_hand: number;
  sales_count: number;
  transfers_count: number;
  last_activity_time?: string;
}

export type CustomerType = 
  | 'Retail' 
  | 'Wholesale' 
  | 'Restaurant' 
  | 'Supermarket';

export interface SaleItem {
  item_sn: string;
  item_name: string;
  quantity_sold: number;
  unit: ProductUnit;
  unit_price: number;
  total_amount: number;
  cost_price: number;
}

export interface SaleTransaction {
  transaction_id: string; // TXN-20260922-001
  date_time: string; // 2026-09-22 10:30 AM
  items: SaleItem[];
  item_sn?: string; // For single item backward compatibility
  item_name?: string;
  quantity_sold?: number;
  unit_price?: number;
  total_amount: number;
  discount_applied: number;
  discount_reason?: string;
  discount_authorized_by?: string;
  final_amount: number;
  payment_method: PaymentMethod;
  payment_splits?: SplitPaymentDetail[];
  amount_paid?: number;
  change_due?: number;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  payment_reference?: string; // RRN or bank transfer session ID
  staff_id: string;
  customer_id: string;
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
}

export interface Customer {
  customer_id: string; // CUST-00201
  full_name: string;
  phone_number: string;
  email?: string;
  address?: string;
  customer_type: CustomerType;
  discount_percent?: number; // Authorized customer discount % (Admin or Manager only)
  discount_notes?: string;   // Reason or approval notes for customer discount
  total_spent: number;
  purchase_count: number;
  preferred_product: string;
  last_purchase_date: string;
  registration_date: string;
  notes?: string;
}

export type PaymentTerms = 'Cash on Delivery' | 'Net 7 Days' | 'Net 30 Days';

export interface Supplier {
  supplier_id: string; // SUP-00012
  supplier_name: string;
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  products_supplied: string[]; // item names or SNs
  lead_time_days: number;
  payment_terms: PaymentTerms;
  average_unit_cost: number;
  reliability_rating: number; // 1 to 5
  status: 'Active' | 'Inactive';
}

export type POStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  po_id: string; // PO-20260922-001
  supplier_id: string;
  item_sn: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  order_date: string;
  expected_delivery_date: string;
  actual_delivery_date?: string;
  status: POStatus;
  notes?: string;
}

export type UserRole = 'Cashier' | 'Supervisor' | 'Manager' | 'Admin';

export interface Employee {
  staff_id: string; // STAFF-001
  staff_name: string;
  username?: string; // e.g. kola, ibrahim, chidinma, alex, admin
  password?: string; // e.g. admin123
  phone_number: string;
  role: UserRole;
  pin: string; // security PIN / password for authorization
  shift_time: 'Morning' | 'Afternoon' | 'Full Day';
  date_hired: string;
  status: 'Active' | 'Inactive';
}

export interface RefundRecord {
  refund_id: string;
  original_transaction_id: string;
  item_sn: string;
  item_name: string;
  quantity_refunded: number;
  refund_amount: number;
  reason: string;
  date_time: string;
  staff_id: string;
  customer_id: string;
  authorized_by?: string; // If cashier performed via supervisor override
  manager_name?: string;
  payment_method?: PaymentMethod;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  settlement_type?: 'CASH' | 'POS_TERMINAL' | 'BANK_TRANSFER' | 'SPLIT';
}

export interface CycleCountRecord {
  count_id: string; // CC-YYYYMMDD-001
  date_time: string;
  staff_id: string;
  staff_name: string;
  role: UserRole;
  item_sn: string;
  item_name: string;
  system_qty: number;
  counted_qty: number;
  discrepancy: number; // counted_qty - system_qty
  unit: string;
  reason: string;
  adjusted: boolean;
}

export interface StockTransferRecord {
  transfer_id: string; // TRF-YYYYMMDD-001
  date_time: string;
  item_sn: string;
  item_name: string;
  quantity: number;
  unit: string;
  from_location: string;
  to_location: string;
  authorized_by_id: string;
  authorized_by_name: string;
  notes?: string;
}

export interface CartItem extends SaleItem {
  maxAvailable: number;
}

export interface ActiveWalkInOrder {
  id: string; // e.g. ORD-1727289123-1
  orderNumber: number;
  label: string; // e.g. "Walk-in #1", "Customer A - Catfish"
  customerId: string;
  cart: CartItem[];
  customDiscount: number;
  customDiscountReason: string;
  discountAuthorizedBy: string | null;
  paymentMode: 'single' | 'split';
  selectedPaymentMethod: PaymentMethod;
  cashTendered: string;
  singleRef: string;
  splitCashAmount: string;
  splitCashTendered: string;
  splitSecondMethod: 'Bank Transfer' | 'POS';
  splitSecondAmount: string;
  splitSecondRef: string;
  splitThirdMethod: 'POS' | 'Bank Transfer' | null;
  splitThirdAmount: string;
  splitThirdRef: string;
  createdAt: string;
}

export interface ParkedOrder {
  order_id: string; // e.g. ORD-1727289123-1
  order_number: number;
  order_label: string; // e.g. "Walk-in #1", "Customer A - Catfish", "Waiting for ATM"
  created_at: string;
  parked_at?: string;
  park_reason?: string;
  customer_id: string;
  customer_name?: string;
  items: CartItem[];
  customDiscount: number;
  customDiscountReason: string;
  discountAuthorizedBy: string | null;
  paymentMode: 'single' | 'split';
  selectedPaymentMethod: PaymentMethod;
  cashTendered: string;
  singleRef: string;
  splitCashAmount: string;
  splitCashTendered: string;
  splitSecondMethod: 'Bank Transfer' | 'POS';
  splitSecondAmount: string;
  splitSecondRef: string;
  splitThirdMethod: 'POS' | 'Bank Transfer' | null;
  splitThirdAmount: string;
  splitThirdRef: string;
  staff_id: string;
  staff_name: string;
  status: 'ACTIVE' | 'PARKED';
}

export interface VoidedOrderRecord {
  void_id: string; // VOID-20260925-001
  order_id: string;
  order_label: string;
  customer_id: string;
  customer_name: string;
  items: SaleItem[];
  subtotal: number;
  discount_applied: number;
  total_amount: number;
  void_reason: string; // e.g. "Customer walked away", "Payment declined", "Cashier error", etc.
  void_notes?: string;
  voided_by_staff_id: string;
  voided_by_staff_name: string;
  voided_by_role: UserRole;
  date_time: string;
  restored_to_inventory: boolean;
}

export type AuditCategory = 
  | 'Sales' 
  | 'Refunds' 
  | 'Inventory' 
  | 'Purchasing' 
  | 'Customer'
  | 'CycleCount' 
  | 'Transfer' 
  | 'Finance'
  | 'Security' 
  | 'System';

export type AuditSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';

export type AuditAction = 
  | 'SALE_COMPLETED'
  | 'ORDER_PARKED'
  | 'ORDER_RESUMED'
  | 'ORDER_VOIDED'
  | 'REFUND_PROCESSED'
  | 'GOODS_RECEIVED'
  | 'CYCLE_COUNT_ADJUSTED'
  | 'STOCK_TRANSFERRED'
  | 'PO_CREATED'
  | 'PO_CANCELLED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'CUSTOMER_REGISTERED'
  | 'SUPPLIER_CREATED'
  | 'CASH_TRANSFER_TO_BANK'
  | 'POS_TERMINAL_CREATED'
  | 'POS_TERMINAL_UPDATED'
  | 'POS_TERMINAL_DELETED'
  | 'STAFF_SWITCHED'
  | 'STAFF_LOGIN'
  | 'STAFF_LOGOUT'
  | 'LOGIN_FAILED'
  | 'PIN_VERIFIED'
  | 'MANAGER_OVERRIDE'
  | 'PERMISSION_DENIED'
  | 'DATABASE_BACKUP_EXPORT'
  | 'DATABASE_RESET';

export interface AuditLogEntry {
  id: string; // AUD-YYYYMMDD-0001
  timestamp: string;
  staff_id: string;
  staff_name: string;
  role: UserRole;
  category: AuditCategory;
  action: AuditAction;
  details: string;
  severity: AuditSeverity;
  metadata?: Record<string, any>;
  tamper_hash?: string; // Simulates immutable cryptographically verifiable trail
}
