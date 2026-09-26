import React, { useState, useEffect } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { Sidebar } from './components/Sidebar';
import { AppHeader } from './components/AppHeader';
import { PosTerminal } from './components/pos/PosTerminal';
import { InventoryManager } from './components/inventory/InventoryManager';
import { SalesHistoryManager } from './components/sales/SalesHistoryManager';
import { CustomerManager } from './components/customers/CustomerManager';
import { SupplierAndPOManager } from './components/suppliers/SupplierAndPOManager';
import { ReportingDashboard } from './components/reports/ReportingDashboard';
import { AuditLogManager } from './components/security/AuditLogManager';
import { ReceiptModal } from './components/receipt/ReceiptModal';
import { RefundModal } from './components/refund/RefundModal';
import { LoginAuthModal } from './components/auth/LoginAuthModal';
import { StaffManagerModal } from './components/admin/StaffManagerModal';
import { StaffAndRolesManager } from './components/admin/StaffAndRolesManager';
import { CashReconciliationManager } from './components/finance/CashReconciliationManager';
import { PosTerminalSetupManager } from './components/pos/PosTerminalSetupManager';
import { CycleCountModal } from './components/inventory/CycleCountModal';
import { StockTransferModal } from './components/inventory/StockTransferModal';
import { SaleTransaction, UserRole } from './types';
import { PanelLeftOpen } from 'lucide-react';

function MainApp() {
  const { 
    activeStaff,
    activeReceipt, 
    setActiveReceipt,
    setSelectedCustomerId,
    isAuthenticated,
    isAuthModalOpen,
    authModalMode,
    closeLoginModal,
  } = usePos();

  const [currentTab, setCurrentTab] = useState<string>('pos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Persistent side panel hidden state
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kiidfromdream_sidebar_hidden_v1');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kiidfromdream_sidebar_hidden_v1', String(sidebarHidden));
    } catch {}
  }, [sidebarHidden]);

  // Keyboard shortcut: [ or Ctrl+B to toggle side panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarHidden(prev => !prev);
      }
      if (e.key === '[') {
        e.preventDefault();
        setSidebarHidden(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileMenuOpen(prev => !prev);
    } else {
      setSidebarHidden(prev => !prev);
    }
  };

  // Modals
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<SaleTransaction | null>(null);
  const [isCycleCountOpen, setIsCycleCountOpen] = useState(false);
  const [isStockTransferOpen, setIsStockTransferOpen] = useState(false);
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState(false);

  // Cross-navigation states
  const [prefilledPo, setPrefilledPo] = useState<{ supplierId?: string; itemSn?: string }>({});

  const handleQuickReorder = (supplierId: string, itemSn: string) => {
    setPrefilledPo({ supplierId, itemSn });
    setCurrentTab('suppliers');
  };

  const handleSelectCustomerForSale = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentTab('pos');
  };

  const handleOpenRefundForTx = (tx: SaleTransaction) => {
    if (activeStaff.role !== 'Manager' && activeStaff.role !== 'Admin') {
      return;
    }
    setSelectedTxForRefund(tx);
    setIsRefundModalOpen(true);
  };

  // STRICT ACCESS REDIRECTION:
  // "and all module other user can not access should not show at all for the user"
  // If the user's role does not allow the currentTab, immediately redirect to 'pos'
  useEffect(() => {
    const role = activeStaff.role;
    const restrictedTabsForRole: Record<UserRole, string[]> = {
      Cashier: ['inventory', 'suppliers', 'reports', 'audit', 'staff', 'reconciliation', 'pos_setup', 'customers'],
      Supervisor: ['reports', 'audit', 'staff', 'reconciliation', 'pos_setup'],
      Manager: ['staff'],
      Admin: [],
    };
    if (restrictedTabsForRole[role]?.includes(currentTab)) {
      setCurrentTab('pos');
    }
  }, [activeStaff.role, currentTab]);

  const isCashier = activeStaff.role === 'Cashier';
  const isSupervisor = activeStaff.role === 'Supervisor';

  // When not authenticated, render ONLY the login page (no app shell, no background)
  if (!isAuthenticated) {
    return (
      <LoginAuthModal
        isOpen={true}
        onClose={closeLoginModal}
        mode="LOGIN"
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col md:flex-row font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Side Navigation Bar (By the Sides) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenRefundModal={() => {
          if (activeStaff.role === 'Manager' || activeStaff.role === 'Admin') {
            setSelectedTxForRefund(null);
            setIsRefundModalOpen(true);
          }
        }}
        onOpenCycleCount={() => setIsCycleCountOpen(true)}
        onOpenStockTransfer={() => setIsStockTransferOpen(true)}
        onOpenStaffAdmin={() => setIsStaffManagerOpen(true)}
        onOpenParkedOrders={() => setCurrentTab('pos')}
        isHidden={sidebarHidden}
        onToggleHide={() => {
          if (window.innerWidth < 768) {
            setMobileMenuOpen(false);
          } else {
            setSidebarHidden(true);
          }
        }}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* App Header */}
        <AppHeader
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Main Tab Content */}
        <main className="flex-1 pb-12">
          {currentTab === 'pos' && (
            <PosTerminal
              onOpenCustomerModal={() => setCurrentTab('customers')}
            />
          )}

          {currentTab === 'inventory' && !isCashier && (
            <InventoryManager
              onQuickOrderPO={handleQuickReorder}
            />
          )}

          {currentTab === 'sales' && (
            <SalesHistoryManager
              onViewReceipt={(tx) => setActiveReceipt(tx)}
              onOpenRefundForTx={handleOpenRefundForTx}
            />
          )}

          {currentTab === 'customers' && !isCashier && (
            <CustomerManager
              onSelectCustomerForSale={handleSelectCustomerForSale}
            />
          )}

          {currentTab === 'suppliers' && !isCashier && (
            <SupplierAndPOManager
              initialTab={prefilledPo.itemSn ? 'orders' : 'orders'}
              prefilledSupplierId={prefilledPo.supplierId}
              prefilledItemSn={prefilledPo.itemSn}
            />
          )}

          {currentTab === 'reports' && !isCashier && !isSupervisor && (
            <ReportingDashboard
              onQuickReorder={handleQuickReorder}
            />
          )}

          {currentTab === 'audit' && !isCashier && !isSupervisor && (
            <AuditLogManager />
          )}

          {currentTab === 'reconciliation' && !isCashier && !isSupervisor && (
            <CashReconciliationManager onOpenPosSetup={() => setCurrentTab('pos_setup')} />
          )}

          {currentTab === 'pos_setup' && !isCashier && !isSupervisor && (
            <PosTerminalSetupManager />
          )}

          {currentTab === 'staff' && !isCashier && !isSupervisor && activeStaff.role === 'Admin' && (
            <StaffAndRolesManager />
          )}
        </main>
      </div>

      {/* Floating Re-Open Side Panel Pill when Hidden (Desktop) */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebarHidden(false)}
          className="hidden md:flex fixed bottom-5 left-5 z-40 bg-slate-900/90 hover:bg-slate-950 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-md items-center space-x-2 transition-all hover:scale-105 cursor-pointer animate-fadeIn"
          title="Show Navigation Side Panel (Hotkey: [ or Ctrl+B)"
        >
          <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
          <span>Show Side Panel</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">[</span>
        </button>
      )}

      {/* Login Authentication Modal (for Operator Switch or Screen Lock) */}
      {isAuthModalOpen && (
        <LoginAuthModal
          isOpen={isAuthModalOpen}
          onClose={closeLoginModal}
          mode={authModalMode}
        />
      )}

      {/* Thermal Receipt Modal (Auto-triggered after checkout or viewed from sales) */}
      {activeReceipt && (
        <ReceiptModal
          transaction={activeReceipt}
          onClose={() => {
            setActiveReceipt(null);
          }}
        />
      )}

      {/* Refund / Returns Processing Modal */}
      {isRefundModalOpen && (
        <RefundModal
          initialTransaction={selectedTxForRefund}
          onClose={() => {
            setIsRefundModalOpen(false);
            setSelectedTxForRefund(null);
          }}
        />
      )}

      {/* Cycle Count Modal (Supervisor, Manager, Admin) */}
      <CycleCountModal
        isOpen={isCycleCountOpen}
        onClose={() => setIsCycleCountOpen(false)}
      />

      {/* Stock Transfer Modal (Manager, Admin) */}
      <StockTransferModal
        isOpen={isStockTransferOpen}
        onClose={() => setIsStockTransferOpen(false)}
      />

      {/* Staff & Role Admin Modal (Admin) */}
      <StaffManagerModal
        isOpen={isStaffManagerOpen}
        onClose={() => setIsStaffManagerOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <PosProvider>
      <MainApp />
    </PosProvider>
  );
}
