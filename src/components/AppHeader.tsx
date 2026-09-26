import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Menu, 
  Clock, 
  AlertTriangle, 
  Database, 
  RefreshCw, 
  Radio, 
  LockKeyhole,
  CheckCircle2,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react';
import { ROLE_BADGES } from '../utils/rbac';

interface AppHeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  sidebarHidden?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  pos: {
    title: 'POS Sales Terminal',
    subtitle: 'High-speed counter transactions, weight scale adjustments, and split tender settlements.',
  },
  inventory: {
    title: 'Inventory & Stock Management',
    subtitle: 'Real-time cold-room stock levels, batch expiries, reorder thresholds, and cycle counts.',
  },
  sales: {
    title: 'Sales History & Void Ledger',
    subtitle: 'Immutable counter transaction logs, customer returns, and aborted order audit records.',
  },
  customers: {
    title: 'Customer Directory & VIP Rates',
    subtitle: 'Wholesale, restaurant, and retail customer database with authorized custom discount rates.',
  },
  suppliers: {
    title: 'Suppliers & Purchase Orders',
    subtitle: 'Fish farms, vessel vendors, receiving goods inspections, and supply chain tracking.',
  },
  reports: {
    title: 'Executive Financial & P&L Reports',
    subtitle: 'Gross revenue, margins, COGS, payment breakdown, and cashier shift balance reconciliation.',
  },
  audit: {
    title: 'Cryptographic Audit Trail Ledger',
    subtitle: 'SHA-256 tamper-evident system logs, security overrides, and operational event history.',
  },
  reconciliation: {
    title: 'Cash Drawer Reconciliation & Bank Treasury',
    subtitle: 'Track physical till cash balances per cashier, shift collections, and authorize bank deposits.',
  },
  pos_setup: {
    title: 'POS Terminal Setup & Bank Account Mapping',
    subtitle: 'Configure wireless POS machines (Moniepoint, OPay, GTBank) and commercial accounts for sale tagging.',
  },
  staff: {
    title: 'Staff & Role Security Administration',
    subtitle: 'Standard enterprise RBAC, staff credentials, security PINs, and shift scheduling.',
  },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  setCurrentTab,
  sidebarHidden = false,
  onToggleSidebar,
  onToggleMobileMenu,
}) => {
  const { 
    activeStaff, 
    lowStockCount, 
    expiringSoonCount, 
    syncStatus, 
    lastSyncTime, 
    serverVersion, 
    forceSync,
    recentBroadcastNotice,
    clearBroadcastNotice,
    lockTerminal,
    openLoginModal
  } = usePos();

  const [currentTime, setCurrentTime] = useState<string>('');

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

  const meta = TAB_TITLES[currentTab] || {
    title: 'KiidFromDream POS',
    subtitle: 'Fish & Seafood Counter Management',
  };

  const roleBadge = ROLE_BADGES[activeStaff.role] || ROLE_BADGES.Cashier;

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Broadcast Banner if any */}
      {recentBroadcastNotice && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
            <span>{recentBroadcastNotice}</span>
          </div>
          <button
            type="button"
            onClick={clearBroadcastNotice}
            className="text-emerald-200 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-emerald-700/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left: Sidebar Toggle Button + Module Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar || onToggleMobileMenu}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              sidebarHidden
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/20 hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200'
            }`}
            title={sidebarHidden ? "Show Navigation Side Panel (Press [ or Ctrl+B)" : "Hide Navigation Side Panel"}
            aria-label="Toggle Navigation Side Panel"
          >
            {sidebarHidden ? (
              <>
                <PanelLeftOpen className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Show Side Panel</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5 hidden md:block" />
                <Menu className="w-5 h-5 md:hidden" />
              </>
            )}
          </button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
              {meta.title}
            </h1>
            <p className="text-[11px] text-slate-500 truncate hidden sm:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Live Clock, DB Status, Alerts, Session */}
        <div className="flex items-center space-x-2.5 text-xs shrink-0">
          {/* Live Clock */}
          <div className="hidden lg:flex items-center space-x-1.5 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>{currentTime || '25 Sep 2026'}</span>
          </div>

          {/* Central DB Sync Pill */}
          <div 
            className="hidden sm:flex items-center space-x-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px] font-mono"
            title={`Central Database: ${syncStatus}. Version: ${serverVersion}. Last sync: ${lastSyncTime}`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
            </span>
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-800">
              {syncStatus === 'synced' ? 'Central DB' : syncStatus === 'syncing' ? 'Syncing' : 'Offline'}
            </span>
            <button
              type="button"
              onClick={() => forceSync()}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
              title="Force Sync Server"
            >
              <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Low Stock Alerts */}
          {(lowStockCount > 0 || expiringSoonCount > 0) && (
            <button
              type="button"
              onClick={() => {
                if (['Supervisor', 'Manager', 'Admin'].includes(activeStaff.role)) {
                  setCurrentTab('inventory');
                }
              }}
              className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              title={`${lowStockCount} items low in stock, ${expiringSoonCount} expiring soon`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="font-bold">{lowStockCount + expiringSoonCount} Alerts</span>
            </button>
          )}

          {/* Quick Staff Switch Button */}
          <button
            type="button"
            onClick={() => openLoginModal('SWITCH')}
            className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer"
            title="Switch Operator"
          >
            <div className="w-5 h-5 rounded-md bg-slate-900 text-emerald-400 font-mono font-bold text-[10px] flex items-center justify-center">
              {activeStaff.staff_name[0]}
            </div>
            <span className="font-semibold text-slate-800 hidden md:inline">{activeStaff.staff_name}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}>
              {roleBadge.label}
            </span>
          </button>

          {/* Lock Terminal Button */}
          <button
            type="button"
            onClick={lockTerminal}
            className="p-2 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Lock POS Terminal Screen"
          >
            <LockKeyhole className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
