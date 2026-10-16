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
import { FactoryResetModal } from './components/admin/FactoryResetModal';
import { BackupRestoreModal } from './components/admin/BackupRestoreModal';
import { LegacyDataMigrationModal } from './components/admin/LegacyDataMigrationModal';
import { CashReconciliationManager } from './components/finance/CashReconciliationManager';
import { PosTerminalSetupManager } from './components/pos/PosTerminalSetupManager';
import { CashDrawerTreasuryManager } from './components/finance/CashDrawerTreasuryManager';
import { CycleCountModal } from './components/inventory/CycleCountModal';
import { CycleCountManager } from './components/inventory/CycleCountManager';
import { StockTransferModal } from './components/inventory/StockTransferModal';
import { ReceiptBrandingManager } from './components/admin/ReceiptBrandingManager';
import { SaleTransaction, UserRole } from './types';
import { PanelLeftOpen } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';

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
    isBackupModalOpen,
    closeBackupModal,
    isFactoryResetModalOpen,
    closeFactoryResetModal,
  } = usePos();

  const [currentTab, setCurrentTab] = useState<string>('pos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shouldOpenHeldOrders, setShouldOpenHeldOrders] = useState(false);
  
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
      Cashier: ['inventory', 'suppliers', 'reports', 'audit', 'staff', 'treasury', 'reconciliation', 'pos_setup', 'customers', 'receipt_settings'],
      Supervisor: ['reports', 'audit', 'staff', 'treasury', 'reconciliation', 'pos_setup', 'receipt_settings'],
      Manager: ['staff'],
      Admin: [],
      'Super Admin': [],
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
    <div className="h-screen w-screen overflow-hidden bg-slate-100/70 text-slate-800 flex flex-col md:flex-row font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Side Navigation Bar (By the Sides) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenRefundModal={() => {
          if (['Manager', 'Admin', 'Super Admin'].includes(activeStaff.role)) {
            setSelectedTxForRefund(null);
            setIsRefundModalOpen(true);
          }
        }}
        onOpenCycleCount={() => setIsCycleCountOpen(true)}
        onOpenStockTransfer={() => setIsStockTransferOpen(true)}
        onOpenStaffAdmin={() => setIsStaffManagerOpen(true)}
        onOpenParkedOrders={() => {
          setCurrentTab('pos');
          setShouldOpenHeldOrders(true);
        }}
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
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300">
        {/* App Header */}
        <AppHeader
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Main Tab Content */}
        <main className="flex-1 overflow-y-auto min-h-0 pb-12">
          <ErrorBoundary
            fallbackTitle="View Display Error"
            fallbackMessage="An unexpected issue occurred while rendering this module. You can return to the POS register safely."
            onReset={() => setCurrentTab('pos')}
          >
            {currentTab === 'pos' && (
              <PosTerminal
                onOpenCustomerModal={() => setCurrentTab('customers')}
                openParkedOrdersDirectly={shouldOpenHeldOrders}
                onClearOpenParkedOrdersDirectly={() => setShouldOpenHeldOrders(false)}
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

            {(currentTab === 'treasury' || currentTab === 'reconciliation') && !isCashier && !isSupervisor && (
              <CashDrawerTreasuryManager initialTab="drawers" />
            )}

            {currentTab === 'pos_setup' && !isCashier && !isSupervisor && (
              <CashDrawerTreasuryManager initialTab="terminals_banks" />
            )}

            {currentTab === 'receipt_settings' && !isCashier && !isSupervisor && (
              <ReceiptBrandingManager />
            )}

            {currentTab === 'cycle_count' && !isCashier && (
              <CycleCountManager />
            )}

            {currentTab === 'staff' && !isCashier && !isSupervisor && (activeStaff.role === 'Admin' || activeStaff.role === 'Super Admin') && (
              <StaffAndRolesManager />
            )}
          </ErrorBoundary>
        </main>
      </div>

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
      <ErrorBoundary fallbackTitle="Cycle Count Error" fallbackMessage="Unable to render Cycle Count Modal.">
        <CycleCountModal
          isOpen={isCycleCountOpen}
          onClose={() => setIsCycleCountOpen(false)}
        />
      </ErrorBoundary>

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

      {/* Factory Data Reset Confirmation Modal (Admin Only) */}
      <FactoryResetModal
        isOpen={isFactoryResetModalOpen}
        onClose={closeFactoryResetModal}
      />

      {/* Accessible Data Backup & Restore Modal (All Staff) */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={closeBackupModal}
      />

      {/* Legacy Data Migration & Third-Party Import Module */}
      <LegacyDataMigrationModal />
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
