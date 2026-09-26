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
  AlertTriangle
} from 'lucide-react';
import { CashToBankTransfer, CashierDrawerSummary, Employee } from '../../types';

interface CashReconciliationManagerProps {
  onOpenPosSetup?: () => void;
}

export const CashReconciliationManager: React.FC<CashReconciliationManagerProps> = ({ onOpenPosSetup }) => {
  const { 
    employees, 
    activeStaff, 
    posTerminals, 
    cashTransfers, 
    getCashierDrawerSummary, 
    processCashToBankTransfer, 
    sales, 
    refunds 
  } = usePos();

  const [activeTab, setActiveTab] = useState<'drawers' | 'transfers'>('drawers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');
  
  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
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

  // Get active bank accounts for transfer destination
  const bankAccounts = useMemo(() => {
    return posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.status === 'Active');
  }, [posTerminals]);

  // Drawer summaries for all cashiers / staff who have handled cash
  const drawerSummaries: CashierDrawerSummary[] = useMemo(() => {
    return getCashierDrawerSummary();
  }, [getCashierDrawerSummary, employees, sales, refunds, cashTransfers]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCashInHand = drawerSummaries.reduce((sum, d) => sum + d.current_cash_in_hand, 0);
    const totalCashCollected = drawerSummaries.reduce((sum, d) => sum + d.total_cash_collected, 0);
    const totalCashRefunded = drawerSummaries.reduce((sum, d) => sum + d.total_cash_refunded, 0);
    const totalBankTransferred = cashTransfers.reduce((sum, t) => sum + t.amount_transferred, 0);
    const activeHoldingCount = drawerSummaries.filter(d => d.current_cash_in_hand > 0).length;

    return {
      totalCashInHand,
      totalCashCollected,
      totalCashRefunded,
      totalBankTransferred,
      activeHoldingCount,
    };
  }, [drawerSummaries, cashTransfers]);

  // Open modal for a specific cashier
  const handleOpenTransferModal = (cashier: Employee) => {
    const summary = drawerSummaries.find(d => d.staff_id === cashier.staff_id);
    const availableCash = summary?.current_cash_in_hand || 0;
    
    setTargetCashier(cashier);
    setTransferAmount(availableCash > 0 ? availableCash.toString() : '');
    
    // Default to first active bank account or default one
    const defaultBank = bankAccounts.find(b => b.is_default) || bankAccounts[0];
    if (defaultBank) {
      setSelectedBankAccountId(defaultBank.id);
    }
    
    setDepositSlipNumber(`DEP-${Date.now().toString().slice(-6)}`);
    setTransferNotes(`Cash handover from ${cashier.staff_name} for shift clearing`);
    setManagerPin(activeStaff.role === 'Manager' || activeStaff.role === 'Admin' ? activeStaff.pin : '');
    setTransferError(null);
    setTransferSuccess(null);
    setIsTransferModalOpen(true);
  };

  // Preset float helper
  const handleApplyPresetTransfer = (type: 'all' | 'keep5k' | 'keep10k' | 'keep20k') => {
    if (!targetCashier) return;
    const summary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
    const cash = summary?.current_cash_in_hand || 0;

    if (type === 'all') {
      setTransferAmount(cash.toString());
    } else if (type === 'keep5k') {
      setTransferAmount(Math.max(0, cash - 5000).toString());
    } else if (type === 'keep10k') {
      setTransferAmount(Math.max(0, cash - 10000).toString());
    } else if (type === 'keep20k') {
      setTransferAmount(Math.max(0, cash - 20000).toString());
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
    });

    if (!res.success) {
      setTransferError(res.error || 'Failed to complete cash transfer.');
    } else {
      setTransferSuccess(res.transfer || null);
      // Keep modal open on success view so user can view/print voucher
    }
  };

  // Filtered transfer history
  const filteredTransfers = useMemo(() => {
    return cashTransfers.filter(t => {
      const matchSearch = 
        t.transfer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.cashier_staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.manager_staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination_bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination_account_number.includes(searchQuery) ||
        (t.deposit_slip_number && t.deposit_slip_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCashier = selectedCashierId === 'all' || t.cashier_staff_id === selectedCashierId;
      return matchSearch && matchCashier;
    });
  }, [cashTransfers, searchQuery, selectedCashierId]);

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
                Track live cash drawer balances, till collections, and authorize flexible cash-to-bank deposits with full audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick open transfer for active staff or first cashier */}
          <button
            type="button"
            onClick={() => {
              const eligibleCashier = employees.find(e => e.role === 'Cashier' && drawerSummaries.some(d => d.staff_id === e.staff_id && d.current_cash_in_hand > 0)) ||
                employees.find(e => e.role === 'Cashier') || employees[0];
              if (eligibleCashier) handleOpenTransferModal(eligibleCashier);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer Cash to Bank</span>
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
              From cash sales & split payments
            </div>
          </div>
        </div>

        {/* Total Banked Transferred */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Cleared to Bank Account</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-blue-700">
              ₦{stats.totalBankTransferred.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cashTransfers.length} verified bank deposit transfer(s)
            </div>
          </div>
        </div>

        {/* Cash Refunded */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Cash Refunds Deducted</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-rose-600">
              ₦{stats.totalCashRefunded.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Authorized cash customer refunds
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('drawers')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
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
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'transfers'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Cash-to-Bank Transfer Log ({cashTransfers.length})</span>
        </button>
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
                        {summary.sales_count} cash sales completed • {summary.transfers_count} bank deposits
                      </div>
                    </div>

                    {/* Detailed Drawer Breakdown */}
                    <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total Cash Collected:</span>
                        <span className="font-mono font-bold text-slate-800">
                          ₦{summary.total_cash_collected.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cash Refunds Deducted:</span>
                        <span className="font-mono font-bold text-rose-600">
                          -₦{summary.total_cash_refunded.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Transferred to Bank:</span>
                        <span className="font-mono font-bold text-blue-600">
                          ₦{summary.total_transferred_to_bank.toLocaleString()}
                        </span>
                      </div>
                      {summary.last_activity_time && (
                        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-dashed border-slate-100">
                          <span>Last Cash Activity:</span>
                          <span className="font-mono">{summary.last_activity_time}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transfer Action Button */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={!cashierStaff}
                      onClick={() => cashierStaff && handleOpenTransferModal(cashierStaff)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        isHoldingCash
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 active:scale-98'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>
                        {isHoldingCash 
                          ? `Clear Cash to Bank (₦${summary.current_cash_in_hand.toLocaleString()})`
                          : 'Transfer Partial / Add Deposit'
                        }
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CASH-TO-BANK TRANSFER HISTORY & AUDIT LOG */}
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
                placeholder="Search transfer ref, cashier name, deposit slip, or bank account..."
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
                  const headers = ['Transfer ID', 'Date & Time', 'Cashier', 'Manager Authorizer', 'Amount (₦)', 'Cash Before (₦)', 'Remaining Float (₦)', 'Destination Bank', 'Account Number', 'Deposit Slip', 'Notes'];
                  const rows = filteredTransfers.map(t => [
                    t.transfer_id,
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
                  link.setAttribute('download', `cash_to_bank_transfers_${Date.now()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors"
                title="Download CSV report of bank deposits"
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
                    <th className="py-3 px-4">Transfer Ref & Date</th>
                    <th className="py-3 px-4">Cashier (From)</th>
                    <th className="py-3 px-4">Manager (Authorized)</th>
                    <th className="py-3 px-4">Destination Bank Account</th>
                    <th className="py-3 px-4">Deposit Slip / Ref</th>
                    <th className="py-3 px-4 text-right">Amount Transferred</th>
                    <th className="py-3 px-4 text-right">Remaining Float</th>
                    <th className="py-3 px-4">Mandatory Audit Note</th>
                    <th className="py-3 px-4 text-center">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No cash-to-bank transfers found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map(transfer => (
                      <tr key={transfer.transfer_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-medium">
                          <div className="text-slate-900 font-bold">{transfer.transfer_id}</div>
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

                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-sm text-emerald-700">
                          ₦{transfer.amount_transferred.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-xs text-slate-600">
                          ₦{transfer.cashier_cash_remaining.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 max-w-xs truncate" title={transfer.notes}>
                          <span className="text-slate-600 italic">"{transfer.notes}"</span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucher(transfer)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="View / Print Cash Deposit Voucher"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FLEXIBLE CASH-TO-BANK TRANSFER MODAL */}
      {isTransferModalOpen && targetCashier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500 text-slate-950">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Cash Transfer to Bank</h3>
                  <p className="text-xs text-slate-400">Clear cashier cash drawer into commercial bank account</p>
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
                    <span className="text-slate-500">Transferred Amount:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      ₦{transferSuccess.amount_transferred.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-semibold text-slate-800">{transferSuccess.cashier_staff_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remaining Cash in Hand:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₦{transferSuccess.cashier_cash_remaining.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination Bank:</span>
                    <span className="font-semibold text-slate-800">
                      {transferSuccess.destination_bank_name} ({transferSuccess.destination_account_number})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Deposit Slip:</span>
                    <span className="font-mono text-slate-700">{transferSuccess.deposit_slip_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorizing Manager:</span>
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
                    <span>Print Handover Slip</span>
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

                {/* Cashier Selection & Current Cash In Hand */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">1. Select Cashier:</label>
                    <select
                      value={targetCashier.staff_id}
                      onChange={(e) => {
                        const c = employees.find(emp => emp.staff_id === e.target.value);
                        if (c) {
                          setTargetCashier(c);
                          const s = drawerSummaries.find(d => d.staff_id === c.staff_id);
                          setTransferAmount(s ? s.current_cash_in_hand.toString() : '');
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

                  {/* Cash in Hand Banner */}
                  {(() => {
                    const currentSummary = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
                    const currentCash = currentSummary?.current_cash_in_hand || 0;
                    const parsedTransfer = parseFloat(transferAmount) || 0;
                    const remaining = Math.max(0, currentCash - parsedTransfer);

                    return (
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <div className="text-[10px] text-slate-500">Till Before</div>
                          <div className="font-mono font-bold text-slate-800 mt-0.5">
                            ₦{currentCash.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="text-[10px] text-emerald-800 font-bold">Transferring</div>
                          <div className="font-mono font-bold text-emerald-700 mt-0.5">
                            -₦{parsedTransfer.toLocaleString()}
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg border ${
                          remaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
                        }`}>
                          <div className="text-[10px] text-slate-500">Float Left</div>
                          <div className={`font-mono font-bold mt-0.5 ${
                            remaining > 0 ? 'text-amber-800' : 'text-slate-500'
                          }`}>
                            ₦{remaining.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Amount to Transfer (Partial or Full) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">
                      2. Transfer Amount (₦) *
                    </label>
                    <span className="text-[10px] text-slate-400">Flexible Partial or Full</span>
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
                      Keep ₦5,000 Float
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetTransfer('keep10k')}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition-colors"
                    >
                      Keep ₦10,000 Float
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetTransfer('keep20k')}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition-colors"
                    >
                      Keep ₦20,000 Float
                    </button>
                  </div>
                </div>

                {/* Destination Bank Account */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">
                      3. Destination Commercial Bank Account *
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
                        + Configure Bank Accounts
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

                {/* Deposit Slip / Reference Number */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">
                    4. Bank Deposit Slip / Ref ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositSlipNumber}
                    onChange={(e) => setDepositSlipNumber(e.target.value)}
                    placeholder="e.g. GTB-DEP-991201 or teller reference"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Mandatory Audit Note */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">
                    5. Mandatory Audit Note / Reason *
                  </label>
                  <textarea
                    rows={2}
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g. End of morning shift cash handover to bank deposit box. Left ₦5,000 float for afternoon cashier."
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
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Authorize Transfer</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE CASH DEPOSIT VOUCHER / SLIP */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">Cash Handover & Bank Deposit Voucher</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Body (Printable thermal or voucher format) */}
            <div id="cash-handover-voucher" className="p-6 space-y-4 font-mono text-xs text-slate-800">
              
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                <div className="font-black text-base text-slate-950 tracking-tight">
                  KIID FROM DREAM SEAFOODS LTD
                </div>
                <div className="text-[10px] text-slate-500">
                  CASH-TO-BANK TREASURY HANDOVER VOUCHER
                </div>
                <div className="text-[11px] font-bold text-emerald-700">
                  {selectedVoucher.transfer_id}
                </div>
                <div className="text-[10px] text-slate-400">
                  {selectedVoucher.date_time}
                </div>
              </div>

              {/* Amount Transferred Highlight */}
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                <div className="text-[10px] text-emerald-800 uppercase font-bold">
                  AMOUNT TRANSFERRED TO BANK
                </div>
                <div className="text-2xl font-black text-emerald-700 mt-0.5">
                  ₦{selectedVoucher.amount_transferred.toLocaleString()}
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier Turning In:</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.cashier_staff_name} ({selectedVoucher.cashier_staff_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Authorizing Manager:</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.manager_staff_name} ({selectedVoucher.manager_staff_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier Till Before:</span>
                  <span>₦{selectedVoucher.cashier_cash_before.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Cash Moved Out:</span>
                  <span>-₦{selectedVoucher.amount_transferred.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-800">
                  <span>Remaining Float With Cashier:</span>
                  <span>₦{selectedVoucher.cashier_cash_remaining.toLocaleString()}</span>
                </div>
              </div>

              {/* Destination Bank Account */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1">
                <div className="font-bold text-slate-700 uppercase">DESTINATION BANK:</div>
                <div className="font-bold text-slate-900">{selectedVoucher.destination_bank_name}</div>
                <div>Account Number: <span className="font-bold">{selectedVoucher.destination_account_number}</span></div>
                <div>Account Name: {selectedVoucher.destination_account_name}</div>
                {selectedVoucher.deposit_slip_number && (
                  <div className="pt-1 border-t border-slate-200 font-semibold text-slate-800">
                    Deposit Slip / Ref: {selectedVoucher.deposit_slip_number}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="text-[11px] text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-200">
                <span className="font-bold not-italic text-amber-900">Audit Note: </span>
                "{selectedVoucher.notes}"
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
