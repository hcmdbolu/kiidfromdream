import React, { useState } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { Header } from './components/Header';
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
import { RoleRestrictedCard } from './components/common/RoleRestrictedCard';
import { SaleTransaction } from './types';

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
  
  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<SaleTransaction | null>(null);

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
    setSelectedTxForRefund(tx);
    setIsRefundModalOpen(true);
  };

  // Role permissions evaluation for tab access
  const isCashier = activeStaff.role === 'Cashier';
  const isSupervisor = activeStaff.role === 'Supervisor';

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenRefundModal={() => {
          setSelectedTxForRefund(null);
          setIsRefundModalOpen(true);
        }}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-12">
        {currentTab === 'pos' && (
          <PosTerminal
            onOpenCustomerModal={() => setCurrentTab('customers')}
          />
        )}

        {currentTab === 'inventory' && (
          isCashier ? (
            <RoleRestrictedCard
              moduleName="Inventory & Stock Management"
              minRoleRequired="Supervisor, Manager or Admin"
              description="Cashiers are designated for POS sales only. Modifying product catalog, adjusting stock levels, and performing cycle counts require a Supervisor, Manager, or Admin."
              onBackToPos={() => setCurrentTab('pos')}
            />
          ) : (
            <InventoryManager
              onQuickOrderPO={handleQuickReorder}
            />
          )
        )}

        {currentTab === 'sales' && (
          <SalesHistoryManager
            onViewReceipt={(tx) => setActiveReceipt(tx)}
            onOpenRefundForTx={handleOpenRefundForTx}
          />
        )}

        {currentTab === 'customers' && (
          <CustomerManager
            onSelectCustomerForSale={handleSelectCustomerForSale}
          />
        )}

        {currentTab === 'suppliers' && (
          isCashier ? (
            <RoleRestrictedCard
              moduleName="Suppliers & Purchase Orders"
              minRoleRequired="Supervisor, Manager or Admin"
              description="Cashiers are restricted from supplier records and purchase orders. A minimum Supervisor role is required to verify shipments or receive goods into stock."
              onBackToPos={() => setCurrentTab('pos')}
            />
          ) : (
            <SupplierAndPOManager
              initialTab={prefilledPo.itemSn ? 'orders' : 'orders'}
              prefilledSupplierId={prefilledPo.supplierId}
              prefilledItemSn={prefilledPo.itemSn}
            />
          )
        )}

        {currentTab === 'reports' && (
          (isCashier || isSupervisor) ? (
            <RoleRestrictedCard
              moduleName="Executive Financial & P&L Reports"
              minRoleRequired="Manager or Admin"
              description="Confidential profit-and-loss accounts, margin analysis, and business analytics are strictly restricted to Store Managers and System Administrators."
              onBackToPos={() => setCurrentTab('pos')}
            />
          ) : (
            <ReportingDashboard
              onQuickReorder={handleQuickReorder}
            />
          )
        )}

        {currentTab === 'audit' && (
          (isCashier || isSupervisor) ? (
            <RoleRestrictedCard
              moduleName="Cryptographic Audit Trail Ledger"
              minRoleRequired="Manager or Admin"
              description="Immutable SHA-256 tamper-evident system logs, override logs, and security event histories are restricted to Store Managers and Administrators."
              onBackToPos={() => setCurrentTab('pos')}
            />
          ) : (
            <AuditLogManager />
          )
        )}
      </main>

      {/* Login Authentication Modal */}
      <LoginAuthModal
        isOpen={!isAuthenticated || isAuthModalOpen}
        onClose={closeLoginModal}
        mode={authModalMode}
      />

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
