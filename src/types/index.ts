export type ProductCategory = 
  | 'General'
  | 'Groceries'
  | 'Beverages'
  | 'Food & Snacks'
  | 'Perishables'
  | 'Frozen Goods'
  | 'Electronics'
  | 'Apparel & Clothing'
  | 'Household'
  | 'Personal Care'
  | 'Hardware'
  | 'Freshwater Fish' 
  | 'Saltwater Fish' 
  | 'Frozen Fish' 
  | 'Dried Fish'
  | string;

export type ProductUnit = 
  | 'PCS' 
  | 'PIECES' 
  | 'KG' 
  | 'PACK' 
  | 'BOX' 
  | 'LITERS' 
  | 'TONS' 
  | 'CARTON' 
  | 'CRATE'
  | 'SACHET'
  | 'BOTTLE' 
  | 'CAN' 
  | 'BAG' 
  | 'ROLL'
  | 'BUNDLE'
  | 'METERS'
  | string;

export type ProductStatus = 'Active' | 'Inactive';

export interface Product {
  item_sn: string; // e.g. ITEM-00045
  item_name: string; // e.g. Product Name
  item_picture: string;
  quantity: number; // Current stock in BASE UNITS (e.g. 400 sachets)
  expiry_date: string; // YYYY-MM-DD
  item_cost: number; // Wholesale cost in ₦ per BASE unit
  product_measure_unit: ProductUnit; // Base unit e.g. PCS, SACHET, BOTTLE, KG
  quantity_per_unit: number; // e.g. 25
  selling_price: number; // Selling price in ₦ per BASE unit
  product_category: ProductCategory;
  reorder_level: number; // Low stock threshold in BASE units
  supplier_id: string; // Links to Supplier
  status: ProductStatus;
  created_at?: string;

  // Multi-Unit / Fractional Packaging & Conversion
  has_bulk_unit?: boolean;         // True if item supports bulk packaging
  bulk_unit?: string;              // Bulk unit name (e.g. CARTON, CRATE, BOX, PACK)
  conversion_factor?: number;      // Multiplier: 1 bulk_unit = N base_units (e.g. 24 or 40)
  bulk_selling_price?: number;     // Selling price in ₦ per bulk_unit (e.g. ₦9,500)
  bulk_item_cost?: number;         // Wholesale cost in ₦ per bulk_unit (e.g. ₦7,800)
  allow_loose_sales?: boolean;     // Whether loose unit sales are permitted (default: true)
}

export type PaymentMethod = 
  | 'Cash' 
  | 'Bank Transfer' 
  | 'POS' 
  | 'Debit/Credit Card' 
  | 'Mobile Money' 
  | 'Check'
  | 'Split Payment'
  | 'Credit / Pay Later';

export type PosAccountType = 'POS_TERMINAL' | 'BANK_TRANSFER_ACCOUNT';
export type PosProvider = 'Moniepoint' | 'OPay' | 'GTBank' | 'Zenith Bank' | 'Access Bank' | 'PalmPay' | 'FirstBank' | 'Stanbic IBTC' | 'Kuda' | 'Other';

export interface PosTerminalConfig {
  id: string; // e.g. "POS-001", "BANK-001"
  name: string; // e.g. "Moniepoint POS - Counter 1", "GTBank Commercial Account"
  type: PosAccountType;
  provider: PosProvider;
  terminal_id?: string; // Terminal Serial or Merchant ID (e.g. "MP-882019", "OPAY-7721")
  account_name: string; // e.g. "Kiid From Dream Enterprises"
  account_number: string; // e.g. "0123456789"
  bank_name: string; // e.g. "Moniepoint Microfinance Bank", "Guaranty Trust Bank"
  assigned_location?: string; // e.g. "Counter 1 - Retail Counter", "Main Checkout"
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

export type CashTransferType = 'POS_TO_BANK' | 'BANK_TO_POS' | 'BANK_TO_TERMINAL' | 'TERMINAL_TO_BANK';

export interface CashToBankTransfer {
  transfer_id: string; // e.g. "CASH-TRF-20260926-001"
  transfer_type?: CashTransferType; // Default is 'POS_TO_BANK'
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
  cashier_cash_after?: number;
  destination_bank_name: string;
  destination_account_name?: string;
  destination_account_number?: string;
  bank_account_id?: string;
  source_account_id?: string;
  source_account_name?: string;
  deposit_slip_number?: string; // Bank slip number or transaction reference
  notes: string; // Mandatory explanation/notes
  status: 'COMPLETED';
}

export interface BankAndPosLedgerSummary {
  id: string;
  name: string;
  type: PosAccountType;
  provider: PosProvider;
  terminal_id?: string;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  assigned_location?: string;
  status: 'Active' | 'Inactive';
  is_default?: boolean;
  salesCount: number;
  salesGrossVolume: number;
  debtRepaymentsCount: number;
  debtRepaymentsVolume: number;
  bankDepositsVolume: number;
  floatWithdrawalsVolume: number;
  refundsCount: number;
  refundsDeductedVolume: number;
  netLedgerBalance: number;
}

export interface CustomerDebtRepayment {
  repayment_id: string;
  customer_id: string;
  customer_name: string;
  amount_paid: number;
  payment_method: 'Cash' | 'Bank Transfer' | 'POS' | string;
  bank_account_id?: string;
  bank_name?: string;
  bank_account_number?: string;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  reference_number?: string;
  date_time: string;
  staff_id: string;
  staff_name: string;
  previous_balance: number;
  remaining_balance: number;
  notes?: string;
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
  total_replenished_from_bank?: number;
  total_debt_collected_cash?: number;
  current_cash_in_hand: number;
  sales_count: number;
  transfers_count: number;
  last_activity_time?: string;
  total_discounts_applied?: number;
  discount_transactions_count?: number;
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
  sell_unit?: 'BASE' | 'BULK';
  conversion_factor?: number;
  base_quantity_deducted?: number;
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
  discount_rule_id?: string;
  final_amount: number;
  payment_method: PaymentMethod;
  payment_splits?: SplitPaymentDetail[];
  amount_paid?: number;
  change_due?: number;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  bank_account_id?: string;
  bank_account_number?: string;
  bank_name?: string;
  payment_reference?: string; // RRN or bank transfer session ID
  credit_amount?: number;     // Amount taken on credit
  deposit_amount?: number;    // Upfront down payment paid today
  balance_due?: number;       // Remaining debt balance
  payment_due_date?: string;  // Agreed settlement date
  deposit_payment_method?: PaymentMethod | string;
  staff_id: string;
  customer_id: string;
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  is_historical_import?: boolean;
  migration_batch_id?: string;
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
  balance?: number;          // Outstanding credit balance / debt in ₦ (defaults to 0)
  credit_limit?: number;     // Max allowable debt limit in ₦
  credit_history?: any[];    // Credit purchases history
  repayment_history?: any[]; // Debt repayments history
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

export type POStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  item_sn: string;
  item_name: string;
  product_measure_unit?: ProductUnit;
  quantity_ordered: number;
  quantity_received: number; // Cumulative quantity received so far
  quantity_pending?: number;  // Remaining quantity pending receipt
  unit_cost: number;
  total_cost: number;        // quantity_ordered * unit_cost
  expiry_date?: string;      // YYYY-MM-DD
}

export interface POReceiptBatchItem {
  item_sn: string;
  item_name: string;
  quantity_received: number;
  expiry_date?: string;
}

export interface POReceiptBatch {
  receipt_id: string; // e.g. "REC-PO-20261001-001"
  received_at: string;
  received_by_staff_id: string;
  received_by_staff_name: string;
  received_by_role: UserRole;
  delivery_note_ref?: string;
  notes?: string;
  items: POReceiptBatchItem[];
}

export interface PurchaseOrder {
  po_id: string; // PO-20260922-001
  supplier_id: string;
  items: PurchaseOrderItem[];
  order_date: string;
  expected_delivery_date: string;
  actual_delivery_date?: string;
  status: POStatus;
  notes?: string;
  receiving_history?: POReceiptBatch[];
  
  // Backward compatibility fields for legacy single-item records
  item_sn?: string;
  quantity_ordered?: number;
  quantity_received?: number;
  unit_cost?: number;
  total_cost: number;
}

export type UserRole = 'Cashier' | 'Supervisor' | 'Manager' | 'Admin' | 'Super Admin';

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

export interface RefundItemDetail {
  item_sn: string;
  item_name: string;
  quantity_refunded: number;
  unit_price: number;
  refund_amount: number;
  unit?: ProductUnit;
  item_cost?: number;
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
  payment_method?: PaymentMethod;
  pos_terminal_id?: string;
  pos_terminal_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_account_id?: string;
  cashier_staff_id?: string;
  cashier_staff_name?: string;
  items?: RefundItemDetail[];
  is_full_refund?: boolean;
  disbursement_channel?: 'ORIGINAL_CHANNEL' | 'STORE_VOUCHER' | 'BANK_REVERSAL' | 'CASH_OVERRIDE';
  disbursement_reference?: string;
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
  cart_item_id?: string; // Unique row key: `${item_sn}_${sell_unit || 'BASE'}`
  maxAvailable: number;
}

export interface ActiveWalkInOrder {
  id: string; // e.g. ORD-1727289123-1
  orderNumber: number;
  label: string; // e.g. "Walk-in #1", "Customer A - Retail Order"
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
  order_label: string; // e.g. "Walk-in #1", "Customer A - Retail Order", "Waiting for ATM"
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
  | 'Discounts'
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
  | 'STAFF_CREATED'
  | 'STAFF_UPDATED'
  | 'STAFF_DELETED'
  | 'STAFF_SWITCHED'
  | 'STAFF_LOGIN'
  | 'STAFF_LOGOUT'
  | 'LOGIN_FAILED'
  | 'PIN_VERIFIED'
  | 'MANAGER_OVERRIDE'
  | 'PERMISSION_DENIED'
  | 'DATABASE_BACKUP_EXPORT'
  | 'DATABASE_RESET'
  | 'RECEIPT_SETTINGS_UPDATED'
  | 'PARTIAL_GOODS_RECEIVED'
  | 'DISCOUNT_PIN_VERIFIED'
  | 'DISCOUNT_PIN_ROTATED'
  | 'DISCOUNT_APPLIED'
  | 'DISCOUNT_RULE_CREATED'
  | 'DISCOUNT_RULE_UPDATED'
  | 'DISCOUNT_RULE_DELETED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED';

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

export interface ReceiptBrandingConfig {
  id: string; // 'DEFAULT_RECEIPT_CONFIG'
  business_name: string;
  tagline: string;
  address_line1: string;
  address_line2: string;
  phone_numbers: string;
  email: string;
  tax_or_cac_number: string;
  footer_thank_you: string;
  footer_policy_notice: string;
  custom_notes?: string;
  logo_base64: string | null;
  show_logo: boolean;
  show_barcode: boolean;
  show_cashier_name: boolean;
  show_tax_details: boolean;
  paper_width: '80mm' | '58mm';
  updated_at: string;
  updated_by_staff_name: string;
}

export interface DiscountSecurityConfig {
  id: 'DISCOUNT_SECURITY_CONFIG';
  discount_pin: string; // Salted SHA-256 hash of manager-set discount PIN
  is_configured: boolean;
  stacking_policy?: 'BEST_DISCOUNT' | 'CONTROLLED_STACKING'; // Default: 'BEST_DISCOUNT'
  max_discount_percent_cap?: number; // Default: 25%
  enforce_cost_floor?: boolean; // Default: true (prevents selling below cost)
  updated_at: string;
  updated_by_staff_id?: string;
  updated_by_staff_name?: string;
}

export type DiscountRuleCondition = 
  | 'ITEM_WEIGHT_THRESHOLD'
  | 'CART_SUBTOTAL_THRESHOLD'
  | 'CART_QUANTITY_THRESHOLD'
  | 'CUSTOMER_LOYALTY'
  | 'GENERAL_OVERRIDE';

export interface DiscountRule {
  rule_id: string;
  name: string;
  description: string;
  condition_type: DiscountRuleCondition;
  threshold_value: number;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  scope?: 'QUALIFYING_ITEM' | 'BASKET'; // Default: 'BASKET'
  max_discount_cap?: number; // Optional maximum discount amount in Naira
  requires_manager_approval: boolean; // false = pre-approved for cashier when criteria met
  is_active: boolean;
  updated_at?: string;
}

export interface ProductCategoryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_at?: string;
  created_by?: string;
}

// -------------------------------------------------------------
// LEGACY DATA MIGRATION & THIRD-PARTY IMPORT TYPES
// -------------------------------------------------------------
export interface LegacyMigrationConfig {
  deductInventory: boolean;
  creditSalesStatus: 'SETTLED' | 'OUTSTANDING';
  autoCreateMissingProducts: boolean;
  autoCreateMissingCustomers: boolean;
  batchTag?: string;
}

export interface LegacyMigrationRow {
  invoice_number?: string;
  date_time: string;
  item_name: string;
  item_sn?: string;
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  cost_price?: number;
  customer_name?: string;
  customer_phone?: string;
  cashier_name?: string;
  payment_method?: PaymentMethod | string;
  discount_applied?: number;
  unit?: string;
}

export interface LegacyMigrationBatchResult {
  success: boolean;
  batchId: string;
  totalImported: number;
  totalVolume: number;
  dateRange: { start: string; end: string };
  productsCreated: number;
  customersCreated: number;
  stockDeducted: boolean;
  error?: string;
  errors?: string[];
}


