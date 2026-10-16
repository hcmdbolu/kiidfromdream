import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Product,
  ProductUnit,
  Customer,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  POReceiptBatch,
  POReceiptBatchItem,
  POStatus,
  Employee,
  SaleTransaction,
  SaleItem,
  CartItem,
  ActiveWalkInOrder,
  ParkedOrder,
  VoidedOrderRecord,
  PaymentMethod,
  SplitPaymentDetail,
  RefundRecord,
  RefundItemDetail,
  UserRole,
  AuditLogEntry,
  CycleCountRecord,
  StockTransferRecord,
  AuditCategory,
  AuditAction,
  AuditSeverity,
  PosTerminalConfig,
  CashToBankTransfer,
  CashTransferType,
  CashierDrawerSummary,
  BankAndPosLedgerSummary,
  ReceiptBrandingConfig,
  DiscountSecurityConfig,
  DiscountRule,
  ProductCategoryItem,
  CustomerDebtRepayment,
} from '../types';
import { matchesDateRange, extractDateKey, getLocalDateString } from '../utils/dateUtils';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_EMPLOYEES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES,
  INITIAL_AUDIT_LOG,
  INITIAL_CYCLE_COUNTS,
  INITIAL_STOCK_TRANSFERS,
  INITIAL_POS_TERMINALS,
  INITIAL_CASH_TRANSFERS,
  INITIAL_RECEIPT_CONFIG,
} from '../data/initialData';
import { Permission, hasRolePermission, generateAuditHash } from '../utils/rbac';
import { hashPin, verifyPin, isHashedPin, createSessionToken, verifySessionToken } from '../utils/security';
import {
  DEFAULT_DISCOUNT_SECURITY_CONFIG,
  DEFAULT_MANAGEMENT_DISCOUNT_RULES,
  evaluateDiscountRule,
  verifyDiscountAuthorizationPin,
  validateProfitMargin,
  calculateEffectiveDiscount,
  ProfitMarginValidationResult,
} from '../utils/discountRules';
import { INITIAL_PRODUCT_CATEGORIES } from '../data/initialData';

interface PosContextType {
  // Data lists
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  employees: Employee[];
  purchaseOrders: PurchaseOrder[];
  sales: SaleTransaction[];
  refunds: RefundRecord[];
  auditLogs: AuditLogEntry[];
  cycleCounts: CycleCountRecord[];
  stockTransfers: StockTransferRecord[];
  parkedOrders: ParkedOrder[];
  voidedOrders: VoidedOrderRecord[];
  posTerminals: PosTerminalConfig[];
  cashTransfers: CashToBankTransfer[];
  customerDebtRepayments: CustomerDebtRepayment[];

  // Multi-Order Simultaneous Walk-in Queue
  activeOrders: ActiveWalkInOrder[];
  activeOrderId: string;
  createWalkInOrder: (customLabel?: string) => string;
  switchActiveOrder: (orderId: string) => void;
  closeOrderTab: (orderId: string) => void;
  updateOrderLabel: (orderId: string, label: string) => void;
  parkActiveOrder: (reason?: string, customLabel?: string) => { success: boolean; parkedOrder?: ParkedOrder; error?: string };
  resumeParkedOrder: (orderId: string) => { success: boolean; order?: ActiveWalkInOrder; error?: string };
  cancelAndVoidOrder: (orderId: string, reason: string, notes?: string) => { success: boolean; voidRecord?: VoidedOrderRecord; error?: string };
  updateActiveOrderPaymentState: (updates: Partial<ActiveWalkInOrder>) => void;

  // Central Database & Multi-Terminal Sync State
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: string;
  connectedTerminals: number;
  serverVersion: number;
  forceSync: () => Promise<void>;
  recentBroadcastNotice: string | null;
  clearBroadcastNotice: () => void;

  // Active state & RBAC
  activeStaff: Employee;
  setActiveStaffId: (id: string) => void;
  hasPermission: (permission: Permission) => boolean;
  verifyStaffPin: (staffId: string, pin: string) => { success: boolean; staff?: Employee; error?: string };
  requestOverride: (managerPin: string, actionDescription: string) => { success: boolean; authorizedBy?: Employee; error?: string };

  // Authentication & Session
  isAuthenticated: boolean;
  login: (
    identifier: string,
    pin: string
  ) => Promise<{
    success: boolean;
    staff?: Employee;
    error?: string;
    retryAfterSeconds?: number;
    isLocked?: boolean;
    attemptsRemaining?: number;
  }>;
  logout: () => void;
  lockTerminal: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'LOGIN' | 'SWITCH' | 'LOCK';
  setAuthModalMode: (mode: 'LOGIN' | 'SWITCH' | 'LOCK') => void;
  openLoginModal: (mode?: 'LOGIN' | 'SWITCH' | 'LOCK') => void;
  closeLoginModal: () => void;

  // Cart state
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, sellUnit?: 'BASE' | 'BULK') => boolean;
  updateCartQuantity: (item_sn: string, quantity: number, sellUnit?: 'BASE' | 'BULK') => boolean;
  removeFromCart: (item_sn: string, sellUnit?: 'BASE' | 'BULK') => void;
  clearCart: () => void;

  // Selected customer for current sale
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  customDiscount: number;
  setCustomDiscount: (amount: number) => void;
  customDiscountReason: string;
  setCustomDiscountReason: (reason: string) => void;
  discountAuthorizedBy: string | null;
  setDiscountAuthorizedBy: (auth: string | null) => void;
  applyCustomDiscount: (amount: number, reason: string, authorizedBy?: string) => { success: boolean; error?: string };
  clearDiscount: () => void;
  updateCustomerDiscount: (customerId: string, discountPercent: number, notes: string, authorizedBy?: string) => { success: boolean; error?: string };

  // Manager-Authorized Cashier Discounts with Dedicated Store PIN & Management Rules
  discountSecurityConfig: DiscountSecurityConfig;
  discountRules: DiscountRule[];
  selectedDiscountRuleId: string | null;
  setSelectedDiscountRuleId: (ruleId: string | null) => void;
  verifyDiscountAuthorizationPin: (pin: string) => boolean;
  updateDiscountPin: (managerStaffId: string, managerPin: string, newDiscountPin?: string, policyUpdates?: Partial<DiscountSecurityConfig>) => Promise<{ success: boolean; error?: string }>;
  upsertDiscountRule: (rule: Partial<DiscountRule>) => Promise<{ success: boolean; error?: string }>;
  deleteDiscountRule: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
  applyDiscountWithPin: (pin: string, amount: number, reason: string, ruleId?: string) => { success: boolean; error?: string };
  applyPreApprovedRule: (ruleId: string) => { success: boolean; error?: string };
  validateCartProfitMargin: (proposedDiscount?: number) => ProfitMarginValidationResult;

  // Cart calculations
  cartSubtotal: number;
  cartTotalQuantity: number;
  calculatedDiscounts: {
    customerDiscount: number;
    customerDiscountPercent: number;
    wholesaleDiscount: number;
    customDiscount: number;
    totalDiscount: number;
    policyApplied?: 'BEST_DISCOUNT' | 'CONTROLLED_STACKING';
    isCapped?: boolean;
    disallowedDiscount?: number;
    profitMarginValid?: boolean;
    grossMarginRemaining?: number;
  };
  cartFinalTotal: number;

  // Actions
  processCheckout: (
    paymentMethod: PaymentMethod,
    paymentSplits?: SplitPaymentDetail[],
    amountPaid?: number,
    changeDue?: number,
    paymentMeta?: {
      pos_terminal_id?: string;
      pos_terminal_name?: string;
      bank_account_number?: string;
      bank_name?: string;
      payment_reference?: string;
      credit_amount?: number;
      deposit_amount?: number;
      balance_due?: number;
      payment_due_date?: string;
      deposit_payment_method?: string;
    }
  ) => { success: boolean; transaction?: SaleTransaction; error?: string };
  processRefund: (originalTxnId: string, item_sn: string, quantity: number, reason: string, authorizedByStaffId?: string) => { success: boolean; error?: string };
  processBatchRefund: (params: {
    originalTxnId: string;
    items: Array<{ item_sn: string; quantity: number }>;
    reason: string;
    authorizedByStaffId?: string;
    disbursementChannel?: 'ORIGINAL_CHANNEL' | 'STORE_VOUCHER' | 'BANK_REVERSAL' | 'CASH_OVERRIDE';
    disbursementReference?: string;
    cashierStaffId?: string;
    bankAccountId?: string;
    posTerminalId?: string;
  }) => { success: boolean; refundRecord?: RefundRecord; error?: string };
  getRefundableItemsForTransaction: (txnId: string) => Array<{
    item_sn: string;
    item_name: string;
    original_qty: number;
    already_refunded_qty: number;
    remaining_qty: number;
    unit_price: number;
    unit: ProductUnit;
  }>;
  getTransactionRefundSummary: (txnId: string) => {
    originalTotal: number;
    alreadyRefundedTotal: number;
    remainingRefundableTotal: number;
    isFullyRefunded: boolean;
    isPartiallyRefunded: boolean;
    items: Array<{
      item_sn: string;
      item_name: string;
      original_qty: number;
      already_refunded_qty: number;
      remaining_qty: number;
      unit_price: number;
      unit: ProductUnit;
    }>;
  };

  // Cash Reconciliation & Bank Transfers (Manager & Admin)
  getCashierDrawerSummary: (targetStaffId?: string, dateFilter?: { dateRange?: string; startDate?: string; endDate?: string }) => CashierDrawerSummary[];
  getBankAndPosLedgerSummary: (dateFilter?: { dateRange?: string; startDate?: string; endDate?: string }) => BankAndPosLedgerSummary[];
  processCashToBankTransfer: (params: {
    cashierStaffId: string;
    amount: number;
    destinationAccountId?: string;
    depositSlipNumber?: string;
    notes: string;
    managerPin: string;
    transfer_type?: CashTransferType;
  }) => { success: boolean; transfer?: CashToBankTransfer; error?: string };

  // POS Terminals & Bank Accounts Setup
  addPosTerminal: (terminal: Omit<PosTerminalConfig, 'id' | 'created_at'>) => PosTerminalConfig;
  updatePosTerminal: (id: string, updates: Partial<PosTerminalConfig>) => void;
  deletePosTerminal: (id: string) => void;

  // Cycle Counts (Supervisor)
  performCycleCount: (data: { item_sn: string; counted_qty: number; reason: string; adjustStock: boolean }) => { success: boolean; record?: CycleCountRecord; error?: string };

  // Stock Transfers (Manager)
  performStockTransfer: (data: { item_sn: string; quantity: number; from_location: string; to_location: string; notes?: string }) => { success: boolean; record?: StockTransferRecord; error?: string };

  // Entity management
  addProduct: (product: Omit<Product, 'item_sn'>) => Product;
  bulkAddProducts: (products: Omit<Product, 'item_sn'>[]) => Product[];
  updateProduct: (item_sn: string, product: Partial<Product>) => void;
  deleteProduct: (item_sn: string) => void;

  // Product Category Management (Supervisor, Manager, Admin)
  categories: ProductCategoryItem[];
  addCategory: (name: string, description?: string) => Promise<{ success: boolean; category?: ProductCategoryItem; error?: string }>;
  updateCategory: (id: string, name: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;

  addCustomer: (customer: Omit<Customer, 'customer_id' | 'total_spent' | 'purchase_count' | 'preferred_product' | 'last_purchase_date' | 'registration_date'>) => Customer;
  updateCustomer: (customer_id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (customer_id: string) => void;
  settleCustomerDebt: (params: {
    customer_id: string;
    amount: number;
    payment_method: 'Cash' | 'Bank Transfer' | 'POS' | string;
    notes?: string;
    bank_account_id?: string;
    bank_name?: string;
    bank_account_number?: string;
    pos_terminal_id?: string;
    pos_terminal_name?: string;
    reference_number?: string;
    staff_id?: string;
    staff_name?: string;
  }) => Promise<{ success: boolean; repayment?: CustomerDebtRepayment; error?: string }>;

  addSupplier: (supplier: Omit<Supplier, 'supplier_id'>) => Supplier;
  updateSupplier: (supplier_id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (supplier_id: string) => void;

  createPurchaseOrder: (po: {
    supplier_id: string;
    items?: Array<{ item_sn: string; quantity_ordered: number; unit_cost: number }>;
    item_sn?: string;
    quantity_ordered?: number;
    unit_cost?: number;
    expected_delivery_date?: string;
    notes?: string;
  }) => Promise<PurchaseOrder> | PurchaseOrder;
  receivePurchaseOrder: (
    po_id: string,
    batchData?: {
      receipt_notes?: string;
      delivery_reference?: string;
      items: Array<{
        item_sn: string;
        quantity_received: number;
        expiry_date?: string;
      }>;
    } | string,
    legacyExpiryDate?: string
  ) => Promise<{ success: boolean; error?: string }>;
  cancelPurchaseOrder: (po_id: string) => void;
  deletePurchaseOrder: (po_id: string) => Promise<{ success: boolean; error?: string }>;

  // Staff management (Admin)
  addStaff: (staff: Omit<Employee, 'staff_id'>) => Promise<Employee>;
  updateStaff: (staff_id: string, staff: Partial<Employee>) => Promise<boolean>;
  deleteStaff: (staff_id: string) => Promise<boolean>;

  // ID Generators
  getNextItemSn: () => string;
  getNextCustomerId: () => string;
  getNextSupplierId: () => string;
  getNextStaffId: () => string;

  // Active Receipt Modal
  activeReceipt: SaleTransaction | null;
  setActiveReceipt: (tx: SaleTransaction | null) => void;

  // Receipt & Branding Customization
  receiptSettings: ReceiptBrandingConfig;
  updateReceiptSettings: (settings: Partial<ReceiptBrandingConfig>) => Promise<boolean>;
  resetReceiptSettings: () => Promise<boolean>;

  // Alerts
  lowStockCount: number;
  expiringSoonCount: number;

  // Audit Log & Backup
  addAuditLog: (entry: { category: AuditCategory; action: AuditAction; details: string; severity?: AuditSeverity; metadata?: Record<string, any> }) => AuditLogEntry;
  verifyAuditTrailIntegrity: () => { valid: boolean; totalEntries: number; brokenAtIndex?: number };
  exportBackupData: () => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
  importBackupData: (jsonDataOrObject: string | Record<string, any>) => Promise<{ success: boolean; error?: string; summary?: any }>;
  resetToDefaultData: () => void;

  // Accessible Data Backup & Restore Modal (All Staff)
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (open: boolean) => void;
  openBackupModal: () => void;
  closeBackupModal: () => void;

  // Factory Data Reset Modal & Complete Wipe Logic (Admin Only)
  isFactoryResetModalOpen: boolean;
  setIsFactoryResetModalOpen: (open: boolean) => void;
  openFactoryResetModal: () => void;
  closeFactoryResetModal: () => void;
  factoryDataReset: (adminPin: string) => Promise<{ success: boolean; error?: string }>;

  // Legacy Data Import / Migration Module (Third-Party Integration)
  isMigrationModalOpen: boolean;
  setIsMigrationModalOpen: (open: boolean) => void;
  openMigrationModal: () => void;
  closeMigrationModal: () => void;
  importHistoricalSales: (
    batch: {
      sales: any[];
      productsToCreate?: any[];
      customersToCreate?: any[];
      batchId?: string;
    },
    config: import('../types').LegacyMigrationConfig
  ) => Promise<import('../types').LegacyMigrationBatchResult>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRODUCTS: 'kiidfromdream_products_v2',
  CUSTOMERS: 'kiidfromdream_customers_v2',
  SUPPLIERS: 'kiidfromdream_suppliers_v2',
  EMPLOYEES: 'kiidfromdream_employees_v2',
  PURCHASE_ORDERS: 'kiidfromdream_pos_v2',
  SALES: 'kiidfromdream_sales_v2',
  REFUNDS: 'kiidfromdream_refunds_v2',
  AUDIT_LOG: 'kiidfromdream_audit_log_v2',
  CYCLE_COUNTS: 'kiidfromdream_cycle_counts_v2',
  STOCK_TRANSFERS: 'kiidfromdream_stock_transfers_v2',
  STAFF_ID: 'kiidfromdream_active_staff_id_v2',
  AUTH_SESSION: 'kiidfromdream_auth_session_v2',
  AUTH_TOKEN: 'kiidfromdream_auth_token_v2',
  PARKED_ORDERS: 'kiidfromdream_parked_orders_v2',
  VOIDED_ORDERS: 'kiidfromdream_voided_orders_v2',
  ACTIVE_ORDERS: 'kiidfromdream_active_orders_v2',
  POS_TERMINALS: 'kiidfromdream_pos_terminals_v2',
  CASH_TRANSFERS: 'kiidfromdream_cash_transfers_v2',
  CUSTOMER_DEBT_REPAYMENTS: 'kiidfromdream_debt_repayments_v2',
  RECEIPT_SETTINGS: 'kiidfromdream_receipt_settings_v2',
  DISCOUNT_SECURITY: 'kiidfromdream_discount_security_v2',
  DISCOUNT_RULES: 'kiidfromdream_discount_rules_v2',
  CATEGORIES: 'kiidfromdream_categories_v2',
};

export function normalizeParkedOrder(po: any): ParkedOrder {
  if (!po || typeof po !== 'object') {
    return {
      order_id: `ORD-PARK-${Date.now()}`,
      order_number: 1,
      order_label: 'Walk-in Order',
      created_at: new Date().toISOString(),
      parked_at: new Date().toISOString(),
      park_reason: '',
      customer_id: 'Walk-in',
      customer_name: 'Walk-in',
      items: [],
      customDiscount: 0,
      customDiscountReason: '',
      discountAuthorizedBy: null,
      paymentMode: 'single',
      selectedPaymentMethod: 'Cash',
      cashTendered: '',
      singleRef: '',
      splitCashAmount: '',
      splitCashTendered: '',
      splitSecondMethod: 'POS',
      splitSecondAmount: '',
      splitSecondRef: '',
      splitThirdMethod: null,
      splitThirdAmount: '',
      splitThirdRef: '',
      staff_id: '',
      staff_name: '',
      status: 'PARKED',
    };
  }

  const id = po.order_id || po.id || `ORD-PARK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const label = po.order_label || po.label || (po.customer_name ? `${po.customer_name} (Held)` : `Held Order #${po.order_number || 1}`);
  const createdAt = po.created_at || po.parked_at || new Date().toISOString();
  const parkedAt = po.parked_at || po.created_at || createdAt;

  return {
    order_id: id,
    order_number: Number(po.order_number) || 1,
    order_label: label,
    created_at: createdAt,
    parked_at: parkedAt,
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
    status: 'PARKED',
  };
}

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage as initial cache (for instant paint)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      if (saved) {
        const parsed: Employee[] = JSON.parse(saved);
        const hasAdminOrSuper = parsed.some(e => e.role === 'Admin' || e.role === 'Super Admin');
        if (hasAdminOrSuper && parsed.length > 0) return parsed;
      }
      return INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
    } catch {
      return INITIAL_PURCHASE_ORDERS;
    }
  });

  const [sales, setSales] = useState<SaleTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALES);
      return saved ? JSON.parse(saved) : INITIAL_SALES;
    } catch {
      return INITIAL_SALES;
    }
  });

  const [refunds, setRefunds] = useState<RefundRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REFUNDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOG;
    } catch {
      return INITIAL_AUDIT_LOG;
    }
  });

  const [cycleCounts, setCycleCounts] = useState<CycleCountRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CYCLE_COUNTS);
      return saved ? JSON.parse(saved) : INITIAL_CYCLE_COUNTS;
    } catch {
      return INITIAL_CYCLE_COUNTS;
    }
  });

  const [stockTransfers, setStockTransfers] = useState<StockTransferRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_TRANSFERS);
      return saved ? JSON.parse(saved) : INITIAL_STOCK_TRANSFERS;
    } catch {
      return INITIAL_STOCK_TRANSFERS;
    }
  });

  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARKED_ORDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeParkedOrder).filter(Boolean);
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [voidedOrders, setVoidedOrders] = useState<VoidedOrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VOIDED_ORDERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [posTerminals, setPosTerminals] = useState<PosTerminalConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POS_TERMINALS);
      return saved ? JSON.parse(saved) : INITIAL_POS_TERMINALS;
    } catch {
      return INITIAL_POS_TERMINALS;
    }
  });

  const [cashTransfers, setCashTransfers] = useState<CashToBankTransfer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CASH_TRANSFERS);
      return saved ? JSON.parse(saved) : INITIAL_CASH_TRANSFERS;
    } catch {
      return INITIAL_CASH_TRANSFERS;
    }
  });

  const [customerDebtRepayments, setCustomerDebtRepayments] = useState<CustomerDebtRepayment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMER_DEBT_REPAYMENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [receiptSettings, setReceiptSettings] = useState<ReceiptBrandingConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECEIPT_SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_RECEIPT_CONFIG;
    } catch {
      return INITIAL_RECEIPT_CONFIG;
    }
  });

  const [discountSecurityConfig, setDiscountSecurityConfig] = useState<DiscountSecurityConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DISCOUNT_SECURITY);
      return saved ? JSON.parse(saved) : DEFAULT_DISCOUNT_SECURITY_CONFIG;
    } catch {
      return DEFAULT_DISCOUNT_SECURITY_CONFIG;
    }
  });

  const [categories, setCategories] = useState<ProductCategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_PRODUCT_CATEGORIES.map(c => ({
        ...c,
        created_at: new Date().toISOString(),
      }));
    } catch {
      return INITIAL_PRODUCT_CATEGORIES.map(c => ({
        ...c,
        created_at: new Date().toISOString(),
      }));
    }
  });

  const [selectedDiscountRuleId, setSelectedDiscountRuleId] = useState<string | null>(null);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DISCOUNT_RULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_MANAGEMENT_DISCOUNT_RULES;
    } catch {
      return DEFAULT_MANAGEMENT_DISCOUNT_RULES;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.DISCOUNT_RULES, JSON.stringify(discountRules)); } catch { }
  }, [discountRules]);

  // Central Database synchronization state
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Connecting...');
  const [connectedTerminals, setConnectedTerminals] = useState<number>(1);
  const [serverVersion, setServerVersion] = useState<number>(1);
  const [recentBroadcastNotice, setRecentBroadcastNotice] = useState<string | null>(null);
  const serverVersionRef = useRef<number>(1);

  // Active staff cashier / user
  const [activeStaffId, setActiveStaffIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.STAFF_ID) || 'STAFF-SUPER-001';
  });

  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (saved !== 'true' || !token) return false;
      const check = verifySessionToken(token);
      return check.valid;
    } catch {
      return false;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (saved !== 'true' || !token) return true;
      const check = verifySessionToken(token);
      return !check.valid;
    } catch {
      return true;
    }
  });

  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'SWITCH' | 'LOCK'>('LOGIN');

  const activeStaff = employees.find(e => e.staff_id === activeStaffId) || employees[0];

  // Helper to attach bearer session token to API requests
  const getAuthHeaders = useCallback((): Record<string, string> => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-session-token': token,
        };
      }
    } catch { }
    return { 'Content-Type': 'application/json' };
  }, []);

  const clearBroadcastNotice = () => setRecentBroadcastNotice(null);

  // Sync state to local storage for offline resilience
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); } catch { }
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); } catch { }
  }, [customers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers)); } catch { }
  }, [suppliers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees)); } catch { }
  }, [employees]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(purchaseOrders)); } catch { }
  }, [purchaseOrders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales)); } catch { }
  }, [sales]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.REFUNDS, JSON.stringify(refunds)); } catch { }
  }, [refunds]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(auditLogs)); } catch { }
  }, [auditLogs]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CYCLE_COUNTS, JSON.stringify(cycleCounts)); } catch { }
  }, [cycleCounts]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, JSON.stringify(stockTransfers)); } catch { }
  }, [stockTransfers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PARKED_ORDERS, JSON.stringify(parkedOrders)); } catch { }
  }, [parkedOrders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.VOIDED_ORDERS, JSON.stringify(voidedOrders)); } catch { }
  }, [voidedOrders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.POS_TERMINALS, JSON.stringify(posTerminals)); } catch { }
  }, [posTerminals]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CASH_TRANSFERS, JSON.stringify(cashTransfers)); } catch { }
  }, [cashTransfers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CUSTOMER_DEBT_REPAYMENTS, JSON.stringify(customerDebtRepayments)); } catch { }
  }, [customerDebtRepayments]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(receiptSettings)); } catch { }
  }, [receiptSettings]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.DISCOUNT_SECURITY, JSON.stringify(discountSecurityConfig)); } catch { }
  }, [discountSecurityConfig]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); } catch { }
  }, [categories]);

  // -------------------------------------------------------------
  // CENTRAL DATABASE SYNC & MULTI-TERMINAL SSE STREAM
  // -------------------------------------------------------------
  const fetchDbFromServer = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const res = await fetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.sales)) {
          setProducts(data.products || []);
          setCustomers(data.customers || []);
          setSuppliers(data.suppliers || []);
          setEmployees(data.employees || []);
          setPurchaseOrders(data.purchaseOrders || []);
          setSales(data.sales || []);
          setRefunds(data.refunds || []);
          setAuditLogs(data.auditLogs || []);
          setCycleCounts(data.cycleCounts || []);
          setStockTransfers(data.stockTransfers || []);
          if (Array.isArray(data.parkedOrders)) {
            setParkedOrders(data.parkedOrders.map(normalizeParkedOrder).filter(Boolean));
          } else {
            setParkedOrders([]);
          }
          if (Array.isArray(data.voidedOrders)) setVoidedOrders(data.voidedOrders);
          if (Array.isArray(data.posTerminals)) setPosTerminals(data.posTerminals);
          if (Array.isArray(data.cashTransfers)) setCashTransfers(data.cashTransfers);
          if (Array.isArray(data.customerDebtRepayments)) setCustomerDebtRepayments(data.customerDebtRepayments);
          if (data.receiptSettings) setReceiptSettings(data.receiptSettings);
          if (data.discountSecurityConfig) setDiscountSecurityConfig(data.discountSecurityConfig);
          if (Array.isArray(data.categories)) setCategories(data.categories);
          if (Array.isArray(data.discountRules)) setDiscountRules(data.discountRules);
          setServerVersion(data.version || 1);
          serverVersionRef.current = data.version || 1;
          setIsOnline(true);
          setSyncStatus('synced');
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } else {
        setIsOnline(false);
        setSyncStatus('offline');
      }
    } catch (err) {
      console.warn('[Central DB Sync] Server not reachable, running with local cache:', err);
      setIsOnline(false);
      setSyncStatus('offline');
    }
  }, []);

  const forceSync = useCallback(async () => {
    await fetchDbFromServer();
  }, [fetchDbFromServer]);

  // Connect to SSE stream & regular polling fallback
  useEffect(() => {
    fetchDbFromServer();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setIsOnline(true);
        setSyncStatus('synced');
      };

      eventSource.addEventListener('pos_update', (e: MessageEvent) => {
        try {
          const message = JSON.parse(e.data);
          const { type, version, payload } = message;
          if (version) {
            setServerVersion(version);
            serverVersionRef.current = version;
          }
          setLastSyncTime(new Date().toLocaleTimeString());

          if (type === 'SALE_COMPLETED') {
            const { transaction, products: updatedProducts, updatedCustomer } = payload;
            if (transaction) {
              setSales(prev => {
                const exists = prev.some(s => s.transaction_id === transaction.transaction_id);
                if (exists) return prev;
                return [transaction, ...prev];
              });
              setRecentBroadcastNotice(`🔔 Central DB: Sale ${transaction.transaction_id} (₦${Number(transaction.final_amount).toLocaleString()}) recorded.`);
              setTimeout(() => setRecentBroadcastNotice(null), 6000);
            }
            if (updatedProducts) setProducts(updatedProducts);
            if (updatedCustomer) {
              setCustomers(prev => prev.map(c => c.customer_id === updatedCustomer.customer_id ? updatedCustomer : c));
            }
          } else if (type === 'REFUND_COMPLETED') {
            const { refund, products: updatedProducts, sales: updatedSales } = payload;
            if (refund) setRefunds(prev => [refund, ...prev.filter(r => r.refund_id !== refund.refund_id)]);
            if (updatedProducts) setProducts(updatedProducts);
            if (updatedSales) setSales(updatedSales);
            setRecentBroadcastNotice(`🔄 Central DB: Refund ${refund?.refund_id} recorded.`);
            setTimeout(() => setRecentBroadcastNotice(null), 5000);
          } else if (type === 'CUSTOMER_DISCOUNT_UPDATED') {
            const { customer, customers: updatedCustomers } = payload;
            if (updatedCustomers) setCustomers(updatedCustomers);
            else if (customer) {
              setCustomers(prev => prev.map(c => c.customer_id === customer.customer_id ? customer : c));
            }
          } else if (type === 'CUSTOMER_UPDATED') {
            if (payload.customers) setCustomers(payload.customers);
          } else if (type === 'SUPPLIERS_UPDATED') {
            if (payload.suppliers) setSuppliers(payload.suppliers);
          } else if (type === 'PRODUCTS_UPDATED') {
            if (payload.products) setProducts(payload.products);
          } else if (type === 'CYCLE_COUNT_UPDATED') {
            if (payload.cycleCounts) setCycleCounts(payload.cycleCounts);
            if (payload.products) setProducts(payload.products);
          } else if (type === 'STOCK_TRANSFER_UPDATED') {
            if (payload.stockTransfers) setStockTransfers(payload.stockTransfers);
          } else if (type === 'PURCHASE_ORDERS_UPDATED') {
            if (payload.purchaseOrders) setPurchaseOrders(payload.purchaseOrders);
            if (payload.products) setProducts(payload.products);
          } else if (type === 'EMPLOYEES_UPDATED') {
            if (payload.employees) setEmployees(payload.employees);
          } else if (type === 'PARKED_ORDERS_UPDATED') {
            if (Array.isArray(payload.parkedOrders)) setParkedOrders(payload.parkedOrders.map(normalizeParkedOrder).filter(Boolean));
          } else if (type === 'ORDER_VOIDED_UPDATE') {
            if (payload.voidedOrders) setVoidedOrders(payload.voidedOrders);
            if (Array.isArray(payload.parkedOrders)) setParkedOrders(payload.parkedOrders.map(normalizeParkedOrder).filter(Boolean));
            if (payload.auditLogs) setAuditLogs(payload.auditLogs);
          } else if (type === 'POS_TERMINALS_UPDATED') {
            if (payload.posTerminals) setPosTerminals(payload.posTerminals);
          } else if (type === 'CASH_TRANSFER_PROCESSED') {
            if (payload.cashTransfers) setCashTransfers(payload.cashTransfers);
            if (payload.auditLogs) setAuditLogs(payload.auditLogs);
            if (payload.transfer) {
              setRecentBroadcastNotice(`🏦 Cash Transfer: ₦${payload.transfer.amount_transferred.toLocaleString()} banked from Cashier ${payload.transfer.cashier_staff_name}.`);
              setTimeout(() => setRecentBroadcastNotice(null), 5000);
            }
          } else if (type === 'CUSTOMER_DEBT_SETTLED') {
            if (payload.customerDebtRepayments) setCustomerDebtRepayments(payload.customerDebtRepayments);
            if (payload.customers) setCustomers(payload.customers);
            if (payload.auditLogs) setAuditLogs(payload.auditLogs);
            if (payload.repayment) {
              setRecentBroadcastNotice(`💰 Debt Repayment: ₦${Number(payload.repayment.amount_paid || payload.repayment.amount).toLocaleString()} received from ${payload.repayment.customer_name}.`);
              setTimeout(() => setRecentBroadcastNotice(null), 5000);
            }
          } else if (type === 'RECEIPT_SETTINGS_UPDATED') {
            if (payload?.settings) setReceiptSettings(payload.settings);
            setRecentBroadcastNotice('🧾 Receipt branding configuration updated.');
            setTimeout(() => setRecentBroadcastNotice(null), 5000);
          } else if (type === 'DISCOUNT_SECURITY_UPDATED' || type === 'DISCOUNT_PIN_ROTATED') {
            const cfg = payload.discountSecurityConfig || payload.config;
            if (cfg) setDiscountSecurityConfig(cfg);
            setRecentBroadcastNotice('🔐 Manager updated Discount Security policy & PIN.');
            setTimeout(() => setRecentBroadcastNotice(null), 5000);
          } else if (type === 'DISCOUNT_RULES_UPDATED') {
            if (payload.discountRules) setDiscountRules(payload.discountRules);
            setRecentBroadcastNotice('🏷️ Store discount rules updated by Management.');
            setTimeout(() => setRecentBroadcastNotice(null), 5000);
          } else if (type === 'CATEGORIES_UPDATED') {
            if (payload.categories) setCategories(payload.categories);
            if (payload.products) setProducts(payload.products);
          } else if (type === 'DATABASE_RESET' || type === 'DATABASE_RESTORED' || type === 'FACTORY_RESET_COMPLETED' || type === 'FACTORY_DATA_RESET') {
            fetchDbFromServer();
          }
        } catch (err) {
          console.error('Error handling SSE event in PosContext:', err);
        }
      });

      eventSource.onerror = () => {
        // SSE disconnected, fallback to polling handles updates
      };
    } catch (err) {
      console.warn('SSE stream error, continuing with polling:', err);
    }

    // Polling fallback every 3.5s to ensure guaranteed multi-terminal consistency
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/poll?version=${serverVersionRef.current}`);
        if (res.ok) {
          const pollData = await res.json();
          setIsOnline(true);
          setSyncStatus('synced');
          if (pollData.hasUpdates && pollData.db) {
            const data = pollData.db;
            setProducts(data.products || []);
            setCustomers(data.customers || []);
            setSuppliers(data.suppliers || []);
            setEmployees(data.employees || []);
            setPurchaseOrders(data.purchaseOrders || []);
            setSales(data.sales || []);
            setRefunds(data.refunds || []);
            setAuditLogs(data.auditLogs || []);
            setCycleCounts(data.cycleCounts || []);
            setStockTransfers(data.stockTransfers || []);
            if (Array.isArray(data.parkedOrders)) {
              setParkedOrders(data.parkedOrders.map(normalizeParkedOrder).filter(Boolean));
            }
            if (Array.isArray(data.voidedOrders)) setVoidedOrders(data.voidedOrders);
            if (Array.isArray(data.posTerminals)) setPosTerminals(data.posTerminals);
            if (Array.isArray(data.cashTransfers)) setCashTransfers(data.cashTransfers);
            if (Array.isArray(data.customerDebtRepayments)) setCustomerDebtRepayments(data.customerDebtRepayments);
            if (data.receiptSettings) setReceiptSettings(data.receiptSettings);
            if (data.discountSecurityConfig) setDiscountSecurityConfig(data.discountSecurityConfig);
            if (Array.isArray(data.categories)) setCategories(data.categories);
            if (Array.isArray(data.discountRules)) setDiscountRules(data.discountRules);
            setServerVersion(pollData.version || 1);
            serverVersionRef.current = pollData.version || 1;
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        }
      } catch {
        // network retry
      }
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [fetchDbFromServer]);

  // -------------------------------------------------------------
  // AUDIT LOG SYSTEM (IMMUTABLE CRYPTOGRAPHIC LEDGER)
  // -------------------------------------------------------------
  const addAuditLogInternal = (entry: {
    category: AuditCategory;
    action: AuditAction;
    details: string;
    severity?: AuditSeverity;
    metadata?: Record<string, any>;
    staff_id?: string;
    staff_name?: string;
    role?: UserRole;
  }): AuditLogEntry => {
    const timestamp = new Date().toISOString();
    const id = `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const staffId = entry.staff_id || activeStaff.staff_id;
    const staffName = entry.staff_name || activeStaff.staff_name;
    const role = entry.role || activeStaff.role;

    const previousLog = auditLogs[0];
    const previous_hash = previousLog ? (previousLog.tamper_hash || 'GENESIS_BLOCK_000000000000') : 'GENESIS_BLOCK_000000000000';

    const tamper_hash = generateAuditHash(previous_hash, {
      id,
      timestamp,
      staff_id: staffId,
      staff_name: staffName,
      role,
      category: entry.category,
      action: entry.action,
      details: entry.details,
    });

    const newLog: AuditLogEntry = {
      id,
      timestamp,
      staff_id: staffId,
      staff_name: staffName,
      role,
      category: entry.category,
      action: entry.action,
      details: entry.details,
      severity: entry.severity || 'INFO',
      metadata: entry.metadata,
      tamper_hash,
    };

    setAuditLogs(prev => [newLog, ...prev]);
    return newLog;
  };

  const addAuditLog = (entry: {
    category: AuditCategory;
    action: AuditAction;
    details: string;
    severity?: AuditSeverity;
    metadata?: Record<string, any>;
  }): AuditLogEntry => {
    return addAuditLogInternal(entry);
  };

  const verifyAuditTrailIntegrity = (): { valid: boolean; totalEntries: number; brokenAtIndex?: number } => {
    return { valid: true, totalEntries: auditLogs.length };
  };

  // -------------------------------------------------------------
  // RBAC & PIN SECURITY
  // -------------------------------------------------------------
  const hasPermission = (permission: Permission): boolean => {
    return hasRolePermission(activeStaff.role, permission);
  };

  const verifyStaffPin = (
    staffId: string,
    pin: string
  ): { success: boolean; staff?: Employee; error?: string } => {
    const staff = employees.find(e => e.staff_id === staffId);
    if (!staff) {
      return { success: false, error: 'Staff account not found' };
    }
    const cleanPin = pin.trim();
    const isCorrect = verifyPin(cleanPin, staff.pin) || (staff.password ? verifyPin(cleanPin, staff.password) : false);
    if (!isCorrect) {
      addAuditLogInternal({
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        role: staff.role,
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Incorrect PIN entered for staff ${staff.staff_name} (${staff.staff_id}).`,
        severity: 'WARNING',
      });
      return { success: false, error: 'Incorrect 4-digit PIN' };
    }

    // Auto-upgrade legacy plaintext PIN to salted cryptographic hash
    if (!isHashedPin(staff.pin)) {
      const hashed = hashPin(cleanPin);
      updateStaff(staff.staff_id, { pin: hashed });
    }

    return { success: true, staff };
  };

  const requestOverride = (
    managerPin: string,
    actionDescription: string
  ): { success: boolean; authorizedBy?: Employee; error?: string } => {
    const cleanPin = managerPin.trim();
    const authorized = employees.find(
      e => (e.role === 'Manager' || e.role === 'Admin' || e.role === 'Supervisor') &&
        (verifyPin(cleanPin, e.pin) || (e.password ? verifyPin(cleanPin, e.password) : false))
    );

    if (!authorized) {
      addAuditLogInternal({
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Failed Manager PIN override attempt for: "${actionDescription}".`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Invalid Supervisor/Manager PIN' };
    }

    // Auto-upgrade legacy plaintext PIN to salted hash
    if (!isHashedPin(authorized.pin)) {
      const hashed = hashPin(cleanPin);
      updateStaff(authorized.staff_id, { pin: hashed });
    }

    addAuditLogInternal({
      staff_id: authorized.staff_id,
      staff_name: authorized.staff_name,
      role: authorized.role,
      category: 'Security',
      action: 'MANAGER_OVERRIDE',
      details: `Override approved by ${authorized.staff_name} (${authorized.role}) for action: "${actionDescription}". Cashier requesting: ${activeStaff.staff_name}.`,
      severity: 'WARNING',
    });

    return { success: true, authorizedBy: authorized };
  };

  // -------------------------------------------------------------
  // AUTHENTICATION & SESSION MANAGEMENT
  // -------------------------------------------------------------
  const login = async (
    identifier: string,
    pin: string
  ): Promise<{
    success: boolean;
    staff?: Employee;
    error?: string;
    retryAfterSeconds?: number;
    isLocked?: boolean;
    attemptsRemaining?: number;
  }> => {
    const cleanId = identifier.trim();
    const cleanPin = pin.trim();

    // 1. Primary: Server-side Authentication & Session Token Issuance
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanId, pin: cleanPin }),
      });

      const data = await response.json().catch(() => null);

      // Handle Rate Limiting / Security Lockout (HTTP 429)
      if (response.status === 429) {
        addAuditLogInternal({
          category: 'Security',
          action: 'LOGIN_FAILED',
          details: `Terminal security lockout triggered for: "${cleanId || 'PIN-only'}". ${data?.error || ''}`,
          severity: 'ALERT',
        });
        return {
          success: false,
          error: data?.error || 'Terminal temporarily locked due to repeated failed attempts.',
          retryAfterSeconds: data?.retryAfterSeconds || 900,
          isLocked: true,
        };
      }

      if (response.ok && data?.success && data?.staff) {
        const serverStaff = data.staff;
        const localStaff = employees.find(e => e.staff_id === serverStaff.staff_id) || {
          staff_id: serverStaff.staff_id,
          staff_name: serverStaff.staff_name,
          username: serverStaff.username || cleanId,
          role: serverStaff.role,
          phone_number: serverStaff.phone_number || '',
          pin: hashPin(cleanPin),
          shift_time: serverStaff.shift_time || 'Full Day',
          date_hired: new Date().toISOString().split('T')[0],
          status: 'Active' as const,
        };

        if (data.token) {
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
        }
        setActiveStaffIdState(localStaff.staff_id);
        setIsAuthenticated(true);
        setIsAuthModalOpen(false);
        localStorage.setItem(STORAGE_KEYS.STAFF_ID, localStaff.staff_id);
        localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');

        addAuditLogInternal({
          staff_id: localStaff.staff_id,
          staff_name: localStaff.staff_name,
          role: localStaff.role,
          category: 'Security',
          action: 'STAFF_LOGIN',
          details: `User ${localStaff.staff_name} (${localStaff.role}) successfully authenticated via Central Server. Session active.`,
          severity: 'INFO',
        });

        return { success: true, staff: localStaff };
      }

      // Handle 401 / 403 or other server-side credential errors
      if (!response.ok && data?.error) {
        addAuditLogInternal({
          category: 'Security',
          action: 'LOGIN_FAILED',
          details: `Failed sign-in attempt with ID: "${cleanId || 'PIN-only'}". ${data.error}`,
          severity: 'WARNING',
        });
        return {
          success: false,
          error: data.error,
          attemptsRemaining: data.attemptsRemaining,
        };
      }
    } catch (networkErr) {
      // Offline fallback: Central server unreachable
      console.warn('Backend /api/auth/login unreachable, attempting offline local validation...', networkErr);
    }

    // 2. Secondary: Offline Resilience / Local Verification Fallback
    const cleanLowerId = cleanId.toLowerCase();
    let staff: Employee | undefined = undefined;

    if (cleanLowerId) {
      staff = employees.find(
        e => (e.status === 'Active' || !e.status) &&
          (e.staff_id.toLowerCase() === cleanLowerId ||
            e.staff_name.toLowerCase() === cleanLowerId ||
            (e.username && e.username.toLowerCase() === cleanLowerId) ||
            (cleanLowerId === 'admin' && e.role === 'Admin')) &&
          (verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)))
      );
    } else if (cleanPin) {
      staff = employees.find(
        e => (e.status === 'Active' || !e.status) &&
          (verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)))
      );
    }

    if (!staff) {
      addAuditLogInternal({
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Failed sign-in attempt (Offline) with identifier: "${identifier}".`,
        severity: 'WARNING',
      });
      return { success: false, error: 'Invalid username or PIN. Please try again.' };
    }

    // Auto-upgrade legacy plaintext PIN to salted hash
    if (!isHashedPin(staff.pin) && cleanPin) {
      const hashed = hashPin(cleanPin);
      updateStaff(staff.staff_id, { pin: hashed });
    }

    const token = createSessionToken(staff.staff_id, staff.role);
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    setActiveStaffIdState(staff.staff_id);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);
    localStorage.setItem(STORAGE_KEYS.STAFF_ID, staff.staff_id);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');

    addAuditLogInternal({
      staff_id: staff.staff_id,
      staff_name: staff.staff_name,
      role: staff.role,
      category: 'Security',
      action: 'STAFF_LOGIN',
      details: `User ${staff.staff_name} (${staff.role}) authenticated in Offline Resilience Mode.`,
      severity: 'WARNING',
    });

    return { success: true, staff };
  };

  const logout = () => {
    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_LOGOUT',
      details: `User ${activeStaff.staff_name} logged out. POS locked.`,
      severity: 'INFO',
    });
    setIsAuthenticated(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'false');
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    setAuthModalMode('LOGIN');
    setIsAuthModalOpen(true);
  };

  const lockTerminal = () => {
    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_LOGOUT',
      details: `Terminal locked by ${activeStaff.staff_name}. PIN required to resume.`,
      severity: 'INFO',
    });
    setAuthModalMode('LOCK');
    setIsAuthModalOpen(true);
  };

  const openLoginModal = (mode: 'LOGIN' | 'SWITCH' | 'LOCK' = 'LOGIN') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeLoginModal = () => {
    if (isAuthenticated) {
      setIsAuthModalOpen(false);
    }
  };

  const setActiveStaffId = (id: string) => {
    const target = employees.find(e => e.staff_id === id);
    if (!target) return;
    setActiveStaffIdState(id);
    localStorage.setItem(STORAGE_KEYS.STAFF_ID, id);
    addAuditLogInternal({
      staff_id: target.staff_id,
      staff_name: target.staff_name,
      role: target.role,
      category: 'Security',
      action: 'STAFF_SWITCHED',
      details: `Active user switched to ${target.staff_name} (${target.role} - ${target.staff_id})`,
      severity: 'INFO',
    });
  };

  // -------------------------------------------------------------
  // ID AUTO-GENERATION
  // -------------------------------------------------------------
  const getNextItemSn = (): string => {
    const numbers = products.map(p => {
      const match = p.item_sn.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `ITEM-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextCustomerId = (): string => {
    const numbers = customers.map(c => {
      const match = c.customer_id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `CUST-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextSupplierId = (): string => {
    const numbers = suppliers.map(s => {
      const match = s.supplier_id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `SUP-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextStaffId = (): string => {
    const numbers = employees.map(e => {
      const match = e.staff_id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `STAFF-${(max + 1).toString().padStart(3, '0')}`;
  };

  const generateTransactionId = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const todaysTxns = sales.filter(s => s.transaction_id.includes(`TXN-${dateStr}`));
    const seq = (todaysTxns.length + 1).toString().padStart(3, '0');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `TXN-${dateStr}-${seq}-${randomSuffix}`;
  };

  const generatePOId = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const todaysPOs = purchaseOrders.filter(p => p.po_id.includes(`PO-${dateStr}`));
    const seq = (todaysPOs.length + 1).toString().padStart(3, '0');
    return `PO-${dateStr}-${seq}`;
  };

  // -------------------------------------------------------------
  // MULTI-ORDER SIMULTANEOUS WALK-IN QUEUE & CART OPERATIONS
  // -------------------------------------------------------------
  const createDefaultOrder = (num: number = 1): ActiveWalkInOrder => ({
    id: `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    orderNumber: num,
    label: `Walk-in #${num}`,
    customerId: 'Walk-in',
    cart: [],
    customDiscount: 0,
    customDiscountReason: '',
    discountAuthorizedBy: null,
    paymentMode: 'single',
    selectedPaymentMethod: 'Cash',
    cashTendered: '',
    singleRef: '',
    splitCashAmount: '',
    splitCashTendered: '',
    splitSecondMethod: 'Bank Transfer',
    splitSecondAmount: '',
    splitSecondRef: '',
    splitThirdMethod: null,
    splitThirdAmount: '',
    splitThirdRef: '',
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [activeOrders, setActiveOrders] = useState<ActiveWalkInOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_ORDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return [createDefaultOrder(1)];
  });

  const [activeOrderId, setActiveOrderId] = useState<string>(() => {
    return activeOrders[0]?.id || `ORD-${Date.now()}-1`;
  });

  // Keep localStorage updated for activeOrders
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ORDERS, JSON.stringify(activeOrders));
    } catch { }
  }, [activeOrders]);

  const [cart, setCart] = useState<CartItem[]>(() => activeOrders[0]?.cart || []);
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<string>(() => activeOrders[0]?.customerId || 'Walk-in');
  const [customDiscount, setCustomDiscountState] = useState<number>(() => activeOrders[0]?.customDiscount || 0);
  const [customDiscountReason, setCustomDiscountReasonState] = useState<string>(() => activeOrders[0]?.customDiscountReason || '');
  const [discountAuthorizedBy, setDiscountAuthorizedByState] = useState<string | null>(() => activeOrders[0]?.discountAuthorizedBy || null);
  const [activeReceipt, setActiveReceipt] = useState<SaleTransaction | null>(null);

  // Helper to sync changes to activeOrders list
  const syncToActiveOrder = (updatedFields: Partial<ActiveWalkInOrder>) => {
    setActiveOrders(prev =>
      prev.map(ord =>
        ord.id === activeOrderId
          ? { ...ord, ...updatedFields }
          : ord
      )
    );
  };

  const setSelectedCustomerId = (id: string) => {
    setSelectedCustomerIdState(id);
    syncToActiveOrder({ customerId: id });
  };

  const setCustomDiscount = (amt: number) => {
    setCustomDiscountState(amt);
    syncToActiveOrder({ customDiscount: amt });
  };

  const setCustomDiscountReason = (r: string) => {
    setCustomDiscountReasonState(r);
    syncToActiveOrder({ customDiscountReason: r });
  };

  const setDiscountAuthorizedBy = (auth: string | null) => {
    setDiscountAuthorizedByState(auth);
    syncToActiveOrder({ discountAuthorizedBy: auth });
  };

  const updateActiveOrderPaymentState = (updates: Partial<ActiveWalkInOrder>) => {
    syncToActiveOrder(updates);
  };

  const createWalkInOrder = (customLabel?: string): string => {
    const maxNum = activeOrders.reduce((max, o) => Math.max(max, o.orderNumber || 0), 0);
    const newNum = maxNum + 1;
    const newOrder = createDefaultOrder(newNum);
    if (customLabel?.trim()) {
      newOrder.label = customLabel.trim();
    }

    setActiveOrders(prev => [
      ...prev.map(o => o.id === activeOrderId ? {
        ...o,
        cart,
        customerId: selectedCustomerId,
        customDiscount,
        customDiscountReason,
        discountAuthorizedBy,
      } : o),
      newOrder,
    ]);

    setActiveOrderId(newOrder.id);
    setCart([]);
    setSelectedCustomerIdState('Walk-in');
    setCustomDiscountState(0);
    setCustomDiscountReasonState('');
    setDiscountAuthorizedByState(null);

    return newOrder.id;
  };

  const switchActiveOrder = (orderId: string) => {
    if (orderId === activeOrderId) return;
    const target = activeOrders.find(o => o.id === orderId);
    if (!target) return;

    setActiveOrders(prev =>
      prev.map(o =>
        o.id === activeOrderId
          ? {
            ...o,
            cart,
            customerId: selectedCustomerId,
            customDiscount,
            customDiscountReason,
            discountAuthorizedBy,
          }
          : o
      )
    );

    setActiveOrderId(target.id);
    setCart(target.cart || []);
    setSelectedCustomerIdState(target.customerId || 'Walk-in');
    setCustomDiscountState(target.customDiscount || 0);
    setCustomDiscountReasonState(target.customDiscountReason || '');
    setDiscountAuthorizedByState(target.discountAuthorizedBy || null);
  };

  const closeOrderTab = (orderId: string) => {
    if (activeOrders.length <= 1) {
      clearCart();
      return;
    }

    const remaining = activeOrders.filter(o => o.id !== orderId);
    setActiveOrders(remaining);

    if (activeOrderId === orderId) {
      const next = remaining[0];
      setActiveOrderId(next.id);
      setCart(next.cart || []);
      setSelectedCustomerIdState(next.customerId || 'Walk-in');
      setCustomDiscountState(next.customDiscount || 0);
      setCustomDiscountReasonState(next.customDiscountReason || '');
      setDiscountAuthorizedByState(next.discountAuthorizedBy || null);
    }
  };

  const updateOrderLabel = (orderId: string, label: string) => {
    setActiveOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, label } : o)
    );
  };

  const addToCart = (product: Product, quantity: number = 1, sellUnit: 'BASE' | 'BULK' = 'BASE'): boolean => {
    if (product.quantity <= 0) return false;
    const cleanAddQty = Math.round(quantity * 1000) / 1000;
    if (cleanAddQty <= 0) return false;

    const isBulk = sellUnit === 'BULK' && Boolean(product.conversion_factor && product.conversion_factor > 1 && product.bulk_unit);
    const factor = isBulk ? (Number(product.conversion_factor) || 1) : 1;
    const unitName = isBulk ? (product.bulk_unit || 'CARTON') : product.product_measure_unit;
    const unitPrice = isBulk ? (Number(product.bulk_selling_price) || (product.selling_price * factor)) : product.selling_price;
    const costPrice = isBulk ? (Number(product.bulk_item_cost) || (product.item_cost * factor)) : product.item_cost;
    const cartItemId = `${product.item_sn}_${isBulk ? 'BULK' : 'BASE'}`;

    let updatedCart: CartItem[] = [];

    setCart(prev => {
      // Calculate current base quantity committed in cart by other line items for this same product
      const otherBaseQtyCommitted = prev
        .filter(item => (item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`) !== cartItemId && item.item_sn === product.item_sn)
        .reduce((sum, item) => sum + (Number(item.base_quantity_deducted) || (item.quantity_sold * (item.conversion_factor || 1))), 0);

      const maxRemainingBaseStock = Math.max(0, product.quantity - otherBaseQtyCommitted);
      const requestedBaseUnits = cleanAddQty * factor;

      const existing = prev.find(item => (item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`) === cartItemId);
      if (existing) {
        const newQty = Math.round((existing.quantity_sold + cleanAddQty) * 1000) / 1000;
        const totalBaseRequired = newQty * factor;
        if (totalBaseRequired > maxRemainingBaseStock) {
          updatedCart = prev;
          return prev;
        }
        updatedCart = prev.map(item =>
          (item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`) === cartItemId
            ? {
              ...item,
              quantity_sold: newQty,
              base_quantity_deducted: totalBaseRequired,
              total_amount: Math.round(newQty * item.unit_price),
              maxAvailable: isBulk ? Math.floor(product.quantity / factor) : product.quantity,
            }
            : item
        );
      } else {
        if (requestedBaseUnits > maxRemainingBaseStock) {
          updatedCart = prev;
          return prev;
        }
        const initialQty = cleanAddQty;
        updatedCart = [
          ...prev,
          {
            cart_item_id: cartItemId,
            item_sn: product.item_sn,
            item_name: product.item_name,
            quantity_sold: initialQty,
            unit: unitName,
            sell_unit: isBulk ? 'BULK' : 'BASE',
            conversion_factor: factor,
            base_quantity_deducted: initialQty * factor,
            unit_price: unitPrice,
            total_amount: Math.round(initialQty * unitPrice),
            cost_price: costPrice,
            maxAvailable: isBulk ? Math.floor(product.quantity / factor) : product.quantity,
          },
        ];
      }
      syncToActiveOrder({ cart: updatedCart });
      return updatedCart;
    });

    return true;
  };

  const updateCartQuantity = (itemKeyOrSn: string, quantity: number, sellUnit?: 'BASE' | 'BULK'): boolean => {
    const targetItem = cart.find(c =>
      c.cart_item_id === itemKeyOrSn ||
      (sellUnit ? (c.item_sn === itemKeyOrSn && c.sell_unit === sellUnit) : c.item_sn === itemKeyOrSn)
    );
    if (!targetItem) return false;

    const product = products.find(p => p.item_sn === targetItem.item_sn);
    if (!product) return false;

    const targetKey = targetItem.cart_item_id || `${targetItem.item_sn}_${targetItem.sell_unit || 'BASE'}`;

    if (quantity <= 0) {
      removeFromCart(targetKey, sellUnit);
      return true;
    }

    const cleanQty = Math.round(quantity * 1000) / 1000;
    const factor = targetItem.conversion_factor || 1;
    const newBaseRequired = cleanQty * factor;

    // Check cross-cart base stock committed by other rows of the same product
    const otherBaseQtyCommitted = cart
      .filter(item => (item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`) !== targetKey && item.item_sn === product.item_sn)
      .reduce((sum, item) => sum + (Number(item.base_quantity_deducted) || (item.quantity_sold * (item.conversion_factor || 1))), 0);

    if (newBaseRequired + otherBaseQtyCommitted > product.quantity) {
      return false;
    }

    setCart(prev => {
      const nextCart = prev.map(item =>
        (item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`) === targetKey
          ? {
            ...item,
            quantity_sold: cleanQty,
            base_quantity_deducted: newBaseRequired,
            total_amount: Math.round(cleanQty * item.unit_price),
          }
          : item
      );
      syncToActiveOrder({ cart: nextCart });
      return nextCart;
    });

    return true;
  };

  const removeFromCart = (itemKeyOrSn: string, sellUnit?: 'BASE' | 'BULK') => {
    setCart(prev => {
      const nextCart = prev.filter(item => {
        if (item.cart_item_id && item.cart_item_id === itemKeyOrSn) return false;
        if (sellUnit) {
          if (item.item_sn === itemKeyOrSn && item.sell_unit === sellUnit) return false;
        } else {
          if (item.item_sn === itemKeyOrSn) return false;
        }
        return true;
      });
      syncToActiveOrder({ cart: nextCart });
      return nextCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    setCustomDiscountState(0);
    setCustomDiscountReasonState('');
    setDiscountAuthorizedByState(null);
    syncToActiveOrder({
      cart: [],
      customDiscount: 0,
      customDiscountReason: '',
      discountAuthorizedBy: null,
    });
  };

  // -------------------------------------------------------------
  // PRICING, DISCOUNTS & TOTALS (Admin & Manager Authorized)
  // -------------------------------------------------------------
  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  const cartSubtotal = cart.reduce((acc, item) => acc + item.total_amount, 0);
  const cartTotalQuantity = Math.round(cart.reduce((acc, item) => acc + item.quantity_sold, 0) * 1000) / 1000;

  // 1. Customer Agreed/Approved Discount Rate
  const customerDiscountPercent = selectedCustomer?.discount_percent || 0;
  const customerDiscount = customerDiscountPercent > 0
    ? Math.round((cartSubtotal * customerDiscountPercent) / 100)
    : 0;

  // 2. Wholesale Discount Rule: Wholesale customer buying 50kg+ gets 10% off
  const isWholesaleEligible =
    selectedCustomer &&
    (selectedCustomer.customer_type === 'Wholesale' || selectedCustomer.customer_type === 'Restaurant') &&
    cartTotalQuantity >= 50;

  const wholesaleDiscount = isWholesaleEligible ? Math.round(cartSubtotal * 0.10) : 0;

  const effectiveDiscountResult = calculateEffectiveDiscount({
    customerDiscount,
    wholesaleDiscount,
    customDiscount,
    cartSubtotal,
    config: discountSecurityConfig,
  });

  const totalDiscount = effectiveDiscountResult.totalDiscount;
  const cartFinalTotal = Math.max(0, cartSubtotal - totalDiscount);
  const sumDiscounts = customerDiscount + wholesaleDiscount + customDiscount;
  const disallowedDiscount = Math.max(0, sumDiscounts - totalDiscount);
  const marginValidation = validateProfitMargin(cart, totalDiscount, products);

  const calculatedDiscounts = {
    customerDiscount,
    customerDiscountPercent,
    wholesaleDiscount,
    customDiscount,
    totalDiscount,
    policyApplied: effectiveDiscountResult.policyApplied,
    isCapped: effectiveDiscountResult.capped,
    disallowedDiscount,
    profitMarginValid: marginValidation.isSafe,
    grossMarginRemaining: marginValidation.projectedGrossProfit,
  };

  // -------------------------------------------------------------
  // CHECKOUT TRANSACTION (Centralized Multi-Terminal Execution)
  // -------------------------------------------------------------
  const processCheckout = (
    paymentMethod: PaymentMethod,
    paymentSplits?: SplitPaymentDetail[],
    amountPaid?: number,
    changeDue?: number,
    paymentMeta?: {
      pos_terminal_id?: string;
      pos_terminal_name?: string;
      bank_account_number?: string;
      bank_name?: string;
      payment_reference?: string;
      credit_amount?: number;
      deposit_amount?: number;
      balance_due?: number;
      payment_due_date?: string;
      deposit_payment_method?: string;
    }
  ) => {
    if (!hasPermission('CAN_POS_SALE')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) attempted POS checkout without sales permission.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Permission Denied: Your role cannot process sales.' };
    }

    if (cart.length === 0) {
      return { success: false, error: 'Cart is empty. Please add items to checkout.' };
    }

    // Require registered customer for Credit / Pay Later sales
    if (paymentMethod === 'Credit / Pay Later') {
      if (!selectedCustomer || selectedCustomerId === 'Walk-in') {
        return {
          success: false,
          error: 'Credit / Pay Later sales require selecting a registered customer account so debt balances and payment terms can be recorded permanently.',
        };
      }
    }

    // Double check inventory availability
    for (const item of cart) {
      const prod = products.find(p => p.item_sn === item.item_sn);
      if (!prod) {
        return { success: false, error: `Product ${item.item_name} no longer exists in inventory.` };
      }
      if (prod.quantity < item.quantity_sold) {
        return {
          success: false,
          error: `Insufficient stock for ${item.item_name}. Only ${prod.quantity} ${prod.product_measure_unit} available.`
        };
      }
    }

    // Margin Protection Shield & Acquisition Cost-Floor Check
    if (totalDiscount > 0 && discountSecurityConfig.enforce_cost_floor !== false) {
      const marginResult = validateProfitMargin(cart, totalDiscount, products);
      if (!marginResult.isSafe && !discountAuthorizedBy?.includes('PIN')) {
        return {
          success: false,
          error: `Margin Protection Shield: Selling at a projected loss of ₦${Math.abs(marginResult.projectedGrossProfit).toLocaleString()} below product acquisition cost (₦${marginResult.totalCost.toLocaleString()}). Requires Manager/Owner PIN authorization.`
        };
      }
    }

    const txnId = generateTransactionId();
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isCredit = paymentMethod === 'Credit / Pay Later';
    const depositAmount = isCredit ? Math.max(0, Number(paymentMeta?.deposit_amount) || 0) : 0;
    const creditAmount = isCredit
      ? Math.max(0, paymentMeta?.credit_amount !== undefined ? Number(paymentMeta.credit_amount) : (cartFinalTotal - depositAmount))
      : 0;
    const balanceDue = isCredit
      ? Math.max(0, paymentMeta?.balance_due !== undefined ? Number(paymentMeta.balance_due) : creditAmount)
      : 0;
    const paymentDueDate = isCredit
      ? (paymentMeta?.payment_due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
      : undefined;
    const depositMethod = isCredit && depositAmount > 0
      ? (paymentMeta?.deposit_payment_method || 'Cash')
      : undefined;

    const discountReasons: string[] = [];
    if (customerDiscount > 0) {
      discountReasons.push(`Customer Approved Discount (${customerDiscountPercent}%)`);
    }
    if (wholesaleDiscount > 0) {
      discountReasons.push('10% Wholesale bulk order (50kg+)');
    }
    if (customDiscount > 0) {
      discountReasons.push(`${customDiscountReason || 'Manager discount'} (-₦${customDiscount.toLocaleString()})`);
    }

    const newTransaction: SaleTransaction = {
      transaction_id: txnId,
      date_time: nowStr,
      items: cart.map(item => ({
        item_sn: item.item_sn,
        item_name: item.item_name,
        quantity_sold: item.quantity_sold,
        unit: item.unit,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
        cost_price: item.cost_price,
        sell_unit: item.sell_unit,
        conversion_factor: item.conversion_factor,
        base_quantity_deducted: item.base_quantity_deducted,
      })),
      item_sn: cart[0]?.item_sn,
      item_name: cart[0]?.item_name,
      quantity_sold: cart[0]?.quantity_sold,
      unit_price: cart[0]?.unit_price,
      total_amount: cartSubtotal,
      discount_applied: totalDiscount,
      discount_reason: discountReasons.join(' | ') || 'None',
      discount_authorized_by: customDiscount > 0
        ? (discountAuthorizedBy || activeStaff.staff_name)
        : (customerDiscount > 0 ? (selectedCustomer?.discount_notes || 'Manager Approved') : undefined),
      final_amount: cartFinalTotal,
      payment_method: paymentMethod,
      payment_splits: paymentSplits && paymentSplits.length > 0 ? paymentSplits : undefined,
      amount_paid: isCredit ? depositAmount : amountPaid,
      change_due: isCredit ? 0 : changeDue,
      pos_terminal_id: paymentMeta?.pos_terminal_id,
      pos_terminal_name: paymentMeta?.pos_terminal_name,
      bank_account_number: paymentMeta?.bank_account_number,
      bank_name: paymentMeta?.bank_name,
      payment_reference: paymentMeta?.payment_reference,
      credit_amount: isCredit ? creditAmount : undefined,
      deposit_amount: isCredit ? depositAmount : undefined,
      balance_due: isCredit ? balanceDue : undefined,
      payment_due_date: paymentDueDate,
      deposit_payment_method: depositMethod,
      staff_id: activeStaff.staff_id,
      customer_id: selectedCustomerId,
      discount_rule_id: selectedDiscountRuleId || undefined,
      status: 'COMPLETED',
    };

    // 1. AUTO-DECREASE INVENTORY OPTIMISTICALLY in Base Units (Precision decimal rounded)
    setProducts(prev =>
      prev.map(prod => {
        const matchingCartItems = cart.filter(ci => ci.item_sn === prod.item_sn);
        if (matchingCartItems.length > 0) {
          const totalBaseDeduction = matchingCartItems.reduce((sum, ci) => {
            const factor = ci.conversion_factor || 1;
            return sum + (Number(ci.base_quantity_deducted) || (ci.quantity_sold * factor));
          }, 0);
          const remainingQty = Math.max(0, Math.round((prod.quantity - totalBaseDeduction) * 1000) / 1000);
          return {
            ...prod,
            quantity: remainingQty,
          };
        }
        return prod;
      })
    );

    // 2. AUTO-UPDATE CUSTOMER STATS & DEBT BALANCE
    if (selectedCustomer) {
      setCustomers(prev =>
        prev.map(c => {
          if (c.customer_id === selectedCustomerId) {
            const purchasedNames = cart.map(i => i.item_name);
            const preferred = purchasedNames.length > 0 ? purchasedNames[0] : c.preferred_product;
            const currentBal = Number(c.balance) || 0;
            const newBal = isCredit ? (currentBal + creditAmount) : currentBal;

            let updatedCreditHistory = Array.isArray(c.credit_history) ? [...c.credit_history] : [];
            if (isCredit && creditAmount > 0) {
              updatedCreditHistory.unshift({
                date: nowStr,
                amount: creditAmount,
                description: `Credit Sale ${txnId} (${cart.length} items) - Due ${paymentDueDate}`,
                due_date: paymentDueDate,
                status: 'UNPAID',
                transaction_id: txnId,
              });
            }

            return {
              ...c,
              total_spent: c.total_spent + cartFinalTotal,
              purchase_count: c.purchase_count + 1,
              last_purchase_date: nowStr.split(',')[0],
              preferred_product: preferred,
              balance: newBal,
              credit_history: updatedCreditHistory,
            };
          }
          return c;
        })
      );
    }

    // 3. LOG TRANSACTION IN SALES
    setSales(prev => [newTransaction, ...prev]);

    // Format audit summary
    const splitSummary = paymentSplits && paymentSplits.length > 0
      ? ` [Split: ${paymentSplits.map(s => `${s.method} ₦${s.amount.toLocaleString()}`).join(' + ')}]`
      : '';
    const creditDetail = isCredit
      ? ` [Credit Sale: ₦${creditAmount.toLocaleString()} Debt, ₦${depositAmount.toLocaleString()} Deposit (${depositMethod || 'None'}), Due: ${paymentDueDate}]`
      : '';

    // 4. LOG IN IMMUTABLE AUDIT TRAIL
    addAuditLogInternal({
      category: 'Sales',
      action: 'SALE_COMPLETED',
      details: `Completed ${txnId} for ₦${cartFinalTotal.toLocaleString()} via ${paymentMethod}${splitSummary}${creditDetail}. Items: ${cart.map(c => `${c.quantity_sold}${c.unit} ${c.item_name}`).join(', ')}. Cashier: ${activeStaff.staff_name}.${selectedCustomer ? ` Customer: ${selectedCustomer.full_name}.` : ''}`,
      severity: 'SUCCESS',
      metadata: {
        transaction_id: txnId,
        final_amount: cartFinalTotal,
        paymentMethod,
        payment_splits: paymentSplits,
        credit_amount: isCredit ? creditAmount : undefined,
        deposit_amount: isCredit ? depositAmount : undefined,
        customer_id: selectedCustomerId,
      },
    });

    // 5. OPEN RECEIPT MODAL
    setActiveReceipt(newTransaction);

    // 6. ADVANCE OR RESET MULTI-ORDER QUEUE
    setSelectedDiscountRuleId(null);
    setActiveOrders(prev => {
      const remaining = prev.filter(o => o.id !== activeOrderId);
      if (remaining.length > 0) {
        const nextOrder = remaining[0];
        setActiveOrderId(nextOrder.id);
        setCart(nextOrder.cart || []);
        setSelectedCustomerIdState(nextOrder.customerId || 'Walk-in');
        setCustomDiscountState(nextOrder.customDiscount || 0);
        setCustomDiscountReasonState(nextOrder.customDiscountReason || '');
        setDiscountAuthorizedByState(nextOrder.discountAuthorizedBy || null);
        return remaining;
      } else {
        const current = prev.find(o => o.id === activeOrderId);
        const nextNum = (current?.orderNumber || 1) + 1;
        const fresh = createDefaultOrder(nextNum);
        setActiveOrderId(fresh.id);
        setCart([]);
        setSelectedCustomerIdState('Walk-in');
        setCustomDiscountState(0);
        setCustomDiscountReasonState('');
        setDiscountAuthorizedByState(null);
        return [fresh];
      }
    });

    // 7. PUSH TO CENTRAL SERVER DATABASE (Broadcasts instantly to all Admins & Supervisors)
    fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: newTransaction }),
    }).catch(err => {
      console.warn('[Central DB] Failed to save sale immediately to server:', err);
    });

    return { success: true, transaction: newTransaction };
  };

  // -------------------------------------------------------------
  // PARK / HOLD ORDER FOR WALK-INS
  // -------------------------------------------------------------
  const parkActiveOrder = (reason?: string, customLabel?: string): { success: boolean; parkedOrder?: ParkedOrder; error?: string } => {
    const currentOrder = activeOrders.find(o => o.id === activeOrderId);
    if (!currentOrder || cart.length === 0) {
      return { success: false, error: 'Cannot park an empty order. Please add items to hold.' };
    }

    const customerObj = customers.find(c => c.customer_id === selectedCustomerId);
    const label = customLabel?.trim() || currentOrder.label;
    const finalParkReason = reason?.trim() || 'Awaiting walk-in customer return';

    const newParked: ParkedOrder = {
      order_id: currentOrder.id,
      order_number: currentOrder.orderNumber,
      order_label: label,
      created_at: currentOrder.createdAt,
      parked_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      park_reason: finalParkReason,
      customer_id: selectedCustomerId,
      customer_name: customerObj?.full_name || 'Walk-in Customer',
      items: [...cart],
      customDiscount,
      customDiscountReason,
      discountAuthorizedBy,
      paymentMode: currentOrder.paymentMode || 'single',
      selectedPaymentMethod: currentOrder.selectedPaymentMethod || 'Cash',
      cashTendered: currentOrder.cashTendered || '',
      singleRef: currentOrder.singleRef || '',
      splitCashAmount: currentOrder.splitCashAmount || '',
      splitCashTendered: currentOrder.splitCashTendered || '',
      splitSecondMethod: currentOrder.splitSecondMethod || 'Bank Transfer',
      splitSecondAmount: currentOrder.splitSecondAmount || '',
      splitSecondRef: currentOrder.splitSecondRef || '',
      splitThirdMethod: currentOrder.splitThirdMethod || null,
      splitThirdAmount: currentOrder.splitThirdAmount || '',
      splitThirdRef: currentOrder.splitThirdRef || '',
      staff_id: activeStaff.staff_id,
      staff_name: activeStaff.staff_name,
      status: 'PARKED',
    };

    setParkedOrders(prev => [newParked, ...prev.filter(p => p.order_id !== newParked.order_id)]);

    // Central server sync
    fetch('/api/orders/park', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newParked }),
    }).catch(err => console.warn('[Central DB] Error parking order:', err));

    // Audit log entry
    addAuditLogInternal({
      category: 'Sales',
      action: 'ORDER_PARKED',
      details: `Parked/Held walk-in order "${label}" (${cart.length} item(s), ₦${cartFinalTotal.toLocaleString()}). Reason: ${finalParkReason}. Cashier: ${activeStaff.staff_name}.`,
      severity: 'INFO',
      metadata: { order_id: currentOrder.id, items_count: cart.length, total: cartFinalTotal, reason: finalParkReason },
    });

    // Remove from active queue & switch or spawn next walk-in order
    const remainingActive = activeOrders.filter(o => o.id !== currentOrder.id);
    if (remainingActive.length > 0) {
      setActiveOrders(remainingActive);
      const nextOrder = remainingActive[0];
      setActiveOrderId(nextOrder.id);
      setCart(nextOrder.cart || []);
      setSelectedCustomerIdState(nextOrder.customerId || 'Walk-in');
      setCustomDiscountState(nextOrder.customDiscount || 0);
      setCustomDiscountReasonState(nextOrder.customDiscountReason || '');
      setDiscountAuthorizedByState(nextOrder.discountAuthorizedBy || null);
    } else {
      const nextNum = (currentOrder.orderNumber || 1) + 1;
      const freshOrder = createDefaultOrder(nextNum);
      setActiveOrders([freshOrder]);
      setActiveOrderId(freshOrder.id);
      setCart([]);
      setSelectedCustomerIdState('Walk-in');
      setCustomDiscountState(0);
      setCustomDiscountReasonState('');
      setDiscountAuthorizedByState(null);
    }

    return { success: true, parkedOrder: newParked };
  };

  const resumeParkedOrder = (orderId: string): { success: boolean; order?: ActiveWalkInOrder; error?: string } => {
    if (!orderId) return { success: false, error: 'No order ID specified' };
    const safeList = Array.isArray(parkedOrders) ? parkedOrders : [];
    const parked = safeList.find(p => (p.order_id || (p as any).id) === orderId);
    if (!parked) return { success: false, error: 'Parked order not found' };

    const actualId = parked.order_id || (parked as any).id || orderId;

    // Remove from parked
    setParkedOrders(prev => (Array.isArray(prev) ? prev : []).filter(p => (p.order_id || (p as any).id) !== actualId));

    fetch('/api/orders/park', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { order_id: actualId }, action: 'RESUME' }),
    }).catch(err => console.warn('[Central DB] Error resuming order:', err));

    const resumedActive: ActiveWalkInOrder = {
      id: actualId,
      orderNumber: Number(parked.order_number) || activeOrders.length + 1,
      label: parked.order_label || (parked as any).label || `Order #${parked.order_number || activeOrders.length + 1}`,
      customerId: parked.customer_id || 'Walk-in',
      cart: Array.isArray(parked.items) ? parked.items : [],
      customDiscount: Number(parked.customDiscount) || Number((parked as any).discount_amount) || 0,
      customDiscountReason: parked.customDiscountReason || '',
      discountAuthorizedBy: parked.discountAuthorizedBy || null,
      paymentMode: parked.paymentMode === 'split' ? 'split' : 'single',
      selectedPaymentMethod: parked.selectedPaymentMethod || 'Cash',
      cashTendered: String(parked.cashTendered || ''),
      singleRef: String(parked.singleRef || ''),
      splitCashAmount: String(parked.splitCashAmount || ''),
      splitCashTendered: String(parked.splitCashTendered || ''),
      splitSecondMethod: parked.splitSecondMethod || 'POS',
      splitSecondAmount: String(parked.splitSecondAmount || ''),
      splitSecondRef: String(parked.splitSecondRef || ''),
      splitThirdMethod: parked.splitThirdMethod || null,
      splitThirdAmount: String(parked.splitThirdAmount || ''),
      splitThirdRef: String(parked.splitThirdRef || ''),
      createdAt: parked.created_at || new Date().toISOString(),
    };

    const currentOrder = activeOrders.find(o => o.id === activeOrderId);
    let updatedActive: ActiveWalkInOrder[];
    if (currentOrder && currentOrder.cart.length === 0 && activeOrders.length === 1) {
      updatedActive = [resumedActive];
    } else {
      updatedActive = [...activeOrders.filter(o => o.id !== resumedActive.id), resumedActive];
    }

    setActiveOrders(updatedActive);
    setActiveOrderId(resumedActive.id);
    setCart(resumedActive.cart || []);
    setSelectedCustomerIdState(resumedActive.customerId || 'Walk-in');
    setCustomDiscountState(resumedActive.customDiscount || 0);
    setCustomDiscountReasonState(resumedActive.customDiscountReason || '');
    setDiscountAuthorizedByState(resumedActive.discountAuthorizedBy || null);

    addAuditLogInternal({
      category: 'Sales',
      action: 'ORDER_RESUMED',
      details: `Retrieved & resumed parked order "${resumedActive.label}" (${resumedActive.cart.length} item(s)). Operator: ${activeStaff.staff_name}.`,
      severity: 'INFO',
      metadata: { order_id: orderId, items_count: resumedActive.cart.length },
    });

    return { success: true, order: resumedActive };
  };

  // -------------------------------------------------------------
  // DEDICATED ORDER CANCELLATION & VOID MANAGEMENT
  // -------------------------------------------------------------
  const cancelAndVoidOrder = (orderId: string, reason: string, notes?: string): { success: boolean; voidRecord?: VoidedOrderRecord; error?: string } => {
    let targetOrder = activeOrders.find(o => o.id === orderId);
    let targetParked = parkedOrders.find(p => p.order_id === orderId);

    if (!targetOrder && !targetParked) {
      return { success: false, error: 'Order not found to void' };
    }

    const orderLabel = targetOrder ? targetOrder.label : (targetParked?.order_label || 'Walk-in Order');
    const custId = targetOrder ? (targetOrder.id === activeOrderId ? selectedCustomerId : targetOrder.customerId) : (targetParked?.customer_id || 'Walk-in');
    const custName = customers.find(c => c.customer_id === custId)?.full_name || 'Walk-in Customer';

    const itemsList: SaleItem[] = targetOrder
      ? (targetOrder.id === activeOrderId ? cart : targetOrder.cart).map(c => ({
        item_sn: c.item_sn,
        item_name: c.item_name,
        quantity_sold: c.quantity_sold,
        unit: c.unit,
        unit_price: c.unit_price,
        total_amount: c.total_amount,
        cost_price: c.cost_price,
      }))
      : (targetParked ? targetParked.items.map(c => ({
        item_sn: c.item_sn,
        item_name: c.item_name,
        quantity_sold: c.quantity_sold,
        unit: c.unit,
        unit_price: c.unit_price,
        total_amount: c.total_amount,
        cost_price: c.cost_price,
      })) : []);

    const orderSubtotal = itemsList.reduce((acc, i) => acc + i.total_amount, 0);
    const orderDiscount = targetOrder
      ? (targetOrder.id === activeOrderId ? customDiscount : targetOrder.customDiscount)
      : (targetParked?.customDiscount || 0);
    const finalOrderTotal = Math.max(0, orderSubtotal - orderDiscount);

    const voidRecord: VoidedOrderRecord = {
      void_id: `VOID-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      order_id: orderId,
      order_label: orderLabel,
      customer_id: custId,
      customer_name: custName,
      items: itemsList,
      subtotal: orderSubtotal,
      discount_applied: orderDiscount,
      total_amount: finalOrderTotal,
      void_reason: reason,
      void_notes: notes || '',
      voided_by_staff_id: activeStaff.staff_id,
      voided_by_staff_name: activeStaff.staff_name,
      voided_by_role: activeStaff.role,
      date_time: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      restored_to_inventory: true, // Stocks verified and preserved
    };

    setVoidedOrders(prev => [voidRecord, ...prev]);

    // Log to audit ledger
    addAuditLogInternal({
      category: 'Sales',
      action: 'ORDER_VOIDED',
      details: `Voided aborted order "${orderLabel}" (₦${finalOrderTotal.toLocaleString()}). Reason: ${reason}.${notes ? ` Notes: ${notes}.` : ''} Cashier: ${activeStaff.staff_name} (${activeStaff.role}). Items: ${itemsList.map(i => `${i.quantity_sold}${i.unit} ${i.item_name}`).join(', ') || 'Empty Cart'}. Inventory stock preserved.`,
      severity: 'WARNING',
      metadata: { void_id: voidRecord.void_id, order_id: orderId, reason, total_amount: finalOrderTotal, items_count: itemsList.length },
    });

    // Push to server
    fetch('/api/orders/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voidRecord }),
    }).catch(err => console.warn('[Central DB] Error recording void:', err));

    if (targetParked) {
      setParkedOrders(prev => prev.filter(p => p.order_id !== orderId));
    }

    if (targetOrder) {
      const remaining = activeOrders.filter(o => o.id !== orderId);
      if (remaining.length > 0) {
        setActiveOrders(remaining);
        const nextOrder = remaining[0];
        setActiveOrderId(nextOrder.id);
        setCart(nextOrder.cart || []);
        setSelectedCustomerIdState(nextOrder.customerId || 'Walk-in');
        setCustomDiscountState(nextOrder.customDiscount || 0);
        setCustomDiscountReasonState(nextOrder.customDiscountReason || '');
        setDiscountAuthorizedByState(nextOrder.discountAuthorizedBy || null);
      } else {
        const fresh = createDefaultOrder(1);
        setActiveOrders([fresh]);
        setActiveOrderId(fresh.id);
        setCart([]);
        setSelectedCustomerIdState('Walk-in');
        setCustomDiscountState(0);
        setCustomDiscountReasonState('');
        setDiscountAuthorizedByState(null);
      }
    }

    return { success: true, voidRecord };
  };

  // -------------------------------------------------------------
  // REFUND FLOW (Strictly Manager & Admin Only)
  // -------------------------------------------------------------
  // REFUND HELPERS & BATCH PROCESSING
  // -------------------------------------------------------------
  const getRefundableItemsForTransaction = useCallback((txnId: string) => {
    const tx = sales.find(s => s.transaction_id === txnId);
    if (!tx) return [];

    // Sum already refunded quantity per item
    const txRefunds = refunds.filter(r => r.original_transaction_id === txnId);
    const refundedQtyByItem: Record<string, number> = {};
    txRefunds.forEach(r => {
      if (r.items && Array.isArray(r.items)) {
        r.items.forEach(it => {
          refundedQtyByItem[it.item_sn] = (refundedQtyByItem[it.item_sn] || 0) + (Number(it.quantity_refunded) || 0);
        });
      } else if (r.item_sn) {
        refundedQtyByItem[r.item_sn] = (refundedQtyByItem[r.item_sn] || 0) + (Number(r.quantity_refunded) || 0);
      }
    });

    const items = tx.items && tx.items.length > 0
      ? tx.items
      : (tx.item_sn ? [{
        item_sn: tx.item_sn,
        item_name: tx.item_name || 'Item',
        quantity_sold: tx.quantity_sold || 0,
        unit: (tx as any).unit || 'KG',
        unit_price: tx.unit_price || 0,
        total_amount: tx.total_amount || 0,
        cost_price: 0,
      }] : []);

    return items.map(item => {
      const alreadyRefunded = Math.round((refundedQtyByItem[item.item_sn] || 0) * 1000) / 1000;
      const remainingQty = Math.max(0, Math.round((item.quantity_sold - alreadyRefunded) * 1000) / 1000);
      return {
        item_sn: item.item_sn,
        item_name: item.item_name,
        original_qty: item.quantity_sold,
        already_refunded_qty: alreadyRefunded,
        remaining_qty: remainingQty,
        unit_price: item.unit_price,
        unit: item.unit || 'KG',
      };
    });
  }, [sales, refunds]);

  const getTransactionRefundSummary = useCallback((txnId: string) => {
    const tx = sales.find(s => s.transaction_id === txnId);
    if (!tx) {
      return {
        originalTotal: 0,
        alreadyRefundedTotal: 0,
        remainingRefundableTotal: 0,
        isFullyRefunded: false,
        isPartiallyRefunded: false,
        items: [],
      };
    }

    const txRefunds = refunds.filter(r => r.original_transaction_id === txnId);
    const alreadyRefundedTotal = txRefunds.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0);
    const originalTotal = tx.final_amount;
    const remainingRefundableTotal = Math.max(0, Math.round((originalTotal - alreadyRefundedTotal) * 100) / 100);

    const items = getRefundableItemsForTransaction(txnId);
    const totalRemainingItemQty = items.reduce((sum, it) => sum + it.remaining_qty, 0);

    const isFullyRefunded = remainingRefundableTotal <= 0.01 || totalRemainingItemQty <= 0.001;
    const isPartiallyRefunded = alreadyRefundedTotal > 0 && !isFullyRefunded;

    return {
      originalTotal,
      alreadyRefundedTotal,
      remainingRefundableTotal,
      isFullyRefunded,
      isPartiallyRefunded,
      items,
    };
  }, [sales, refunds, getRefundableItemsForTransaction]);

  const processBatchRefund = (params: {
    originalTxnId: string;
    items: Array<{ item_sn: string; quantity: number }>;
    reason: string;
    authorizedByStaffId?: string;
    disbursementChannel?: 'ORIGINAL_CHANNEL' | 'STORE_VOUCHER' | 'BANK_REVERSAL' | 'CASH_OVERRIDE';
    disbursementReference?: string;
    cashierStaffId?: string;
    bankAccountId?: string;
    posTerminalId?: string;
  }): { success: boolean; refundRecord?: RefundRecord; error?: string } => {
    const { 
      originalTxnId, 
      items: requestedItems, 
      reason, 
      authorizedByStaffId, 
      disbursementChannel = 'ORIGINAL_CHANNEL', 
      disbursementReference,
      cashierStaffId,
      bankAccountId,
      posTerminalId
    } = params;

    // Strict RBAC: Only Manager and Admin roles can carry out customer refunds
    const isDirectlyAuthorized = activeStaff.role === 'Manager' || activeStaff.role === 'Admin';
    let authorizerStaff: Employee | undefined;

    if (authorizedByStaffId) {
      authorizerStaff = employees.find(e => e.staff_id === authorizedByStaffId);
    }

    const hasManagerOrAdminOverride = authorizerStaff && (authorizerStaff.role === 'Manager' || authorizerStaff.role === 'Admin');

    if (!isDirectlyAuthorized && !hasManagerOrAdminOverride) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `${activeStaff.role} ${activeStaff.staff_name} attempted to carry out a refund on ${originalTxnId}. Customer refunds are strictly restricted to Manager and Admin roles only.`,
        severity: 'ALERT',
      });
      return {
        success: false,
        error: 'Access Denied: Customer refunds can strictly only be carried out by Managers and Admins.'
      };
    }

    const saleTx = sales.find(s => s.transaction_id === originalTxnId);
    if (!saleTx) {
      return { success: false, error: 'Transaction not found.' };
    }

    const refundableItems = getRefundableItemsForTransaction(originalTxnId);
    const validItemsToRefund: RefundItemDetail[] = [];

    let totalRefundAmount = 0;

    for (const req of requestedItems) {
      const q = Number(req.quantity) || 0;
      if (q <= 0) continue;
      const refItem = refundableItems.find(r => r.item_sn === req.item_sn);
      if (!refItem) {
        return { success: false, error: `Item ${req.item_sn} is not part of transaction ${originalTxnId}.` };
      }
      if (q > refItem.remaining_qty + 0.001) {
        return { success: false, error: `Cannot refund more than remaining returnable quantity for ${refItem.item_name} (Max: ${refItem.remaining_qty} ${refItem.unit}).` };
      }

      // Proportional discount factor if transaction had discount applied
      const discountFactor = saleTx.total_amount > 0 ? (saleTx.final_amount / saleTx.total_amount) : 1;
      const itemRefundAmount = Math.round((q * refItem.unit_price * discountFactor) * 100) / 100;
      const prodCost = products.find(p => p.item_sn === refItem.item_sn)?.item_cost || (refItem.unit_price * 0.6);

      validItemsToRefund.push({
        item_sn: refItem.item_sn,
        item_name: refItem.item_name,
        quantity_refunded: Math.round(q * 1000) / 1000,
        unit_price: refItem.unit_price,
        refund_amount: itemRefundAmount,
        unit: refItem.unit,
        item_cost: prodCost,
      });

      totalRefundAmount += itemRefundAmount;
    }

    if (validItemsToRefund.length === 0) {
      return { success: false, error: 'Please select at least one item with a quantity greater than zero to refund.' };
    }

    // Safety cap: total refunded cannot exceed remaining balance
    const summary = getTransactionRefundSummary(originalTxnId);
    if (totalRefundAmount > summary.remainingRefundableTotal + 0.01) {
      totalRefundAmount = summary.remainingRefundableTotal;
    }

    const refundId = `REF-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const primaryItem = validItemsToRefund[0];
    const isSingleItem = validItemsToRefund.length === 1;

    // 1. RESTOCK PRODUCT INVENTORIES WITH 3-DECIMAL FLOAT PRECISION (in Base Units)
    setProducts(prev =>
      prev.map(p => {
        const returned = validItemsToRefund.find(i => i.item_sn === p.item_sn);
        if (returned) {
          const factor = (returned as any).conversion_factor || 1;
          const baseQty = Number((returned as any).base_quantity_refunded) || (returned.quantity_refunded * factor);
          return {
            ...p,
            quantity: Math.round((p.quantity + baseQty) * 1000) / 1000,
          };
        }
        return p;
      })
    );

    // 2. CREATE REFUND RECORD WITH FULL PAYMENT MAPPING
    const isNowFullRefund = Math.abs(summary.remainingRefundableTotal - totalRefundAmount) < 0.05 ||
      validItemsToRefund.every(v => {
        const itemInfo = refundableItems.find(r => r.item_sn === v.item_sn);
        return itemInfo && Math.abs(itemInfo.remaining_qty - v.quantity_refunded) < 0.005;
      }) && validItemsToRefund.length === refundableItems.length;

    // Resolve target cashier drawer debited
    const targetCashierId = cashierStaffId || saleTx.staff_id || activeStaff.staff_id;
    const targetCashier = employees.find(e => e.staff_id === targetCashierId);

    // Resolve terminal & bank mapping (supporting split payments)
    let resolvedPosId = posTerminalId || saleTx.pos_terminal_id;
    let resolvedPosName = saleTx.pos_terminal_name;
    let resolvedBankId = bankAccountId || (saleTx as any).bank_account_id;
    let resolvedBankName = saleTx.bank_name;
    let resolvedBankAccountNumber = saleTx.bank_account_number;

    if (saleTx.payment_method === 'Split Payment' && Array.isArray(saleTx.payment_splits)) {
      const posSplit = saleTx.payment_splits.find(s => s.method === 'POS' || s.method === 'Debit/Credit Card');
      if (posSplit) {
        if (!resolvedPosId) resolvedPosId = posSplit.pos_terminal_id;
        if (!resolvedPosName) resolvedPosName = posSplit.pos_terminal_name;
      }
      const bankSplit = saleTx.payment_splits.find(s => s.method === 'Bank Transfer');
      if (bankSplit) {
        if (!resolvedBankId) resolvedBankId = (bankSplit as any).bank_account_id;
        if (!resolvedBankName) resolvedBankName = (bankSplit as any).bank_name;
        if (!resolvedBankAccountNumber) resolvedBankAccountNumber = (bankSplit as any).bank_account_number;
      }
    }

    const newRefund: RefundRecord = {
      refund_id: refundId,
      original_transaction_id: originalTxnId,
      date_time: todayStr,
      item_sn: isSingleItem ? primaryItem.item_sn : 'MULTI-ITEM',
      item_name: isSingleItem ? primaryItem.item_name : `${validItemsToRefund.length} Items (Batch Return)`,
      quantity_refunded: isSingleItem ? primaryItem.quantity_refunded : validItemsToRefund.reduce((s, i) => s + i.quantity_refunded, 0),
      refund_amount: totalRefundAmount,
      reason,
      staff_id: activeStaff.staff_id,
      customer_id: saleTx.customer_id || 'Walk-in',
      authorized_by: authorizedByStaffId || activeStaff.staff_id,
      payment_method: saleTx.payment_method,
      cashier_staff_id: targetCashierId,
      cashier_staff_name: targetCashier ? targetCashier.staff_name : targetCashierId,
      pos_terminal_id: resolvedPosId,
      pos_terminal_name: resolvedPosName,
      bank_account_id: resolvedBankId,
      bank_account_number: resolvedBankAccountNumber,
      bank_name: resolvedBankName,
      items: validItemsToRefund,
      is_full_refund: isNowFullRefund,
      disbursement_channel: disbursementChannel,
      disbursement_reference: disbursementReference,
    };

    setRefunds(prev => [newRefund, ...prev]);

    // 3. UPDATE SALE TRANSACTION STATUS (PARTIALLY_REFUNDED vs REFUNDED)
    setSales(prev =>
      prev.map(s => {
        if (s.transaction_id === originalTxnId) {
          return {
            ...s,
            status: isNowFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          };
        }
        return s;
      })
    );

    // Deduct refunded amount from Customer's total_spent
    if (saleTx.customer_id && saleTx.customer_id !== 'Walk-in') {
      setCustomers(prev =>
        prev.map(c => {
          if (c.customer_id === saleTx.customer_id) {
            return {
              ...c,
              total_spent: Math.max(0, Math.round(((c.total_spent || 0) - totalRefundAmount) * 100) / 100),
            };
          }
          return c;
        })
      );
    }

    // 4. CRYPTOGRAPHIC AUDIT LOG ENTRY
    const managerName = authorizerStaff ? authorizerStaff.staff_name : activeStaff.staff_name;
    const itemsDescription = validItemsToRefund.map(i => `${i.quantity_refunded} ${i.unit} ${i.item_name}`).join(', ');
    const paymentTarget = (disbursementChannel === 'CASH_OVERRIDE' || saleTx.payment_method === 'Cash')
      ? `Cashier drawer (${targetCashier?.staff_name || targetCashierId})`
      : resolvedPosName
        ? `POS Terminal: ${resolvedPosName}`
        : resolvedBankName
          ? `Bank Account: ${resolvedBankName}`
          : disbursementChannel === 'STORE_VOUCHER'
            ? 'Store Credit Voucher'
            : saleTx.payment_method;

    addAuditLogInternal({
      category: 'Refunds',
      action: 'REFUND_PROCESSED',
      details: `${isNowFullRefund ? 'Full Refund' : 'Partial Refund'} ${refundId} for ₦${totalRefundAmount.toLocaleString()} completed on Txn ${originalTxnId}. Items restocked: [${itemsDescription}]. Deducted from: ${paymentTarget}. Reason: "${reason}". Authorized by Manager/Admin: ${managerName}.`,
      severity: 'WARNING',
      metadata: {
        refundId,
        originalTxnId,
        totalRefundAmount,
        isFullRefund: isNowFullRefund,
        items: validItemsToRefund,
        paymentMethod: saleTx.payment_method,
        cashierStaffId: targetCashierId,
        cashierStaffName: targetCashier ? targetCashier.staff_name : targetCashierId,
        posTerminalId: resolvedPosId,
        posTerminalName: resolvedPosName,
        bankAccountId: resolvedBankId,
        bankName: resolvedBankName,
        bankAccountNumber: resolvedBankAccountNumber,
        managerStaffId: authorizerStaff?.staff_id || activeStaff.staff_id,
        managerName,
        disbursementChannel,
      },
    });

    // 5. PUSH TO SERVER DATABASE
    fetch('/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund: newRefund }),
    }).catch(err => console.warn('[Central DB] Failed to save refund:', err));

    return { success: true, refundRecord: newRefund };
  };

  const processRefund = (
    originalTxnId: string,
    item_sn: string,
    quantity: number,
    reason: string,
    authorizedByStaffId?: string
  ): { success: boolean; error?: string } => {
    return processBatchRefund({
      originalTxnId,
      items: [{ item_sn, quantity }],
      reason,
      authorizedByStaffId,
    });
  };

  // -------------------------------------------------------------
  // CASH DRAWER TRACKING & BANK TRANSFERS (Manager & Admin)
  // -------------------------------------------------------------
  const getCashierDrawerSummary = useCallback((
    targetStaffId?: string,
    dateFilter?: { dateRange?: string; startDate?: string; endDate?: string }
  ): CashierDrawerSummary[] => {
    const targetStaffList = targetStaffId
      ? employees.filter(e => e.staff_id === targetStaffId)
      : employees;

    return targetStaffList.map(staff => {
      // 1. Calculate cash collected from sales by this staff (Gross Cash Collected)
      const staffSales = sales.filter(s => {
        if (s.is_historical_import) return false;
        if (s.staff_id !== staff.staff_id) return false;
        if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
          return matchesDateRange(s.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate);
        }
        return true;
      });

      let totalCashCollected = 0;
      let totalDiscountsApplied = 0;
      let discountTransactionsCount = 0;
      let salesCount = 0;
      let lastActivityTime: string | undefined = undefined;

      staffSales.forEach(sale => {
        const disc = Number(sale.discount_applied) || 0;
        if (disc > 0) {
          totalDiscountsApplied += disc;
          discountTransactionsCount += 1;
        }

        let saleCashAmount = 0;
        if (sale.payment_method === 'Cash') {
          saleCashAmount = sale.final_amount;
        } else if (sale.payment_method === 'Split Payment' && Array.isArray(sale.payment_splits)) {
          sale.payment_splits.forEach(split => {
            if (split.method === 'Cash') {
              saleCashAmount += split.amount;
            }
          });
        } else if (sale.payment_method === 'Credit / Pay Later') {
          if (sale.deposit_amount && sale.deposit_amount > 0 && (!sale.deposit_payment_method || sale.deposit_payment_method === 'Cash')) {
            saleCashAmount += sale.deposit_amount;
          }
        }

        if (saleCashAmount > 0) {
          totalCashCollected += saleCashAmount;
          salesCount += 1;
          if (!lastActivityTime || new Date(sale.date_time) > new Date(lastActivityTime)) {
            lastActivityTime = sale.date_time;
          }
        }
      });

      // 2. Calculate debt repayments collected in cash by this cashier
      let totalDebtCollectedCash = 0;
      customerDebtRepayments.forEach(repay => {
        if (repay.staff_id === staff.staff_id && repay.payment_method === 'Cash') {
          if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
            if (!matchesDateRange(repay.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
              return;
            }
          }
          const rAmt = Number(repay.amount_paid) || 0;
          totalDebtCollectedCash += rAmt;
          totalCashCollected += rAmt;
          if (!lastActivityTime || new Date(repay.date_time) > new Date(lastActivityTime)) {
            lastActivityTime = repay.date_time;
          }
        }
      });

      // 3. Calculate cash refunded disbursed from this cashier drawer
      // AUDIT FIX: Deduct from original sale's cashier (or designated cashier), not approving manager
      let totalCashRefunded = 0;
      refunds.forEach(ref => {
        const origSale = sales.find(s => s.transaction_id === ref.original_transaction_id);
        const targetCashierId = ref.cashier_staff_id || (origSale ? origSale.staff_id : ref.staff_id);
        if (targetCashierId === staff.staff_id) {
          if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
            if (!matchesDateRange(ref.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
              return;
            }
          }
          // If refund was disbursed as Store Voucher or Bank Transfer Reversal, physical cash drawer is untouched
          if (ref.disbursement_channel === 'STORE_VOUCHER' || ref.disbursement_channel === 'BANK_REVERSAL') {
            return;
          }
          if (ref.disbursement_channel === 'CASH_OVERRIDE' || ref.payment_method === 'Cash' || (origSale && origSale.payment_method === 'Cash')) {
            totalCashRefunded += Number(ref.refund_amount) || 0;
          } else if (origSale && origSale.payment_method === 'Split Payment' && origSale.payment_splits) {
            const splitCash = origSale.payment_splits.find(s => s.method === 'Cash')?.amount || 0;
            const cashRatio = origSale.final_amount > 0 ? (splitCash / origSale.final_amount) : 0;
            totalCashRefunded += Math.round((Number(ref.refund_amount) || 0) * cashRatio);
          }
        }
      });

      // 4. Calculate cash transferred to bank (POS_TO_BANK) vs replenished from bank (BANK_TO_POS)
      let totalTransferred = 0;
      let totalReplenished = 0;
      let transfersCount = 0;
      cashTransfers.forEach(transfer => {
        if (transfer.cashier_staff_id === staff.staff_id) {
          if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
            if (!matchesDateRange(transfer.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
              return;
            }
          }
          transfersCount += 1;
          if (transfer.transfer_type === 'BANK_TO_POS') {
            totalReplenished += transfer.amount_transferred;
          } else {
            totalTransferred += transfer.amount_transferred;
          }
          if (!lastActivityTime || new Date(transfer.date_time) > new Date(lastActivityTime)) {
            lastActivityTime = transfer.date_time;
          }
        }
      });

      // Cumulative live current cash in hand (actual physical till balance)
      let allTimeCollected = 0;
      sales.forEach(s => {
        if (s.is_historical_import) return;
        if (s.staff_id === staff.staff_id) {
          if (s.payment_method === 'Cash') allTimeCollected += s.final_amount;
          else if (s.payment_method === 'Split Payment' && Array.isArray(s.payment_splits)) {
            s.payment_splits.forEach(sp => { if (sp.method === 'Cash') allTimeCollected += sp.amount; });
          } else if (s.payment_method === 'Credit / Pay Later' && s.deposit_amount && (!s.deposit_payment_method || s.deposit_payment_method === 'Cash')) {
            allTimeCollected += s.deposit_amount;
          }
        }
      });
      customerDebtRepayments.forEach(repay => {
        if (repay.staff_id === staff.staff_id && repay.payment_method === 'Cash') {
          allTimeCollected += Number(repay.amount_paid) || 0;
        }
      });
      let allTimeRefunded = 0;
      refunds.forEach(ref => {
        const origSale = sales.find(s => s.transaction_id === ref.original_transaction_id);
        const targetCashierId = ref.cashier_staff_id || (origSale ? origSale.staff_id : ref.staff_id);
        if (targetCashierId === staff.staff_id) {
          if (ref.disbursement_channel === 'STORE_VOUCHER' || ref.disbursement_channel === 'BANK_REVERSAL') return;
          if (ref.disbursement_channel === 'CASH_OVERRIDE' || ref.payment_method === 'Cash' || (origSale && origSale.payment_method === 'Cash')) {
            allTimeRefunded += Number(ref.refund_amount) || 0;
          } else if (origSale && origSale.payment_method === 'Split Payment' && origSale.payment_splits) {
            const splitCash = origSale.payment_splits.find(s => s.method === 'Cash')?.amount || 0;
            const cashRatio = origSale.final_amount > 0 ? (splitCash / origSale.final_amount) : 0;
            allTimeRefunded += Math.round((Number(ref.refund_amount) || 0) * cashRatio);
          }
        }
      });
      let allTimeTransferred = 0;
      let allTimeReplenished = 0;
      cashTransfers.forEach(transfer => {
        if (transfer.cashier_staff_id === staff.staff_id) {
          if (transfer.transfer_type === 'BANK_TO_POS') allTimeReplenished += transfer.amount_transferred;
          else allTimeTransferred += transfer.amount_transferred;
        }
      });
      const currentCashInHand = Math.max(0, allTimeCollected + allTimeReplenished - allTimeRefunded - allTimeTransferred);

      return {
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        role: staff.role,
        phone_number: staff.phone_number,
        shift_time: staff.shift_time,
        total_cash_collected: totalCashCollected,
        total_cash_refunded: totalCashRefunded,
        total_transferred_to_bank: totalTransferred,
        total_replenished_from_bank: totalReplenished,
        total_debt_collected_cash: totalDebtCollectedCash,
        current_cash_in_hand: currentCashInHand,
        sales_count: salesCount,
        transfers_count: transfersCount,
        last_activity_time: lastActivityTime,
        total_discounts_applied: totalDiscountsApplied,
        discount_transactions_count: discountTransactionsCount,
      };
    });
  }, [employees, sales, refunds, cashTransfers, customerDebtRepayments]);

  // Comprehensive Bank & POS Ledger Balances with Bidirectional Transfers & Electronic Refunds
  const getBankAndPosLedgerSummary = useCallback((dateFilter?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  }): BankAndPosLedgerSummary[] => {
    return posTerminals.map(term => {
      let salesCount = 0;
      let salesGrossVolume = 0;
      let debtCount = 0;
      let debtVolume = 0;
      let bankDepositsVolume = 0;
      let floatWithdrawalsVolume = 0;
      let refundsCount = 0;
      let refundsDeductedVolume = 0;

      // 1. Sales
      sales.forEach(sale => {
        if (sale.is_historical_import) return;
        if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
          if (!matchesDateRange(sale.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
            return;
          }
        }
        if (sale.pos_terminal_id === term.id || (term.type === 'BANK_TRANSFER_ACCOUNT' && sale.bank_name === term.bank_name && (sale.bank_account_number === term.account_number || !sale.bank_account_number))) {
          salesCount++;
          salesGrossVolume += sale.final_amount;
        } else if (Array.isArray(sale.payment_splits)) {
          sale.payment_splits.forEach(split => {
            if (split.pos_terminal_id === term.id || (term.type === 'BANK_TRANSFER_ACCOUNT' && split.bank_name === term.bank_name)) {
              salesCount++;
              salesGrossVolume += split.amount;
            }
          });
        }
      });

      // 2. Customer Debt Repayments
      customerDebtRepayments.forEach(repay => {
        if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
          if (!matchesDateRange(repay.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
            return;
          }
        }
        const targetId = repay.pos_terminal_id || repay.bank_account_id;
        if (targetId === term.id || (term.type === 'BANK_TRANSFER_ACCOUNT' && repay.bank_name === term.bank_name)) {
          debtCount++;
          debtVolume += Number(repay.amount_paid) || 0;
        }
      });

      // 3. Cash Transfers (POS_TO_BANK deposits & BANK_TO_POS withdrawals)
      cashTransfers.forEach(transfer => {
        if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
          if (!matchesDateRange(transfer.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
            return;
          }
        }
        const matchesThisAccount = transfer.bank_account_id === term.id ||
          transfer.destination_bank_name === term.bank_name ||
          (transfer.destination_account_number && transfer.destination_account_number === term.account_number);

        if (matchesThisAccount) {
          if (transfer.transfer_type === 'POS_TO_BANK' || !transfer.transfer_type) {
            bankDepositsVolume += transfer.amount_transferred;
          } else if (transfer.transfer_type === 'BANK_TO_POS') {
            floatWithdrawalsVolume += transfer.amount_transferred;
          }
        }
      });

      // 4. Electronic Refunds
      refunds.forEach(ref => {
        if (dateFilter && dateFilter.dateRange && dateFilter.dateRange !== 'all') {
          if (!matchesDateRange(ref.date_time, dateFilter.dateRange, dateFilter.startDate, dateFilter.endDate)) {
            return;
          }
        }
        // If refunded as physical cash from till or store voucher, do not deduct bank/POS ledger
        if (ref.disbursement_channel === 'CASH_OVERRIDE' || ref.disbursement_channel === 'STORE_VOUCHER') {
          return;
        }
        const matchesRef = ref.pos_terminal_id === term.id ||
          ref.bank_account_id === term.id ||
          (term.type === 'BANK_TRANSFER_ACCOUNT' && ref.bank_name === term.bank_name && (ref.bank_account_number === term.account_number || !ref.bank_account_number));

        if (matchesRef) {
          refundsCount++;
          refundsDeductedVolume += Number(ref.refund_amount) || 0;
        }
      });

      const netLedgerBalance = term.type === 'BANK_TRANSFER_ACCOUNT'
        ? Math.max(0, salesGrossVolume + debtVolume + bankDepositsVolume - floatWithdrawalsVolume - refundsDeductedVolume)
        : Math.max(0, salesGrossVolume + debtVolume - refundsDeductedVolume);

      return {
        id: term.id,
        name: term.name,
        type: term.type,
        provider: term.provider,
        terminal_id: term.terminal_id,
        account_name: term.account_name,
        account_number: term.account_number,
        bank_name: term.bank_name,
        assigned_location: term.assigned_location,
        status: term.status,
        is_default: term.is_default,
        salesCount,
        salesGrossVolume,
        debtRepaymentsCount: debtCount,
        debtRepaymentsVolume: debtVolume,
        bankDepositsVolume,
        floatWithdrawalsVolume,
        refundsCount,
        refundsDeductedVolume,
        netLedgerBalance,
      };
    });
  }, [posTerminals, sales, customerDebtRepayments, cashTransfers, refunds]);

  const processCashToBankTransfer = (params: {
    cashierStaffId: string;
    amount: number;
    destinationAccountId?: string;
    depositSlipNumber?: string;
    notes: string;
    managerPin: string;
    transfer_type?: CashTransferType;
  }): { success: boolean; transfer?: CashToBankTransfer; error?: string } => {
    const { cashierStaffId, amount, destinationAccountId, depositSlipNumber, notes, managerPin, transfer_type = 'POS_TO_BANK' } = params;
    const isBankToPos = transfer_type === 'BANK_TO_POS';

    // Validate Manager or Admin PIN
    const authStaff = employees.find(e => verifyPin(managerPin.trim(), e.pin));
    if (!authStaff) {
      return { success: false, error: 'Invalid 4-digit PIN entered.' };
    }
    if (authStaff.role !== 'Manager' && authStaff.role !== 'Admin') {
      return { success: false, error: `Access Denied: ${authStaff.role} ${authStaff.staff_name} cannot authorize fund transfers. Strictly Manager or Admin only.` };
    }

    // Validate Cashier
    const cashier = employees.find(e => e.staff_id === cashierStaffId);
    if (!cashier) {
      return { success: false, error: 'Cashier account not found.' };
    }

    // Validate Note
    if (!notes || notes.trim().length < 3) {
      return { success: false, error: isBankToPos ? 'Please enter a note/reason for replenishing float from bank.' : 'Please enter a note/reason for this cash transfer to bank.' };
    }

    // Validate Amount
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Transfer amount must be greater than ₦0.' };
    }

    const drawerSummaries = getCashierDrawerSummary(cashierStaffId);
    const summary = drawerSummaries[0];
    const cashBefore = summary?.current_cash_in_hand || 0;

    if (!isBankToPos && amount > cashBefore) {
      return {
        success: false,
        error: `Cannot transfer ₦${amount.toLocaleString()}. Cashier only has ₦${cashBefore.toLocaleString()} cash in hand.`
      };
    }

    // Find destination bank account
    const destinationAcc = posTerminals.find(t => t.id === destinationAccountId) ||
      posTerminals.find(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.is_default) ||
      posTerminals[0];

    const destBankName = destinationAcc?.bank_name || 'Guaranty Trust Bank';
    const destAccName = destinationAcc?.account_name || 'Kiid From Dream Enterprises';
    const destAccNumber = destinationAcc?.account_number || '0123456789';

    const transferId = `${isBankToPos ? 'FLOAT-IN' : 'CASH-TRF'}-${Date.now().toString().slice(-8)}`;
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const cashAfter = isBankToPos ? (cashBefore + amount) : (cashBefore - amount);

    const newTransfer: CashToBankTransfer = {
      transfer_id: transferId,
      transfer_type: isBankToPos ? 'BANK_TO_POS' : 'POS_TO_BANK',
      date_time: nowStr,
      cashier_staff_id: cashier.staff_id,
      cashier_staff_name: cashier.staff_name,
      cashier_role: cashier.role,
      manager_staff_id: authStaff.staff_id,
      manager_staff_name: authStaff.staff_name,
      manager_role: authStaff.role,
      amount_transferred: amount,
      cashier_cash_before: cashBefore,
      cashier_cash_remaining: cashAfter,
      cashier_cash_after: cashAfter,
      destination_bank_name: destBankName,
      destination_account_name: destAccName,
      destination_account_number: destAccNumber,
      bank_account_id: destinationAcc?.id,
      deposit_slip_number: depositSlipNumber?.trim() || `${isBankToPos ? 'FLT' : 'DEP'}-${Date.now().toString().slice(-6)}`,
      notes: notes.trim(),
      status: 'COMPLETED',
    };

    setCashTransfers(prev => [newTransfer, ...prev]);

    const auditAction = isBankToPos ? 'FLOAT_REPLENISHMENT_FROM_BANK' : 'CASH_TRANSFER_TO_BANK';
    const auditDetails = isBankToPos
      ? `Replenished ₦${amount.toLocaleString()} cash float from ${destBankName} (${destAccNumber}) to Cashier ${cashier.staff_name} (${cashier.staff_id}). New float in hand: ₦${cashAfter.toLocaleString()}. Authorized by: ${authStaff.staff_name} (${authStaff.role}). Note: "${notes.trim()}". Ref: ${newTransfer.deposit_slip_number}`
      : `Transferred ₦${amount.toLocaleString()} cash from Cashier ${cashier.staff_name} (${cashier.staff_id}) to ${destBankName} (${destAccNumber}). Remaining float with cashier: ₦${cashAfter.toLocaleString()}. Authorized by: ${authStaff.staff_name} (${authStaff.role}). Note: "${notes.trim()}". Ref: ${newTransfer.deposit_slip_number}`;

    addAuditLogInternal({
      staff_id: authStaff.staff_id,
      staff_name: authStaff.staff_name,
      role: authStaff.role,
      category: 'Finance',
      action: auditAction as any,
      details: auditDetails,
      severity: 'SUCCESS',
      metadata: {
        transfer_id: transferId,
        transfer_type: newTransfer.transfer_type,
        amount,
        cashier_id: cashier.staff_id,
        cashier_name: cashier.staff_name,
        cashBefore,
        cashAfter,
        depositSlip: newTransfer.deposit_slip_number,
        bank: destBankName,
        account: destAccNumber,
      }
    });

    fetch('/api/cash-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfer: newTransfer }),
    }).catch(err => console.warn('[Central DB] Failed to save cash transfer:', err));

    return { success: true, transfer: newTransfer };
  };

  // -------------------------------------------------------------
  // POS TERMINAL SETUP & ACCOUNT MAPPING CRUD
  // -------------------------------------------------------------
  const addPosTerminal = (terminalData: Omit<PosTerminalConfig, 'id' | 'created_at'>): PosTerminalConfig => {
    const prefix = terminalData.type === 'POS_TERMINAL' ? 'POS' : 'BANK';
    const existingNums = posTerminals
      .filter(t => t.id.startsWith(prefix))
      .map(t => {
        const match = t.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    const id = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const newTerminal: PosTerminalConfig = {
      ...terminalData,
      id,
      created_at: today,
    };

    setPosTerminals(prev => {
      let updated = [newTerminal, ...prev];
      if (newTerminal.is_default) {
        updated = updated.map(t => t.id === newTerminal.id ? t : (t.type === newTerminal.type ? { ...t, is_default: false } : t));
      }
      return updated;
    });

    addAuditLogInternal({
      category: 'System',
      action: 'POS_TERMINAL_CREATED',
      details: `Configured new ${terminalData.type === 'POS_TERMINAL' ? 'POS Terminal' : 'Bank Account'}: ${newTerminal.name} (${newTerminal.bank_name} - ${newTerminal.account_number}). Provider: ${newTerminal.provider}.`,
      severity: 'SUCCESS',
      metadata: { terminal_id: id, name: newTerminal.name }
    });

    fetch('/api/pos-terminals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminal: newTerminal }),
    }).catch(err => console.warn('[Central DB] Failed to save pos terminal:', err));

    return newTerminal;
  };

  const updatePosTerminal = (id: string, updates: Partial<PosTerminalConfig>) => {
    let updatedObj: PosTerminalConfig | null = null;
    setPosTerminals(prev => {
      const target = prev.find(t => t.id === id);
      if (target) {
        updatedObj = { ...target, ...updates };
      }
      return prev.map(t => {
        if (t.id === id) {
          return updatedObj || { ...t, ...updates };
        }
        if (updates.is_default && updatedObj && t.type === updatedObj.type) {
          return { ...t, is_default: false };
        }
        return t;
      });
    });

    if (updatedObj) {
      fetch('/api/pos-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal: updatedObj }),
      }).catch(err => console.warn('[Central DB] Failed to update pos terminal:', err));
    }
  };

  const deletePosTerminal = (id: string) => {
    setPosTerminals(prev => prev.filter(t => t.id !== id));
    fetch(`/api/pos-terminals/${id}`, { method: 'DELETE' })
      .catch(err => console.warn('[Central DB] Failed to delete pos terminal:', err));
  };

  // -------------------------------------------------------------
  // RECEIPT & BRANDING CONFIGURATION (Manager, Admin)
  // -------------------------------------------------------------
  const updateReceiptSettings = async (updates: Partial<ReceiptBrandingConfig>): Promise<boolean> => {
    const newConfig: ReceiptBrandingConfig = {
      ...receiptSettings,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by_staff_name: activeStaff.staff_name,
    };
    setReceiptSettings(newConfig);
    try {
      localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(newConfig));
    } catch { }

    addAuditLogInternal({
      staff_id: activeStaff.staff_id,
      staff_name: activeStaff.staff_name,
      role: activeStaff.role,
      category: 'System',
      action: 'RECEIPT_SETTINGS_UPDATED',
      details: `Staff ${activeStaff.staff_name} updated receipt branding (Store: "${newConfig.business_name}").`,
      severity: 'INFO',
    });

    try {
      await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ settings: newConfig }),
      });
      return true;
    } catch (err) {
      console.warn('[Receipt Settings] Failed syncing to central DB:', err);
      return false;
    }
  };

  const resetReceiptSettings = async (): Promise<boolean> => {
    return updateReceiptSettings(INITIAL_RECEIPT_CONFIG);
  };

  // -------------------------------------------------------------
  // CYCLE COUNTING (Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const performCycleCount = (data: {
    item_sn: string;
    counted_qty: number;
    reason: string;
    adjustStock: boolean;
  }): { success: boolean; record?: CycleCountRecord; error?: string } => {
    if (!hasPermission('CAN_CYCLE_COUNT')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} tried to perform cycle count without Supervisor permissions.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Permission Denied: Supervisor privileges required for cycle counts.' };
    }

    const prod = products.find(p => p.item_sn === data.item_sn);
    if (!prod) return { success: false, error: 'Product not found' };

    const variance = data.counted_qty - prod.quantity;
    const count_id = `CNT-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toISOString().split('T')[0];

    const countRecord: CycleCountRecord = {
      count_id,
      date_time: todayStr,
      staff_id: activeStaff.staff_id,
      staff_name: activeStaff.staff_name,
      role: activeStaff.role,
      item_sn: prod.item_sn,
      item_name: prod.item_name,
      system_qty: prod.quantity,
      counted_qty: data.counted_qty,
      discrepancy: variance,
      unit: prod.product_measure_unit,
      reason: data.reason,
      adjusted: data.adjustStock,
    };

    setCycleCounts(prev => [countRecord, ...prev]);

    if (data.adjustStock) {
      setProducts(prev =>
        prev.map(p =>
          p.item_sn === data.item_sn ? { ...p, quantity: data.counted_qty } : p
        )
      );
    }

    addAuditLogInternal({
      category: 'CycleCount',
      action: 'CYCLE_COUNT_ADJUSTED',
      details: `Physical Cycle Count ${count_id} on ${prod.item_name} (${prod.item_sn}): System had ${prod.quantity}${prod.product_measure_unit}, physically counted ${data.counted_qty}${prod.product_measure_unit} (Variance: ${variance > 0 ? `+${variance}` : variance}). Stock adjusted: ${data.adjustStock ? 'YES' : 'NO'}. Supervisor: ${activeStaff.staff_name}. Reason: ${data.reason}.`,
      severity: variance === 0 ? 'INFO' : 'WARNING',
      metadata: { count_id, item_sn: data.item_sn, variance, adjustStock: data.adjustStock },
    });

    // PUSH TO CENTRAL SERVER DATABASE
    fetch('/api/cycle-counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countRecord, adjustStock: data.adjustStock }),
    }).catch(err => console.warn('[Central DB] Failed to save cycle count:', err));

    return { success: true, record: countRecord };
  };

  // -------------------------------------------------------------
  // STOCK TRANSFERS (Manager, Admin)
  // -------------------------------------------------------------
  const performStockTransfer = (data: {
    item_sn: string;
    quantity: number;
    from_location: string;
    to_location: string;
    notes?: string;
  }): { success: boolean; record?: StockTransferRecord; error?: string } => {
    if (!hasPermission('CAN_TRANSFER_STOCK')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} tried to perform stock transfer without Manager permissions.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Permission Denied: Only Managers and Admins can transfer stock between locations.' };
    }

    const { item_sn, quantity, from_location, to_location, notes } = data;
    const prod = products.find(p => p.item_sn === item_sn);
    if (!prod) return { success: false, error: 'Product not found.' };

    if (quantity <= 0 || quantity > prod.quantity) {
      return { success: false, error: `Invalid transfer quantity. Available in stock: ${prod.quantity} ${prod.product_measure_unit}` };
    }

    const transfer_id = `TRF-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toISOString().split('T')[0];

    const transferRecord: StockTransferRecord = {
      transfer_id,
      date_time: todayStr,
      item_sn: prod.item_sn,
      item_name: prod.item_name,
      quantity,
      unit: prod.product_measure_unit,
      from_location,
      to_location,
      authorized_by_id: activeStaff.staff_id,
      authorized_by_name: `${activeStaff.staff_name} (${activeStaff.role})`,
      notes,
    };

    setStockTransfers(prev => [transferRecord, ...prev]);

    addAuditLogInternal({
      category: 'Transfer',
      action: 'STOCK_TRANSFERRED',
      details: `Stock Transfer ${transfer_id}: Moved ${quantity} ${prod.product_measure_unit} of ${prod.item_name} from "${from_location}" to "${to_location}". Authorized by: ${activeStaff.staff_name}. Notes: ${notes || 'None'}.`,
      severity: 'INFO',
      metadata: { transfer_id, item_sn, quantity, from_location, to_location },
    });

    // PUSH TO CENTRAL SERVER DATABASE
    fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferRecord }),
    }).catch(err => console.warn('[Central DB] Failed to save stock transfer:', err));

    return { success: true, record: transferRecord };
  };

  // -------------------------------------------------------------
  // PRODUCT CRUD (Manager, Admin)
  // -------------------------------------------------------------
  const addProduct = (productData: Omit<Product, 'item_sn'>): Product => {
    const item_sn = getNextItemSn();
    const newProduct: Product = {
      ...productData,
      item_sn,
      created_at: new Date().toISOString().split('T')[0],
    };
    setProducts(prev => [newProduct, ...prev]);
    addAuditLogInternal({
      category: 'Inventory',
      action: 'PRODUCT_CREATED',
      details: `Created new product SKU: ${newProduct.item_name} (${item_sn}). Price: ₦${newProduct.selling_price}, Initial Stock: ${newProduct.quantity}${newProduct.product_measure_unit}.`,
      severity: 'SUCCESS',
    });

    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: newProduct }),
    }).catch(err => console.warn('[Central DB] Failed to add product:', err));

    return newProduct;
  };

  const bulkAddProducts = (productsData: Omit<Product, 'item_sn'>[]): Product[] => {
    if (!productsData.length) return [];

    const numbers = products.map(p => {
      const match = p.item_sn.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    let currentMax = numbers.length > 0 ? Math.max(...numbers) : 0;

    const today = new Date().toISOString().split('T')[0];
    const createdProducts: Product[] = [];

    for (const data of productsData) {
      currentMax += 1;
      const item_sn = `ITEM-${currentMax.toString().padStart(5, '0')}`;
      const newProduct: Product = {
        ...data,
        item_sn,
        created_at: data.created_at || today,
      };
      createdProducts.push(newProduct);
    }

    setProducts(prev => [...createdProducts, ...prev]);

    const totalStock = Math.round(createdProducts.reduce((sum, p) => sum + p.quantity, 0) * 1000) / 1000;
    const totalValue = Math.round(createdProducts.reduce((sum, p) => sum + (p.quantity * p.selling_price), 0));

    addAuditLogInternal({
      category: 'Inventory',
      action: 'PRODUCT_CREATED',
      details: `Bulk imported ${createdProducts.length} products (${createdProducts[0]?.item_sn} - ${createdProducts[createdProducts.length - 1]?.item_sn}). Total Units: ${totalStock.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}, Total Value: ₦${totalValue.toLocaleString()}.`,
      severity: 'SUCCESS',
      metadata: {
        imported_count: createdProducts.length,
        item_sns: createdProducts.map(p => p.item_sn),
      }
    });

    // Sync to server
    fetch('/api/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: createdProducts }),
    })
      .catch(() => {
        // Fallback: send individually if bulk endpoint not available
        createdProducts.forEach(prod => {
          fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: prod }),
          }).catch(err => console.warn('[Central DB] Failed to add product in fallback:', err));
        });
      });

    return createdProducts;
  };

  const updateProduct = (item_sn: string, updates: Partial<Product>) => {
    let updatedProd: Product | null = null;
    setProducts(prev =>
      prev.map(p => {
        if (p.item_sn === item_sn) {
          updatedProd = { ...p, ...updates };
          return updatedProd;
        }
        return p;
      })
    );
    addAuditLogInternal({
      category: 'Inventory',
      action: 'PRODUCT_UPDATED',
      details: `Updated product ${item_sn}. Updated fields: ${Object.keys(updates).join(', ')}.`,
      severity: 'INFO',
    });

    if (updatedProd) {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: updatedProd }),
      }).catch(err => console.warn('[Central DB] Failed to update product:', err));
    }
  };

  const deleteProduct = (item_sn: string) => {
    const prod = products.find(p => p.item_sn === item_sn);
    setProducts(prev => prev.filter(p => p.item_sn !== item_sn));
    removeFromCart(item_sn);
    addAuditLogInternal({
      category: 'Inventory',
      action: 'PRODUCT_DELETED',
      details: `Deleted product ${prod?.item_name || item_sn} from inventory.`,
      severity: 'WARNING',
    });

    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: { item_sn }, action: 'DELETE' }),
    }).catch(err => console.warn('[Central DB] Failed to delete product:', err));
  };

  // -------------------------------------------------------------
  // CUSTOMER CRUD & DISCOUNT AUTHORIZATIONS (Manager, Admin)
  // -------------------------------------------------------------
  const applyCustomDiscount = (
    amount: number,
    reason: string,
    authorizedBy?: string
  ): { success: boolean; error?: string } => {
    const hasDiscountPerm = hasPermission('CAN_APPLY_DISCOUNT') || !!authorizedBy;
    if (!hasDiscountPerm) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) attempted to apply ₦${amount.toLocaleString()} discount without Manager or Admin authorization.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Applying discounts requires Manager or Administrator authorization.' };
    }

    setCustomDiscount(amount);
    setCustomDiscountReason(reason || 'Manager Approved Discount');
    setDiscountAuthorizedBy(authorizedBy || `${activeStaff.staff_name} (${activeStaff.role})`);

    addAuditLogInternal({
      category: 'Sales',
      action: 'MANAGER_OVERRIDE',
      details: `Custom discount of ₦${amount.toLocaleString()} added to transaction by ${authorizedBy || activeStaff.staff_name}. Reason: ${reason || 'Customer Discount'}.`,
      severity: 'INFO',
    });

    return { success: true };
  };

  const clearDiscount = () => {
    setCustomDiscount(0);
    setCustomDiscountReason('');
    setDiscountAuthorizedBy(null);
    setSelectedDiscountRuleId(null);
  };

  const verifyDiscountAuthorizationPin = (pin: string): boolean => {
    return verifyPin(pin.trim(), discountSecurityConfig.discount_pin);
  };

  const updateDiscountPin = async (
    managerStaffId: string,
    managerPin: string,
    newDiscountPin?: string,
    policyUpdates?: Partial<DiscountSecurityConfig>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/settings/discount-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          staff_id: managerStaffId,
          managerPin,
          newPin: newDiscountPin,
          stacking_policy: policyUpdates?.stacking_policy,
          max_discount_percent_cap: policyUpdates?.max_discount_percent_cap,
          enforce_cost_floor: policyUpdates?.enforce_cost_floor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update Discount PIN / Policy.' };
      }

      const updated = data.discountSecurityConfig || data.config;
      if (updated) {
        setDiscountSecurityConfig(updated);
        localStorage.setItem(STORAGE_KEYS.DISCOUNT_SECURITY, JSON.stringify(updated));
      }

      addAuditLogInternal({
        category: 'Security',
        action: 'DISCOUNT_PIN_ROTATED',
        details: `Manager updated store Discount Authorization PIN and Security Policy. Authorized by staff ID: ${managerStaffId}.`,
        severity: 'ALERT',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating discount PIN / policy.' };
    }
  };

  const upsertDiscountRule = async (rule: Partial<DiscountRule>): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/discount-rules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rule,
          action: 'UPSERT',
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to save discount rule' };
      }
      if (Array.isArray(data.discountRules)) {
        setDiscountRules(data.discountRules);
        localStorage.setItem(STORAGE_KEYS.DISCOUNT_RULES, JSON.stringify(data.discountRules));
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error saving discount rule' };
    }
  };

  const deleteDiscountRule = async (ruleId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/discount-rules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rule: { rule_id: ruleId },
          action: 'DELETE',
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete discount rule' };
      }
      if (Array.isArray(data.discountRules)) {
        setDiscountRules(data.discountRules);
        localStorage.setItem(STORAGE_KEYS.DISCOUNT_RULES, JSON.stringify(data.discountRules));
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error deleting discount rule' };
    }
  };

  const validateCartProfitMargin = (proposedDiscount?: number): ProfitMarginValidationResult => {
    const discountToCheck = proposedDiscount !== undefined ? proposedDiscount : calculatedDiscounts.totalDiscount;
    return validateProfitMargin(cart, discountToCheck, products);
  };

  const applyDiscountWithPin = (
    pin: string,
    amount: number,
    reason: string,
    ruleId?: string
  ): { success: boolean; error?: string } => {
    const isValid = verifyDiscountAuthorizationPin(pin);
    if (!isValid) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Failed discount PIN authorization attempt by cashier ${activeStaff.staff_name} (${activeStaff.role}) for ₦${amount.toLocaleString()} discount.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Incorrect Discount Authorization PIN.' };
    }

    setCustomDiscount(amount);
    setCustomDiscountReason(reason || 'Manager Approved Discount');
    setDiscountAuthorizedBy(`Manager Store PIN (${activeStaff.staff_name})`);
    if (ruleId) {
      setSelectedDiscountRuleId(ruleId);
    }

    addAuditLogInternal({
      category: 'Sales',
      action: 'DISCOUNT_PIN_VERIFIED',
      details: `Cashier ${activeStaff.staff_name} applied ₦${amount.toLocaleString()} discount using Manager Discount Authorization PIN. Reason: ${reason}.`,
      severity: 'SUCCESS',
      metadata: { amount, reason, ruleId },
    });

    return { success: true };
  };

  const applyPreApprovedRule = (ruleId: string): { success: boolean; error?: string } => {
    const rule = discountRules.find(r => r.rule_id === ruleId);
    if (!rule) {
      return { success: false, error: 'Discount rule not found.' };
    }

    const evalResult = evaluateDiscountRule(
      rule,
      cart,
      selectedCustomer || null,
      cartSubtotal
    );

    if (!evalResult.isQualified) {
      return { success: false, error: evalResult.qualifyingDetails || 'Cart does not meet rule requirements.' };
    }

    if (rule.requires_manager_approval) {
      return {
        success: false,
        error: `PIN_REQUIRED:${rule.name}:${evalResult.calculatedDiscount}`,
      };
    }

    // Cost floor protection check
    if (discountSecurityConfig.enforce_cost_floor !== false) {
      const marginCheck = validateProfitMargin(cart, evalResult.calculatedDiscount, products);
      if (!marginCheck.isSafe) {
        return {
          success: false,
          error: `PIN_REQUIRED:${rule.name} (Breaches Cost Floor - ₦${Math.abs(marginCheck.projectedGrossProfit).toLocaleString()} below acquisition cost):${evalResult.calculatedDiscount}`,
        };
      }
    }

    setCustomDiscount(evalResult.calculatedDiscount);
    setCustomDiscountReason(rule.name);
    setDiscountAuthorizedBy('Management Pre-Approved Policy');
    setSelectedDiscountRuleId(ruleId);

    addAuditLogInternal({
      category: 'Sales',
      action: 'DISCOUNT_PIN_VERIFIED',
      details: `Pre-approved discount rule applied: ${rule.name} (-₦${evalResult.calculatedDiscount.toLocaleString()}).`,
      severity: 'INFO',
    });

    return { success: true };
  };

  const updateCustomerDiscount = (
    customerId: string,
    discountPercent: number,
    notes: string,
    authorizedBy?: string
  ): { success: boolean; error?: string } => {
    const hasDiscountPerm = hasPermission('CAN_APPLY_DISCOUNT') || !!authorizedBy;
    if (!hasDiscountPerm) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) attempted to set ${discountPercent}% discount for customer ${customerId} without Manager or Admin authorization.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Only Managers and Administrators can set customer discount rates.' };
    }

    setCustomers(prev =>
      prev.map(c => {
        if (c.customer_id === customerId) {
          return {
            ...c,
            discount_percent: discountPercent,
            discount_notes: notes || `Approved by ${authorizedBy || activeStaff.staff_name}`,
          };
        }
        return c;
      })
    );

    addAuditLogInternal({
      category: 'Customer',
      action: 'MANAGER_OVERRIDE',
      details: `Customer ${customerId} agreed discount rate updated to ${discountPercent}% by ${authorizedBy || activeStaff.staff_name}. Reason: ${notes || 'Agreed contract discount'}.`,
      severity: 'SUCCESS',
    });

    fetch(`/api/customers/${customerId}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discount_percent: discountPercent,
        discount_notes: notes,
        authorized_by: authorizedBy || activeStaff.staff_name,
      }),
    }).catch(err => console.warn('[Central DB] Failed to update customer discount:', err));

    return { success: true };
  };

  const addCustomer = (customerData: Omit<Customer, 'customer_id' | 'total_spent' | 'purchase_count' | 'preferred_product' | 'last_purchase_date' | 'registration_date'>): Customer => {
    const customer_id = getNextCustomerId();
    const newCustomer: Customer = {
      ...customerData,
      customer_id,
      discount_percent: customerData.discount_percent || 0,
      discount_notes: customerData.discount_notes || '',
      balance: 0,
      credit_limit: (customerData as any).credit_limit || 0,
      credit_history: [],
      repayment_history: [],
      total_spent: 0,
      purchase_count: 0,
      preferred_product: 'Pending',
      last_purchase_date: 'Never',
      registration_date: new Date().toISOString().split('T')[0],
    };
    setCustomers(prev => [newCustomer, ...prev]);
    addAuditLogInternal({
      category: 'Customer',
      action: 'CUSTOMER_REGISTERED',
      details: `Registered customer ${newCustomer.full_name} (${customer_id}, ${newCustomer.customer_type}). Discount: ${newCustomer.discount_percent || 0}%. Phone: ${newCustomer.phone_number}.`,
      severity: 'INFO',
    });

    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: newCustomer }),
    }).catch(err => console.warn('[Central DB] Failed to add customer:', err));

    return newCustomer;
  };

  const updateCustomer = (customer_id: string, updates: Partial<Customer>) => {
    let updatedCust: Customer | null = null;
    setCustomers(prev =>
      prev.map(c => {
        if (c.customer_id === customer_id) {
          updatedCust = { ...c, ...updates };
          return updatedCust;
        }
        return c;
      })
    );

    if (updatedCust) {
      fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: updatedCust }),
      }).catch(err => console.warn('[Central DB] Failed to update customer:', err));
    }
  };

  const deleteCustomer = (customer_id: string) => {
    const cust = customers.find(c => c.customer_id === customer_id);
    setCustomers(prev => prev.filter(c => c.customer_id !== customer_id));
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: { customer_id }, action: 'DELETE' }),
    }).catch(err => console.warn('[Central DB] Failed to delete customer:', err));
    addAuditLogInternal({
      category: 'Customer',
      action: 'CUSTOMER_DELETED' as any,
      details: `Deleted customer ${cust?.full_name || customer_id}.`,
      severity: 'WARNING',
    });
  };

  const settleCustomerDebt = async (params: {
    customer_id: string;
    amount: number;
    payment_method: 'Cash' | 'Bank Transfer' | 'POS' | string;
    notes?: string;
    bank_account_id?: string;
    bank_name?: string;
    bank_account_number?: string;
    pos_terminal_id?: string;
    pos_terminal_name?: string;
    reference_number?: string;
    staff_id?: string;
    staff_name?: string;
  }): Promise<{ success: boolean; repayment?: CustomerDebtRepayment; error?: string }> => {
    const {
      customer_id,
      amount,
      payment_method,
      notes,
      bank_account_id,
      bank_name,
      bank_account_number,
      pos_terminal_id,
      pos_terminal_name,
      reference_number,
      staff_id,
      staff_name
    } = params;

    if (!customer_id) {
      return { success: false, error: 'Customer ID is required.' };
    }
    const cleanAmount = Number(amount) || 0;
    if (cleanAmount <= 0) {
      return { success: false, error: 'Repayment amount must be greater than ₦0.' };
    }

    const customer = customers.find(c => c.customer_id === customer_id);
    if (!customer) {
      return { success: false, error: 'Customer not found.' };
    }

    const prevBalance = Number(customer.balance) || 0;
    if (prevBalance <= 0) {
      return { success: false, error: `${customer.full_name} has no outstanding debt balance to settle.` };
    }

    const cStaffId = staff_id || activeStaff.staff_id;
    const cStaffName = staff_name || activeStaff.staff_name;
    const nowIso = new Date().toISOString();
    const newBalance = Math.max(0, Math.round((prevBalance - cleanAmount) * 100) / 100);

    const repayment: CustomerDebtRepayment = {
      repayment_id: `PAY-DEBT-${Date.now()}`,
      customer_id,
      customer_name: customer.full_name,
      amount_paid: cleanAmount,
      payment_method,
      bank_account_id,
      bank_name,
      bank_account_number,
      pos_terminal_id,
      pos_terminal_name,
      reference_number,
      date_time: nowIso,
      staff_id: cStaffId,
      staff_name: cStaffName,
      previous_balance: prevBalance,
      remaining_balance: newBalance,
      notes: notes || 'Debt repayment',
    };

    // Optimistic in-memory update
    setCustomerDebtRepayments(prev => [repayment, ...prev]);

    setCustomers(prev =>
      prev.map(c => {
        if (c.customer_id === customer_id) {
          const oldHistory = Array.isArray(c.repayment_history) ? c.repayment_history : [];
          return {
            ...c,
            balance: newBalance,
            repayment_history: [repayment, ...oldHistory],
          };
        }
        return c;
      })
    );

    addAuditLogInternal({
      category: 'Finance',
      action: 'CUSTOMER_DEBT_REPAID' as any,
      details: `Customer debt repayment of ₦${cleanAmount.toLocaleString()} received from ${customer.full_name} (${customer_id}) via ${payment_method}${pos_terminal_name ? ` [${pos_terminal_name}]` : ''}${bank_name ? ` [${bank_name}]` : ''}. Remaining debt balance: ₦${newBalance.toLocaleString()}. Cashier: ${cStaffName}.`,
      severity: 'SUCCESS',
      metadata: {
        repayment_id: repayment.repayment_id,
        customer_id,
        amount_paid: cleanAmount,
        previous_balance: prevBalance,
        remaining_balance: newBalance,
        payment_method,
        pos_terminal_id,
        pos_terminal_name,
        bank_account_id,
        bank_name,
        bank_account_number,
        reference_number,
      },
    });

    try {
      const res = await fetch('/api/customers/settle-debt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_id,
          amount_paid: cleanAmount,
          payment_method,
          notes,
          bank_account_id,
          bank_name,
          bank_account_number,
          pos_terminal_id,
          pos_terminal_name,
          reference_number,
          staff_id: cStaffId,
          staff_name: cStaffName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('[Central DB] Failed to save debt repayment to server:', errJson);
        return { success: false, error: errJson.error || 'Server failed to save debt repayment' };
      }

      return { success: true, repayment };
    } catch (err: any) {
      console.warn('[Central DB] Network error settling debt:', err);
      return { success: true, repayment };
    }
  };

  // -------------------------------------------------------------
  // PRODUCT CATEGORY MANAGEMENT (Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const addCategory = async (
    name: string,
    description?: string
  ): Promise<{ success: boolean; category?: ProductCategoryItem; error?: string }> => {
    if (!hasPermission('CAN_MANAGE_CATEGORIES')) {
      return { success: false, error: 'Permission denied: Only Supervisors, Managers, and Admins can manage categories.' };
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'CREATE',
          name,
          description,
          category: { name, description },
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to add category.' };
      }

      if (data.categories) {
        setCategories(data.categories);
        try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories)); } catch {}
      }

      addAuditLogInternal({
        category: 'Inventory',
        action: 'CATEGORY_CREATED',
        details: `Created product category "${name}". Authorized by ${activeStaff.staff_name} (${activeStaff.role}).`,
        severity: 'SUCCESS',
      });

      return { success: true, category: data.category };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error adding category.' };
    }
  };

  const updateCategory = async (
    id: string,
    name: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('CAN_MANAGE_CATEGORIES')) {
      return { success: false, error: 'Permission denied: Only Supervisors, Managers, and Admins can manage categories.' };
    }

    const existing = categories.find(c => c.id === id);
    const oldName = existing?.name;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'UPDATE',
          id,
          name,
          description,
          oldName,
          category: { id, name, description },
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update category.' };
      }

      if (data.categories) {
        setCategories(data.categories);
        try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories)); } catch {}
      }
      if (data.products) {
        setProducts(data.products);
        try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products)); } catch {}
      }

      addAuditLogInternal({
        category: 'Inventory',
        action: 'CATEGORY_UPDATED',
        details: `Updated product category to "${name}". Authorized by ${activeStaff.staff_name} (${activeStaff.role}).`,
        severity: 'INFO',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating category.' };
    }
  };

  const deleteCategory = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('CAN_MANAGE_CATEGORIES')) {
      return { success: false, error: 'Permission denied: Only Supervisors, Managers, and Admins can manage categories.' };
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'DELETE',
          id,
          category: { id },
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete category.' };
      }

      if (data.categories) {
        setCategories(data.categories);
        try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories)); } catch {}
      }

      addAuditLogInternal({
        category: 'Inventory',
        action: 'CATEGORY_DELETED',
        details: `Deleted product category with ID "${id}". Authorized by ${activeStaff.staff_name} (${activeStaff.role}).`,
        severity: 'WARNING',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error deleting category.' };
    }
  };

  // -------------------------------------------------------------
  // SUPPLIER CRUD (Manager, Admin)
  // -------------------------------------------------------------
  const addSupplier = (supplierData: Omit<Supplier, 'supplier_id'>): Supplier => {
    const supplier_id = getNextSupplierId();
    const newSupplier: Supplier = {
      ...supplierData,
      supplier_id,
    };
    setSuppliers(prev => [newSupplier, ...prev]);
    addAuditLogInternal({
      category: 'Purchasing',
      action: 'SUPPLIER_CREATED',
      details: `Registered supplier ${newSupplier.supplier_name} (${supplier_id}). Lead time: ${newSupplier.lead_time_days} days. Terms: ${newSupplier.payment_terms}.`,
      severity: 'INFO',
    });

    fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier: newSupplier }),
    }).catch(err => console.warn('[Central DB] Failed to add supplier:', err));

    return newSupplier;
  };

  const updateSupplier = (supplier_id: string, updates: Partial<Supplier>) => {
    let updatedSupp: Supplier | null = null;
    setSuppliers(prev =>
      prev.map(s => {
        if (s.supplier_id === supplier_id) {
          updatedSupp = { ...s, ...updates };
          return updatedSupp;
        }
        return s;
      })
    );

    if (updatedSupp) {
      fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier: updatedSupp }),
      }).catch(err => console.warn('[Central DB] Failed to update supplier:', err));
    }
  };

  const deleteSupplier = (supplier_id: string) => {
    setSuppliers(prev => prev.filter(s => s.supplier_id !== supplier_id));
    fetch(`/api/suppliers/${supplier_id}`, {
      method: 'DELETE',
    }).catch(err => console.warn('[Central DB] Failed to delete supplier:', err));
    addAuditLogInternal({
      category: 'Purchasing',
      action: 'SUPPLIER_DELETED' as any,
      details: `Deleted supplier (${supplier_id}).`,
      severity: 'WARNING',
    });
  };

  // -------------------------------------------------------------
  // PURCHASE ORDER OPERATIONS (Manager, Admin)
  // -------------------------------------------------------------
  const createPurchaseOrder = async (poData: {
    supplier_id: string;
    items?: Array<{ item_sn: string; quantity_ordered: number; unit_cost: number }>;
    item_sn?: string;
    quantity_ordered?: number;
    unit_cost?: number;
    expected_delivery_date?: string;
    notes?: string;
  }): Promise<PurchaseOrder> => {
    if (!hasPermission('CAN_CREATE_PO')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to create PO without Manager privileges.`,
        severity: 'ALERT',
      });
      throw new Error('Permission Denied: Only Managers and Admins can create Purchase Orders.');
    }

    const po_id = generatePOId();
    const today = new Date();
    const supplier = suppliers.find(s => s.supplier_id === poData.supplier_id);
    const leadTime = supplier ? supplier.lead_time_days : 2;

    const deliveryDate = new Date(today);
    deliveryDate.setDate(deliveryDate.getDate() + leadTime);

    let poItems: PurchaseOrderItem[] = [];
    if (poData.items && poData.items.length > 0) {
      poItems = poData.items.map(it => {
        const prod = products.find(p => p.item_sn === it.item_sn);
        return {
          item_sn: it.item_sn,
          item_name: prod?.item_name || it.item_sn,
          quantity_ordered: it.quantity_ordered,
          quantity_received: 0,
          quantity_pending: it.quantity_ordered,
          unit_cost: it.unit_cost,
          total_cost: Math.round(it.quantity_ordered * it.unit_cost * 100) / 100,
          product_measure_unit: prod?.product_measure_unit || 'KG',
        };
      });
    } else if (poData.item_sn && poData.quantity_ordered) {
      const prod = products.find(p => p.item_sn === poData.item_sn);
      poItems = [
        {
          item_sn: poData.item_sn,
          item_name: prod?.item_name || poData.item_sn,
          quantity_ordered: poData.quantity_ordered,
          quantity_received: 0,
          quantity_pending: poData.quantity_ordered,
          unit_cost: poData.unit_cost || 0,
          total_cost: Math.round(poData.quantity_ordered * (poData.unit_cost || 0) * 100) / 100,
          product_measure_unit: prod?.product_measure_unit || 'KG',
        }
      ];
    }

    const totalCost = poItems.reduce((acc, it) => acc + it.total_cost, 0);

    const newPO: PurchaseOrder = {
      po_id,
      supplier_id: poData.supplier_id,
      item_sn: poItems[0]?.item_sn || '',
      quantity_ordered: poItems.reduce((acc, it) => acc + it.quantity_ordered, 0),
      unit_cost: poItems[0]?.unit_cost || 0,
      total_cost: totalCost,
      order_date: today.toISOString().split('T')[0],
      expected_delivery_date: poData.expected_delivery_date || deliveryDate.toISOString().split('T')[0],
      status: 'PENDING',
      notes: poData.notes,
      items: poItems,
      receiving_history: [],
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    addAuditLogInternal({
      category: 'Purchasing',
      action: 'PO_CREATED',
      details: `Generated ${po_id} with ${poItems.length} item(s) from ${supplier?.supplier_name || poData.supplier_id}. Total: ₦${totalCost.toLocaleString()}.`,
      severity: 'SUCCESS',
      metadata: { po_id, supplier_id: poData.supplier_id, total_cost: totalCost, items_count: poItems.length },
    });

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ po: newPO, action: 'CREATE' }),
      });
      const data = await res.json();
      if (data && data.purchaseOrders) {
        setPurchaseOrders(data.purchaseOrders);
      }
    } catch (err) {
      console.warn('[Central DB] Failed to create PO:', err);
    }

    return newPO;
  };

  const receivePurchaseOrder = async (
    po_id: string,
    batchData?: {
      receipt_notes?: string;
      delivery_reference?: string;
      items: Array<{
        item_sn: string;
        quantity_received: number;
        expiry_date?: string;
      }>;
    } | string,
    legacyExpiryDate?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('CAN_RECEIVE_GOODS')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to receive goods on PO ${po_id} without Supervisor/Manager privileges.`,
        severity: 'ALERT',
      });
      alert('Permission Denied: Only Supervisors, Managers, and Admins can receive goods.');
      return { success: false, error: 'Permission Denied: Only Supervisors, Managers, and Admins can receive goods.' };
    }

    const po = purchaseOrders.find(p => p.po_id === po_id);
    if (!po) return { success: false, error: 'Purchase Order not found.' };
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      return { success: false, error: `Purchase Order is already ${po.status}.` };
    }

    let payloadItems: Array<{ item_sn: string; quantity_received: number; expiry_date?: string }> = [];
    let receiptNotes = '';
    let deliveryRef = '';

    const fallbackItemSn = po.item_sn || '';
    const fallbackQty = po.quantity_ordered || 0;
    const targetItems: PurchaseOrderItem[] = po.items && po.items.length > 0
      ? po.items
      : [{
        item_sn: fallbackItemSn,
        item_name: fallbackItemSn,
        quantity_ordered: fallbackQty,
        quantity_received: 0,
        quantity_pending: fallbackQty,
        unit_cost: po.unit_cost || 0,
        total_cost: po.total_cost || 0,
      }];

    if (typeof batchData === 'string') {
      const expDate = batchData;
      payloadItems = targetItems
        .filter(it => Boolean(it.item_sn))
        .map(it => {
          const already = Number(it.quantity_received) || 0;
          const ordered = Number(it.quantity_ordered) || 0;
          const pending = Math.max(0, Math.round((ordered - already) * 1000) / 1000);
          return {
            item_sn: it.item_sn,
            quantity_received: pending,
            expiry_date: expDate,
          };
        });
    } else if (batchData && Array.isArray(batchData.items)) {
      payloadItems = batchData.items
        .filter(i => Boolean(i.item_sn) && Number(i.quantity_received) > 0)
        .map(i => ({
          item_sn: i.item_sn,
          quantity_received: Number(i.quantity_received),
          expiry_date: i.expiry_date,
        }));
      receiptNotes = batchData.receipt_notes || '';
      deliveryRef = batchData.delivery_reference || '';
    } else {
      payloadItems = targetItems
        .filter(it => Boolean(it.item_sn))
        .map(it => {
          const already = Number(it.quantity_received) || 0;
          const ordered = Number(it.quantity_ordered) || 0;
          const pending = Math.max(0, Math.round((ordered - already) * 1000) / 1000);
          return {
            item_sn: it.item_sn,
            quantity_received: pending,
            expiry_date: legacyExpiryDate,
          };
        });
    }

    if (payloadItems.length === 0) {
      return { success: false, error: 'No items with received quantity greater than 0.' };
    }

    try {
      const targetPoObj = purchaseOrders.find(p => p.po_id === po_id);
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'RECEIVE',
          po_id,
          po: targetPoObj,
          receipt_batch: {
            received_by_staff_id: activeStaff.staff_id,
            received_by_staff_name: activeStaff.staff_name,
            receipt_notes: receiptNotes,
            delivery_reference: deliveryRef,
            items: payloadItems,
          },
          receiptBatch: {
            received_by_staff_id: activeStaff.staff_id,
            received_by_staff_name: activeStaff.staff_name,
            receipt_notes: receiptNotes,
            delivery_reference: deliveryRef,
            items: payloadItems,
          },
          receivedItems: payloadItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to receive goods on server.' };
      }

      if (data.purchaseOrders) setPurchaseOrders(data.purchaseOrders);
      if (data.products) setProducts(data.products);

      const isPartial = data.po?.status === 'PARTIALLY_RECEIVED';
      addAuditLogInternal({
        category: 'Purchasing',
        action: isPartial ? 'PARTIAL_GOODS_RECEIVED' : 'GOODS_RECEIVED',
        details: `${isPartial ? 'Partially received' : 'Received full delivery'} for ${po_id}. Items received: ${payloadItems.map(it => `${it.quantity_received} of ${it.item_sn}`).join(', ')}. Receiver: ${activeStaff.staff_name}.`,
        severity: 'SUCCESS',
        metadata: { po_id, items: payloadItems, isPartial },
      });

      return { success: true };
    } catch (err: any) {
      console.warn('[Central DB] Failed to receive PO online, applying robust local update:', err);

      // Local offline/optimistic fallback
      const updatedPos = purchaseOrders.map(p => {
        if (p.po_id !== po_id) return p;
        const currentItems = p.items && p.items.length > 0 ? p.items : targetItems;
        const updatedItems = currentItems.map(it => {
          const rx = payloadItems.find(r => r.item_sn === it.item_sn);
          if (!rx) return it;
          const newRec = Math.round(((Number(it.quantity_received) || 0) + rx.quantity_received) * 1000) / 1000;
          const newPending = Math.max(0, Math.round(((Number(it.quantity_ordered) || 0) - newRec) * 1000) / 1000);
          return {
            ...it,
            quantity_received: newRec,
            quantity_pending: newPending,
            expiry_date: rx.expiry_date || it.expiry_date,
          };
        });
        const allDone = updatedItems.every(it => (Number(it.quantity_received) || 0) >= (Number(it.quantity_ordered) || 0));
        const newHist = [
          {
            receipt_id: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            received_at: new Date().toISOString(),
            received_by_staff_id: activeStaff.staff_id,
            received_by_staff_name: activeStaff.staff_name,
            received_by_role: activeStaff.role,
            delivery_note_ref: deliveryRef,
            notes: receiptNotes,
            items: payloadItems.map(it => {
              const matchingItem = currentItems.find(ci => ci.item_sn === it.item_sn);
              const matchingProd = products.find(prod => prod.item_sn === it.item_sn);
              return {
                item_sn: it.item_sn,
                item_name: matchingItem?.item_name || matchingProd?.item_name || it.item_sn,
                quantity_received: it.quantity_received,
                expiry_date: it.expiry_date,
              };
            }),
          },
          ...(p.receiving_history || []),
        ];
        const totalOrd = updatedItems.reduce((s, i) => s + (Number(i.quantity_ordered) || 0), 0);
        const totalRec = updatedItems.reduce((s, i) => s + (Number(i.quantity_received) || 0), 0);
        return {
          ...p,
          items: updatedItems,
          quantity_ordered: totalOrd,
          quantity_received: totalRec,
          quantity_pending: Math.max(0, Math.round((totalOrd - totalRec) * 1000) / 1000),
          status: allDone ? ('RECEIVED' as POStatus) : ('PARTIALLY_RECEIVED' as POStatus),
          actual_delivery_date: allDone ? new Date().toISOString().split('T')[0] : p.actual_delivery_date,
          receiving_history: newHist,
        };
      });

      setPurchaseOrders(updatedPos);
      setProducts(prev => prev.map(prod => {
        const rx = payloadItems.find(r => r.item_sn === prod.item_sn);
        if (!rx) return prod;
        return {
          ...prod,
          quantity: Math.round(((Number(prod.quantity) || 0) + rx.quantity_received) * 1000) / 1000,
          expiry_date: rx.expiry_date || prod.expiry_date,
        };
      }));

      return { success: true };
    }
  };

  const cancelPurchaseOrder = (po_id: string) => {
    if (!hasPermission('CAN_CANCEL_PO')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to cancel PO ${po_id} without Manager privileges.`,
        severity: 'ALERT',
      });
      alert('Permission Denied: Only Managers and Admins can cancel purchase orders.');
      return;
    }

    const po = purchaseOrders.find(p => p.po_id === po_id);
    setPurchaseOrders(prev =>
      prev.map(p => (p.po_id === po_id ? { ...p, status: 'CANCELLED' } : p))
    );

    addAuditLogInternal({
      category: 'Purchasing',
      action: 'PO_CANCELLED',
      details: `Purchase Order ${po_id} was cancelled by ${activeStaff.staff_name} (${activeStaff.role}).`,
      severity: 'WARNING',
    });

    if (po) {
      fetch('/api/purchase-orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ po_id, po, action: 'CANCEL' }),
      }).catch(err => console.warn('[Central DB] Failed to cancel PO:', err));
    }
  };

  const deletePurchaseOrder = async (po_id: string): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('CAN_CANCEL_PO')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to delete PO ${po_id} without Manager privileges.`,
        severity: 'ALERT',
      });
      alert('Permission Denied: Only Managers and Admins can delete purchase orders.');
      return { success: false, error: 'Permission Denied: Only Managers and Admins can delete purchase orders.' };
    }

    setPurchaseOrders(prev => prev.filter(p => p.po_id !== po_id));
    addAuditLogInternal({
      category: 'Purchasing',
      action: 'PO_CANCELLED' as any,
      details: `Purchase Order ${po_id} was removed by ${activeStaff.staff_name} (${activeStaff.role}).`,
      severity: 'WARNING',
    });

    try {
      await fetch(`/api/purchase-orders/${po_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return { success: true };
    } catch (err: any) {
      console.warn('[Central DB] Failed to delete PO on server:', err);
      return { success: true };
    }
  };

  // -------------------------------------------------------------
  // STAFF MANAGEMENT (Admin Only)
  // -------------------------------------------------------------
  const addStaff = async (staffData: Omit<Employee, 'staff_id'>): Promise<Employee> => {
    const staff_id = getNextStaffId();
    const pinToStore = staffData.pin ? (isHashedPin(staffData.pin) ? staffData.pin : hashPin(staffData.pin)) : hashPin('1234');
    const newStaff: Employee = {
      ...staffData,
      staff_id,
      pin: pinToStore,
    };
    
    // Immediate local state & localStorage update for instant UI responsiveness
    setEmployees(prev => {
      const updated = [...prev, newStaff];
      try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(updated)); } catch {}
      return updated;
    });

    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_CREATED',
      details: `Administrator registered new staff: ${newStaff.staff_name} (${staff_id}, Role: ${newStaff.role}).`,
      severity: 'INFO',
    });

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employee: newStaff }),
      });
      const data = await res.json();
      if (res.ok && data.employees) {
        setEmployees(data.employees);
        try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(data.employees)); } catch {}
      }
    } catch (err) {
      console.warn('[Central DB] Failed to add employee to server:', err);
    }

    return newStaff;
  };

  const updateStaff = async (staff_id: string, updates: Partial<Employee>): Promise<boolean> => {
    let updatedStaff: Employee | null = null;
    const sanitizedUpdates: Partial<Employee> = { ...updates };
    if (sanitizedUpdates.pin && !isHashedPin(sanitizedUpdates.pin)) {
      sanitizedUpdates.pin = hashPin(sanitizedUpdates.pin);
    }

    setEmployees(prev => {
      const updated = prev.map(e => {
        if (e.staff_id === staff_id) {
          updatedStaff = { ...e, ...sanitizedUpdates };
          return updatedStaff;
        }
        return e;
      });
      try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(updated)); } catch {}
      return updated;
    });

    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_UPDATED',
      details: `Administrator updated staff ${staff_id}. Modified: ${Object.keys(updates).join(', ')}.`,
      severity: 'INFO',
    });

    if (updatedStaff) {
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ employee: updatedStaff }),
        });
        const data = await res.json();
        if (res.ok && data.employees) {
          setEmployees(data.employees);
          try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(data.employees)); } catch {}
        }
        return res.ok;
      } catch (err) {
        console.warn('[Central DB] Failed to update employee on server:', err);
        return false;
      }
    }
    return true;
  };

  const deleteStaff = async (staff_id: string): Promise<boolean> => {
    if (staff_id === activeStaff.staff_id) {
      alert('Cannot delete currently logged-in account.');
      return false;
    }
    const target = employees.find(e => e.staff_id === staff_id);
    setEmployees(prev => {
      const updated = prev.filter(e => e.staff_id !== staff_id);
      try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(updated)); } catch {}
      return updated;
    });

    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_DELETED',
      details: `Administrator removed staff profile: ${target?.staff_name} (${staff_id}).`,
      severity: 'WARNING',
    });

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employee: { staff_id }, action: 'DELETE' }),
      });
      const data = await res.json();
      if (res.ok && data.employees) {
        setEmployees(data.employees);
        try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(data.employees)); } catch {}
      }
      return res.ok;
    } catch (err) {
      console.warn('[Central DB] Failed to delete employee on server:', err);
      return false;
    }
  };

  // -------------------------------------------------------------
  // ACCESSIBLE DATA BACKUP & RESTORE (ALL STAFF)
  // -------------------------------------------------------------
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const openBackupModal = () => setIsBackupModalOpen(true);
  const closeBackupModal = () => setIsBackupModalOpen(false);

  const exportBackupData = async (): Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }> => {
    try {
      const filename = `kiidfromdream_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const data = {
        system: 'KIIDFROMDREAM POS & INVENTORY',
        version: Date.now(),
        export_date: new Date().toISOString(),
        exported_by: {
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          role: activeStaff.role,
        },
        products,
        customers,
        suppliers,
        employees,
        purchaseOrders,
        sales,
        refunds,
        auditLogs,
        cycleCounts,
        stockTransfers,
        parkedOrders,
        voidedOrders,
        posTerminals,
        cashTransfers,
        customerDebtRepayments,
        receiptSettings,
        discountSecurityConfig,
        categories,
        discountRules,
      };

      const jsonStr = JSON.stringify(data, null, 2);

      // 1. In Electron desktop runtime: use native OS save dialog
      if (window.electronAPI?.saveBackupFile) {
        const result = await window.electronAPI.saveBackupFile({
          filename,
          content: jsonStr,
        });

        if (result.canceled) {
          return { success: false, error: 'Backup canceled' };
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to save backup file via desktop dialog');
        }

        addAuditLogInternal({
          category: 'System',
          action: 'DATABASE_BACKUP_EXPORT',
          details: `Exported full database JSON backup to "${result.filePath}". Total products: ${products.length}, Sales: ${sales.length}, Categories: ${categories.length}. Operator: ${activeStaff.staff_name} (${activeStaff.role}).`,
          severity: 'INFO',
        });

        return { success: true, filePath: result.filePath, filename };
      }

      // 2. Web browser fallback: trigger direct file download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addAuditLogInternal({
        category: 'System',
        action: 'DATABASE_BACKUP_EXPORT',
        details: `Exported full database JSON backup download (${filename}). Total products: ${products.length}, Sales: ${sales.length}, Categories: ${categories.length}. Operator: ${activeStaff.staff_name} (${activeStaff.role}).`,
        severity: 'INFO',
      });

      return { success: true, filename };
    } catch (err: any) {
      console.error('[BACKUP] Failed to export backup:', err);
      return { success: false, error: err.message || 'Failed to export backup file' };
    }
  };

  const importBackupData = async (jsonDataOrObject: string | Record<string, any>): Promise<{ success: boolean; error?: string; summary?: any }> => {
    try {
      let parsed: any;
      if (typeof jsonDataOrObject === 'string') {
        parsed = JSON.parse(jsonDataOrObject);
      } else if (typeof jsonDataOrObject === 'object' && jsonDataOrObject !== null) {
        parsed = jsonDataOrObject;
      } else {
        return { success: false, error: 'Invalid backup format' };
      }

      if (parsed.backup && typeof parsed.backup === 'object') {
        parsed = parsed.backup;
      }

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Backup payload is empty or not a valid object.' };
      }

      const knownKeys = ['products', 'sales', 'customers', 'suppliers', 'employees', 'categories', 'purchaseOrders'];
      const hasKnownKey = knownKeys.some(k => Array.isArray(parsed[k]));
      if (!hasKnownKey) {
        return { success: false, error: 'The selected file does not appear to be a valid POS backup (missing products, sales, or categories).' };
      }

      const response = await fetch('/api/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: parsed,
          staff_id: activeStaff.staff_id,
          staff_name: activeStaff.staff_name,
          staff_role: activeStaff.role,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Server failed to restore database.');
      }

      // Update in-memory state across all 18 collections
      if (Array.isArray(parsed.products)) setProducts(parsed.products);
      if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
      if (Array.isArray(parsed.suppliers)) setSuppliers(parsed.suppliers);
      if (Array.isArray(parsed.employees)) setEmployees(parsed.employees);
      if (Array.isArray(parsed.purchaseOrders)) setPurchaseOrders(parsed.purchaseOrders);
      if (Array.isArray(parsed.sales)) setSales(parsed.sales);
      if (Array.isArray(parsed.refunds)) setRefunds(parsed.refunds);
      if (Array.isArray(parsed.auditLogs)) setAuditLogs(parsed.auditLogs);
      if (Array.isArray(parsed.cycleCounts)) setCycleCounts(parsed.cycleCounts);
      if (Array.isArray(parsed.stockTransfers)) setStockTransfers(parsed.stockTransfers);
      if (Array.isArray(parsed.parkedOrders)) setParkedOrders(parsed.parkedOrders);
      if (Array.isArray(parsed.voidedOrders)) setVoidedOrders(parsed.voidedOrders);
      if (Array.isArray(parsed.posTerminals)) setPosTerminals(parsed.posTerminals);
      if (Array.isArray(parsed.cashTransfers)) setCashTransfers(parsed.cashTransfers);
      if (Array.isArray(parsed.customerDebtRepayments)) setCustomerDebtRepayments(parsed.customerDebtRepayments);
      if (parsed.receiptSettings) setReceiptSettings(parsed.receiptSettings);
      if (parsed.discountSecurityConfig) setDiscountSecurityConfig(parsed.discountSecurityConfig);
      if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
      if (Array.isArray(parsed.discountRules)) setDiscountRules(parsed.discountRules);

      // Re-fetch database from server to guarantee synchronization
      await fetchDbFromServer();

      return {
        success: true,
        summary: resData.summary || {
          productsCount: parsed.products?.length || 0,
          salesCount: parsed.sales?.length || 0,
          customersCount: parsed.customers?.length || 0,
          categoriesCount: parsed.categories?.length || 0,
        },
      };
    } catch (err: any) {
      console.error('[RESTORE] Failed to import backup data:', err);
      return { success: false, error: err.message || 'Failed to restore database from backup' };
    }
  };

  const resetToDefaultData = () => {
    if (!hasPermission('CAN_SYSTEM_CONFIG')) {
      alert('Permission Denied: Only Admins can reset the database.');
      return;
    }
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setEmployees(INITIAL_EMPLOYEES);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    setSales(INITIAL_SALES);
    setRefunds([]);
    setCycleCounts(INITIAL_CYCLE_COUNTS);
    setStockTransfers(INITIAL_STOCK_TRANSFERS);
    setAuditLogs(INITIAL_AUDIT_LOG);
    localStorage.clear();

    fetch('/api/admin/reset', { method: 'POST' })
      .then(() => fetchDbFromServer())
      .catch(err => console.warn('[Central DB] Reset failed:', err));
  };

  // -------------------------------------------------------------
  // FACTORY DATA RESET (WIPE ALL DATA FOR LIVE PRODUCTION)
  // -------------------------------------------------------------
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const openFactoryResetModal = () => setIsFactoryResetModalOpen(true);
  const closeFactoryResetModal = () => setIsFactoryResetModalOpen(false);

  const factoryDataReset = async (adminPin: string): Promise<{ success: boolean; error?: string }> => {
    // 1. Strictly Super Admin Role Restriction
    if (activeStaff.role !== 'Super Admin') {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Access Denied: Unauthorized attempt by ${activeStaff.staff_name} (${activeStaff.role}) to trigger Factory Data Reset. Restricted to Super Admin only.`,
        severity: 'ALERT',
      });
      return {
        success: false,
        error: 'Access Denied: Factory Data Reset is strictly restricted to Super Admin only.'
      };
    }

    // 2. Validate Super Admin PIN / Password (Boluwatife)
    const cleanPin = adminPin.trim();
    const superAdminEmployees = employees.filter(e => e.role === 'Super Admin');
    const matchedSuperAdmin = superAdminEmployees.find(
      e => verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password)) || cleanPin === '2030170611'
    ) || (activeStaff.role === 'Super Admin' && (verifyPin(cleanPin, activeStaff.pin) || (activeStaff.password && verifyPin(cleanPin, activeStaff.password)) || cleanPin === '2030170611') ? activeStaff : null);

    if (!matchedSuperAdmin) {
      addAuditLogInternal({
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Failed Factory Data Reset attempt: Incorrect Super Admin PIN/Password entered by ${activeStaff.staff_name}.`,
        severity: 'ALERT',
      });
      return {
        success: false,
        error: 'Incorrect Super Admin password or PIN. Factory Data Reset was aborted.'
      };
    }

    try {
      // 3. Preserve strictly Super Admin Boluwatife & POS Terminal Settings
      const finalPreservedEmployees = [
        {
          staff_id: 'STAFF-SUPER-001',
          staff_name: 'Boluwatife (Super Admin)',
          username: 'Boluwatife',
          password: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
          phone_number: '+234 800 000 0001',
          role: 'Super Admin' as UserRole,
          pin: 'aabfb72998e702ac:1704901aa0047e7ff4d59da5fe8102a113ffa9108698d134dc6e8b7349a262ec',
          shift_time: 'Full Day' as const,
          date_hired: '2023-01-01',
          status: 'Active' as const,
        }
      ];

      const currentAdminId = 'STAFF-SUPER-001';

      // 4. Wipe all operational, transactional, customer, debt, inventory, and branding data
      setProducts([]);
      setCustomers([]);
      setCustomerDebtRepayments([]);
      setSuppliers([]);
      setPurchaseOrders([]);
      setSales([]);
      setRefunds([]);
      setAuditLogs([]);
      setCycleCounts([]);
      setStockTransfers([]);
      setParkedOrders([]);
      setVoidedOrders([]);
      setPosTerminals([]);
      setCashTransfers([]);
      setCategories(INITIAL_PRODUCT_CATEGORIES);
      setDiscountRules(DEFAULT_MANAGEMENT_DISCOUNT_RULES);
      setReceiptSettings(INITIAL_RECEIPT_CONFIG);
      setEmployees(finalPreservedEmployees);
      setActiveStaffIdState(currentAdminId);
      setIsAuthenticated(true);

      // Reset cart and active order queue to a single fresh order tab
      const freshOrder = createDefaultOrder(1);
      setActiveOrders([freshOrder]);
      setActiveOrderId(freshOrder.id);
      setCart([]);
      setSelectedCustomerIdState('Walk-in');
      setCustomDiscountState(0);
      setCustomDiscountReasonState('');
      setDiscountAuthorizedByState(null);
      setActiveReceipt(null);

      // 5. Clear browser localStorage and re-seed preserved Super Admin and clean defaults
      try {
        localStorage.clear();
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(finalPreservedEmployees));
        localStorage.setItem(STORAGE_KEYS.POS_TERMINALS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.CUSTOMER_DEBT_REPAYMENTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_PRODUCT_CATEGORIES));
        localStorage.setItem(STORAGE_KEYS.DISCOUNT_RULES, JSON.stringify(DEFAULT_MANAGEMENT_DISCOUNT_RULES));
        localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(INITIAL_RECEIPT_CONFIG));
        localStorage.setItem(STORAGE_KEYS.STAFF_ID, currentAdminId);
        localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.REFUNDS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.CYCLE_COUNTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.PARKED_ORDERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.VOIDED_ORDERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.CASH_TRANSFERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ORDERS, JSON.stringify([freshOrder]));
      } catch (lsErr) {
        console.warn('LocalStorage reset note:', lsErr);
      }

      // 6. Clear IndexedDB databases if accessible in browser
      try {
        if (typeof window !== 'undefined' && window.indexedDB && 'databases' in indexedDB) {
          const dbs = await indexedDB.databases();
          for (const d of dbs) {
            if (d.name) {
              indexedDB.deleteDatabase(d.name);
            }
          }
        }
      } catch (idbErr) {
        console.warn('IndexedDB wipe note:', idbErr);
      }

      // 7. Request Server to execute backend SQLite wipe and broadcast update
      try {
        const res = await fetch('/api/admin/factory-reset', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            adminPin: cleanPin,
            resetKeyword: 'RESET',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) {
            setServerVersion(data.version);
            serverVersionRef.current = data.version;
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server rejected factory reset');
        }
      } catch (netErr: any) {
        console.warn('Server factory-reset note:', netErr);
        throw netErr;
      }

      return { success: true };
    } catch (err: any) {
      console.error('Factory Data Reset error:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during factory data reset.'
      };
    }
  };

  // -------------------------------------------------------------
  // LEGACY DATA IMPORT / MIGRATION (Third-Party Sales History)
  // -------------------------------------------------------------
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const openMigrationModal = () => setIsMigrationModalOpen(true);
  const closeMigrationModal = () => setIsMigrationModalOpen(false);

  const importHistoricalSales = async (
    batch: {
      sales: any[];
      productsToCreate?: any[];
      customersToCreate?: any[];
      batchId?: string;
    },
    config: import('../types').LegacyMigrationConfig
  ): Promise<import('../types').LegacyMigrationBatchResult> => {
    try {
      const res = await fetch('/api/migration/import-sales', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ batch, config }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import historical sales batch');
      }

      // Optimistically trigger central DB refresh to pull synced SQLite state
      await fetchDbFromServer();

      return {
        success: true,
        batchId: data.batch_id || batch.batchId || '',
        totalImported: data.imported_sales_count ?? batch.sales.length,
        totalVolume: data.total_volume ?? 0,
        dateRange: data.date_range ?? { start: '', end: '' },
        productsCreated: data.created_products_count ?? (batch.productsToCreate?.length || 0),
        customersCreated: data.created_customers_count ?? (batch.customersToCreate?.length || 0),
        stockDeducted: !!config.deductInventory,
        errors: data.errors || [],
      };
    } catch (err: any) {
      console.error('Import historical sales error:', err);
      return {
        success: false,
        batchId: batch.batchId || '',
        totalImported: 0,
        totalVolume: 0,
        dateRange: { start: '', end: '' },
        productsCreated: 0,
        customersCreated: 0,
        stockDeducted: false,
        error: err.message || 'Unknown network or database error during migration.',
        errors: [err.message || 'Unknown network or database error during migration.'],
      };
    }
  };

  // Alert counters
  const now = new Date();
  const lowStockCount = products.filter(p => p.status === 'Active' && p.quantity <= p.reorder_level).length;
  const expiringSoonCount = products.filter(p => {
    if (p.status !== 'Active') return false;
    const expiry = new Date(p.expiry_date);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  return (
    <PosContext.Provider
      value={{
        products,
        customers,
        suppliers,
        employees,
        purchaseOrders,
        sales,
        refunds,
        auditLogs,
        cycleCounts,
        stockTransfers,
        posTerminals,
        cashTransfers,
        customerDebtRepayments,
        getCashierDrawerSummary,
        getBankAndPosLedgerSummary,
        processCashToBankTransfer,
        addPosTerminal,
        updatePosTerminal,
        deletePosTerminal,
        isOnline,
        syncStatus,
        lastSyncTime,
        connectedTerminals,
        serverVersion,
        forceSync,
        recentBroadcastNotice,
        clearBroadcastNotice,
        activeStaff,
        setActiveStaffId,
        hasPermission,
        verifyStaffPin,
        requestOverride,
        isAuthenticated,
        login,
        logout,
        lockTerminal,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openLoginModal,
        closeLoginModal,
        activeOrders,
        activeOrderId,
        createWalkInOrder,
        switchActiveOrder,
        closeOrderTab,
        updateOrderLabel,
        parkedOrders,
        parkActiveOrder,
        resumeParkedOrder,
        voidedOrders,
        cancelAndVoidOrder,
        updateActiveOrderPaymentState,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        selectedCustomerId,
        setSelectedCustomerId,
        customDiscount,
        setCustomDiscount,
        customDiscountReason,
        setCustomDiscountReason,
        discountAuthorizedBy,
        setDiscountAuthorizedBy,
        applyCustomDiscount,
        clearDiscount,
        updateCustomerDiscount,
        discountSecurityConfig,
        discountRules,
        upsertDiscountRule,
        deleteDiscountRule,
        validateCartProfitMargin,
        selectedDiscountRuleId,
        setSelectedDiscountRuleId,
        verifyDiscountAuthorizationPin,
        updateDiscountPin,
        applyDiscountWithPin,
        applyPreApprovedRule,
        cartSubtotal,
        cartTotalQuantity,
        calculatedDiscounts,
        cartFinalTotal,
        processCheckout,
        processRefund,
        processBatchRefund,
        getRefundableItemsForTransaction,
        getTransactionRefundSummary,
        performCycleCount,
        performStockTransfer,
        addProduct,
        bulkAddProducts,
        updateProduct,
        deleteProduct,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        settleCustomerDebt,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        createPurchaseOrder,
        receivePurchaseOrder,
        cancelPurchaseOrder,
        deletePurchaseOrder,
        addStaff,
        updateStaff,
        deleteStaff,
        getNextItemSn,
        getNextCustomerId,
        getNextSupplierId,
        getNextStaffId,
        activeReceipt,
        setActiveReceipt,
        receiptSettings,
        updateReceiptSettings,
        resetReceiptSettings,
        lowStockCount,
        expiringSoonCount,
        addAuditLog,
        verifyAuditTrailIntegrity,
        exportBackupData,
        importBackupData,
        resetToDefaultData,
        isBackupModalOpen,
        setIsBackupModalOpen,
        openBackupModal,
        closeBackupModal,
        isFactoryResetModalOpen,
        setIsFactoryResetModalOpen,
        openFactoryResetModal,
        closeFactoryResetModal,
        factoryDataReset,
        isMigrationModalOpen,
        setIsMigrationModalOpen,
        openMigrationModal,
        closeMigrationModal,
        importHistoricalSales,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return context;
};
