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
  | 'Debit/Credit Card' 
  | 'Mobile Money' 
  | 'Bank Transfer' 
  | 'Check';

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
  username?: string; // e.g. kola, ibrahim, chidinma, alex
  phone_number: string;
  role: UserRole;
  pin: string; // 4-digit security PIN for authorization
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

export type AuditCategory = 
  | 'Sales' 
  | 'Refunds' 
  | 'Inventory' 
  | 'Purchasing' 
  | 'Customer'
  | 'CycleCount' 
  | 'Transfer' 
  | 'Security' 
  | 'System';

export type AuditSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';

export type AuditAction = 
  | 'SALE_COMPLETED'
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
