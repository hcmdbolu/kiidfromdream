import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, CycleCountRecord } from '../../types';
import {
  ClipboardCheck,
  Scale,
  History,
  Printer,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  FileText,
  Package,
  Calendar,
  UserCheck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Download,
  Check,
  RefreshCw,
  PlusCircle,
  X
} from 'lucide-react';

export const CycleCountManager: React.FC = () => {
  const { 
    products, 
    cycleCounts, 
    performCycleCount, 
    activeStaff, 
    receiptSettings,
    hasPermission 
  } = usePos();

  const [activeSubTab, setActiveSubTab] = useState<'AUDIT_FORM' | 'LEDGER_HISTORY'>('AUDIT_FORM');
  const [selectedSn, setSelectedSn] = useState<string>(products[0]?.item_sn || '');
  const [countedQty, setCountedQty] = useState<number>(products[0]?.quantity || 0);
  const [reason, setReason] = useState<string>('Routine physical audit & scale calibration');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [adjustStock, setAdjustStock] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [lastCommittedCount, setLastCommittedCount] = useState<CycleCountRecord | null>(null);

  // Ledger Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [varianceFilter, setVarianceFilter] = useState<'ALL' | 'MATCH' | 'DISCREPANCY' | 'RECONCILED'>('ALL');
  const [printingSlip, setPrintingSlip] = useState<CycleCountRecord | null>(null);

  const canCycleCount = hasPermission('CAN_CYCLE_COUNT');

  // Currently audited product calculation
  const currentProduct = useMemo(() => {
    return products.find(p => p.item_sn === selectedSn) || products[0];
  }, [products, selectedSn]);

  const systemQty = currentProduct?.quantity ?? 0;
  const discrepancy = Math.round(((countedQty ?? 0) - systemQty) * 1000) / 1000;
  const costPrice = currentProduct?.item_cost || 0;
  const financialVariance = Math.round(discrepancy * costPrice);

  // Filtered ledger history with safe null-checking
  const filteredHistory = useMemo(() => {
    return (cycleCounts || []).filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const name = (c.item_name || '').toLowerCase();
      const sn = (c.item_sn || '').toLowerCase();
      const id = (c.count_id || '').toLowerCase();
      const staff = (c.staff_name || '').toLowerCase();
      const r = (c.reason || '').toLowerCase();

      const matchSearch = !q || name.includes(q) || sn.includes(q) || id.includes(q) || staff.includes(q) || r.includes(q);

      let matchVariance = true;
      if (varianceFilter === 'MATCH') matchVariance = c.discrepancy === 0;
      else if (varianceFilter === 'DISCREPANCY') matchVariance = c.discrepancy !== 0;
      else if (varianceFilter === 'RECONCILED') matchVariance = Boolean(c.adjusted);

      return matchSearch && matchVariance;
    });
  }, [cycleCounts, searchQuery, varianceFilter]);

  // Aggregate KPI metrics
  const stats = useMemo(() => {
    const list = cycleCounts || [];
    const totalCounts = list.length;
    const discrepanciesFound = list.filter(c => c.discrepancy !== 0).length;
    const reconciledCount = list.filter(c => c.adjusted).length;
    const exactMatches = list.filter(c => c.discrepancy === 0).length;
    
    // Net physical variance in items
    const netVarianceQty = list.reduce((sum, c) => sum + (Number(c.discrepancy) || 0), 0);

    return {
      totalCounts,
      discrepanciesFound,
      reconciledCount,
      exactMatches,
      netVarianceQty: Math.round(netVarianceQty * 100) / 100,
    };
  }, [cycleCounts]);

  const handleProductSelect = (sn: string) => {
    setSelectedSn(sn);
    const prod = products.find(p => p.item_sn === sn);
    if (prod) {
      setCountedQty(prod.quantity);
    }
  };

  const handleExecuteCount = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!canCycleCount) {
      setFormError('Permission Denied: Supervisor or Manager role required to conduct cycle counts.');
      return;
    }

    if (!currentProduct) {
      setFormError('Please select a valid inventory product to audit.');
      return;
    }

    if (countedQty < 0) {
      setFormError('Physical count cannot be negative.');
      return;
    }

    const fullReason = customNotes.trim() ? `${reason}: ${customNotes.trim()}` : reason;

    const res = performCycleCount({
      item_sn: currentProduct.item_sn,
      counted_qty: countedQty,
      reason: fullReason,
      adjustStock,
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to complete physical count audit.');
    } else {
      setLastCommittedCount(res.record || null);
      setFormSuccess(
        `Cycle count ${res.record?.count_id} permanently recorded in SQLite. Database stock ${
          adjustStock
            ? 'was reconciled immediately to ' + countedQty + ' ' + (currentProduct.product_measure_unit || 'units')
            : 'was audited without changing database stock'
        }.`
      );
    }
  };

  const handlePrintSlip = (rec: CycleCountRecord) => {
    setPrintingSlip(rec);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-500/15 text-amber-800 rounded-xl border border-amber-300">
              <ClipboardCheck className="w-5 h-5 text-amber-700" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Cycle Count Stock Audit & Reconciliation
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold">
              Supervisor Discrepancy Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conduct physical scale audits, reconcile inventory discrepancies immediately in SQLite, and trace tamper-evident stock shrinkage records.
          </p>
        </div>

        {/* Tab switch pills */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('AUDIT_FORM');
              setFormSuccess(null);
              setFormError(null);
            }}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'AUDIT_FORM'
                ? 'bg-white text-amber-900 shadow-xs border border-amber-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4 text-amber-600" />
            <span>Perform Cycle Count</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('LEDGER_HISTORY');
              setFormSuccess(null);
              setFormError(null);
            }}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'LEDGER_HISTORY'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Audit History Ledger ({stats.totalCounts})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Cycle Audits */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Physical Audits</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">{stats.totalCounts}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Recorded in SQLite ledger</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Variances Identified */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Variances Detected</div>
            <div className="text-2xl font-black text-rose-700 mt-0.5 font-mono">{stats.discrepanciesFound}</div>
            <div className="text-[10px] text-rose-500 mt-0.5">Items with stock discrepancies</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Immediate Reconciliations */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Stock Reconciled</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5 font-mono">{stats.reconciledCount}</div>
            <div className="text-[10px] text-emerald-500 mt-0.5">Auto-adjusted database stock</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Net Physical Variance Qty */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Net Unit Variance</div>
            <div className={`text-2xl font-black mt-0.5 font-mono ${stats.netVarianceQty >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
              {stats.netVarianceQty > 0 ? `+${stats.netVarianceQty}` : stats.netVarianceQty}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Cumulative shrinkage / gain</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main View Area */}
      {activeSubTab === 'AUDIT_FORM' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <span>Conduct Physical Count & Scale Inspection</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare actual counted store inventory or scale weight against central SQLite balance.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              Inspector: <strong className="text-slate-800">{activeStaff.staff_name}</strong> ({activeStaff.role})
            </div>
          </div>

          <div className="p-6">
            {formError && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col space-y-2 text-xs text-emerald-900">
                <div className="flex items-center space-x-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
                {lastCommittedCount && (
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePrintSlip(lastCommittedCount)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Reconciliation Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSuccess(null);
                        setLastCommittedCount(null);
                      }}
                      className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Count Another Item
                    </button>
                  </div>
                )}
              </div>
            )}

            {products.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Package className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-sm">No Inventory Products Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no products registered in the database yet. Add or import inventory items before conducting physical cycle count audits.
                </p>
              </div>
            ) : (
              <form onSubmit={handleExecuteCount} className="space-y-6">
                
                {/* Product Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Product to Audit *
                  </label>
                  <select
                    value={selectedSn}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    {products.map(p => (
                      <option key={p.item_sn} value={p.item_sn}>
                        {p.item_sn} — {p.item_name} ({p.quantity} {p.product_measure_unit || 'units'} in system, Cost: ₦{(p.item_cost || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Variance Comparison Cards */}
                {currentProduct && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Current System Stock
                      </span>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                        {systemQty}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {currentProduct.product_measure_unit || 'units'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">Recorded in central database</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Actual Physical Count / Scale Reading
                      </span>
                      <div className="text-2xl font-black text-amber-600 font-mono mt-1">
                        {countedQty}{' '}
                        <span className="text-xs font-normal text-amber-500">
                          {currentProduct.product_measure_unit || 'units'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">Physically verified quantity</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Variance & Financial Impact
                      </span>
                      <div
                        className={`text-2xl font-black font-mono mt-1 flex items-center space-x-1.5 ${
                          discrepancy === 0
                            ? 'text-emerald-600'
                            : discrepancy > 0
                            ? 'text-blue-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {discrepancy === 0 ? (
                          <Minus className="w-5 h-5 shrink-0" />
                        ) : discrepancy > 0 ? (
                          <TrendingUp className="w-5 h-5 shrink-0" />
                        ) : (
                          <TrendingDown className="w-5 h-5 shrink-0" />
                        )}
                        <span>
                          {discrepancy > 0 ? `+${discrepancy}` : discrepancy}{' '}
                          <span className="text-xs font-normal">{currentProduct.product_measure_unit || 'units'}</span>
                        </span>
                      </div>
                      <span className="text-[11px] font-bold block mt-0.5">
                        {financialVariance === 0 ? (
                          <span className="text-emerald-600 font-semibold">Zero Financial Variance</span>
                        ) : financialVariance > 0 ? (
                          <span className="text-blue-600">+₦{financialVariance.toLocaleString()} stock gain</span>
                        ) : (
                          <span className="text-rose-600">-₦{Math.abs(financialVariance).toLocaleString()} inventory loss</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Counted Quantity Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Physical Counted Quantity / Weight ({currentProduct?.product_measure_unit || 'units'}) *</span>
                    <span className="text-[11px] text-amber-800 font-medium">Physical count / digital scale reading</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={countedQty}
                      onChange={(e) => setCountedQty(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 pr-16 text-base font-bold font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-500">
                      {currentProduct?.product_measure_unit || 'units'}
                    </span>
                  </div>
                </div>

                {/* Audit Reason Category & Specific Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Audit Reason Category *
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="Routine physical audit & scale calibration">Routine physical audit & scale calibration</option>
                      <option value="Packaging damage or shrinkage discrepancy">Packaging damage or shrinkage discrepancy</option>
                      <option value="Trimming, handling, or portioning loss">Trimming, handling, or portioning loss</option>
                      <option value="Damaged / expired stock write-off">Damaged / expired stock write-off</option>
                      <option value="Data entry / cashier miscount correction">Cashier miscount correction</option>
                      <option value="Suspected theft / inventory shrinkage investigation">Suspected theft / inventory shrinkage investigation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Specific Notes & Scale Observation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Calibrated on scale #2; 2 frozen cartons unsealed"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Stock Reconcile Option Checkbox */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="adjustStockCheckbox"
                    checked={adjustStock}
                    onChange={(e) => setAdjustStock(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="adjustStockCheckbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                    <span className="font-bold text-slate-900 block">
                      Reconcile Database Stock Immediately (Commit to SQLite)
                    </span>
                    Update the current inventory level in SQLite to match the counted {countedQty}{' '}
                    {currentProduct?.product_measure_unit || 'units'}. Discrepancy details will be logged permanently to the cryptographic audit trail ledger.
                  </label>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Commit Physical Count to SQLite Ledger</span>
                  </button>
                </div>

              </form>
            )}
          </div>

        </div>
      ) : (
        /* Audit History & Discrepancy Ledger */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit ledger by count ID, item name, SKU, reason, or supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={varianceFilter}
                onChange={(e) => setVarianceFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="ALL">All Audit Records ({cycleCounts.length})</option>
                <option value="DISCREPANCY">Discrepancies Only</option>
                <option value="MATCH">Exact Matches (Zero Discrepancy)</option>
                <option value="RECONCILED">Reconciled to Stock</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">No cycle count audit records match your query.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Records are logged permanently when physical audits are performed.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-200 font-semibold">
                  <tr>
                    <th className="p-3.5">Count Ref / Date</th>
                    <th className="p-3.5">Audited Product</th>
                    <th className="p-3.5 text-right">System Qty</th>
                    <th className="p-3.5 text-right">Physical Count</th>
                    <th className="p-3.5 text-right">Variance</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((rec) => {
                    const isMatch = (Number(rec.discrepancy) || 0) === 0;
                    const isGain = (Number(rec.discrepancy) || 0) > 0;
                    return (
                      <tr key={rec.count_id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-slate-900">{rec.count_id}</div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">{rec.date_time}</div>
                          <div className="text-[10px] text-slate-600 flex items-center space-x-1 mt-0.5">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span>{rec.staff_name || 'Supervisor'}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{rec.item_name || rec.item_sn}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rec.item_sn}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">{rec.reason}</div>
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-600">
                          {rec.system_qty} {rec.unit || 'units'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                          {rec.counted_qty} {rec.unit || 'units'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black">
                          <span
                            className={
                              isMatch ? 'text-emerald-600' : isGain ? 'text-blue-600' : 'text-rose-600'
                            }
                          >
                            {isGain ? `+${rec.discrepancy}` : rec.discrepancy} {rec.unit || 'units'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {rec.adjusted ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Reconciled
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Audited Only
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintSlip(rec)}
                            title="Print Stock Reconciliation Slip"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
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
      )}

      {/* Printable Reconciliation Thermal Slip (Hidden in web, displayed on print) */}
      {printingSlip && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 z-9999 text-slate-900 font-mono text-xs">
          <div className="text-center pb-4 border-b border-dashed border-slate-400">
            <h1 className="text-base font-bold uppercase">{receiptSettings.business_name || 'KIID FROM DREAM'}</h1>
            <p className="text-[10px]">{receiptSettings.tagline}</p>
            <p className="text-[10px]">{receiptSettings.address_line1}</p>
            <p className="text-[10px]">Tel: {receiptSettings.phone_numbers}</p>
            <h2 className="text-sm font-black mt-2 uppercase tracking-wider">STOCK RECONCILIATION SLIP</h2>
          </div>

          <div className="py-3 border-b border-dashed border-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Count Reference:</span>
              <span className="font-bold">{printingSlip.count_id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span>{printingSlip.date_time}</span>
            </div>
            <div className="flex justify-between">
              <span>Auditing Inspector:</span>
              <span>{printingSlip.staff_name} ({printingSlip.role || 'Supervisor'})</span>
            </div>
          </div>

          <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold">Item:</span>
              <span className="font-bold">{printingSlip.item_name} ({printingSlip.item_sn})</span>
            </div>
            <div className="flex justify-between">
              <span>Pre-Audit System Qty:</span>
              <span>{printingSlip.system_qty} {printingSlip.unit}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Physical Scale Count:</span>
              <span>{printingSlip.counted_qty} {printingSlip.unit}</span>
            </div>
            <div className="flex justify-between font-black">
              <span>Discrepancy / Variance:</span>
              <span>{(Number(printingSlip.discrepancy) || 0) > 0 ? `+${printingSlip.discrepancy}` : printingSlip.discrepancy} {printingSlip.unit}</span>
            </div>
            <div className="flex justify-between">
              <span>Database Stock Reconciled:</span>
              <span>{printingSlip.adjusted ? 'YES (Committed to SQLite)' : 'NO (Audited Only)'}</span>
            </div>
          </div>

          <div className="py-3 border-b border-dashed border-slate-400">
            <span className="block font-bold">Reason / Notes:</span>
            <p className="text-[11px] text-slate-700 mt-0.5">{printingSlip.reason}</p>
          </div>

          <div className="pt-6 space-y-4 text-center">
            <div className="flex justify-between pt-6 text-[10px]">
              <div className="border-t border-slate-400 w-28 pt-1">Auditor Sign</div>
              <div className="border-t border-slate-400 w-28 pt-1">Manager Sign</div>
            </div>
            <p className="text-[9px] text-slate-500">Official Physical Inventory Audit Document — Committed to SQLite WAL Ledger</p>
          </div>
        </div>
      )}

    </div>
  );
};
