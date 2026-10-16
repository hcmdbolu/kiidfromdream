import React from 'react';
import { usePos } from '../context/PosContext';
import { 
  Store, 
  ShoppingCart, 
  Package, 
  Users, 
  Truck, 
  BarChart3, 
  RotateCcw, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  LockKeyhole, 
  Database, 
  RefreshCw, 
  KeyRound, 
  ClipboardCheck, 
  ArrowLeftRight, 
  Download,
  Trash2,
  Flame,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Banknote,
  CreditCard,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { ROLE_BADGES } from '../utils/rbac';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenRefundModal: () => void;
  onOpenCycleCount: () => void;
  onOpenStockTransfer: () => void;
  onOpenStaffAdmin: () => void;
  onOpenParkedOrders?: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenRefundModal,
  onOpenCycleCount,
  onOpenStockTransfer,
  onOpenStaffAdmin,
  onOpenParkedOrders,
  isHidden = false,
  onToggleHide,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { 
    employees,
    activeStaff, 
    cartTotalQuantity, 
    lowStockCount, 
    auditLogs,
    parkedOrders,
    posTerminals,
    cashTransfers,
    cycleCounts,
    openLoginModal,
    lockTerminal,
    logout,
    openBackupModal,
    exportBackupData,
    openFactoryResetModal,
    openMigrationModal,
    syncStatus,
    serverVersion,
    lastSyncTime,
    forceSync
  } = usePos();

  const roleBadge = ROLE_BADGES[activeStaff.role] || ROLE_BADGES.Cashier;
  const isSuperAdmin = activeStaff.role === 'Super Admin';
  const isAdminOrSuper = activeStaff.role === 'Admin' || isSuperAdmin;
  const isManagerOrAbove = ['Manager', 'Admin', 'Super Admin'].includes(activeStaff.role);

  // Complete catalog of system modules organized by dashboard section:
  // Strict role permissions enforced:
  // - Cashier: POS sales, sales history
  // - Supervisor: + Inventory stock, receiving goods & purchase orders, cycle counts
  // - Manager: + Executive Reports & P&L, Audit Trail, Cash Reconciliation & POS Setup
  // - Admin: + Staff Admin & System Backup
  // - Super Admin: Full Root control & Exclusive Factory Data Reset
  const navSections = [
    {
      title: 'Counter & Sales',
      items: [
        { 
          id: 'pos', 
          label: 'POS Terminal', 
          icon: ShoppingCart, 
          badge: cartTotalQuantity > 0 ? cartTotalQuantity : null,
          badgeColor: 'bg-emerald-500 text-white',
          allowed: true,
        },
        { 
          id: 'sales', 
          label: 'Sales & Void Log', 
          icon: RotateCcw,
          badge: null,
          allowed: true,
        },
      ],
    },
    {
      title: 'Inventory & Operations',
      items: [
        { 
          id: 'inventory', 
          label: 'Inventory', 
          icon: Package, 
          badge: lowStockCount > 0 ? `${lowStockCount} low` : null, 
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          allowed: activeStaff.role !== 'Cashier',
        },
        { 
          id: 'cycle_count', 
          label: 'Cycle Count Audit', 
          icon: ClipboardCheck, 
          badge: (cycleCounts || []).length > 0 ? `${(cycleCounts || []).length}` : null, 
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          allowed: ['Supervisor', 'Manager', 'Admin', 'Super Admin'].includes(activeStaff.role),
        },
        { 
          id: 'customers', 
          label: 'Customer Accounts', 
          icon: Users,
          badge: null,
          allowed: activeStaff.role !== 'Cashier',
        },
        { 
          id: 'suppliers', 
          label: 'Suppliers & PO', 
          icon: Truck,
          badge: null,
          allowed: activeStaff.role !== 'Cashier',
        },
      ],
    },
    {
      title: 'Treasury & Intelligence',
      items: [
        { 
          id: 'treasury', 
          label: 'Cash Drawer & Treasury', 
          icon: Banknote, 
          badge: cashTransfers.length > 0 ? `${cashTransfers.length} xfers` : `${posTerminals.length} mapped`,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          allowed: isManagerOrAbove,
        },
        { 
          id: 'receipt_settings', 
          label: 'Receipt & Branding', 
          icon: Printer, 
          badge: null,
          allowed: isManagerOrAbove,
        },
        { 
          id: 'reports', 
          label: 'Executive Reports & P&L', 
          icon: BarChart3, 
          badge: null,
          allowed: isManagerOrAbove,
        },
        { 
          id: 'audit', 
          label: 'Audit Trail Ledger', 
          icon: ShieldAlert,
          badge: auditLogs.filter(l => l.severity === 'ALERT').length || null,
          badgeColor: 'bg-rose-500 text-white',
          allowed: isManagerOrAbove,
        },
        { 
          id: 'staff', 
          label: 'Staff & Roles Admin', 
          icon: Users,
          badge: `${employees.length} staff`,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          allowed: isAdminOrSuper,
        },
      ],
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-35 md:hidden backdrop-blur-xs transition-opacity animate-fadeIn"
        />
      )}

      {/* Main Side Panel */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 bg-[#0f172a] border-r border-slate-800/80 text-slate-300 flex flex-col h-screen shrink-0 select-none overflow-hidden transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full'}
          ${isHidden 
            ? 'md:translate-x-0 md:static md:w-20 md:shrink-0' 
            : 'md:translate-x-0 md:static md:w-72 md:shrink-0'
          }
        `}
      >
        {/* ========================================================================= */}
        {/* TOP PINNED SECTION: Branding & Active Operator (shrink-0)                 */}
        {/* ========================================================================= */}
        <div className="shrink-0 flex flex-col border-b border-slate-800/80 bg-slate-950/50">
          
          {/* Brand Row */}
          <div className={`p-3.5 flex items-center ${isHidden ? 'justify-center' : 'justify-between'}`}>
            <div 
              onClick={() => handleSelectTab('pos')}
              className={`flex items-center space-x-3 cursor-pointer group select-none min-w-0 ${isHidden ? 'justify-center' : ''}`}
              title="KIIDFROMDREAM POS"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Store className="w-6 h-6 stroke-[2.5]" />
              </div>
              {!isHidden && (
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-black tracking-tight text-white font-mono truncate">
                      KIIDFROMDREAM
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] uppercase font-bold tracking-wider rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      POS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate flex items-center space-x-1 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Counter & Inventory OS</span>
                  </p>
                </div>
              )}
            </div>

            {/* Collapse/Expand Toggle Button (Desktop) & Close (Mobile) */}
            <div className="flex items-center space-x-1 shrink-0">
              {onToggleHide && (
                <button
                  type="button"
                  onClick={onToggleHide}
                  className="hidden md:flex text-slate-400 hover:text-white p-1.5 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                  title={isHidden ? "Expand Sidebar (Shortcut: [ or Ctrl+B)" : "Collapse Sidebar (Shortcut: [ or Ctrl+B)"}
                >
                  {isHidden ? <PanelLeftOpen className="w-4 h-4 text-emerald-400" /> : <PanelLeftClose className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
                className="md:hidden text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close Navigation Drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Operator Status Card */}
          <div className={`p-2.5 bg-slate-950/40 border-t border-slate-800/40 ${isHidden ? 'flex justify-center' : ''}`}>
            {isHidden ? (
              <div 
                onClick={() => openLoginModal('SWITCH')}
                className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-700/60 cursor-pointer transition-all relative group"
                title={`Active Operator: ${activeStaff.staff_name} (${activeStaff.role}) - Click to Switch`}
              >
                {activeStaff.staff_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
              </div>
            ) : (
              <div className="bg-slate-800/50 hover:bg-slate-800/70 rounded-xl p-2.5 border border-slate-700/60 flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-emerald-400">
                      {activeStaff.staff_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-white text-xs truncate leading-snug">
                      {activeStaff.staff_name}
                    </div>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
                        {roleBadge.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeStaff.staff_id}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openLoginModal('SWITCH')}
                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Switch Active Operator"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MIDDLE INDEPENDENTLY SCROLLABLE SECTION: Navigation Modules               */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto min-h-0 pos-sidebar-scroll p-3 space-y-4">
          
          {/* Held Orders High-Priority Alert Banner (when orders are held) */}
          {parkedOrders.length > 0 && (
            <div 
              onClick={() => {
                if (onOpenParkedOrders) onOpenParkedOrders();
                else handleSelectTab('pos');
              }}
              className={`rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 border border-amber-500/30 text-amber-300 transition-all cursor-pointer shadow-xs ${
                isHidden ? 'p-2 flex flex-col items-center text-center' : 'p-2.5'
              }`}
              title="View and resume parked customer orders"
            >
              <div className={`flex items-center ${isHidden ? 'justify-center' : 'justify-between'}`}>
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  {!isHidden && <span className="text-xs font-bold text-amber-200">Held Orders</span>}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-[10px]">
                  {parkedOrders.length}
                </span>
              </div>
              {!isHidden && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-amber-300/80">
                  <span>Waiting in queue</span>
                  <span className="text-[10px] font-bold text-amber-400 hover:underline flex items-center">
                    Resume <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Grouped Navigation Sections (Strictly Role-Filtered) */}
          {navSections.map((section, idx) => {
            const visibleItems = section.items.filter(item => item.allowed);
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                {!isHidden ? (
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between">
                    <span>{section.title}</span>
                  </div>
                ) : (
                  <div className="my-1 border-t border-slate-800/40" />
                )}

                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id || (item.id === 'treasury' && (currentTab === 'reconciliation' || currentTab === 'pos_setup'));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center ${
                        isHidden ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                      } rounded-xl text-xs transition-all cursor-pointer group relative ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                      }`}
                      title={isHidden ? item.label : undefined}
                    >
                      <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-3 min-w-0'}`}>
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive 
                            ? 'text-emerald-400' 
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`} />
                        {!isHidden && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isHidden && item.badge !== null && item.badge !== undefined && (
                        <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full shrink-0 ${item.badgeColor || 'bg-emerald-500 text-white'}`}>
                          {item.badge}
                        </span>
                      )}

                      {isHidden && item.badge !== null && item.badge !== undefined && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Quick Operations & Tools Section */}
          <div className="pt-2 border-t border-slate-800/60 space-y-1">
            {!isHidden ? (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between">
                <span>Operations & Tools</span>
              </div>
            ) : (
              <div className="my-1 border-t border-slate-800/40" />
            )}

            <div className="space-y-1">
              {/* Cycle Count Button (Supervisor, Manager, Admin, Super Admin) */}
              {['Supervisor', 'Manager', 'Admin', 'Super Admin'].includes(activeStaff.role) && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('cycle_count')}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-slate-300 hover:text-amber-300 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-700/50 transition-all cursor-pointer group`}
                  title="Cycle Count Audit"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <ClipboardCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Cycle Count Audit</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-slate-500 group-hover:text-amber-400/80 font-mono">Stock</span>}
                </button>
              )}

              {/* Stock Transfer Button (Manager, Admin, Super Admin) */}
              {isManagerOrAbove && (
                <button
                  type="button"
                  onClick={onOpenStockTransfer}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-slate-300 hover:text-purple-300 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-700/50 transition-all cursor-pointer group`}
                  title="Transfer Stock"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Transfer Stock</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-slate-500 group-hover:text-purple-400/80 font-mono">Move</span>}
                </button>
              )}

              {/* Staff Management (Admin and Super Admin only) */}
              {isAdminOrSuper && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('staff')}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-700/50 transition-all cursor-pointer group`}
                  title="Staff & Roles Admin"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <Settings className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Staff & Roles Admin</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-slate-500 group-hover:text-emerald-400/80 font-mono">Admin</span>}
                </button>
              )}

              {/* Quick Cash-to-Bank Transfer / Treasury - Manager, Admin & Super Admin */}
              {isManagerOrAbove && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('treasury')}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-700/50 transition-all cursor-pointer group`}
                  title="Cash Drawer & Treasury / Bank Management"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <Banknote className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Cash & Bank Treasury</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-emerald-400/80 font-mono">Treasury</span>}
                </button>
              )}

              {/* Quick Refund / Return Button - Manager, Admin & Super Admin */}
              {isManagerOrAbove && (
                <button
                  type="button"
                  onClick={onOpenRefundModal}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-700/50 transition-all cursor-pointer group`}
                  title="Process Return / Refund"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Process Return / Refund</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-rose-400/80 font-mono">Mgr/Admin</span>}
                </button>
              )}

              {/* Database Backup & Restore - Accessible to All Staff Members */}
              <button
                type="button"
                onClick={openBackupModal}
                className={`w-full flex items-center ${
                  isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                } rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-all cursor-pointer group`}
                title="Backup & Restore Data (Accessible to all staff)"
              >
                <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                  <Database className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0" />
                  {!isHidden && <span className="truncate">Backup & Restore Data</span>}
                </div>
                {!isHidden && <span className="text-[10px] text-indigo-400/80 font-mono">All Staff</span>}
              </button>

              {/* Legacy Data Migration / Third-Party Import - Manager & Admin */}
              {isManagerOrAbove && (
                <button
                  type="button"
                  onClick={openMigrationModal}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-700/50 transition-all cursor-pointer group`}
                  title="Legacy Data Migration & Third-Party Sales Import"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                    {!isHidden && <span className="truncate">Data Migration / Import</span>}
                  </div>
                  {!isHidden && <span className="text-[10px] text-indigo-400/80 font-mono">Legacy</span>}
                </button>
              )}

              {/* Factory Data Reset - STRICTLY SUPER ADMIN ONLY */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={openFactoryResetModal}
                  className={`w-full flex items-center ${
                    isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-950 hover:border-rose-800/80 transition-all cursor-pointer group`}
                  title="Factory Data Reset - Wipe all transactional data for clean production (Super Admin Only)"
                >
                  <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                    <Flame className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform shrink-0 animate-pulse" />
                    {!isHidden && <span className="truncate font-semibold">Factory Data Reset</span>}
                  </div>
                  {!isHidden && (
                    <span className="text-[10px] text-rose-400 bg-rose-950/70 border border-rose-800/60 px-1.5 py-0.5 rounded font-mono font-bold">
                      Root
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM PINNED SECTION: DB Status, Screen Lock, Sign Out (shrink-0)        */}
        {/* ========================================================================= */}
        <div className="shrink-0 p-3 border-t border-slate-800/80 bg-slate-950/70 space-y-2">
          
          {/* Central Database Sync Card */}
          <div 
            className={`flex items-center ${
              isHidden ? 'justify-center p-2' : 'justify-between px-3 py-2'
            } bg-slate-800/60 hover:bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs transition-colors`}
            title={`Central Database. Status: ${syncStatus}. Version: ${serverVersion}. Last sync: ${lastSyncTime}`}
          >
            <div className={`flex items-center ${isHidden ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              </span>
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
              {!isHidden && (
                <div className="truncate">
                  <div className="font-semibold text-white text-[11px] truncate leading-tight">
                    {syncStatus === 'synced' ? 'Central Database' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    {syncStatus === 'synced' ? `v${serverVersion} • Live` : 'Connecting...'}
                  </div>
                </div>
              )}
            </div>
            
            {!isHidden && (
              <button
                type="button"
                onClick={() => forceSync()}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Force Sync With Central Server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
          </div>

          {/* Lock Screen & Sign Out Buttons */}
          <div className={isHidden ? 'flex flex-col space-y-1.5' : 'grid grid-cols-2 gap-2'}>
            <button
              type="button"
              onClick={lockTerminal}
              className={`flex items-center justify-center ${
                isHidden ? 'p-2' : 'space-x-1.5 py-2 px-2.5'
              } bg-slate-800/80 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 border border-slate-700/60 hover:border-amber-700/50 rounded-xl text-xs font-semibold transition-all cursor-pointer`}
              title="Lock Terminal Screen"
            >
              <LockKeyhole className="w-3.5 h-3.5 shrink-0" />
              {!isHidden && <span>Lock</span>}
            </button>

            <button
              type="button"
              onClick={logout}
              className={`flex items-center justify-center ${
                isHidden ? 'p-2' : 'space-x-1.5 py-2 px-2.5'
              } bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/60 hover:border-rose-700/50 rounded-xl text-xs font-semibold transition-all cursor-pointer`}
              title="Sign out of POS session"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!isHidden && <span>Sign Out</span>}
            </button>
          </div>

          {/* Quick Collapse / Expand Footer Bar (Desktop) */}
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`hidden md:flex w-full items-center ${
                isHidden ? 'justify-center p-2' : 'justify-between px-3 py-1.5'
              } rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer`}
              title={isHidden ? "Expand Sidebar (Hotkey: [ or Ctrl+B)" : "Collapse Sidebar (Hotkey: [ or Ctrl+B)"}
            >
              <div className="flex items-center space-x-1.5">
                {isHidden ? (
                  <PanelLeftOpen className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
                    <span>Collapse Sidebar</span>
                  </>
                )}
              </div>
              {!isHidden && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">[</span>
              )}
            </button>
          )}

        </div>
      </aside>
    </>
  );
};
