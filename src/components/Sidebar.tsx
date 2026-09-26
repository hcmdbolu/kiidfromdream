import React from 'react';
import { usePos } from '../context/PosContext';
import { 
  Fish, 
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
  PauseCircle,
  X,
  PanelLeftClose,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Banknote,
  CreditCard,
  Wallet
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
    openLoginModal,
    lockTerminal,
    logout,
    exportBackupData,
    syncStatus,
    serverVersion,
    lastSyncTime,
    forceSync
  } = usePos();

  const roleBadge = ROLE_BADGES[activeStaff.role] || ROLE_BADGES.Cashier;

  // Complete catalog of system modules organized by dashboard section:
  // Strict role permissions enforced:
  // - Cashier: POS sales, sales history, customer records
  // - Supervisor: + Inventory stock, receiving goods & purchase orders
  // - Manager: + Executive Reports & P&L, Audit Trail, Cash Reconciliation & POS Setup
  // - Admin: Complete control + Staff Admin
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
          label: 'Inventory & Cold Room', 
          icon: Package, 
          badge: lowStockCount > 0 ? `${lowStockCount} low` : null, 
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          allowed: activeStaff.role !== 'Cashier',
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
          id: 'reconciliation', 
          label: 'Cash Drawer & Bank Transfer', 
          icon: Banknote, 
          badge: cashTransfers.length > 0 ? `${cashTransfers.length} dep` : null,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          allowed: ['Manager', 'Admin'].includes(activeStaff.role),
        },
        { 
          id: 'pos_setup', 
          label: 'POS & Bank Account Setup', 
          icon: CreditCard, 
          badge: `${posTerminals.length} mapped`,
          badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
          allowed: ['Manager', 'Admin'].includes(activeStaff.role),
        },
        { 
          id: 'reports', 
          label: 'Executive Reports & P&L', 
          icon: BarChart3, 
          badge: null,
          allowed: ['Manager', 'Admin'].includes(activeStaff.role),
        },
        { 
          id: 'audit', 
          label: 'Audit Trail Ledger', 
          icon: ShieldAlert,
          badge: auditLogs.filter(l => l.severity === 'ALERT').length || null,
          badgeColor: 'bg-rose-500 text-white',
          allowed: ['Manager', 'Admin'].includes(activeStaff.role),
        },
        { 
          id: 'staff', 
          label: 'Staff & Roles Admin', 
          icon: Users,
          badge: `${employees.length} staff`,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          allowed: activeStaff.role === 'Admin',
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
          fixed inset-y-0 left-0 z-40 bg-[#0f172a] border-r border-slate-800/80 text-slate-300 flex flex-col justify-between transition-all duration-300 ease-in-out select-none
          ${mobileMenuOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full w-72'}
          ${isHidden 
            ? 'md:-translate-x-full md:w-0 md:border-r-0 md:opacity-0 md:pointer-events-none md:overflow-hidden' 
            : 'md:translate-x-0 md:static md:h-screen md:shrink-0 md:w-72 md:opacity-100'
          }
        `}
      >
        {/* Top Header & Branding */}
        <div className="flex flex-col min-h-0">
          
          {/* Brand Row */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div 
              onClick={() => handleSelectTab('pos')}
              className="flex items-center space-x-3 cursor-pointer group select-none min-w-0"
              title="Return to POS Terminal"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Fish className="w-6 h-6 stroke-[2.5]" />
              </div>
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
            </div>

            {/* Collapse/Hide Button (Desktop) & Close (Mobile) */}
            <div className="flex items-center space-x-1 shrink-0 ml-1">
              {onToggleHide && (
                <button
                  type="button"
                  onClick={onToggleHide}
                  className="hidden md:flex text-slate-400 hover:text-white p-1.5 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                  title="Collapse Sidebar (Shortcut: [ or Ctrl+B)"
                >
                  <PanelLeftClose className="w-4 h-4" />
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
          <div className="p-3 border-b border-slate-800/60 bg-slate-950/40">
            <div className="bg-slate-800/50 hover:bg-slate-800/70 rounded-xl p-2.5 border border-slate-700/60 flex items-center justify-between transition-colors">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-emerald-400">
                    {activeStaff.staff_name.split(' ').map(n => n[0]).join('')}
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
          </div>

          {/* Scrollable Navigation Area */}
          <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-thin scrollbar-thumb-slate-800">
            
            {/* Held Orders High-Priority Alert Banner (when orders are held) */}
            {parkedOrders.length > 0 && (
              <div 
                onClick={() => {
                  if (onOpenParkedOrders) onOpenParkedOrders();
                  else handleSelectTab('pos');
                }}
                className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 border border-amber-500/30 text-amber-300 transition-all cursor-pointer shadow-xs"
                title="View and resume parked walk-in customer orders"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="text-xs font-bold text-amber-200">Held Walk-in Orders</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-[10px]">
                    {parkedOrders.length}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-amber-300/80">
                  <span>Customers waiting in queue</span>
                  <span className="text-[10px] font-bold text-amber-400 hover:underline flex items-center">
                    Resume <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}

            {/* Grouped Navigation Sections (Strictly Role-Filtered) */}
            {navSections.map((section, idx) => {
              const visibleItems = section.items.filter(item => item.allowed);
              if (visibleItems.length === 0) return null;

              return (
                <div key={idx} className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between">
                    <span>{section.title}</span>
                  </div>

                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive 
                              ? 'text-emerald-400' 
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`} />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge !== null && item.badge !== undefined && (
                          <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full shrink-0 ${item.badgeColor || 'bg-emerald-500 text-white'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Quick Operations & Tools Section */}
            <div className="pt-2 border-t border-slate-800/60 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between">
                <span>Operations & Tools</span>
              </div>

              <div className="space-y-1">
                {/* Cycle Count Button (Supervisor, Manager, Admin) */}
                {['Supervisor', 'Manager', 'Admin'].includes(activeStaff.role) && (
                  <button
                    type="button"
                    onClick={onOpenCycleCount}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-amber-300 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-700/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <ClipboardCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="truncate">Cycle Count Audit</span>
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-amber-400/80 font-mono">Stock</span>
                  </button>
                )}

                {/* Stock Transfer Button (Manager, Admin) */}
                {['Manager', 'Admin'].includes(activeStaff.role) && (
                  <button
                    type="button"
                    onClick={onOpenStockTransfer}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-purple-300 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-700/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="truncate">Transfer Stock</span>
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-purple-400/80 font-mono">Move</span>
                  </button>
                )}

                {/* Staff Management (Admin only) */}
                {activeStaff.role === 'Admin' && (
                  <button
                    type="button"
                    onClick={() => handleSelectTab('staff')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-700/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Settings className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="truncate">Staff & Roles Admin</span>
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-emerald-400/80 font-mono">Admin</span>
                  </button>
                )}

                {/* Quick Cash-to-Bank Transfer - Manager & Admin Only */}
                {['Manager', 'Admin'].includes(activeStaff.role) && (
                  <button
                    type="button"
                    onClick={() => handleSelectTab('reconciliation')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-700/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="truncate">Cash-to-Bank Transfer</span>
                    </div>
                    <span className="text-[10px] text-emerald-400/80 font-mono">Drawer</span>
                  </button>
                )}

                {/* Quick Refund / Return Button - Strictly Manager & Admin Only */}
                {(activeStaff.role === 'Manager' || activeStaff.role === 'Admin') && (
                  <button
                    type="button"
                    onClick={onOpenRefundModal}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-700/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="truncate">Process Return / Refund</span>
                    </div>
                    <span className="text-[10px] text-rose-400/80 font-mono">Mgr/Admin</span>
                  </button>
                )}

                {/* Database Backup Export - Strictly Admin Only */}
                {activeStaff.role === 'Admin' && (
                  <button
                    type="button"
                    onClick={exportBackupData}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0" />
                      <span className="truncate">Export JSON Backup</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Admin</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Footer Section: DB Status & Sign Out Dock */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          
          {/* Central Database Sync Card */}
          <div 
            className="flex items-center justify-between bg-slate-800/60 hover:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/60 text-xs transition-colors"
            title={`Centralized Multi-Terminal Server. Status: ${syncStatus}. Version: ${serverVersion}. Last sync: ${lastSyncTime}`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              </span>
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-white text-[11px] truncate leading-tight">
                  {syncStatus === 'synced' ? 'Central Database' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  {syncStatus === 'synced' ? `v${serverVersion} • Live` : 'Connecting...'}
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => forceSync()}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Force Sync With Central Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Lock Screen & Sign Out Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={lockTerminal}
              className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-slate-800/80 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 border border-slate-700/60 hover:border-amber-700/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Lock Terminal Screen"
            >
              <LockKeyhole className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/60 hover:border-rose-700/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Sign out of POS session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Quick Collapse Footer Bar (Desktop) */}
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className="hidden md:flex w-full items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Collapse Side Panel to expand counter workspace"
            >
              <div className="flex items-center space-x-1.5">
                <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
                <span>Collapse Sidebar</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">[</span>
            </button>
          )}

        </div>
      </aside>
    </>
  );
};
