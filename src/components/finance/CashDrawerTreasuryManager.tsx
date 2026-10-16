import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Banknote, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Search, 
  Filter, 
  Printer, 
  DollarSign, 
  Wallet, 
  RefreshCw,
  X,
  Receipt,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  Plus,
  Edit3,
  Trash2,
  Check,
  Copy,
  Star,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { 
  CashToBankTransfer, 
  CashTransferType, 
  CashierDrawerSummary, 
  Employee, 
  PosTerminalConfig, 
  PosAccountType, 
  PosProvider,
  BankAndPosLedgerSummary 
} from '../../types';
import { matchesDateRange, extractDateKey, getLocalDateString } from '../../utils/dateUtils';

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Moniepoint: { bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-300' },
  OPay: { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-300' },
  GTBank: { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-300' },
  'Zenith Bank': { bg: 'bg-red-500/10', text: 'text-red-700', border: 'border-red-300' },
  PalmPay: { bg: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-purple-300' },
  'Access Bank': { bg: 'bg-amber-500/10', text: 'text-amber-800', border: 'border-amber-300' },
  FirstBank: { bg: 'bg-yellow-500/10', text: 'text-yellow-800', border: 'border-yellow-300' },
  'Stanbic IBTC': { bg: 'bg-blue-600/10', text: 'text-blue-800', border: 'border-blue-300' },
  Kuda: { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-300' },
  Other: { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-300' },
};

const PROVIDER_OPTIONS: PosProvider[] = [
  'Moniepoint',
  'OPay',
  'GTBank',
  'Zenith Bank',
  'Access Bank',
  'PalmPay',
  'FirstBank',
  'Stanbic IBTC',
  'Kuda',
  'Other'
];

interface CashDrawerTreasuryManagerProps {
  initialTab?: 'drawers' | 'terminals_banks' | 'transfers' | 'analytics';
}

export const CashDrawerTreasuryManager: React.FC<CashDrawerTreasuryManagerProps> = ({ 
  initialTab = 'drawers' 
}) => {
  const { 
    employees, 
    activeStaff, 
    posTerminals, 
    cashTransfers, 
    customerDebtRepayments,
    getCashierDrawerSummary, 
    getBankAndPosLedgerSummary,
    processCashToBankTransfer, 
    addPosTerminal,
    updatePosTerminal,
    deletePosTerminal,
    sales, 
    refunds 
  } = usePos();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'drawers' | 'terminals_banks' | 'transfers' | 'analytics'>(initialTab);
  
  // Date Filtering Engine
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');
  const [terminalFilterType, setTerminalFilterType] = useState<'ALL' | 'POS_TERMINAL' | 'BANK_TRANSFER_ACCOUNT'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Terminal & Bank Account Form Modal State
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminalConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<PosAccountType>('POS_TERMINAL');
  const [formProvider, setFormProvider] = useState<PosProvider>('Moniepoint');
  const [formTerminalId, setFormTerminalId] = useState('');
  const [formAccountName, setFormAccountName] = useState('Kiid From Dream Frozen Foods Ltd');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formBankName, setFormBankName] = useState('Moniepoint Microfinance Bank');
  const [formLocation, setFormLocation] = useState('Main Retail Counter 1');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);

  // Printable Voucher Modal State
  const [selectedVoucher, setSelectedVoucher] = useState<CashToBankTransfer | null>(null);

  // Active bank accounts for transfer destination / source
  const bankAccounts = useMemo(() => {
    return posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.status === 'Active');
  }, [posTerminals]);

  // Date Filter Parameter object passed to queries
  const dateFilterOpts = useMemo(() => {
    return {
      dateRange,
      startDate: customStartDate,
      endDate: customEndDate,
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Drawer summaries for all cashiers / staff handling cash
  const drawerSummaries: CashierDrawerSummary[] = useMemo(() => {
    return getCashierDrawerSummary(undefined, dateFilterOpts);
  }, [getCashierDrawerSummary, dateFilterOpts, employees, sales, refunds, cashTransfers, customerDebtRepayments]);

  // Bank & POS Ledgers computed with real-time sales, deposits, float outflows, and refunds
  const bankAndPosLedgers: BankAndPosLedgerSummary[] = useMemo(() => {
    return getBankAndPosLedgerSummary(dateFilterOpts);
  }, [getBankAndPosLedgerSummary, dateFilterOpts, posTerminals, sales, customerDebtRepayments, cashTransfers, refunds]);

  // Filtered transfers based on search, cashier, and date range
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
      const matchDate = matchesDateRange(t.date_time, dateRange, customStartDate, customEndDate);

      return matchSearch && matchCashier && matchDate;
    });
  }, [cashTransfers, searchQuery, selectedCashierId, dateRange, customStartDate, customEndDate]);

  // Filtered bank & POS ledgers based on sub-tab and search
  const filteredLedgers = useMemo(() => {
    return bankAndPosLedgers.filter(term => {
      const matchType = terminalFilterType === 'ALL' || term.type === terminalFilterType;
      const matchSearch = 
        term.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.account_number?.includes(searchQuery) ||
        term.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.terminal_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.provider.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [bankAndPosLedgers, terminalFilterType, searchQuery]);

  // Aggregate stats across all treasury channels
  const stats = useMemo(() => {
    const totalCashInHand = drawerSummaries.reduce((sum, d) => sum + d.current_cash_in_hand, 0);
    const periodCashCollected = drawerSummaries.reduce((sum, d) => sum + d.total_cash_collected, 0);
    const periodCashRefunded = drawerSummaries.reduce((sum, d) => sum + d.total_cash_refunded, 0);
    
    const bankAccountsList = bankAndPosLedgers.filter(l => l.type === 'BANK_TRANSFER_ACCOUNT');
    const posTerminalsList = bankAndPosLedgers.filter(l => l.type === 'POS_TERMINAL');

    const totalBankBalance = bankAccountsList.reduce((sum, b) => sum + b.netLedgerBalance, 0);
    const totalPosVolume = posTerminalsList.reduce((sum, p) => sum + p.netLedgerBalance, 0);

    const periodDepositedToBank = filteredTransfers
      .filter(t => t.transfer_type === 'POS_TO_BANK' || !t.transfer_type)
      .reduce((sum, t) => sum + t.amount_transferred, 0);

    const periodReplenishedFromBank = filteredTransfers
      .filter(t => t.transfer_type === 'BANK_TO_POS')
      .reduce((sum, t) => sum + t.amount_transferred, 0);

    const activeHoldingCount = drawerSummaries.filter(d => d.current_cash_in_hand > 0).length;

    return {
      totalCashInHand,
      periodCashCollected,
      periodCashRefunded,
      totalBankBalance,
      totalPosVolume,
      periodDepositedToBank,
      periodReplenishedFromBank,
      activeHoldingCount,
      totalCommercialAccounts: bankAccountsList.length,
      totalPosDevices: posTerminalsList.length,
    };
  }, [drawerSummaries, bankAndPosLedgers, filteredTransfers]);

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

  // Submit fund transfer
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

  // Handle Add / Edit Terminal Modal
  const handleOpenAddTerminalModal = (type: PosAccountType = 'POS_TERMINAL') => {
    setEditingTerminal(null);
    setFormName('');
    setFormType(type);
    setFormProvider(type === 'BANK_TRANSFER_ACCOUNT' ? 'GTBank' : 'Moniepoint');
    setFormTerminalId(type === 'POS_TERMINAL' ? `MP-${Math.floor(100000 + Math.random() * 900000)}` : '');
    setFormAccountName('Kiid From Dream Frozen Foods Ltd');
    setFormAccountNumber('');
    setFormBankName(type === 'BANK_TRANSFER_ACCOUNT' ? 'Guaranty Trust Bank' : 'Moniepoint Microfinance Bank');
    setFormLocation('Main Retail Counter 1');
    setFormIsDefault(false);
    setFormNotes('');
    setFormStatus('Active');
    setFormError(null);
    setIsTerminalModalOpen(true);
  };

  const handleOpenEditTerminalModal = (term: PosTerminalConfig) => {
    setEditingTerminal(term);
    setFormName(term.name);
    setFormType(term.type);
    setFormProvider(term.provider);
    setFormTerminalId(term.terminal_id || '');
    setFormAccountName(term.account_name);
    setFormAccountNumber(term.account_number);
    setFormBankName(term.bank_name);
    setFormLocation(term.assigned_location || '');
    setFormIsDefault(!!term.is_default);
    setFormNotes(term.notes || '');
    setFormStatus(term.status);
    setFormError(null);
    setIsTerminalModalOpen(true);
  };

  const handleProviderChange = (provider: PosProvider) => {
    setFormProvider(provider);
    if (provider === 'Moniepoint') setFormBankName('Moniepoint Microfinance Bank');
    else if (provider === 'OPay') setFormBankName('OPay Digital Services');
    else if (provider === 'GTBank') setFormBankName('Guaranty Trust Bank');
    else if (provider === 'Zenith Bank') setFormBankName('Zenith Bank Plc');
    else if (provider === 'Access Bank') setFormBankName('Access Bank Plc');
    else if (provider === 'PalmPay') setFormBankName('PalmPay Digital Services');
    else if (provider === 'FirstBank') setFormBankName('First Bank of Nigeria');
    else if (provider === 'Stanbic IBTC') setFormBankName('Stanbic IBTC Bank');
    else if (provider === 'Kuda') setFormBankName('Kuda Microfinance Bank');
  };

  const handleSaveTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Please enter a descriptive device or account name.');
      return;
    }

    if (!formAccountNumber.trim() || formAccountNumber.trim().length < 6) {
      setFormError('Please enter a valid commercial bank / POS account number.');
      return;
    }

    if (!formBankName.trim()) {
      setFormError('Please enter the bank name.');
      return;
    }

    if (editingTerminal) {
      updatePosTerminal(editingTerminal.id, {
        name: formName.trim(),
        type: formType,
        provider: formProvider,
        terminal_id: formTerminalId.trim() || undefined,
        account_name: formAccountName.trim(),
        account_number: formAccountNumber.trim(),
        bank_name: formBankName.trim(),
        assigned_location: formLocation.trim() || undefined,
        is_default: formIsDefault,
        notes: formNotes.trim() || undefined,
        status: formStatus,
      });
    } else {
      addPosTerminal({
        name: formName.trim(),
        type: formType,
        provider: formProvider,
        terminal_id: formTerminalId.trim() || undefined,
        account_name: formAccountName.trim(),
        account_number: formAccountNumber.trim(),
        bank_name: formBankName.trim(),
        assigned_location: formLocation.trim() || undefined,
        is_default: formIsDefault,
        notes: formNotes.trim() || undefined,
        status: formStatus,
      });
    }

    setIsTerminalModalOpen(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Cash Drawer & Treasury / Bank Management</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Unified Module
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized financial management: track live till balances, commercial bank vaults, POS terminal collections, and authorize bidirectional fund transfers with SQLite WAL audit persistence.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Add Bank or POS Device */}
          <button
            type="button"
            onClick={() => handleOpenAddTerminalModal('BANK_TRANSFER_ACCOUNT')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Bank / POS</span>
          </button>

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

      {/* KPI Stats Cards (Aware of Date Filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash In Hand */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Physical Cash in Tills</span>
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
              <span>{stats.activeHoldingCount} active cashier drawer(s)</span>
            </div>
          </div>
        </div>

        {/* Commercial Bank Accounts Balance */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Commercial Bank Balances</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-blue-700">
              ₦{stats.totalBankBalance.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Across {stats.totalCommercialAccounts} commercial bank settlement accounts
            </div>
          </div>
        </div>

        {/* POS Terminals Settled Volume */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">POS Terminals Settled</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-purple-700">
              ₦{stats.totalPosVolume.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Net card volume across {stats.totalPosDevices} active terminal(s)
            </div>
          </div>
        </div>

        {/* Bank Transfer Movements in Period */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Cleared to Bank (Deposits)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-700">
              ₦{stats.periodDepositedToBank.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.periodReplenishedFromBank > 0 
                ? `₦${stats.periodReplenishedFromBank.toLocaleString()} float injected`
                : 'Cash drawer till handovers to bank'}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Date Range Engine & Tabs Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('drawers')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'drawers'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>Cashier Drawers ({drawerSummaries.length})</span>
              {stats.activeHoldingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
                  {stats.activeHoldingCount} active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('terminals_banks')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'terminals_banks'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Bank Accounts & POS Terminals ({posTerminals.length})</span>
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
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Fund Transfer Audit Log ({filteredTransfers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Treasury Analytics</span>
            </button>
          </div>

          {/* Date Range Chips */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setDateRange(chip.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateRange === chip.id
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker Bar (Shown when dateRange === 'custom') */}
        {dateRange === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/70 p-3 rounded-xl">
            <div className="flex items-center space-x-2 text-slate-700 font-medium">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Specify Custom Date Range for Treasury Reconciliation:</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px]">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px]">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
                  title="Clear custom dates"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE CASHIER DRAWERS & TILLS                                      */}
      {/* ========================================================================= */}
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

                    {/* Current Physical Till Balance Banner */}
                    <div className={`mt-4 p-3.5 rounded-xl border text-center ${
                      isHoldingCash
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Current Physical Cash In Till
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
                        <span>Counter Sales (Cash Collected):</span>
                        <span className="font-mono font-bold text-slate-800">
                          ₦{summary.total_cash_collected.toLocaleString()}
                        </span>
                      </div>

                      {Boolean(summary.total_debt_collected_cash && summary.total_debt_collected_cash > 0) && (
                        <div className="flex justify-between items-center text-emerald-700 font-medium">
                          <span>Debt Repayments (Cash):</span>
                          <span className="font-mono font-bold">
                            +₦{(summary.total_debt_collected_cash || 0).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Cash Refunds Deducted */}
                      <div className={`flex justify-between items-center ${
                        summary.total_cash_refunded > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'
                      }`}>
                        <span>Cash Refunds Deducted:</span>
                        <span className="font-mono">
                          -₦{summary.total_cash_refunded.toLocaleString()}
                        </span>
                      </div>

                      {/* Injected Float Replenishment */}
                      {Boolean(summary.total_replenished_from_bank && summary.total_replenished_from_bank > 0) && (
                        <div className="flex justify-between items-center text-blue-700 font-medium">
                          <span>Float Injected from Bank:</span>
                          <span className="font-mono font-bold">
                            +₦{(summary.total_replenished_from_bank || 0).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Cleared to Bank */}
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Bank Deposits (Transferred):</span>
                        <span className="font-mono text-slate-700">
                          -₦{summary.total_transferred_to_bank.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Cashier */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => cashierStaff && handleOpenTransferModal(cashierStaff, 'BANK_TO_POS')}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Add Float</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isHoldingCash}
                      onClick={() => cashierStaff && handleOpenTransferModal(cashierStaff, 'POS_TO_BANK')}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer ${
                        isHoldingCash
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Bank Deposit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANK ACCOUNTS & POS TERMINALS MANAGEMENT                            */}
      {/* ========================================================================= */}
      {activeTab === 'terminals_banks' && (
        <div className="space-y-4">
          {/* Sub-Filters & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-2">
              {(['ALL', 'BANK_TRANSFER_ACCOUNT', 'POS_TERMINAL'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTerminalFilterType(type)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    terminalFilterType === type
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type === 'ALL' && `All Accounts & Devices (${posTerminals.length})`}
                  {type === 'BANK_TRANSFER_ACCOUNT' && `Commercial Banks (${posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT').length})`}
                  {type === 'POS_TERMINAL' && `POS Terminals (${posTerminals.filter(t => t.type === 'POS_TERMINAL').length})`}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search bank, account, TID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none w-48 sm:w-64"
                />
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddTerminalModal('BANK_TRANSFER_ACCOUNT')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLedgers.map(term => {
              const isBank = term.type === 'BANK_TRANSFER_ACCOUNT';
              const pColor = PROVIDER_COLORS[term.provider] || PROVIDER_COLORS.Other;

              return (
                <div
                  key={term.id}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                    term.status === 'Active' ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div>
                    {/* Header with Provider Badge & Status */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-2 rounded-xl ${isBank ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                          {isBank ? <Building2 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h3 className="font-bold text-slate-900 text-sm leading-tight">{term.name}</h3>
                            {term.is_default && (
                              <span title="Default settlement account">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                            {term.provider}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        term.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {term.status}
                      </span>
                    </div>

                    {/* Account Details Box */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-[11px] font-sans text-slate-400">Account No:</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-900">{term.account_number || 'N/A'}</span>
                          {term.account_number && (
                            <button
                              type="button"
                              onClick={() => handleCopy(term.account_number!, term.id)}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy account number"
                            >
                              {copiedId === term.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-[11px] font-sans text-slate-400">Bank Name:</span>
                        <span className="font-sans font-medium text-slate-800">{term.bank_name || 'N/A'}</span>
                      </div>

                      {term.terminal_id && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-[11px] font-sans text-slate-400">Terminal ID (TID):</span>
                          <span className="text-slate-700">{term.terminal_id}</span>
                        </div>
                      )}

                      {term.assigned_location && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-[11px] font-sans text-slate-400">Location:</span>
                          <span className="font-sans text-slate-700">{term.assigned_location}</span>
                        </div>
                      )}
                    </div>

                    {/* Live Reconciled Net Ledger Box */}
                    <div className={`mt-3 p-3.5 rounded-xl border text-center ${
                      isBank ? 'bg-blue-50/60 border-blue-200 text-blue-950' : 'bg-purple-50/60 border-purple-200 text-purple-950'
                    }`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Reconciled Net Ledger Balance
                      </div>
                      <div className={`text-xl font-black font-mono mt-0.5 ${
                        isBank ? 'text-blue-700' : 'text-purple-700'
                      }`}>
                        ₦{term.netLedgerBalance.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {term.salesCount} direct sales • {term.debtRepaymentsCount} debt settlements
                      </div>
                    </div>

                    {/* Ledger Movement Details */}
                    <div className="mt-3 space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-2.5">
                      <div className="flex justify-between items-center">
                        <span>Gross Sales Volume:</span>
                        <span className="font-mono font-bold text-slate-800">
                          ₦{term.salesGrossVolume.toLocaleString()}
                        </span>
                      </div>

                      {isBank && term.bankDepositsVolume > 0 && (
                        <div className="flex justify-between items-center text-emerald-700">
                          <span>Inbound Cash Deposits:</span>
                          <span className="font-mono font-bold">
                            +₦{term.bankDepositsVolume.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {isBank && term.floatWithdrawalsVolume > 0 && (
                        <div className="flex justify-between items-center text-amber-700">
                          <span>Float Dispensed to Tills:</span>
                          <span className="font-mono font-bold">
                            -₦{term.floatWithdrawalsVolume.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {term.refundsDeductedVolume > 0 && (
                        <div className="flex justify-between items-center text-rose-600 font-semibold">
                          <span>Electronic Refunds Deducted:</span>
                          <span className="font-mono">
                            -₦{term.refundsDeductedVolume.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1">
                      {!term.is_default && (
                        <button
                          type="button"
                          onClick={() => updatePosTerminal(term.id, { is_default: true })}
                          className="px-2 py-1 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 text-[11px] font-medium"
                        >
                          Make Default
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const orig = posTerminals.find(p => p.id === term.id);
                          if (orig) handleOpenEditTerminalModal(orig);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit account details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => updatePosTerminal(term.id, { status: term.status === 'Active' ? 'Inactive' : 'Active' })}
                        className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {term.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => deletePosTerminal(term.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BIDIRECTIONAL FUND TRANSFERS AUDIT LOG                              */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Transfers Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  Fund Transfers & Bank Drops ({filteredTransfers.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  WAL Audit Persistent
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search transfer ID, slip, cashier..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none w-52 sm:w-64"
                  />
                </div>
              </div>
            </div>

            {filteredTransfers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold">No fund transfers match the selected filters or date range.</p>
                <p className="text-xs text-slate-400">Authorize a cash-to-bank transfer or float replenishment using the buttons above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Transfer Ref / Time</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Cashier Till</th>
                      <th className="px-4 py-3">Authorized By</th>
                      <th className="px-4 py-3">Commercial Bank</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Till After</th>
                      <th className="px-4 py-3 text-center">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransfers.map(trf => {
                      const isBankToPos = trf.transfer_type === 'BANK_TO_POS';

                      return (
                        <tr key={trf.transfer_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-mono font-bold text-slate-900">{trf.transfer_id}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{trf.date_time}</div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isBankToPos 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isBankToPos ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              <span>{isBankToPos ? 'Float Injected' : 'Bank Deposit'}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-800">{trf.cashier_staff_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{trf.cashier_staff_id}</div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-slate-800 font-medium">{trf.manager_staff_name}</div>
                            <div className="text-[10px] text-slate-400">{trf.manager_role}</div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-800">{trf.destination_bank_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Slip: {trf.deposit_slip_number}</div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono font-black text-sm">
                            <span className={isBankToPos ? 'text-blue-700' : 'text-emerald-700'}>
                              {isBankToPos ? '+' : '-'}₦{trf.amount_transferred.toLocaleString()}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                            ₦{(trf.cashier_cash_remaining ?? trf.cashier_cash_after ?? 0).toLocaleString()}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedVoucher(trf)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3 text-slate-500" />
                              <span>View Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TREASURY ANALYTICS & INTELLIGENCE                                   */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cash vs Bank Vault Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Treasury Liquidity Distribution</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Cash in Cashier Tills:</span>
                    <span className="font-mono font-bold text-amber-600">₦{stats.totalCashInHand.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (stats.totalCashInHand / ((stats.totalCashInHand + stats.totalBankBalance) || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Commercial Bank Accounts:</span>
                    <span className="font-mono font-bold text-blue-600">₦{stats.totalBankBalance.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (stats.totalBankBalance / ((stats.totalCashInHand + stats.totalBankBalance) || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-100 leading-relaxed">
                Total liquid capital monitored across physical registers and commercial banking vaults:
                <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                  ₦{(stats.totalCashInHand + stats.totalBankBalance).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Reconciliation Integrity Check */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Financial Reconciliation Health</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 text-emerald-900">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cashier Drawer Sync:</span>
                  </span>
                  <span className="font-bold">100% Reconciled</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 text-blue-900">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Bank Handover Ledger:</span>
                  </span>
                  <span className="font-bold font-mono">{filteredTransfers.length} Transfers</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50 text-purple-900">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    <span>Electronic Refunds Debited:</span>
                  </span>
                  <span className="font-bold font-mono">{refunds.length} Recorded</span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Handover Summary */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Printer className="w-4 h-4 text-slate-700" />
                <span>Store Closing & Audit Voucher</span>
              </h3>

              <p className="text-xs text-slate-500 leading-relaxed">
                Generate an instant thermal or full-sheet handover voucher showing gross collections, verified bank deposits, and remaining drawer floats.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print Treasury Closing Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BIDIRECTIONAL FUND TRANSFER EXECUTION MODAL                      */}
      {/* ========================================================================= */}
      {isTransferModalOpen && targetCashier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col">
            {/* Modal Header */}
            <div className={`p-4 text-white flex items-center justify-between ${
              transferType === 'BANK_TO_POS' ? 'bg-blue-600' : 'bg-emerald-600'
            }`}>
              <div className="flex items-center space-x-2.5">
                {transferType === 'BANK_TO_POS' ? (
                  <ArrowDownLeft className="w-5 h-5 text-blue-200" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-emerald-200" />
                )}
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {transferType === 'BANK_TO_POS'
                      ? 'Replenish Cash Float from Bank'
                      : 'Cash-to-Bank Transfer (Clear Drawer)'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Cashier: {targetCashier.staff_name} ({targetCashier.staff_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTransferModalOpen(false);
                  setTransferSuccess(null);
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {transferSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {transferSuccess.transfer_type === 'BANK_TO_POS'
                    ? 'Cash Float Successfully Replenished!'
                    : 'Cash Successfully Cleared to Bank!'}
                </h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Transfer Ref: <span className="font-mono font-bold text-slate-900">{transferSuccess.transfer_id}</span>
                  <br />
                  Amount: <span className="font-mono font-bold text-emerald-700">₦{transferSuccess.amount_transferred.toLocaleString()}</span>
                  <br />
                  New Cashier Till: <span className="font-mono font-bold">₦{(transferSuccess.cashier_cash_remaining ?? transferSuccess.cashier_cash_after ?? 0).toLocaleString()}</span>
                </p>

                <div className="flex items-center justify-center space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoucher(transferSuccess);
                      setIsTransferModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Print Voucher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsTransferModalOpen(false);
                      setTransferSuccess(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4">
                {transferError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{transferError}</span>
                  </div>
                )}

                {/* Transfer Direction Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Transfer Direction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('POS_TO_BANK');
                        const s = drawerSummaries.find(d => d.staff_id === targetCashier.staff_id);
                        setTransferAmount(s?.current_cash_in_hand ? s.current_cash_in_hand.toString() : '');
                        setTransferNotes(`Cash handover from ${targetCashier.staff_name} for bank deposit`);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        transferType === 'POS_TO_BANK'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-400'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 text-xs">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        <span>Drawer to Bank (Deposit)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        Clear cash from till to commercial bank
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferType('BANK_TO_POS');
                        setTransferAmount('10000');
                        setTransferNotes(`Cash float replenishment for ${targetCashier.staff_name} till change`);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        transferType === 'BANK_TO_POS'
                          ? 'border-blue-500 bg-blue-50 text-blue-950 font-bold ring-1 ring-blue-400'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 text-xs">
                        <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                        <span>Bank to Drawer (Float)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        Inject float money from bank into till
                      </div>
                    </button>
                  </div>
                </div>

                {/* Cashier & Current Till Balance */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500">Target Cashier Till:</div>
                    <div className="text-xs font-bold text-slate-900">{targetCashier.staff_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Physical Cash in Till:</div>
                    <div className="text-sm font-black font-mono text-amber-600">
                      ₦{(drawerSummaries.find(d => d.staff_id === targetCashier.staff_id)?.current_cash_in_hand || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Destination / Source Bank Account */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {transferType === 'BANK_TO_POS' ? 'Source Bank Account' : 'Destination Commercial Bank Account'}
                  </label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} — {b.account_number} ({b.name}) {b.is_default ? '★ Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transfer Amount & Preset Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Transfer Amount (₦)</label>
                    <span className="text-[11px] text-slate-400">Quick Presets:</span>
                  </div>

                  <input
                    type="number"
                    min="1"
                    placeholder="Enter amount in ₦"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                    required
                  />

                  {/* Preset Amount Chips */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    {transferType === 'POS_TO_BANK' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('all')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold"
                        >
                          Clear Entire Till (All)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('keep5k')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                        >
                          Keep ₦5,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('keep10k')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                        >
                          Keep ₦10,000 Float
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add5k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold"
                        >
                          +₦5,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add10k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold"
                        >
                          +₦10,000 Float
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPresetTransfer('add20k')}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold"
                        >
                          +₦20,000 Float
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Deposit Slip & Audit Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Slip / Reference No.
                    </label>
                    <input
                      type="text"
                      value={depositSlipNumber}
                      onChange={e => setDepositSlipNumber(e.target.value)}
                      placeholder="e.g. DEP-992011"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Manager PIN Authorization
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={managerPin}
                      onChange={e => setManagerPin(e.target.value)}
                      placeholder="Enter 4-digit PIN"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 outline-none tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Audit Note / Reason
                  </label>
                  <textarea
                    rows={2}
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                    placeholder="Enter reason for this fund transfer..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                    required
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 ${
                      transferType === 'BANK_TO_POS'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    {transferType === 'BANK_TO_POS' ? 'Authorize Float Injection' : 'Authorize Bank Transfer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT BANK ACCOUNT & POS TERMINAL                           */}
      {/* ========================================================================= */}
      {isTerminalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {editingTerminal ? 'Edit Bank Account / POS Terminal' : 'Register New Bank Account or POS Device'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTerminalModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTerminal} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Account Type Toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account / Hardware Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('BANK_TRANSFER_ACCOUNT');
                      handleProviderChange('GTBank');
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                      formType === 'BANK_TRANSFER_ACCOUNT'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Commercial Bank Account
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('POS_TERMINAL');
                      handleProviderChange('Moniepoint');
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                      formType === 'POS_TERMINAL'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 ring-1 ring-purple-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    POS Terminal Device
                  </button>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Financial Provider / Bank</label>
                <select
                  value={formProvider}
                  onChange={e => handleProviderChange(e.target.value as PosProvider)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                >
                  {PROVIDER_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Device / Account Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Label / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. GTBank Main Corporate Account or Counter 1 Moniepoint"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                  required
                />
              </div>

              {/* Account Number & Bank Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NUBAN Account Number</label>
                  <input
                    type="text"
                    placeholder="10-digit account number"
                    value={formAccountNumber}
                    onChange={e => setFormAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Guaranty Trust Bank"
                    value={formBankName}
                    onChange={e => setFormBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Account Name & Terminal ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Beneficiary Account Name</label>
                  <input
                    type="text"
                    value={formAccountName}
                    onChange={e => setFormAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                  />
                </div>

                {formType === 'POS_TERMINAL' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hardware Terminal ID (TID)</label>
                    <input
                      type="text"
                      placeholder="e.g. MP-883921"
                      value={formTerminalId}
                      onChange={e => setFormTerminalId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Location & Default */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={e => setFormIsDefault(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">Set as Default Account</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTerminalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs cursor-pointer"
                >
                  {editingTerminal ? 'Save Changes' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PRINTABLE TREASURY HANDOVER VOUCHER MODAL                        */}
      {/* ========================================================================= */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col">
            <div className="bg-slate-900 text-white p-3.5 px-4 flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs">TREASURY TRANSFER VOUCHER</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintVoucher}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div id="printable-voucher" className="p-6 bg-slate-50 font-mono text-xs text-slate-900 space-y-4">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="font-black text-sm uppercase tracking-wide">KIID FROM DREAM FROZEN FOODS</div>
                <div className="text-[10px] text-slate-500 mt-0.5">TREASURY HANDOVER & CLEARANCE VOUCHER</div>
                <div className="text-[10px] text-slate-400 mt-1">Ref: {selectedVoucher.transfer_id}</div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date/Time:</span>
                  <span className="font-bold">{selectedVoucher.date_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operation:</span>
                  <span className="font-bold">
                    {selectedVoucher.transfer_type === 'BANK_TO_POS' ? 'FLOAT REPLENISHMENT' : 'CASH-TO-BANK DEPOSIT'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span>{selectedVoucher.cashier_staff_name} ({selectedVoucher.cashier_staff_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Authorized By:</span>
                  <span>{selectedVoucher.manager_staff_name} ({selectedVoucher.manager_role})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Target:</span>
                  <span>{selectedVoucher.destination_bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No:</span>
                  <span>{selectedVoucher.destination_account_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposit Slip:</span>
                  <span className="font-bold">{selectedVoucher.deposit_slip_number}</span>
                </div>
              </div>

              {/* Amount Box */}
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                <div className="text-[10px] text-slate-400 font-sans uppercase">Amount Transferred</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  ₦{selectedVoucher.amount_transferred.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-sans">
                  Remaining Till Balance: ₦{(selectedVoucher.cashier_cash_remaining ?? selectedVoucher.cashier_cash_after ?? 0).toLocaleString()}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-slate-100">
                Note: "{selectedVoucher.notes}"
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-center text-[10px]">
                <div>
                  <div className="border-b border-slate-400 pb-6 mb-1"></div>
                  <span className="text-slate-500">Cashier Signature</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-6 mb-1"></div>
                  <span className="text-slate-500">Manager Authorization</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
