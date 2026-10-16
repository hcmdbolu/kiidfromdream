import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Banknote, 
  ArrowRightLeft, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  UserCheck, 
  ChevronRight, 
  DollarSign, 
  Wallet, 
  RefreshCw,
  X,
  Receipt,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle
} from 'lucide-react';
import { CashToBankTransfer, CashTransferType, CashierDrawerSummary, Employee } from '../../types';

interface CashReconciliationManagerProps {
  onOpenPosSetup?: () => void;
}

export const CashReconciliationManager: React.FC<CashReconciliationManagerProps> = ({ onOpenPosSetup }) => {
  const { 
    employees, 
    activeStaff, 
    posTerminals, 
    cashTransfers, 
    customerDebtRepayments,
    getCashierDrawerSummary, 
    processCashToBankTransfer, 
    sales, 
    refunds 
  } = usePos();

  const [activeTab, setActiveTab] = useState<'drawers' | 'transfers'>('drawers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<CashTransferType>('POS_TO_BANK');
  const [targetCashier, setTargetCashier] = useState<Employee | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [depositSlipNumber, setDepositSlipNumber] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<CashToBankTransfer | null>(null);

  // Voucher / Receipt View Modal
  const [selectedVoucher, setSelectedVoucher] = useState<CashToBankTransfer | null>(null);

  // Get active bank accounts for transfer destination / source
  const bankAccounts = useMemo(() => {
    return posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.status === 'Active');
  }, [posTerminals]);

  // Drawer summaries for all cashiers / staff who have handled cash
  const drawerSummaries: CashierDrawerSummary[] = useMemo(() => {
    return getCashierDrawerSummary();
  }, [getCashierDrawerSummary, employees, sales, refunds, cashTransfers, customerDebtRepayments]);

  // Helper to filter dates by timeRange
  const matchesTimeRange = (dateStr: string) => {
    if (timeRange === 'all') return true;
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return true;
    const now = new Date();

    if (timeRange === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (timeRange === 'week') {
      const pastWeek = new Date();
      pastWeek.setDate(now.getDate() - 7);
      return itemDate >= pastWeek && itemDate <= now;
    }
    if (timeRange === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered transfers based on search, cashier, and time range
  const filteredTransfers = useMemo(() => {
    return cashTransfers.filter(t => {
      const matchSearch = 
        t.transfer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.cashier_staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.manager_staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination_bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.destination_account_number && t.destination_account_number.includes(searchQuery)) ||
        (t.deposit_slip_number && t.deposit_slip_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCashier = selectedCashierId === 'all' || t.cashier_staff_id === selectedCashierId;
      const matchTime = matchesTimeRange(t.date_time);

      return matchSearch && matchCashier && matchTime;
    });
  }, [cashTransfers, searchQuery, selectedCashierId, timeRange]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCashInHand = drawerSummaries.reduce((sum, d) => sum + d.current_cash_in_hand, 0);
    const totalCashCollected = drawerSummaries.reduce((sum, d) => sum + d.total_cash_collected, 0);
    const totalCashRefunded = drawerSummaries.reduce((sum, d) => sum + d.total_cash_refunded, 0);
    
    // Distinguish POS-to-Bank and Bank-to-POS
    const totalBankTransferred = cashTransfers
      .filter(t => (t.transfer_type === 'POS_TO_BANK' || !t.transfer_type) && matchesTimeRange(t.date_time))
      .reduce((sum, t) => sum + t.amount_transferred, 0);

    const totalReplenishedFromBank = cashTransfers
      .filter(t => t.transfer_type === 'BANK_TO_POS' && matchesTimeRange(t.date_time))
      .reduce((sum, t) => sum + t.amount_transferred, 0);

    const activeHoldingCount = drawerSummaries.filter(d => d.current_cash_in_hand > 0).length;

    return {
      totalCashInHand,
      totalCashCollected,
      totalCashRefunded,
      totalBankTransferred,
      totalReplenishedFromBank,
      activeHoldingCount,
    };
  }, [drawerSummaries, cashTransfers, timeRange]);

  // Open modal for a specific cashier and transfer direction
  const handleOpenTransferModal = (cashier: Employee, type: CashTransferType = 'POS_TO_BANK') => {
    const summary = drawerSummaries.find(d => d.staff_id === cashier.staff_id);
    const availableCash = summary?.current_cash_in_hand || 0;
    
    setTargetCashier(cashier);
    setTransferType(type);

    if (type === 'POS_TO_BANK') {
      setTransferAmount(availableCash > 0 ? availableCash.toString() : '');
      setTransferNotes(`Cash handover from ${cashier.staff_name} for bank deposit`);
      setDepositSlipNumber(`DEP-${Date.now().toString().slice(-6)}`);
    } else {
      setTransferAmount('10000');
      setTransferNotes(`Cash float replenishment for ${cashier.staff_name} till change`);
      setDepositSlipNumber(`FLT-${Date.now().toString().slice(-6)}`);
    }
    
    // Default to first active bank account or default one
    const defaultBank = bankAccounts.find(b => b.is_default) || bankAccounts[0];
    if (defaultBank) {
      setSelectedBankAccountId(defaultBank.id);
    }
    
    setManagerPin(activeStaff.role === 'Manager' || activeStaff.role === 'Admin' ? activeStaff.pin : '');
    setTransferError(null);
    setTransferSuccess(null);
    setIsTransferModalOpen(true);
  };

  // Preset float helper
  const handleApplyPresetTransfer = (preset: 'all' | 'keep5k' | 'keep10k' | 'keep20k' | 'add5k' | 'add10k' | 'add20k' | 'add50k') => {
    if (!targetCashier) return;
    const summary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
    const cash = summary?.current_cash_in_hand || 0;

    if (preset === 'all') {
      setTransferAmount(cash.toString());
    } else if (preset === 'keep5k') {
      setTransferAmount(Math.max(0, cash - 5000).toString());
    } else if (preset === 'keep10k') {
      setTransferAmount(Math.max(0, cash - 10000).toString());
    } else if (preset === 'keep20k') {
      setTransferAmount(Math.max(0, cash - 20000).toString());
    } else if (preset === 'add5k') {
      setTransferAmount('5000');
    } else if (preset === 'add10k') {
      setTransferAmount('10000');
    } else if (preset === 'add20k') {
      setTransferAmount('20000');
    } else if (preset === 'add50k') {
      setTransferAmount('50000');
    }
  };

  // Submit transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!targetCashier) {
      setTransferError('No cashier selected.');
      return;
    }

    const numAmount = parseFloat(transferAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setTransferError('Please enter a valid transfer amount greater than ₦0.');
      return;
    }

    if (transferType === 'POS_TO_BANK') {
      const summary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
      const cash = summary?.current_cash_in_hand || 0;
      if (numAmount > cash) {
        setTransferError(`Cannot transfer ₦${numAmount.toLocaleString()} because cashier only has ₦${cash.toLocaleString()} in drawer.`);
        return;
      }
    }

    if (!transferNotes || transferNotes.trim().length < 3) {
      setTransferError('Please provide a mandatory audit note explaining this transfer.');
      return;
    }

    if (!managerPin || managerPin.trim().length !== 4) {
      setTransferError('Please enter a valid 4-digit Manager or Admin PIN.');
      return;
    }

    const res = processCashToBankTransfer({
      cashierStaffId: targetCashier.staff_id,
      amount: numAmount,
      destinationAccountId: selectedBankAccountId,
      depositSlipNumber: depositSlipNumber.trim(),
      notes: transferNotes.trim(),
      managerPin: managerPin.trim(),
      transfer_type: transferType,
    });

    if (!res.success) {
      setTransferError(res.error || 'Failed to complete cash transfer.');
    } else {
      setTransferSuccess(res.transfer || null);
    }
  };

  // Printable transfer voucher trigger
  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Cash Reconciliation & Bank Treasury
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Track live cash drawer balances, till collections, and authorize bidirectional fund transfers (POS to Bank and Float Replenishment) with SQLite WAL audit persistence.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Replenish Float Button */}
          <button
            type="button"
            onClick={() => {
              const eligibleCashier = employees.find(e => e.role === 'Cashier') || employees[0];
              if (eligibleCashier) handleOpenTransferModal(eligibleCashier, 'BANK_TO_POS');
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm shadow-blue-600/20 cursor-pointer active:scale-95"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Replenish Cash Float</span>
          </button>

          {/* Transfer Cash to Bank Button */}
          <button
            type="button"
            onClick={() => {
              const eligibleCashier = employees.find(e => e.role === 'Cashier' && drawerSummaries.some(d => d.staff_id === e.staff_id && d.current_cash_in_hand > 0)) ||
                employees.find(e => e.role === 'Cashier') || employees[0];
              if (eligibleCashier) handleOpenTransferModal(eligibleCashier, 'POS_TO_BANK');
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Clear Cash to Bank</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash with Cashiers */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Cash Currently In Hand</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-amber-600">
              ₦{stats.totalCashInHand.toLocaleString()}
            </div>
            <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>{stats.activeHoldingCount} cashier(s) holding physical float</span>
            </div>
          </div>
        </div>

        {/* Total Cash Collected */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Gross Cash Collected</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-700">
              ₦{stats.totalCashCollected.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Sales, debt settlements & deposits
            </div>
          </div>
        </div>

        {/* Total Banked Transferred */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Cleared to Bank (Deposits)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-700">
              ₦{stats.totalBankTransferred.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Transferred from tills into commercial bank
            </div>
          </div>
        </div>

        {/* Replenished Float from Bank */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Replenished Float Injected</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-blue-700">
              ₦{stats.totalReplenishedFromBank.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Bank treasury float issued to cashiers
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Time Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('drawers')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'drawers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Active Cashier Drawers ({drawerSummaries.length})</span>
            {stats.activeHoldingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
                {stats.activeHoldingCount} active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Fund Transfer Audit Log ({filteredTransfers.length})</span>
          </button>
        </div>

        {/* Time Range Chips */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setTimeRange(chip.id as any)}
              className={`px-3 py-1 rounded-lg transition-all ${
                timeRange === chip.id
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: CASHIER DRAWERS VIEW */}
      {activeTab === 'drawers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drawerSummaries.map(summary => {
              const cashierStaff = employees.find(e => e.staff_id === summary.staff_id);
              const isHoldingCash = summary.current_cash_in_hand > 0;

              return (
                <div 
                  key={summary.staff_id}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                    isHoldingCash 
                      ? 'border-amber-300 ring-1 ring-amber-200' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Cashier Info Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm text-white ${
                          isHoldingCash ? 'bg-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-700'
                        }`}>
                          {summary.staff_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{summary.staff_name}</h3>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{summary.staff_id}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">{summary.role}</span>
                            <span>•</span>
                            <span className="text-slate-400">{summary.shift_time}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        isHoldingCash 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isHoldingCash ? 'Cash In Hand' : 'Till Cleared'}
                      </span>
                    </div>

                    {/* Current Cash Balance In Hand Banner */}
                    <div className={`mt-4 p-3.5 rounded-xl border text-center ${
                      isHoldingCash
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Current Cash In Till / Hand
                      </div>
                      <div className={`text-2xl font-black font-mono mt-0.5 ${
                        isHoldingCash ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        ₦{summary.current_cash_in_hand.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {summary.sales_count} cash sales • {summary.transfers_count} bank handovers
                      </div>
                    </div>

                    {/* Detailed Drawer Breakdown */}
                    <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cash Collected (Counter Sales):</span>
                        <span className="font-mono font-bold text-slate-800">
                          ₦{summary.total_cash_collected.toLocaleString()}
                        </span>
                      </div>
                      {Boolean(summary.total_debt_collected_cash && summary.total_debt_collected_cash > 0) && (
                        <div className="flex justify-between items-center text-emerald-700 font-medium">
                          <span>Cash Debt Repayments Collected:</span>
                          <span className="font-mono font-bold">
                            +₦{summary.total_debt_collected_cash?.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {Boolean(summary.total_replenished_from_bank && summary.total_replenished_from_bank > 0) && (
                        <div className="flex justify-between items-center text-blue-700 font-medium">
                          <span>Float Replenished from Bank:</span>
                          <span className="font-mono font-bold">
                            +₦{summary.total_replenished_from_bank?.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cash Refunds Deducted:</span>
                        <span className="font-mono font-bold text-rose-600">
                          -₦{summary.total_cash_refunded.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Deposited to Bank:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          -₦{summary.total_transferred_to_bank.toLocaleString()}
                        </span>
                      </div>
                      {Boolean(summary.total_discounts_applied && summary.total_discounts_applied > 0) && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Discounts Authorized:</span>
                          <span className="font-mono font-bold text-amber-600">
                            -₦{summary.total_discounts_applied?.toLocaleString()} ({summary.discount_transactions_count || 0} sales)
                          </span>
                        </div>
                      )}
                      {summary.last_activity_time && (
                        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-dashed border-slate-100">
                          <span>Last Cash Activity:</span>
                          <span className="font-mono">{summary.last_activity_time}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transfer Action Buttons */}
                  <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    {/* Replenish Float */}
                    <button
                      type="button"
                      disabled={!cashierStaff}
                      onClick={() => cashierStaff && handleOpenTransferModal(cashierStaff, 'BANK_TO_POS')}
                      className="py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 transition-all bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
                      title="Inject cash float into this cashier's drawer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>Add Float</span>
                    </button>

                    {/* Clear to Bank */}
                    <button
                      type="button"
                      disabled={!cashierStaff}
                      onClick={() => cashierStaff && handleOpenTransferModal(cashierStaff, 'POS_TO_BANK')}
                      className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                        isHoldingCash
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 active:scale-98'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Clear cash drawer to commercial bank account"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Clear to Bank</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CASH TRANSFER AUDIT LOG */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transfer ref, cashier, manager, slip, or bank..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto">
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="all">All Cashiers</option>
                {employees.map(e => (
                  <option key={e.staff_id} value={e.staff_id}>
                    {e.staff_name} ({e.role})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  // Export CSV of transfers
                  const headers = ['Transfer ID', 'Type', 'Date & Time', 'Cashier', 'Manager Authorizer', 'Amount (₦)', 'Cash Before (₦)', 'Remaining Float (₦)', 'Bank', 'Account Number', 'Deposit Slip', 'Notes'];
                  const rows = filteredTransfers.map(t => [
                    t.transfer_id,
                    t.transfer_type || 'POS_TO_BANK',
                    `"${t.date_time}"`,
                    `"${t.cashier_staff_name}"`,
                    `"${t.manager_staff_name}"`,
                    t.amount_transferred,
                    t.cashier_cash_before,
                    t.cashier_cash_remaining,
                    `"${t.destination_bank_name}"`,
                    `"${t.destination_account_number}"`,
                    `"${t.deposit_slip_number || ''}"`,
                    `"${t.notes.replace(/"/g, '""')}"`,
                  ]);
                  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `cash_transfers_${Date.now()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors"
                title="Download CSV report of transfers"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Transfer Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Direction & Ref</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Manager (Authorized)</th>
                    <th className="py-3 px-4">Commercial Bank Account</th>
                    <th className="py-3 px-4">Deposit / Slip Ref</th>
                    <th className="py-3 px-4 text-right">Amount (₦)</th>
                    <th className="py-3 px-4 text-right">Till Float After</th>
                    <th className="py-3 px-4">Mandatory Audit Note</th>
                    <th className="py-3 px-4 text-center">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No cash transfers found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map(transfer => {
                      const isBankToPos = transfer.transfer_type === 'BANK_TO_POS';

                      return (
                        <tr key={transfer.transfer_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-medium">
                            <div className="flex items-center space-x-1.5">
                              {isBankToPos ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>FLOAT INJECT</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>DEPOSIT OUT</span>
                                </span>
                              )}
                            </div>
                            <div className="text-slate-900 font-bold mt-0.5">{transfer.transfer_id}</div>
                            <div className="text-[10px] text-slate-400">{transfer.date_time}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{transfer.cashier_staff_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{transfer.cashier_staff_id}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 flex items-center space-x-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>{transfer.manager_staff_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{transfer.manager_role} ({transfer.manager_staff_id})</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{transfer.destination_bank_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Acc: {transfer.destination_account_number}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {transfer.deposit_slip_number || 'N/A'}
                            </span>
                          </td>

                          <td className={`py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-sm ${
                            isBankToPos ? 'text-blue-700' : 'text-emerald-700'
                          }`}>
                            {isBankToPos ? '+' : '-'}₦{transfer.amount_transferred.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-xs text-slate-600">
                            ₦{transfer.cashier_cash_remaining.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 max-w-xs truncate" title={transfer.notes}>
                            <span className="text-slate-600 italic">&quot;{transfer.notes}&quot;</span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedVoucher(transfer)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="View / Print Transfer Voucher"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BIDIRECTIONAL CASH TRANSFER MODAL */}
      {isTransferModalOpen && targetCashier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl text-slate-950 ${transferType === 'BANK_TO_POS' ? 'bg-blue-400' : 'bg-emerald-400'}`}>
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {transferType === 'BANK_TO_POS' 
                      ? 'Replenish Float from Bank Treasury' 
                      : 'Cash Transfer to Bank Account'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {transferType === 'BANK_TO_POS'
                      ? 'Manager injects change float into cashier till'
                      : 'Clear cashier cash drawer into commercial bank account'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferSuccess ? (
              /* Success State with Voucher Preview */
              <div className="p-6 space-y-5 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900">Transfer Completed & Logged!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ref: <span className="font-mono font-bold text-slate-800">{transferSuccess.transfer_id}</span>
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Operation Type:</span>
                    <span className="font-bold text-slate-900">
                      {transferSuccess.transfer_type === 'BANK_TO_POS' ? 'Float Replenishment' : 'Bank Deposit'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      ₦{transferSuccess.amount_transferred.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-semibold text-slate-800">{transferSuccess.cashier_staff_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cash in Till After:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₦{transferSuccess.cashier_cash_remaining.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank Account:</span>
                    <span className="font-semibold text-slate-800">
                      {transferSuccess.destination_bank_name} ({transferSuccess.destination_account_number})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Deposit / Slip Ref:</span>
                    <span className="font-mono text-slate-700">{transferSuccess.deposit_slip_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorized By:</span>
                    <span className="font-semibold text-slate-800">{transferSuccess.manager_staff_name}</span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoucher(transferSuccess);
                      setIsTransferModalOpen(false);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Voucher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Transfer Input Form */
              <form onSubmit={handleExecuteTransfer} className="p-6 space-y-4 text-xs">
                
                {transferError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-medium">{transferError}</span>
                  </div>
                )}

                {/* Transfer Direction Toggle */}
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    1. Select Transfer Direction:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('POS_TO_BANK');
                        const summary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
                        const cash = summary?.current_cash_in_hand || 0;
                        setTransferAmount(cash > 0 ? cash.toString() : '');
                        setTransferNotes(`Cash handover from ${targetCashier.staff_name} for bank deposit`);
                        setDepositSlipNumber(`DEP-${Date.now().toString().slice(-6)}`);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                        transferType === 'POS_TO_BANK'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      <span>Till → Bank Deposit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('BANK_TO_POS');
                        setTransferAmount('10000');
                        setTransferNotes(`Float replenishment for ${targetCashier.staff_name} till change`);
                        setDepositSlipNumber(`FLT-${Date.now().toString().slice(-6)}`);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                        transferType === 'BANK_TO_POS'
                          ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                      <span>Bank → Till Float</span>
                    </button>
                  </div>
                </div>

                {/* Cashier Selection & Current Cash In Hand */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">2. Target Cashier Till:</label>
                    <select
                      value={targetCashier.staff_id}
                      onChange={(e) => {
                        const c = employees.find(emp => emp.staff_id === e.target.value);
                        if (c) {
                          setTargetCashier(c);
                          const s = drawerSummaries.find(d => d.staff_id === c.staff_id);
                          if (transferType === 'POS_TO_BANK') {
                            setTransferAmount(s ? s.current_cash_in_hand.toString() : '');
                          }
                        }
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {employees.map(emp => {
                        const sum = drawerSummaries.find(d => d.staff_id === emp.staff_id);
                        const cash = sum?.current_cash_in_hand || 0;
                        return (
                          <option key={emp.staff_id} value={emp.staff_id}>
                            {emp.staff_name} ({emp.role}) - ₦{cash.toLocaleString()} in hand
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Dynamic Cash in Hand Calculation Banner */}
                  {(() => {
                    const currentSummary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
                    const currentCash = currentSummary?.current_cash_in_hand || 0;
                    const parsedTransfer = parseFloat(transferAmount) || 0;
                    const resultingCash = transferType === 'BANK_TO_POS'
                      ? currentCash + parsedTransfer
                      : Math.max(0, currentCash - parsedTransfer);

                    return (
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <div className="text-[10px] text-slate-500">Till Before</div>
                          <div className="font-mono font-bold text-slate-800 mt-0.5">
                            ₦{currentCash.toLocaleString()}
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg border ${
                          transferType === 'BANK_TO_POS' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          <div className="text-[10px] font-bold">
                            {transferType === 'BANK_TO_POS' ? 'Injecting Float' : 'Depositing Out'}
                          </div>
                          <div className="font-mono font-bold mt-0.5">
                            {transferType === 'BANK_TO_POS' ? '+' : '-'}₦{parsedTransfer.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                          <div className="text-[10px] text-slate-500">Till After</div>
                          <div className="font-mono font-bold text-slate-800 mt-0.5">
                            ₦{resultingCash.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Amount to Transfer */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">
                      3. Transfer Amount (₦) *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {transferType === 'BANK_TO_POS' ? 'Replenishment Amount' : 'Flexible Partial or Full'}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-sm">
                      ₦
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="e.g. 20000"
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {transferType === 'POS_TO_BANK' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('all')}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 transition-colors"
                        >
                          Clear Full Amount
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('keep5k')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition-colors"
                        >
                          Keep ₦5k Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('keep10k')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition-colors"
                        >
                          Keep ₦10k Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('keep20k')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition-colors"
                        >
                          Keep ₦20k Float
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add5k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 transition-colors"
                        >
                          +₦5,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add10k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 transition-colors"
                        >
                          +₦10,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add20k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 transition-colors"
                        >
                          +₦20,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add50k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200 transition-colors"
                        >
                          +₦50,000 Float
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Bank Account Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">
                      4. {transferType === 'BANK_TO_POS' ? 'Source Bank / Safe Account' : 'Destination Bank Account'} *
                    </label>
                    {onOpenPosSetup && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsTransferModalOpen(false);
                          onOpenPosSetup();
                        }}
                        className="text-[10px] text-emerald-600 hover:underline font-semibold"
                      >
                        + Configure Accounts
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} — {b.account_number} ({b.name}) {b.is_default ? '★ Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slip Reference Number */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">
                    5. Deposit / Teller Slip / Ref ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositSlipNumber}
                    onChange={(e) => setDepositSlipNumber(e.target.value)}
                    placeholder="e.g. GTB-DEP-991201 or treasury voucher ref"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Mandatory Audit Note */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">
                    6. Mandatory Audit Note / Reason *
                  </label>
                  <textarea
                    rows={2}
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g. Morning cash float replenishment from safe / end of shift cash handover to bank."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>

                {/* Manager / Admin PIN Authorization */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-amber-900 font-bold">
                    <span className="flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Manager / Admin 4-Digit Security PIN *</span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-normal">Manager/Admin Only</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="password"
                      maxLength={4}
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-28 text-center tracking-widest font-mono text-lg py-1.5 bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="text-[10px] text-slate-500">
                      Eligible: <span className="font-semibold text-slate-700">Chidinma (4444)</span>, <span className="font-semibold text-slate-700">Alex (1234)</span>, <span className="font-semibold text-slate-700">Admin (9999)</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-1.5 ${
                      transferType === 'BANK_TO_POS' 
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Authorize {transferType === 'BANK_TO_POS' ? 'Float Injection' : 'Deposit'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE CASH TRANSFER VOUCHER / SLIP */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">
                  {selectedVoucher.transfer_type === 'BANK_TO_POS'
                    ? 'Float Replenishment Voucher'
                    : 'Cash Handover & Bank Deposit Voucher'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Body */}
            <div id="cash-handover-voucher" className="p-6 space-y-4 font-mono text-xs text-slate-800">
              
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                <div className="font-black text-base text-slate-950 tracking-tight">
                  KIID FROM DREAM SEAFOODS LTD
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">
                  {selectedVoucher.transfer_type === 'BANK_TO_POS'
                    ? 'BANK-TO-DRAWER FLOAT REPLENISHMENT VOUCHER'
                    : 'CASH-TO-BANK TREASURY HANDOVER VOUCHER'}
                </div>
                <div className="text-[11px] font-bold text-emerald-700">
                  {selectedVoucher.transfer_id}
                </div>
                <div className="text-[10px] text-slate-400">
                  {selectedVoucher.date_time}
                </div>
              </div>

              {/* Amount Transferred Highlight */}
              <div className={`p-3 rounded-xl border text-center ${
                selectedVoucher.transfer_type === 'BANK_TO_POS'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="text-[10px] uppercase font-bold">
                  {selectedVoucher.transfer_type === 'BANK_TO_POS'
                    ? 'AMOUNT INJECTED INTO CASH DRAWER (FLOAT)'
                    : 'AMOUNT TRANSFERRED TO BANK'}
                </div>
                <div className={`text-2xl font-black mt-0.5 ${
                  selectedVoucher.transfer_type === 'BANK_TO_POS' ? 'text-blue-700' : 'text-emerald-700'
                }`}>
                  ₦{selectedVoucher.amount_transferred.toLocaleString()}
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier Involved:</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.cashier_staff_name} ({selectedVoucher.cashier_staff_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Authorizing Manager:</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.manager_staff_name} ({selectedVoucher.manager_staff_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Till Before:</span>
                  <span>₦{selectedVoucher.cashier_cash_before.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between font-bold ${
                  selectedVoucher.transfer_type === 'BANK_TO_POS' ? 'text-blue-700' : 'text-emerald-700'
                }`}>
                  <span>{selectedVoucher.transfer_type === 'BANK_TO_POS' ? 'Float Injected:' : 'Cash Moved Out:'}</span>
                  <span>{selectedVoucher.transfer_type === 'BANK_TO_POS' ? '+' : '-'}₦{selectedVoucher.amount_transferred.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Till Balance After:</span>
                  <span>₦{selectedVoucher.cashier_cash_remaining.toLocaleString()}</span>
                </div>
              </div>

              {/* Commercial Bank Account */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1">
                <div className="font-bold text-slate-700 uppercase">
                  {selectedVoucher.transfer_type === 'BANK_TO_POS' ? 'SOURCE BANK TREASURY:' : 'DESTINATION COMMERCIAL BANK:'}
                </div>
                <div className="font-bold text-slate-900">{selectedVoucher.destination_bank_name}</div>
                <div>Account Number: <span className="font-bold">{selectedVoucher.destination_account_number}</span></div>
                {selectedVoucher.deposit_slip_number && (
                  <div className="pt-1 border-t border-slate-200 font-semibold text-slate-800">
                    Slip / Reference: {selectedVoucher.deposit_slip_number}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="text-[11px] text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-200">
                <span className="font-bold not-italic text-amber-900">Audit Note: </span>
                &quot;{selectedVoucher.notes}&quot;
              </div>

              {/* Signatures */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-400 pt-1">
                  <div>{selectedVoucher.cashier_staff_name}</div>
                  <div className="font-bold text-slate-700">Cashier Signature</div>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div>{selectedVoucher.manager_staff_name}</div>
                  <div className="font-bold text-slate-700">Manager Signature</div>
                </div>
              </div>

            </div>

            {/* Print & Close Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex space-x-2">
              <button
                type="button"
                onClick={handlePrintVoucher}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="py-2 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
