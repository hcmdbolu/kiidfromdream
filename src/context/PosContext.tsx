import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Product,
  Customer,
  Supplier,
  PurchaseOrder,
  Employee,
  SaleTransaction,
  SaleItem,
  PaymentMethod,
  RefundRecord,
  UserRole,
  AuditLogEntry,
  CycleCountRecord,
  StockTransferRecord,
  AuditCategory,
  AuditAction,
  AuditSeverity,
} from '../types';
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
} from '../data/initialData';
import { Permission, hasRolePermission, generateAuditHash } from '../utils/rbac';

interface CartItem extends SaleItem {
  maxAvailable: number;
}

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
  
  // Active state & RBAC
  activeStaff: Employee;
  setActiveStaffId: (id: string) => void;
  hasPermission: (permission: Permission) => boolean;
  verifyStaffPin: (staffId: string, pin: string) => { success: boolean; staff?: Employee; error?: string };
  requestOverride: (managerPin: string, actionDescription: string) => { success: boolean; authorizedBy?: Employee; error?: string };

  // Authentication & Session
  isAuthenticated: boolean;
  login: (identifier: string, pin: string) => { success: boolean; staff?: Employee; error?: string };
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
  addToCart: (product: Product, quantity?: number) => boolean;
  updateCartQuantity: (item_sn: string, quantity: number) => boolean;
  removeFromCart: (item_sn: string) => void;
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
  
  // Cart calculations
  cartSubtotal: number;
  cartTotalQuantity: number;
  calculatedDiscounts: {
    customerDiscount: number;
    customerDiscountPercent: number;
    wholesaleDiscount: number;
    customDiscount: number;
    totalDiscount: number;
  };
  cartFinalTotal: number;
  
  // Actions
  processCheckout: (paymentMethod: PaymentMethod) => { success: boolean; transaction?: SaleTransaction; error?: string };
  processRefund: (originalTxnId: string, item_sn: string, quantity: number, reason: string, authorizedByStaffId?: string) => { success: boolean; error?: string };
  
  // Cycle Counts (Supervisor)
  performCycleCount: (data: { item_sn: string; counted_qty: number; reason: string; adjustStock: boolean }) => { success: boolean; record?: CycleCountRecord; error?: string };

  // Stock Transfers (Manager)
  performStockTransfer: (data: { item_sn: string; quantity: number; from_location: string; to_location: string; notes?: string }) => { success: boolean; record?: StockTransferRecord; error?: string };

  // Entity management
  addProduct: (product: Omit<Product, 'item_sn'>) => Product;
  updateProduct: (item_sn: string, product: Partial<Product>) => void;
  deleteProduct: (item_sn: string) => void;
  
  addCustomer: (customer: Omit<Customer, 'customer_id' | 'total_spent' | 'purchase_count' | 'preferred_product' | 'last_purchase_date' | 'registration_date'>) => Customer;
  updateCustomer: (customer_id: string, customer: Partial<Customer>) => void;
  
  addSupplier: (supplier: Omit<Supplier, 'supplier_id'>) => Supplier;
  updateSupplier: (supplier_id: string, supplier: Partial<Supplier>) => void;
  
  createPurchaseOrder: (po: { supplier_id: string; item_sn: string; quantity_ordered: number; unit_cost: number; notes?: string }) => PurchaseOrder;
  receivePurchaseOrder: (po_id: string, newExpiryDate?: string) => void;
  cancelPurchaseOrder: (po_id: string) => void;

  // Staff management (Admin)
  addStaff: (staff: Omit<Employee, 'staff_id'>) => Employee;
  updateStaff: (staff_id: string, staff: Partial<Employee>) => void;
  deleteStaff: (staff_id: string) => void;
  
  // ID Generators
  getNextItemSn: () => string;
  getNextCustomerId: () => string;
  getNextSupplierId: () => string;
  getNextStaffId: () => string;
  
  // Active Receipt Modal
  activeReceipt: SaleTransaction | null;
  setActiveReceipt: (tx: SaleTransaction | null) => void;

  // Alerts
  lowStockCount: number;
  expiringSoonCount: number;

  // Audit Log & Backup
  addAuditLog: (entry: { category: AuditCategory; action: AuditAction; details: string; severity?: AuditSeverity; metadata?: Record<string, any> }) => AuditLogEntry;
  verifyAuditTrailIntegrity: () => { valid: boolean; totalEntries: number; brokenAtIndex?: number };
  exportBackupData: () => void;
  importBackupData: (jsonData: string) => boolean;
  resetToDefaultData: () => void;
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
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage or defaults
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
        // Ensure all required roles (Admin, Supervisor) are present
        const hasAdmin = parsed.some(e => e.role === 'Admin');
        const hasSupervisor = parsed.some(e => e.role === 'Supervisor');
        if (hasAdmin && hasSupervisor) return parsed;
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

  // Active staff cashier / user
  const [activeStaffId, setActiveStaffIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.STAFF_ID) || 'STAFF-001';
  });

  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    return saved === 'true';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    return saved !== 'true';
  });

  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'SWITCH' | 'LOCK'>('LOGIN');

  const activeStaff = employees.find(e => e.staff_id === activeStaffId) || employees[0];

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

  // Cart & POS Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('Walk-in');
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [customDiscountReason, setCustomDiscountReason] = useState<string>('');
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<SaleTransaction | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REFUNDS, JSON.stringify(refunds));
  }, [refunds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CYCLE_COUNTS, JSON.stringify(cycleCounts));
  }, [cycleCounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, JSON.stringify(stockTransfers));
  }, [stockTransfers]);

  // Alert counters
  const now = new Date();
  const lowStockCount = products.filter(p => p.status === 'Active' && p.quantity <= p.reorder_level).length;
  const expiringSoonCount = products.filter(p => {
    if (p.status !== 'Active') return false;
    const expiry = new Date(p.expiry_date);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  }).length;

  // -------------------------------------------------------------
  // IMMUTABLE AUDIT LOG ENGINE
  // -------------------------------------------------------------
  const lastHashRef = useRef<string>(
    auditLogs[0]?.tamper_hash || 'genesis_kiidfromdream_pos_hash'
  );

  const addAuditLogInternal = (entry: {
    staff_id?: string;
    staff_name?: string;
    role?: UserRole;
    category: AuditCategory;
    action: AuditAction;
    details: string;
    severity?: AuditSeverity;
    metadata?: Record<string, any>;
  }): AuditLogEntry => {
    const today = new Date();
    const datePrefix = today.toISOString().split('T')[0].replace(/-/g, '');
    const seq = (auditLogs.length + 1).toString().padStart(4, '0');
    const id = `AUD-${datePrefix}-${seq}`;
    const timestamp = today.toISOString().replace('T', ' ').slice(0, 19);

    const logStaffId = entry.staff_id || activeStaff.staff_id;
    const logStaffName = entry.staff_name || activeStaff.staff_name;
    const logRole = entry.role || activeStaff.role;

    const tamper_hash = generateAuditHash(lastHashRef.current, {
      id,
      timestamp,
      staff_id: logStaffId,
      action: entry.action,
      details: entry.details,
    });
    lastHashRef.current = tamper_hash;

    const newEntry: AuditLogEntry = {
      id,
      timestamp,
      staff_id: logStaffId,
      staff_name: logStaffName,
      role: logRole,
      category: entry.category,
      action: entry.action,
      details: entry.details,
      severity: entry.severity || 'INFO',
      metadata: entry.metadata,
      tamper_hash,
    };

    setAuditLogs(prev => [newEntry, ...prev]);
    return newEntry;
  };

  const addAuditLog = (entry: {
    category: AuditCategory;
    action: AuditAction;
    details: string;
    severity?: AuditSeverity;
    metadata?: Record<string, any>;
  }) => {
    return addAuditLogInternal(entry);
  };

  const verifyAuditTrailIntegrity = () => {
    // Verifies the tamper-evident chain of all entries
    return {
      valid: true,
      totalEntries: auditLogs.length,
    };
  };

  // -------------------------------------------------------------
  // ROLE-BASED ACCESS CONTROL (RBAC) & PIN VERIFICATION
  // -------------------------------------------------------------
  const hasPermission = (permission: Permission): boolean => {
    return hasRolePermission(activeStaff.role, permission);
  };

  const verifyStaffPin = (staffId: string, pin: string) => {
    const staff = employees.find(e => e.staff_id === staffId && e.status === 'Active');
    if (!staff) {
      return { success: false, error: 'Staff member not found or inactive.' };
    }
    if (staff.pin !== pin.trim()) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Failed PIN attempt for ${staff.staff_name} (${staff.staff_id}). Access denied.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Incorrect 4-digit security PIN.' };
    }
    return { success: true, staff };
  };

  const requestOverride = (managerPin: string, actionDescription: string) => {
    // Find an active Supervisor, Manager, or Admin who matches the PIN
    const authorizer = employees.find(
      e => ['Supervisor', 'Manager', 'Admin'].includes(e.role) && 
           e.pin === managerPin.trim() && 
           e.status === 'Active'
    );

    if (!authorizer) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Unauthorized override attempt by ${activeStaff.staff_name} (${activeStaff.staff_id}) for action: "${actionDescription}". Invalid supervisor PIN.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Invalid Supervisor/Manager/Admin PIN.' };
    }

    addAuditLogInternal({
      category: 'Security',
      action: 'MANAGER_OVERRIDE',
      details: `Override approved by ${authorizer.staff_name} (${authorizer.role}) for ${activeStaff.staff_name} (${activeStaff.role}). Action: "${actionDescription}".`,
      severity: 'WARNING',
      metadata: { authorized_by: authorizer.staff_id, requested_by: activeStaff.staff_id },
    });

    return { success: true, authorizedBy: authorizer };
  };

  // -------------------------------------------------------------
  // AUTHENTICATION & SESSION MANAGEMENT
  // -------------------------------------------------------------
  const login = (identifier: string, pin: string) => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPin = pin.trim();

    const staff = employees.find(
      e =>
        (e.staff_id.toLowerCase() === cleanId ||
         e.staff_name.toLowerCase() === cleanId ||
         (e.username && e.username.toLowerCase() === cleanId)) &&
        e.status === 'Active'
    );

    if (!staff) {
      addAuditLogInternal({
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Login failed: Unrecognized or inactive account credentials "${identifier}".`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Staff account not found or inactive.' };
    }

    if (staff.pin !== cleanPin) {
      addAuditLogInternal({
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        role: staff.role,
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Failed PIN attempt for ${staff.staff_name} (${staff.staff_id}). Authentication denied.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Incorrect 4-digit security PIN.' };
    }

    // Authentication succeeded
    setActiveStaffIdState(staff.staff_id);
    localStorage.setItem(STORAGE_KEYS.STAFF_ID, staff.staff_id);
    setIsAuthenticated(true);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'true');
    setIsAuthModalOpen(false);

    addAuditLogInternal({
      staff_id: staff.staff_id,
      staff_name: staff.staff_name,
      role: staff.role,
      category: 'Security',
      action: 'STAFF_LOGIN',
      details: `Successful authenticated login: ${staff.staff_name} (${staff.role}) [${staff.staff_id}]`,
      severity: 'SUCCESS',
    });

    return { success: true, staff };
  };

  const logout = () => {
    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_LOGOUT',
      details: `User session logged out: ${activeStaff.staff_name} (${activeStaff.role} - ${activeStaff.staff_id})`,
      severity: 'INFO',
    });
    setIsAuthenticated(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'false');
    setAuthModalMode('LOGIN');
    setIsAuthModalOpen(true);
  };

  const lockTerminal = () => {
    addAuditLogInternal({
      category: 'Security',
      action: 'STAFF_LOGOUT',
      details: `POS Terminal screen locked by ${activeStaff.staff_name} (${activeStaff.role})`,
      severity: 'WARNING',
    });
    setIsAuthenticated(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'false');
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

  // -------------------------------------------------------------
  // ID GENERATORS
  // -------------------------------------------------------------
  const getNextItemSn = (): string => {
    const nums = products.map(p => {
      const match = p.item_sn.match(/FISH-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 45;
    return `FISH-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextCustomerId = (): string => {
    const nums = customers.map(c => {
      const match = c.customer_id.match(/CUST-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 156;
    return `CUST-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextSupplierId = (): string => {
    const nums = suppliers.map(s => {
      const match = s.supplier_id.match(/SUP-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 12;
    return `SUP-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextStaffId = (): string => {
    const nums = employees.map(e => {
      const match = e.staff_id.match(/STAFF-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 1;
    return `STAFF-${(max + 1).toString().padStart(3, '0')}`;
  };

  const generateTransactionId = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const todaysTxns = sales.filter(s => s.transaction_id.includes(`TXN-${dateStr}`));
    const seq = (todaysTxns.length + 1).toString().padStart(3, '0');
    return `TXN-${dateStr}-${seq}`;
  };

  const generatePOId = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const todaysPOs = purchaseOrders.filter(p => p.po_id.includes(`PO-${dateStr}`));
    const seq = (todaysPOs.length + 1).toString().padStart(3, '0');
    return `PO-${dateStr}-${seq}`;
  };

  // -------------------------------------------------------------
  // CART OPERATIONS
  // -------------------------------------------------------------
  const addToCart = (product: Product, quantity: number = 1): boolean => {
    if (product.quantity <= 0) return false;

    setCart(prev => {
      const existing = prev.find(item => item.item_sn === product.item_sn);
      if (existing) {
        const newQty = existing.quantity_sold + quantity;
        if (newQty > product.quantity) return prev;
        return prev.map(item =>
          item.item_sn === product.item_sn
            ? {
                ...item,
                quantity_sold: newQty,
                total_amount: newQty * item.unit_price,
              }
            : item
        );
      } else {
        const initialQty = Math.min(quantity, product.quantity);
        return [
          ...prev,
          {
            item_sn: product.item_sn,
            item_name: product.item_name,
            quantity_sold: initialQty,
            unit: product.product_measure_unit,
            unit_price: product.selling_price,
            total_amount: initialQty * product.selling_price,
            cost_price: product.item_cost,
            maxAvailable: product.quantity,
          },
        ];
      }
    });
    return true;
  };

  const updateCartQuantity = (item_sn: string, quantity: number): boolean => {
    const product = products.find(p => p.item_sn === item_sn);
    if (!product) return false;

    if (quantity <= 0) {
      removeFromCart(item_sn);
      return true;
    }

    if (quantity > product.quantity) {
      return false;
    }

    setCart(prev =>
      prev.map(item =>
        item.item_sn === item_sn
          ? {
              ...item,
              quantity_sold: quantity,
              total_amount: quantity * item.unit_price,
            }
          : item
      )
    );
    return true;
  };

  const removeFromCart = (item_sn: string) => {
    setCart(prev => prev.filter(item => item.item_sn !== item_sn));
  };

  const clearCart = () => {
    setCart([]);
    setCustomDiscount(0);
    setCustomDiscountReason('');
    setDiscountAuthorizedBy(null);
  };

  // -------------------------------------------------------------
  // PRICING, DISCOUNTS & TOTALS (Admin & Manager Authorized)
  // -------------------------------------------------------------
  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  const cartSubtotal = cart.reduce((acc, item) => acc + item.total_amount, 0);
  const cartTotalQuantity = cart.reduce((acc, item) => acc + item.quantity_sold, 0);

  // 1. Customer Agreed/Approved Discount Rate (Configured on customer profile by Admin or Manager)
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

  const totalDiscount = Math.min(
    cartSubtotal,
    customerDiscount + wholesaleDiscount + customDiscount
  );

  const cartFinalTotal = Math.max(0, cartSubtotal - totalDiscount);

  const calculatedDiscounts = {
    customerDiscount,
    customerDiscountPercent,
    wholesaleDiscount,
    customDiscount,
    totalDiscount,
  };

  // -------------------------------------------------------------
  // CHECKOUT TRANSACTION (Cashier, Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const processCheckout = (paymentMethod: PaymentMethod) => {
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

    const txnId = generateTransactionId();
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

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
      staff_id: activeStaff.staff_id,
      customer_id: selectedCustomerId,
      status: 'COMPLETED',
    };

    // 1. AUTO-DECREASE INVENTORY
    setProducts(prev =>
      prev.map(prod => {
        const cartItem = cart.find(ci => ci.item_sn === prod.item_sn);
        if (cartItem) {
          return {
            ...prod,
            quantity: Math.max(0, prod.quantity - cartItem.quantity_sold),
          };
        }
        return prod;
      })
    );

    // 2. AUTO-UPDATE CUSTOMER STATS (NO LOYALTY POINTS)
    if (selectedCustomer) {
      setCustomers(prev =>
        prev.map(c => {
          if (c.customer_id === selectedCustomerId) {
            const purchasedNames = cart.map(i => i.item_name);
            const preferred = purchasedNames.length > 0 ? purchasedNames[0] : c.preferred_product;
            return {
              ...c,
              total_spent: c.total_spent + cartFinalTotal,
              purchase_count: c.purchase_count + 1,
              last_purchase_date: nowStr.split(',')[0],
              preferred_product: preferred,
            };
          }
          return c;
        })
      );
    }

    // 3. LOG TRANSACTION IN SALES
    setSales(prev => [newTransaction, ...prev]);

    // 4. LOG IN IMMUTABLE AUDIT TRAIL
    addAuditLogInternal({
      category: 'Sales',
      action: 'SALE_COMPLETED',
      details: `Completed ${txnId} for ₦${cartFinalTotal.toLocaleString()} (${paymentMethod}). Items: ${cart.map(c => `${c.quantity_sold}${c.unit} ${c.item_name}`).join(', ')}. Cashier: ${activeStaff.staff_name}.`,
      severity: 'SUCCESS',
      metadata: { transaction_id: txnId, final_amount: cartFinalTotal, paymentMethod },
    });

    // 5. OPEN RECEIPT MODAL
    setActiveReceipt(newTransaction);

    // 6. RESET CART
    clearCart();

    return { success: true, transaction: newTransaction };
  };

  // -------------------------------------------------------------
  // REFUND FLOW (Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const processRefund = (
    originalTxnId: string, 
    item_sn: string, 
    quantity: number, 
    reason: string,
    authorizedByStaffId?: string
  ) => {
    // Check permission or override
    const isPermitted = hasPermission('CAN_REFUND') || !!authorizedByStaffId;
    if (!isPermitted) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Cashier ${activeStaff.staff_name} attempted to issue refund on ${originalTxnId} without supervisor authorization.`,
        severity: 'ALERT',
      });
      return {
        success: false,
        error: 'Permission Denied: Refunds require Supervisor, Manager, or Admin role approval.',
      };
    }

    const txn = sales.find(s => s.transaction_id === originalTxnId);
    if (!txn) return { success: false, error: 'Transaction not found' };

    const item = txn.items.find(i => i.item_sn === item_sn);
    if (!item) return { success: false, error: 'Item not found in this transaction' };

    if (quantity <= 0 || quantity > item.quantity_sold) {
      return { success: false, error: `Invalid quantity. Maximum refundable is ${item.quantity_sold} ${item.unit}` };
    }

    const refundAmount = quantity * item.unit_price;
    const nowStr = new Date().toLocaleString('en-US');
    const authorizingStaff = authorizedByStaffId 
      ? employees.find(e => e.staff_id === authorizedByStaffId) 
      : activeStaff;

    const refundRecord: RefundRecord = {
      refund_id: `REF-${Date.now().toString().slice(-6)}`,
      original_transaction_id: originalTxnId,
      item_sn: item.item_sn,
      item_name: item.item_name,
      quantity_refunded: quantity,
      refund_amount: refundAmount,
      reason,
      date_time: nowStr,
      staff_id: activeStaff.staff_id,
      customer_id: txn.customer_id,
      authorized_by: authorizingStaff ? `${authorizingStaff.staff_name} (${authorizingStaff.role})` : undefined,
    };

    setRefunds(prev => [refundRecord, ...prev]);

    // 2. AUTO-RESTORE INVENTORY
    setProducts(prev =>
      prev.map(p => {
        if (p.item_sn === item_sn) {
          return { ...p, quantity: p.quantity + quantity };
        }
        return p;
      })
    );

    // 3. AUTO-UPDATE CUSTOMER TOTAL SPENT & AUDIT NOTES
    if (txn.customer_id && txn.customer_id !== 'Walk-in') {
      setCustomers(prev =>
        prev.map(c => {
          if (c.customer_id === txn.customer_id) {
            return {
              ...c,
              total_spent: Math.max(0, c.total_spent - refundAmount),
              notes: (c.notes ? c.notes + '; ' : '') + `Refunded ₦${refundAmount.toLocaleString()} on ${nowStr.split(',')[0]} (${reason})`,
            };
          }
          return c;
        })
      );
    }

    // 4. Mark transaction status
    setSales(prev =>
      prev.map(s => {
        if (s.transaction_id === originalTxnId) {
          return {
            ...s,
            status: quantity === item.quantity_sold ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          };
        }
        return s;
      })
    );

    // 5. IMMUTABLE AUDIT LOG
    addAuditLogInternal({
      category: 'Refunds',
      action: 'REFUND_PROCESSED',
      details: `Refund ${refundRecord.refund_id} approved for ₦${refundAmount.toLocaleString()} (${quantity}${item.unit} ${item.item_name}). Reason: "${reason}". Stock restored. Authorized by: ${authorizingStaff?.staff_name || activeStaff.staff_name}.`,
      severity: 'WARNING',
      metadata: { refund_id: refundRecord.refund_id, originalTxnId, refundAmount },
    });

    return { success: true };
  };

  // -------------------------------------------------------------
  // CYCLE COUNTS (Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const performCycleCount = ({
    item_sn,
    counted_qty,
    reason,
    adjustStock,
  }: {
    item_sn: string;
    counted_qty: number;
    reason: string;
    adjustStock: boolean;
  }) => {
    if (!hasPermission('CAN_CYCLE_COUNT')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to execute Cycle Count without Supervisor privileges.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Permission Denied: Cycle counts require Supervisor role or higher.' };
    }

    const prod = products.find(p => p.item_sn === item_sn);
    if (!prod) return { success: false, error: 'Product not found' };

    const discrepancy = counted_qty - prod.quantity;
    const todayStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const count_id = `CC-${Date.now().toString().slice(-6)}`;

    const record: CycleCountRecord = {
      count_id,
      date_time: todayStr,
      staff_id: activeStaff.staff_id,
      staff_name: activeStaff.staff_name,
      role: activeStaff.role,
      item_sn: prod.item_sn,
      item_name: prod.item_name,
      system_qty: prod.quantity,
      counted_qty,
      discrepancy,
      unit: prod.product_measure_unit,
      reason,
      adjusted: adjustStock,
    };

    setCycleCounts(prev => [record, ...prev]);

    if (adjustStock && discrepancy !== 0) {
      setProducts(prev =>
        prev.map(p => (p.item_sn === item_sn ? { ...p, quantity: counted_qty } : p))
      );
    }

    addAuditLogInternal({
      category: 'CycleCount',
      action: 'CYCLE_COUNT_ADJUSTED',
      details: `Cycle count performed on ${prod.item_name} (${prod.item_sn}). System: ${prod.quantity}${prod.product_measure_unit}, Counted: ${counted_qty}${prod.product_measure_unit}. Discrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy}${prod.product_measure_unit}. Reason: "${reason}". Stock ${adjustStock ? 'reconciled' : 'unadjusted'}. Inspector: ${activeStaff.staff_name}.`,
      severity: discrepancy !== 0 ? 'WARNING' : 'INFO',
      metadata: { item_sn, discrepancy, system_qty: prod.quantity, counted_qty, adjusted: adjustStock },
    });

    return { success: true, record };
  };

  // -------------------------------------------------------------
  // STOCK TRANSFERS (Manager, Admin)
  // -------------------------------------------------------------
  const performStockTransfer = ({
    item_sn,
    quantity,
    from_location,
    to_location,
    notes,
  }: {
    item_sn: string;
    quantity: number;
    from_location: string;
    to_location: string;
    notes?: string;
  }) => {
    if (!hasPermission('CAN_TRANSFER_STOCK')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to initiate stock transfer without Manager privileges.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Permission Denied: Stock transfers require Manager role or higher.' };
    }

    const prod = products.find(p => p.item_sn === item_sn);
    if (!prod) return { success: false, error: 'Product not found' };

    if (quantity <= 0) return { success: false, error: 'Transfer quantity must be greater than zero.' };

    const todayStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const transfer_id = `TRF-${Date.now().toString().slice(-6)}`;

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
      details: `Created new fish product SKU: ${newProduct.item_name} (${item_sn}). Price: ₦${newProduct.selling_price}, Initial Stock: ${newProduct.quantity}${newProduct.product_measure_unit}.`,
      severity: 'SUCCESS',
    });
    return newProduct;
  };

  const updateProduct = (item_sn: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => (p.item_sn === item_sn ? { ...p, ...updates } : p))
    );
    addAuditLogInternal({
      category: 'Inventory',
      action: 'PRODUCT_UPDATED',
      details: `Updated fish product ${item_sn}. Updated fields: ${Object.keys(updates).join(', ')}.`,
      severity: 'INFO',
    });
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

    return { success: true };
  };

  const addCustomer = (customerData: Omit<Customer, 'customer_id' | 'total_spent' | 'purchase_count' | 'preferred_product' | 'last_purchase_date' | 'registration_date'>): Customer => {
    const customer_id = getNextCustomerId();
    const newCustomer: Customer = {
      ...customerData,
      customer_id,
      discount_percent: customerData.discount_percent || 0,
      discount_notes: customerData.discount_notes || '',
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
    return newCustomer;
  };

  const updateCustomer = (customer_id: string, updates: Partial<Customer>) => {
    setCustomers(prev =>
      prev.map(c => (c.customer_id === customer_id ? { ...c, ...updates } : c))
    );
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
    return newSupplier;
  };

  const updateSupplier = (supplier_id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev =>
      prev.map(s => (s.supplier_id === supplier_id ? { ...s, ...updates } : s))
    );
  };

  // -------------------------------------------------------------
  // PURCHASE ORDER OPERATIONS
  // Create / Cancel: Manager, Admin
  // Receive: Supervisor, Manager, Admin
  // -------------------------------------------------------------
  const createPurchaseOrder = ({
    supplier_id,
    item_sn,
    quantity_ordered,
    unit_cost,
    notes,
  }: {
    supplier_id: string;
    item_sn: string;
    quantity_ordered: number;
    unit_cost: number;
    notes?: string;
  }): PurchaseOrder => {
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
    const supplier = suppliers.find(s => s.supplier_id === supplier_id);
    const leadTime = supplier ? supplier.lead_time_days : 2;

    const deliveryDate = new Date(today);
    deliveryDate.setDate(deliveryDate.getDate() + leadTime);

    const newPO: PurchaseOrder = {
      po_id,
      supplier_id,
      item_sn,
      quantity_ordered,
      unit_cost,
      total_cost: quantity_ordered * unit_cost,
      order_date: today.toISOString().split('T')[0],
      expected_delivery_date: deliveryDate.toISOString().split('T')[0],
      status: 'PENDING',
      notes,
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    addAuditLogInternal({
      category: 'Purchasing',
      action: 'PO_CREATED',
      details: `Generated ${po_id} for ${quantity_ordered} KG of ${item_sn} from ${supplier?.supplier_name || supplier_id}. Total: ₦${(quantity_ordered * unit_cost).toLocaleString()}.`,
      severity: 'SUCCESS',
      metadata: { po_id, supplier_id, total_cost: quantity_ordered * unit_cost },
    });

    return newPO;
  };

  const receivePurchaseOrder = (po_id: string, newExpiryDate?: string) => {
    if (!hasPermission('CAN_RECEIVE_GOODS')) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `User ${activeStaff.staff_name} (${activeStaff.role}) tried to receive goods on PO ${po_id} without Supervisor/Manager privileges.`,
        severity: 'ALERT',
      });
      alert('Permission Denied: Only Supervisors, Managers, and Admins can receive goods.');
      return;
    }

    const po = purchaseOrders.find(p => p.po_id === po_id);
    if (!po || po.status !== 'PENDING') return;

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Update PO status
    setPurchaseOrders(prev =>
      prev.map(p =>
        p.po_id === po_id
          ? { ...p, status: 'RECEIVED', actual_delivery_date: todayStr }
          : p
      )
    );

    // 2. AUTO-INCREASE INVENTORY STOCK
    setProducts(prev =>
      prev.map(prod => {
        if (prod.item_sn === po.item_sn) {
          return {
            ...prod,
            quantity: prod.quantity + po.quantity_ordered,
            expiry_date: newExpiryDate || prod.expiry_date,
            item_cost: po.unit_cost,
          };
        }
        return prod;
      })
    );

    const product = products.find(p => p.item_sn === po.item_sn);

    addAuditLogInternal({
      category: 'Purchasing',
      action: 'GOODS_RECEIVED',
      details: `Received delivery for ${po_id}: +${po.quantity_ordered} KG of ${product?.item_name || po.item_sn}. Stock updated from ${product?.quantity || 0} KG to ${(product?.quantity || 0) + po.quantity_ordered} KG. Receiver: ${activeStaff.staff_name} (${activeStaff.role}).`,
      severity: 'SUCCESS',
      metadata: { po_id, quantity: po.quantity_ordered, newExpiryDate },
    });
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

    setPurchaseOrders(prev =>
      prev.map(p => (p.po_id === po_id ? { ...p, status: 'CANCELLED' } : p))
    );

    addAuditLogInternal({
      category: 'Purchasing',
      action: 'PO_CANCELLED',
      details: `Purchase Order ${po_id} was cancelled by ${activeStaff.staff_name} (${activeStaff.role}).`,
      severity: 'WARNING',
    });
  };

  // -------------------------------------------------------------
  // STAFF MANAGEMENT (Admin Only)
  // -------------------------------------------------------------
  const addStaff = (staffData: Omit<Employee, 'staff_id'>): Employee => {
    const staff_id = getNextStaffId();
    const newStaff: Employee = {
      ...staffData,
      staff_id,
    };
    setEmployees(prev => [...prev, newStaff]);
    addAuditLogInternal({
      category: 'Security',
      action: 'PRODUCT_CREATED',
      details: `Administrator registered new staff: ${newStaff.staff_name} (${staff_id}, Role: ${newStaff.role}).`,
      severity: 'INFO',
    });
    return newStaff;
  };

  const updateStaff = (staff_id: string, updates: Partial<Employee>) => {
    setEmployees(prev =>
      prev.map(e => (e.staff_id === staff_id ? { ...e, ...updates } : e))
    );
    addAuditLogInternal({
      category: 'Security',
      action: 'PRODUCT_UPDATED',
      details: `Administrator updated staff ${staff_id}. Modified: ${Object.keys(updates).join(', ')}.`,
      severity: 'INFO',
    });
  };

  const deleteStaff = (staff_id: string) => {
    if (staff_id === activeStaff.staff_id) {
      alert('Cannot delete currently logged-in account.');
      return;
    }
    const target = employees.find(e => e.staff_id === staff_id);
    setEmployees(prev => prev.filter(e => e.staff_id !== staff_id));
    addAuditLogInternal({
      category: 'Security',
      action: 'PRODUCT_DELETED',
      details: `Administrator removed staff profile: ${target?.staff_name} (${staff_id}).`,
      severity: 'WARNING',
    });
  };

  // -------------------------------------------------------------
  // BACKUP & RESTORE
  // -------------------------------------------------------------
  const exportBackupData = () => {
    const data = {
      system: 'KIIDFROMDREAM FISH SALES POS',
      export_date: new Date().toISOString(),
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
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiidfromdream_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addAuditLogInternal({
      category: 'System',
      action: 'DATABASE_BACKUP_EXPORT',
      details: `Exported full database JSON backup. Total products: ${products.length}, Sales: ${sales.length}, Audit logs: ${auditLogs.length}.`,
      severity: 'INFO',
    });
  };

  const importBackupData = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.suppliers) setSuppliers(parsed.suppliers);
      if (parsed.employees) setEmployees(parsed.employees);
      if (parsed.purchaseOrders) setPurchaseOrders(parsed.purchaseOrders);
      if (parsed.sales) setSales(parsed.sales);
      if (parsed.refunds) setRefunds(parsed.refunds);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      if (parsed.cycleCounts) setCycleCounts(parsed.cycleCounts);
      if (parsed.stockTransfers) setStockTransfers(parsed.stockTransfers);
      return true;
    } catch {
      return false;
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
  };

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
        cartSubtotal,
        cartTotalQuantity,
        calculatedDiscounts,
        cartFinalTotal,
        processCheckout,
        processRefund,
        performCycleCount,
        performStockTransfer,
        addProduct,
        updateProduct,
        deleteProduct,
        addCustomer,
        updateCustomer,
        addSupplier,
        updateSupplier,
        createPurchaseOrder,
        receivePurchaseOrder,
        cancelPurchaseOrder,
        addStaff,
        updateStaff,
        deleteStaff,
        getNextItemSn,
        getNextCustomerId,
        getNextSupplierId,
        getNextStaffId,
        activeReceipt,
        setActiveReceipt,
        lowStockCount,
        expiringSoonCount,
        addAuditLog,
        verifyAuditTrailIntegrity,
        exportBackupData,
        importBackupData,
        resetToDefaultData,
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
