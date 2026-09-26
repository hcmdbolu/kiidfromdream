import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  CreditCard, 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Copy, 
  Star, 
  Search, 
  Filter, 
  ShieldCheck, 
  MapPin, 
  Hash, 
  Smartphone, 
  Clock, 
  AlertTriangle,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { PosTerminalConfig, PosAccountType, PosProvider } from '../../types';

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

export const PosTerminalSetupManager: React.FC = () => {
  const { 
    posTerminals, 
    addPosTerminal, 
    updatePosTerminal, 
    deletePosTerminal, 
    sales, 
    activeStaff 
  } = usePos();

  const [filterType, setFilterType] = useState<'ALL' | 'POS_TERMINAL' | 'BANK_TRANSFER_ACCOUNT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminalConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<PosAccountType>('POS_TERMINAL');
  const [formProvider, setFormProvider] = useState<PosProvider>('Moniepoint');
  const [formTerminalId, setFormTerminalId] = useState('');
  const [formAccountName, setFormAccountName] = useState('Kiid From Dream Frozen Foods Ltd');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formBankName, setFormBankName] = useState('Moniepoint Microfinance Bank');
  const [formLocation, setFormLocation] = useState('Main Retail Counter');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);

  // Compute tagged transaction volumes per terminal/bank account
  const terminalStats = useMemo(() => {
    const stats: Record<string, { count: number; totalVolume: number }> = {};
    
    posTerminals.forEach(t => {
      stats[t.id] = { count: 0, totalVolume: 0 };
    });

    sales.forEach(sale => {
      // Single payment match
      if (sale.pos_terminal_id && stats[sale.pos_terminal_id]) {
        stats[sale.pos_terminal_id].count += 1;
        stats[sale.pos_terminal_id].totalVolume += sale.final_amount;
      } else if (sale.payment_splits && sale.payment_splits.length > 0) {
        // Split payment matches
        sale.payment_splits.forEach(split => {
          if (split.pos_terminal_id && stats[split.pos_terminal_id]) {
            stats[split.pos_terminal_id].count += 1;
            stats[split.pos_terminal_id].totalVolume += split.amount;
          }
        });
      }
    });

    return stats;
  }, [posTerminals, sales]);

  // Aggregate stats
  const totalPosCount = posTerminals.filter(t => t.type === 'POS_TERMINAL').length;
  const totalBankCount = posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT').length;
  const totalVolumeTracked = Object.values(terminalStats).reduce((sum, s) => sum + s.totalVolume, 0);

  // Open modal for new
  const handleOpenAddModal = () => {
    setEditingTerminal(null);
    setFormName('');
    setFormType('POS_TERMINAL');
    setFormProvider('Moniepoint');
    setFormTerminalId(`MP-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormAccountName('Kiid From Dream Frozen Foods Ltd');
    setFormAccountNumber('');
    setFormBankName('Moniepoint Microfinance Bank');
    setFormLocation('Main Retail Counter 1');
    setFormIsDefault(false);
    setFormNotes('');
    setFormStatus('Active');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (term: PosTerminalConfig) => {
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
    setIsModalOpen(true);
  };

  // Provider change auto-updates bank name
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

  // Submit form
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
        terminal_id: formType === 'POS_TERMINAL' ? formTerminalId.trim() : undefined,
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
        terminal_id: formType === 'POS_TERMINAL' ? formTerminalId.trim() : undefined,
        account_name: formAccountName.trim(),
        account_number: formAccountNumber.trim(),
        bank_name: formBankName.trim(),
        assigned_location: formLocation.trim() || undefined,
        is_default: formIsDefault,
        notes: formNotes.trim() || undefined,
        status: formStatus,
      });
    }

    setIsModalOpen(false);
  };

  // Copy account number helper
  const handleCopyAccount = (accountNumber: string, id: string) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtered devices list
  const filteredTerminals = useMemo(() => {
    return posTerminals.filter(term => {
      const matchType = filterType === 'ALL' || term.type === filterType;
      const matchSearch = 
        term.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.account_number.includes(searchQuery) ||
        term.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (term.terminal_id && term.terminal_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (term.assigned_location && term.assigned_location.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [posTerminals, filterType, searchQuery]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-sm">
            <CreditCard className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              POS Terminal Setup & Bank Accounts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Map multiple POS devices (Moniepoint, OPay, GTBank POS) and commercial bank accounts to track sales by terminal.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add POS Terminal / Bank</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Wireless POS Machines</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {totalPosCount} <span className="text-xs font-normal text-slate-400">devices</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Moniepoint, OPay, GTB, etc.</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Direct Bank Transfer Accounts</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {totalBankCount} <span className="text-xs font-normal text-slate-400">accounts</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Commercial settlement accounts</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Tracked Collections</span>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
              ₦{totalVolumeTracked.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tagged directly to terminals & banks</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal ID, bank account number, provider, or location..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({posTerminals.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('POS_TERMINAL')}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                filterType === 'POS_TERMINAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              POS Terminals ({totalPosCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('BANK_TRANSFER_ACCOUNT')}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                filterType === 'BANK_TRANSFER_ACCOUNT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bank Accounts ({totalBankCount})
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTerminals.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            No terminals or accounts match your search.
          </div>
        ) : (
          filteredTerminals.map(term => {
            const providerStyle = PROVIDER_COLORS[term.provider] || PROVIDER_COLORS.Other;
            const stats = terminalStats[term.id] || { count: 0, totalVolume: 0 };
            const isPos = term.type === 'POS_TERMINAL';

            return (
              <div
                key={term.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Provider Badge, Default Star, Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}>
                        {term.provider}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {isPos ? 'POS Machine' : 'Bank Account'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {term.is_default && (
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>Default</span>
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full ${term.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} title={term.status} />
                    </div>
                  </div>

                  {/* Title & Location */}
                  <div className="mt-3">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{term.name}</h3>
                    {term.assigned_location && (
                      <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{term.assigned_location}</span>
                      </div>
                    )}
                  </div>

                  {/* Account Number Box (with quick copy) */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {term.bank_name}
                      </span>
                      {term.terminal_id && (
                        <span className="text-[10px] font-mono text-slate-500">
                          TID: {term.terminal_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-slate-900 text-sm tracking-wider">
                        {term.account_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(term.account_number, term.id)}
                        className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer flex items-center space-x-1 text-[10px]"
                        title="Copy Account Number"
                      >
                        {copiedId === term.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 truncate" title={term.account_name}>
                      {term.account_name}
                    </div>
                  </div>

                  {/* Transaction Volume Summary */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[10px] text-slate-400">Tagged Sales</span>
                      <div className="font-mono font-bold text-slate-800">
                        {stats.count} txns
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">Volume</span>
                      <div className="font-mono font-bold text-emerald-700">
                        ₦{stats.totalVolume.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {term.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 italic line-clamp-1" title={term.notes}>
                      "{term.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {!term.is_default && (
                      <button
                        type="button"
                        onClick={() => updatePosTerminal(term.id, { is_default: true })}
                        className="text-[11px] text-slate-500 hover:text-amber-600 font-semibold cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(term)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit Terminal / Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(term.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Terminal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT TERMINAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500 text-slate-950">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingTerminal ? 'Edit Terminal / Account' : 'Configure New POS Terminal / Bank Account'}
                  </h3>
                  <p className="text-xs text-slate-400">Map device account numbers for direct sale routing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTerminal} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              {/* Account Type: POS Terminal vs Bank Transfer Account */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Account Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('POS_TERMINAL');
                      if (!formTerminalId) setFormTerminalId(`MP-${Math.floor(100000 + Math.random() * 900000)}`);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      formType === 'POS_TERMINAL'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>POS Terminal (Card Device)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('BANK_TRANSFER_ACCOUNT')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      formType === 'BANK_TRANSFER_ACCOUNT'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span>Commercial Bank Account</span>
                  </button>
                </div>
              </div>

              {/* Provider & Terminal Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Bank / Provider *</label>
                  <select
                    value={formProvider}
                    onChange={(e) => handleProviderChange(e.target.value as PosProvider)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {PROVIDER_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Friendly Device Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Counter 1 - Moniepoint POS"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Account Number & Bank Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Account Number (10 Digits) *</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 0123456789"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Bank Name *</label>
                  <input
                    type="text"
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    placeholder="e.g. Guaranty Trust Bank"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Account Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Registered Account Holder Name *</label>
                <input
                  type="text"
                  value={formAccountName}
                  onChange={(e) => setFormAccountName(e.target.value)}
                  placeholder="e.g. Kiid From Dream Seafoods Ltd"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Terminal Serial ID (if POS) & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formType === 'POS_TERMINAL' && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">POS Terminal ID / Serial</label>
                    <input
                      type="text"
                      value={formTerminalId}
                      onChange={(e) => setFormTerminalId(e.target.value)}
                      placeholder="e.g. MP-882190 or OPAY-7721"
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Assigned Counter / Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Counter 1 - Retail Desk"
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Default checkbox & Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800">
                    Set as Default for {formType === 'POS_TERMINAL' ? 'POS Sales' : 'Bank Transfers'}
                  </span>
                </label>

                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'Active' | 'Inactive')}
                  className="py-1 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Notes / Setup Instructions (Optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Primary wireless terminal at retail front desk"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer"
                >
                  {editingTerminal ? 'Update Configuration' : 'Save Terminal'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Terminal Configuration?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will remove the terminal from the checkout selector. Past transaction audit records remain intact.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePosTerminal(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
