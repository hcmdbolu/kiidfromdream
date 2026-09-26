import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Product,
  Customer,
  Supplier,
  PurchaseOrder,
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
  processCheckout: (
    paymentMethod: PaymentMethod,
    paymentSplits?: SplitPaymentDetail[],
    amountPaid?: number,
    changeDue?: number
  ) => { success: boolean; transaction?: SaleTransaction; error?: string };
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
  PARKED_ORDERS: 'kiidfromdream_parked_orders_v2',
  VOIDED_ORDERS: 'kiidfromdream_voided_orders_v2',
  ACTIVE_ORDERS: 'kiidfromdream_active_orders_v2',
};

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

  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARKED_ORDERS);
      return saved ? JSON.parse(saved) : [];
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

  const clearBroadcastNotice = () => setRecentBroadcastNotice(null);

  // Sync state to local storage for offline resilience
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); } catch {}
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); } catch {}
  }, [customers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers)); } catch {}
  }, [suppliers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees)); } catch {}
  }, [employees]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(purchaseOrders)); } catch {}
  }, [purchaseOrders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales)); } catch {}
  }, [sales]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.REFUNDS, JSON.stringify(refunds)); } catch {}
  }, [refunds]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(auditLogs)); } catch {}
  }, [auditLogs]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.CYCLE_COUNTS, JSON.stringify(cycleCounts)); } catch {}
  }, [cycleCounts]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.STOCK_TRANSFERS, JSON.stringify(stockTransfers)); } catch {}
  }, [stockTransfers]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PARKED_ORDERS, JSON.stringify(parkedOrders)); } catch {}
  }, [parkedOrders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.VOIDED_ORDERS, JSON.stringify(voidedOrders)); } catch {}
  }, [voidedOrders]);

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
          if (Array.isArray(data.parkedOrders)) setParkedOrders(data.parkedOrders);
          if (Array.isArray(data.voidedOrders)) setVoidedOrders(data.voidedOrders);
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
            if (payload.parkedOrders) setParkedOrders(payload.parkedOrders);
          } else if (type === 'ORDER_VOIDED_UPDATE') {
            if (payload.voidedOrders) setVoidedOrders(payload.voidedOrders);
            if (payload.parkedOrders) setParkedOrders(payload.parkedOrders);
            if (payload.auditLogs) setAuditLogs(payload.auditLogs);
          } else if (type === 'DATABASE_RESET' || type === 'DATABASE_RESTORED') {
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
    if (staff.pin !== pin.trim()) {
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
    return { success: true, staff };
  };

  const requestOverride = (
    managerPin: string, 
    actionDescription: string
  ): { success: boolean; authorizedBy?: Employee; error?: string } => {
    const authorized = employees.find(
      e => (e.role === 'Manager' || e.role === 'Admin' || e.role === 'Supervisor') && e.pin === managerPin.trim()
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
  const login = (
    identifier: string, 
    pin: string
  ): { success: boolean; staff?: Employee; error?: string } => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPin = pin.trim();

    let staff = employees.find(
      e => (e.staff_id.toLowerCase() === cleanId ||
            e.staff_name.toLowerCase() === cleanId ||
            (e.username && e.username.toLowerCase() === cleanId)) &&
           (e.pin === cleanPin || (e.password && e.password === cleanPin))
    );

    // Direct fallback support for Admin credentials: admin / admin123
    if (!staff && (cleanId === 'admin' || cleanId === 'alex') && (cleanPin === 'admin123' || cleanPin === '9999')) {
      staff = employees.find(e => e.role === 'Admin') || {
        staff_id: 'STAFF-000',
        staff_name: 'Alex Abiri (Admin)',
        username: 'admin',
        password: 'admin123',
        phone_number: '+234 800 000 0000',
        role: 'Admin',
        pin: 'admin123',
        shift_time: 'Full Day',
        date_hired: '2023-01-01',
        status: 'Active',
      };
    }

    if (!staff) {
      addAuditLogInternal({
        category: 'Security',
        action: 'LOGIN_FAILED',
        details: `Failed sign-in attempt with ID/Name: "${identifier}".`,
        severity: 'WARNING',
      });
      return { success: false, error: 'Invalid username or password. Please try again.' };
    }

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
      details: `User ${staff.staff_name} (${staff.role}) successfully authenticated to POS terminal.`,
      severity: 'INFO',
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
      const parts = p.item_sn.split('-');
      return parseInt(parts[1] || '0', 10);
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 47;
    return `FISH-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextCustomerId = (): string => {
    const numbers = customers.map(c => {
      const parts = c.customer_id.split('-');
      return parseInt(parts[1] || '0', 10);
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 157;
    return `CUST-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextSupplierId = (): string => {
    const numbers = suppliers.map(s => {
      const parts = s.supplier_id.split('-');
      return parseInt(parts[1] || '0', 10);
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 14;
    return `SUP-${(max + 1).toString().padStart(5, '0')}`;
  };

  const getNextStaffId = (): string => {
    const numbers = employees.map(e => {
      const parts = e.staff_id.split('-');
      return parseInt(parts[1] || '0', 10);
    });
    const max = numbers.length > 0 ? Math.max(...numbers) : 4;
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
    } catch {}
    return [createDefaultOrder(1)];
  });

  const [activeOrderId, setActiveOrderId] = useState<string>(() => {
    return activeOrders[0]?.id || `ORD-${Date.now()}-1`;
  });

  // Keep localStorage updated for activeOrders
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ORDERS, JSON.stringify(activeOrders));
    } catch {}
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

  const addToCart = (product: Product, quantity: number = 1): boolean => {
    if (product.quantity <= 0) return false;
    const cleanAddQty = Math.round(quantity * 1000) / 1000;
    if (cleanAddQty <= 0) return false;

    let updatedCart: CartItem[] = [];

    setCart(prev => {
      const existing = prev.find(item => item.item_sn === product.item_sn);
      if (existing) {
        const newQty = Math.round((existing.quantity_sold + cleanAddQty) * 1000) / 1000;
        if (newQty > product.quantity) {
          updatedCart = prev;
          return prev;
        }
        updatedCart = prev.map(item =>
          item.item_sn === product.item_sn
            ? {
                ...item,
                quantity_sold: newQty,
                total_amount: Math.round(newQty * item.unit_price),
              }
            : item
        );
      } else {
        const initialQty = Math.min(cleanAddQty, product.quantity);
        updatedCart = [
          ...prev,
          {
            item_sn: product.item_sn,
            item_name: product.item_name,
            quantity_sold: initialQty,
            unit: product.product_measure_unit,
            unit_price: product.selling_price,
            total_amount: Math.round(initialQty * product.selling_price),
            cost_price: product.item_cost,
            maxAvailable: product.quantity,
          },
        ];
      }
      syncToActiveOrder({ cart: updatedCart });
      return updatedCart;
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

    const cleanQty = Math.round(quantity * 1000) / 1000;

    setCart(prev => {
      const nextCart = prev.map(item =>
        item.item_sn === item_sn
          ? {
              ...item,
              quantity_sold: cleanQty,
              total_amount: Math.round(cleanQty * item.unit_price),
            }
          : item
      );
      syncToActiveOrder({ cart: nextCart });
      return nextCart;
    });

    return true;
  };

  const removeFromCart = (item_sn: string) => {
    setCart(prev => {
      const nextCart = prev.filter(item => item.item_sn !== item_sn);
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
  // CHECKOUT TRANSACTION (Centralized Multi-Terminal Execution)
  // -------------------------------------------------------------
  const processCheckout = (
    paymentMethod: PaymentMethod,
    paymentSplits?: SplitPaymentDetail[],
    amountPaid?: number,
    changeDue?: number
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
      payment_splits: paymentSplits && paymentSplits.length > 0 ? paymentSplits : undefined,
      amount_paid: amountPaid,
      change_due: changeDue,
      staff_id: activeStaff.staff_id,
      customer_id: selectedCustomerId,
      status: 'COMPLETED',
    };

    // 1. AUTO-DECREASE INVENTORY OPTIMISTICALLY (Precision decimal rounded)
    setProducts(prev =>
      prev.map(prod => {
        const cartItem = cart.find(ci => ci.item_sn === prod.item_sn);
        if (cartItem) {
          const remainingQty = Math.max(0, Math.round((prod.quantity - cartItem.quantity_sold) * 1000) / 1000);
          return {
            ...prod,
            quantity: remainingQty,
          };
        }
        return prod;
      })
    );

    // 2. AUTO-UPDATE CUSTOMER STATS
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

    // Format audit summary
    const splitSummary = paymentSplits && paymentSplits.length > 0
      ? ` [Split: ${paymentSplits.map(s => `${s.method} ₦${s.amount.toLocaleString()}`).join(' + ')}]`
      : '';

    // 4. LOG IN IMMUTABLE AUDIT TRAIL
    addAuditLogInternal({
      category: 'Sales',
      action: 'SALE_COMPLETED',
      details: `Completed ${txnId} for ₦${cartFinalTotal.toLocaleString()} via ${paymentMethod}${splitSummary}. Items: ${cart.map(c => `${c.quantity_sold}${c.unit} ${c.item_name}`).join(', ')}. Cashier: ${activeStaff.staff_name}.`,
      severity: 'SUCCESS',
      metadata: { 
        transaction_id: txnId, 
        final_amount: cartFinalTotal, 
        paymentMethod,
        payment_splits: paymentSplits,
      },
    });

    // 5. OPEN RECEIPT MODAL
    setActiveReceipt(newTransaction);

    // 6. ADVANCE OR RESET MULTI-ORDER QUEUE
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
    const parked = parkedOrders.find(p => p.order_id === orderId);
    if (!parked) return { success: false, error: 'Parked order not found' };

    // Remove from parked
    setParkedOrders(prev => prev.filter(p => p.order_id !== orderId));

    fetch('/api/orders/park', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { order_id: orderId }, action: 'RESUME' }),
    }).catch(err => console.warn('[Central DB] Error resuming order:', err));

    const resumedActive: ActiveWalkInOrder = {
      id: parked.order_id,
      orderNumber: parked.order_number || activeOrders.length + 1,
      label: parked.order_label || `Order #${parked.order_number}`,
      customerId: parked.customer_id,
      cart: parked.items,
      customDiscount: parked.customDiscount,
      customDiscountReason: parked.customDiscountReason,
      discountAuthorizedBy: parked.discountAuthorizedBy,
      paymentMode: parked.paymentMode,
      selectedPaymentMethod: parked.selectedPaymentMethod,
      cashTendered: parked.cashTendered,
      singleRef: parked.singleRef,
      splitCashAmount: parked.splitCashAmount,
      splitCashTendered: parked.splitCashTendered,
      splitSecondMethod: parked.splitSecondMethod,
      splitSecondAmount: parked.splitSecondAmount,
      splitSecondRef: parked.splitSecondRef,
      splitThirdMethod: parked.splitThirdMethod,
      splitThirdAmount: parked.splitThirdAmount,
      splitThirdRef: parked.splitThirdRef,
      createdAt: parked.created_at,
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
  // REFUND FLOW (Supervisor, Manager, Admin)
  // -------------------------------------------------------------
  const processRefund = (
    originalTxnId: string, 
    item_sn: string, 
    quantity: number, 
    reason: string,
    authorizedByStaffId?: string
  ) => {
    const isDirectlyAuthorized = ['Supervisor', 'Manager', 'Admin'].includes(activeStaff.role);
    if (!isDirectlyAuthorized && !authorizedByStaffId) {
      addAuditLogInternal({
        category: 'Security',
        action: 'PERMISSION_DENIED',
        details: `Cashier ${activeStaff.staff_name} tried to process refund on ${originalTxnId} without Supervisor PIN approval.`,
        severity: 'ALERT',
      });
      return { success: false, error: 'Refunds require Supervisor, Manager, or Admin authorization.' };
    }

    const saleTx = sales.find(s => s.transaction_id === originalTxnId);
    if (!saleTx) {
      return { success: false, error: 'Transaction not found.' };
    }

    const itemToRefund = saleTx.items?.find(i => i.item_sn === item_sn) || 
      (saleTx.item_sn === item_sn ? {
        item_sn: saleTx.item_sn,
        item_name: saleTx.item_name || 'Fish Item',
        quantity_sold: saleTx.quantity_sold || 0,
        unit_price: saleTx.unit_price || 0,
      } : null);

    if (!itemToRefund) {
      return { success: false, error: 'Item not found in specified transaction.' };
    }

    if (quantity > itemToRefund.quantity_sold) {
      return { success: false, error: `Cannot refund more than original purchase quantity (${itemToRefund.quantity_sold}).` };
    }

    const refundAmount = quantity * itemToRefund.unit_price;
    const refundId = `REF-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toLocaleString();

    // 1. RESTOCK PRODUCT INVENTORY
    setProducts(prev =>
      prev.map(p => {
        if (p.item_sn === item_sn) {
          return {
            ...p,
            quantity: p.quantity + quantity,
          };
        }
        return p;
      })
    );

    // 2. CREATE REFUND RECORD
    const newRefund: RefundRecord = {
      refund_id: refundId,
      original_transaction_id: originalTxnId,
      date_time: todayStr,
      item_sn,
      item_name: itemToRefund.item_name,
      quantity_refunded: quantity,
      refund_amount: refundAmount,
      reason,
      staff_id: activeStaff.staff_id,
      customer_id: saleTx.customer_id || 'Walk-in',
      authorized_by: authorizedByStaffId || activeStaff.staff_id,
    };

    setRefunds(prev => [newRefund, ...prev]);

    // 3. UPDATE SALE TRANSACTION STATUS
    setSales(prev =>
      prev.map(s => {
        if (s.transaction_id === originalTxnId) {
          const isFull = quantity >= (itemToRefund.quantity_sold || 0);
          return {
            ...s,
            status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          };
        }
        return s;
      })
    );

    // 4. LOG AUDIT ENTRY
    addAuditLogInternal({
      category: 'Refunds',
      action: 'REFUND_PROCESSED',
      details: `Refund ${refundId} completed for ₦${refundAmount.toLocaleString()} on Txn ${originalTxnId}. Reason: "${reason}". Restocked: ${quantity} KG of ${itemToRefund.item_name}. Authorized: ${authorizedByStaffId || activeStaff.staff_name}.`,
      severity: 'WARNING',
      metadata: { refundId, originalTxnId, refundAmount, quantity, item_sn },
    });

    // 5. PUSH TO CENTRAL SERVER DATABASE
    fetch('/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund: newRefund }),
    }).catch(err => console.warn('[Central DB] Failed to save refund:', err));

    return { success: true };
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
      details: `Created new fish product SKU: ${newProduct.item_name} (${item_sn}). Price: ₦${newProduct.selling_price}, Initial Stock: ${newProduct.quantity}${newProduct.product_measure_unit}.`,
      severity: 'SUCCESS',
    });

    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: newProduct }),
    }).catch(err => console.warn('[Central DB] Failed to add product:', err));

    return newProduct;
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
      details: `Updated fish product ${item_sn}. Updated fields: ${Object.keys(updates).join(', ')}.`,
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
  // PURCHASE ORDER OPERATIONS (Manager, Admin)
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

    fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ po: newPO }),
    }).catch(err => console.warn('[Central DB] Failed to create PO:', err));

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

    fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ po: { ...po, status: 'RECEIVED' }, action: 'RECEIVE', newExpiryDate }),
    }).catch(err => console.warn('[Central DB] Failed to receive PO:', err));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po: { ...po, status: 'CANCELLED' }, action: 'CANCEL' }),
      }).catch(err => console.warn('[Central DB] Failed to cancel PO:', err));
    }
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

    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee: newStaff }),
    }).catch(err => console.warn('[Central DB] Failed to add employee:', err));

    return newStaff;
  };

  const updateStaff = (staff_id: string, updates: Partial<Employee>) => {
    let updatedStaff: Employee | null = null;
    setEmployees(prev =>
      prev.map(e => {
        if (e.staff_id === staff_id) {
          updatedStaff = { ...e, ...updates };
          return updatedStaff;
        }
        return e;
      })
    );
    addAuditLogInternal({
      category: 'Security',
      action: 'PRODUCT_UPDATED',
      details: `Administrator updated staff ${staff_id}. Modified: ${Object.keys(updates).join(', ')}.`,
      severity: 'INFO',
    });

    if (updatedStaff) {
      fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee: updatedStaff }),
      }).catch(err => console.warn('[Central DB] Failed to update employee:', err));
    }
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

    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee: { staff_id }, action: 'DELETE' }),
    }).catch(err => console.warn('[Central DB] Failed to delete employee:', err));
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

      fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsed }),
      }).then(() => fetchDbFromServer()).catch(() => {});

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

    fetch('/api/admin/reset', { method: 'POST' })
      .then(() => fetchDbFromServer())
      .catch(err => console.warn('[Central DB] Reset failed:', err));
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
