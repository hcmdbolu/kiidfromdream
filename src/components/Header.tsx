import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Fish, 
  ShoppingCart, 
  Package, 
  Users, 
  Truck, 
  FileText, 
  RotateCcw, 
  AlertTriangle, 
  Download, 
  Clock,
  Menu,
  X,
  Lock,
  Shield,
  KeyRound,
  ClipboardCheck,
  ArrowLeftRight,
  ShieldAlert,
  Settings,
  LogOut,
  LockKeyhole
} from 'lucide-react';
import { ROLE_BADGES } from '../utils/rbac';
import { PinAuthModal } from './security/PinAuthModal';
import { StaffManagerModal } from './admin/StaffManagerModal';
import { CycleCountModal } from './inventory/CycleCountModal';
import { StockTransferModal } from './inventory/StockTransferModal';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenRefundModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, onOpenRefundModal }) => {
  const { 
    activeStaff, 
    setActiveStaffId, 
    cartTotalQuantity, 
    lowStockCount, 
    expiringSoonCount,
    exportBackupData,
    hasPermission,
    auditLogs,
    openLoginModal,
    lockTerminal,
    logout
  } = usePos();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Security modals
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalContext, setPinModalContext] = useState<{ mode: 'SWITCH_USER' | 'OVERRIDE'; action?: string; targetTab?: string }>({ mode: 'SWITCH_USER' });
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState(false);
  const [isCycleCountOpen, setIsCycleCountOpen] = useState(false);
  const [isStockTransferOpen, setIsStockTransferOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const roleBadge = ROLE_BADGES[activeStaff.role] || ROLE_BADGES.Cashier;

  // Tabs with RBAC permission gates:
  // Cashier: POS sales only
  // Supervisor: Receive goods, cycle counts, refunds
  // Manager: Purchase orders, transfers, reports
  // Admin: Complete control
  // Audit Log: Immutable trail of all actions
  const navItems = [
    { 
      id: 'pos', 
      label: 'POS Terminal', 
      icon: ShoppingCart, 
      badge: cartTotalQuantity > 0 ? cartTotalQuantity : null,
      allowed: true // All roles can sell
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: Package, 
      badge: lowStockCount > 0 ? lowStockCount : null, 
      badgeColor: 'bg-amber-500',
      allowed: activeStaff.role !== 'Cashier',
      minRole: 'Supervisor'
    },
    { 
      id: 'sales', 
      label: 'Sales History', 
      icon: RotateCcw,
      allowed: true
    },
    { 
      id: 'customers', 
      label: 'Customers', 
      icon: Users,
      allowed: true
    },
    { 
      id: 'suppliers', 
      label: 'Suppliers & PO', 
      icon: Truck,
      allowed: activeStaff.role !== 'Cashier',
      minRole: 'Supervisor'
    },
    { 
      id: 'reports', 
      label: 'Reports & P&L', 
      icon: FileText,
      allowed: ['Manager', 'Admin'].includes(activeStaff.role),
      minRole: 'Manager'
    },
    { 
      id: 'audit', 
      label: 'Audit Trail', 
      icon: ShieldAlert,
      badge: auditLogs.filter(l => l.severity === 'ALERT').length || null,
      badgeColor: 'bg-rose-500',
      allowed: ['Manager', 'Admin'].includes(activeStaff.role),
      minRole: 'Manager'
    },
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    setCurrentTab(item.id);
  };

  return (
    <>
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        {/* Top Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('pos')}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
                <Fish className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-bold tracking-tight text-white font-mono">KIIDFROMDREAM</span>
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    POS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">Fish & Seafood Sales Management System</p>
              </div>
            </div>

            {/* Quick Stats & Alerts Bar */}
            <div className="hidden lg:flex items-center space-x-3 text-xs">
              {/* Live Clock */}
              <div className="flex items-center space-x-1.5 text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-md border border-slate-700/60 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentTime || '22 Sep 2026'}</span>
              </div>

              {/* Inventory Alerts Badge */}
              {(lowStockCount > 0 || expiringSoonCount > 0) && (
                <button 
                  onClick={() => setCurrentTab('inventory')}
                  className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2.5 py-1.5 rounded-md border border-amber-500/30 transition-colors"
                  title={`${lowStockCount} Low stock items, ${expiringSoonCount} expiring soon`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="font-semibold">{lowStockCount + expiringSoonCount} Alerts</span>
                </button>
              )}

              {/* Admin Staff Button */}
              {activeStaff.role === 'Admin' && (
                <button
                  onClick={() => setIsStaffManagerOpen(true)}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1.5 rounded-md border border-emerald-500/30 transition-colors"
                  title="Admin Staff & Role Management"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="font-bold">Staff Admin</span>
                </button>
              )}

              {/* Backup Export */}
              <button
                onClick={exportBackupData}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-md border border-slate-700 transition-colors"
                title="Download full database JSON backup"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Backup</span>
              </button>
            </div>

            {/* Active User & Role Identity Switcher */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => openLoginModal('SWITCH')}
                className="flex items-center space-x-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs transition-all shadow-xs group cursor-pointer"
                title="Click to Switch Staff Account or Authenticate"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-emerald-400">
                  {activeStaff.staff_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-200 group-hover:text-white transition-colors">
                      {activeStaff.staff_name}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <KeyRound className="w-3 h-3 text-slate-500" />
                    <span>Switch Operator</span>
                  </div>
                </div>
              </button>

              {/* Lock Terminal Button */}
              <button
                type="button"
                onClick={lockTerminal}
                className="p-2 bg-slate-800 hover:bg-amber-950/40 hover:text-amber-300 text-slate-400 border border-slate-700 hover:border-amber-700/50 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Lock Terminal Screen (Requires Security PIN to resume)"
              >
                <LockKeyhole className="w-4 h-4" />
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="p-2 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 border border-slate-700 hover:border-rose-700/50 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Sign Out of POS Session"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="hidden md:flex space-x-1 py-1.5 overflow-x-auto items-center">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const isLocked = !item.allowed;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isLocked
                        ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-900/60'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                    title={isLocked ? `Requires ${item.minRole} role. Click to request override.` : undefined}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isLocked ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                    {isLocked && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
                    {item.badge !== null && item.badge !== undefined && (
                      <span className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full text-white ${item.badgeColor || 'bg-emerald-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="flex-1" />

              {/* Supervisor & Manager Quick Action Buttons */}
              <div className="flex items-center space-x-1.5">
                {/* Cycle Count Button (Supervisor, Manager, Admin) */}
                {['Supervisor', 'Manager', 'Admin'].includes(activeStaff.role) && (
                  <button
                    onClick={() => setIsCycleCountOpen(true)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-950/40 border border-amber-800/40 transition-colors"
                    title="Supervisor Stock Reconciliation & Cycle Count"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cycle Count</span>
                  </button>
                )}

                {/* Stock Transfer Button (Manager, Admin) */}
                {['Manager', 'Admin'].includes(activeStaff.role) && (
                  <button
                    onClick={() => setIsStockTransferOpen(true)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-300 hover:bg-purple-950/40 border border-purple-800/40 transition-colors"
                    title="Manager Cold-room / Tank Transfer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                    <span>Transfer Stock</span>
                  </button>
                )}

                {/* Quick Refund Button */}
                <button
                  onClick={onOpenRefundModal}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 border border-rose-800/40 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Refund / Return</span>
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-2">
            <div className="p-2.5 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Current Session</div>
                <div className="font-bold text-white text-xs">{activeStaff.staff_name}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
                {roleBadge.label}
              </span>
            </div>

            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isLocked = !item.allowed;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleTabClick(item);
                    if (item.allowed) setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive ? 'bg-emerald-600 text-white' : isLocked ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isLocked && <Lock className="w-3 h-3 text-slate-500" />}
                  </div>
                  {item.badge !== null && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  onOpenRefundModal();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-rose-950/40 text-rose-300 border border-rose-800/50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Process Refund / Return</span>
              </button>

              <button
                onClick={() => {
                  openLoginModal('SWITCH');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-emerald-400 border border-slate-700"
              >
                <KeyRound className="w-4 h-4" />
                <span>Switch Operator Account</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    lockTerminal();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-amber-950/30 text-amber-300 border border-amber-800/40"
                >
                  <LockKeyhole className="w-3.5 h-3.5" />
                  <span>Lock Screen</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-950/30 text-rose-300 border border-rose-800/40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* PIN Authentication & Override Modal */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        mode={pinModalContext.mode}
        actionDescription={pinModalContext.action}
        title={pinModalContext.mode === 'OVERRIDE' ? 'Manager / Supervisor Override' : 'Staff Switch & Authentication'}
        subtitle={
          pinModalContext.mode === 'OVERRIDE'
            ? 'Enter Supervisor, Manager, or Admin PIN to authorize'
            : 'Enter 4-digit security PIN to authenticate session'
        }
        onSuccess={(authorizedStaff) => {
          if (pinModalContext.mode === 'SWITCH_USER') {
            setActiveStaffId(authorizedStaff.staff_id);
          } else if (pinModalContext.targetTab) {
            setCurrentTab(pinModalContext.targetTab);
          }
        }}
      />

      {/* Staff & Role Admin Modal (Admin) */}
      <StaffManagerModal
        isOpen={isStaffManagerOpen}
        onClose={() => setIsStaffManagerOpen(false)}
      />

      {/* Cycle Count Modal (Supervisor) */}
      <CycleCountModal
        isOpen={isCycleCountOpen}
        onClose={() => setIsCycleCountOpen(false)}
      />

      {/* Stock Transfer Modal (Manager) */}
      <StockTransferModal
        isOpen={isStockTransferOpen}
        onClose={() => setIsStockTransferOpen(false)}
      />
    </>
  );
};
