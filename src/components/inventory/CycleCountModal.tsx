import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, CycleCountRecord } from '../../types';
import {
  ClipboardCheck,
  X,
  AlertCircle,
  CheckCircle2,
  Scale,
  History,
  Printer,
  Search,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  FileText,
} from 'lucide-react';

interface CycleCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: Product;
}

export const CycleCountModal: React.FC<CycleCountModalProps> = ({
  isOpen,
  onClose,
  preselectedProduct,
}) => {
  const { products, cycleCounts, performCycleCount, activeStaff, receiptSettings } = usePos();

  const [activeTab, setActiveTab] = useState<'NEW_COUNT' | 'HISTORY'>('NEW_COUNT');
  const [selectedSn, setSelectedSn] = useState<string>(
    preselectedProduct?.item_sn || products[0]?.item_sn || ''
  );
  const [countedQty, setCountedQty] = useState<number>(
    preselectedProduct?.quantity || products[0]?.quantity || 0
  );
  const [reason, setReason] = useState<string>('Routine physical audit & scale calibration');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [adjustStock, setAdjustStock] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRecordedCount, setLastRecordedCount] = useState<CycleCountRecord | null>(null);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [printingRecord, setPrintingRecord] = useState<CycleCountRecord | null>(null);

  if (!isOpen) return null;

  const currentProduct = products.find(p => p.item_sn === selectedSn) || products[0];
  const systemQty = currentProduct?.quantity ?? 0;
  const discrepancy = Math.round(((countedQty ?? 0) - systemQty) * 1000) / 1000;
  const costPrice = currentProduct?.item_cost || 0;
  const financialVariance = Math.round(discrepancy * costPrice);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return cycleCounts || [];
    const q = historySearch.toLowerCase().trim();
    return (cycleCounts || []).filter(
      c =>
        (c.item_name || '').toLowerCase().includes(q) ||
        (c.item_sn || '').toLowerCase().includes(q) ||
        (c.count_id || '').toLowerCase().includes(q) ||
        (c.staff_name || '').toLowerCase().includes(q) ||
        (c.reason || '').toLowerCase().includes(q)
    );
  }, [cycleCounts, historySearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentProduct) {
      setError('Please select a valid product to audit.');
      return;
    }

    if (countedQty < 0) {
      setError('Counted physical quantity cannot be negative.');
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
      setError(res.error || 'Failed to complete cycle count.');
    } else {
      setLastRecordedCount(res.record || null);
      setSuccess(
        `Cycle count recorded (${res.record?.count_id}). Stock ${
          adjustStock
            ? 'reconciled in database to ' + countedQty + ' ' + currentProduct.product_measure_unit
            : 'audited without altering database stock'
        }.`
      );
    }
  };

  const handlePrintSlip = (record: CycleCountRecord) => {
    setPrintingRecord(record);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Physical Stock Cycle Count & Audit</h3>
              <p className="text-xs text-slate-400">
                Supervisor Inventory Reconciliation & Discrepancy Ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 shrink-0">
          <button
            onClick={() => {
              setActiveTab('NEW_COUNT');
              setSuccess(null);
              setError(null);
            }}
            className={`flex items-center space-x-2 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'NEW_COUNT'
                ? 'border-amber-600 text-amber-700 bg-white/60 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Perform Cycle Count</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('HISTORY');
              setSuccess(null);
              setError(null);
            }}
            className={`flex items-center space-x-2 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'HISTORY'
                ? 'border-amber-600 text-amber-700 bg-white/60 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit History Ledger ({cycleCounts.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'NEW_COUNT' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center space-x-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{success}</span>
                  </div>
                  {lastRecordedCount && (
                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handlePrintSlip(lastRecordedCount)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Reconciliation Slip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSuccess(null);
                          setLastRecordedCount(null);
                        }}
                        className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-lg font-semibold text-xs transition-colors"
                      >
                        Count Another Product
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Product to Audit
                </label>
                <select
                  value={selectedSn}
                  disabled={products.length === 0}
                  onChange={(e) => {
                    const sn = e.target.value;
                    setSelectedSn(sn);
                    const prod = products.find(p => p.item_sn === sn);
                    if (prod) setCountedQty(prod.quantity);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:opacity-60"
                >
                  {products.length === 0 ? (
                    <option value="">No products registered in database</option>
                  ) : (
                    products.map(p => (
                      <option key={p.item_sn} value={p.item_sn}>
                        {p.item_sn} - {p.item_name} ({p.quantity} {p.product_measure_unit || 'units'} in database)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Current vs Counted Cards */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Current Database Stock
                  </span>
                  <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                    {systemQty}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      {currentProduct?.product_measure_unit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Pre-audit balance</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Physical Count
                  </span>
                  <div className="text-lg font-black text-amber-600 font-mono mt-0.5">
                    {countedQty}{' '}
                    <span className="text-xs font-normal text-amber-500">
                      {currentProduct?.product_measure_unit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Scale / counted units</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Audit Variance
                  </span>
                  <div
                    className={`text-lg font-black font-mono mt-0.5 flex items-center space-x-1 ${
                      discrepancy === 0
                        ? 'text-emerald-600'
                        : discrepancy > 0
                        ? 'text-blue-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {discrepancy === 0 ? (
                      <Minus className="w-4 h-4 shrink-0" />
                    ) : discrepancy > 0 ? (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {discrepancy > 0 ? `+${discrepancy}` : discrepancy}{' '}
                      <span className="text-xs font-normal">{currentProduct?.product_measure_unit}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold block">
                    {financialVariance === 0 ? (
                      <span className="text-emerald-600">Zero Financial Impact</span>
                    ) : financialVariance > 0 ? (
                      <span className="text-blue-600">+₦{financialVariance.toLocaleString()} gain</span>
                    ) : (
                      <span className="text-rose-600">-₦{Math.abs(financialVariance).toLocaleString()} loss</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Counted Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Actual Physical Weight / Count ({currentProduct?.product_measure_unit})</span>
                  <span className="text-[11px] text-amber-700 font-medium">Physical count / scale reading</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={countedQty}
                    onChange={(e) => setCountedQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 pr-12 text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">
                    {currentProduct?.product_measure_unit}
                  </span>
                </div>
              </div>

              {/* Reason for Audit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Audit Reason Category
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="Routine physical audit & count verification">Routine physical audit & verification</option>
                    <option value="Packaging damage or shrinkage discrepancy">Packaging damage or shrinkage</option>
                    <option value="Trimming, handling, or portioning loss">Trimming / portioning loss</option>
                    <option value="Damaged / expired stock write-off">Damaged / expired stock write-off</option>
                    <option value="Data entry / cashier miscount correction">Cashier miscount correction</option>
                    <option value="Suspected theft / inventory shrinkage investigation">Suspected theft / shrinkage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Specific Notes / Explanations
                  </label>
                  <input
                    type="text"
                    placeholder="Scale calibration or specific batch note..."
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Reconcile Checkbox */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="adjustStockModal"
                  checked={adjustStock}
                  onChange={(e) => setAdjustStock(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <label htmlFor="adjustStockModal" className="text-xs text-slate-700 font-medium cursor-pointer">
                  <span className="font-bold text-slate-900 block">
                    Reconcile System Inventory (Commit to SQLite)
                  </span>
                  Update database stock immediately to match the counted {countedQty}{' '}
                  {currentProduct?.product_measure_unit}. Discrepancy will be logged to audit trail.
                </label>
              </div>

              {/* Staff Info Note */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>
                  Inspector: <strong className="text-slate-800">{activeStaff.staff_name}</strong> ({activeStaff.role})
                </span>
                <span className="font-mono text-emerald-600 font-semibold">Immutable Trail Protected</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-1.5"
                >
                  <Scale className="w-4 h-4" />
                  <span>Record & Commit Count</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search audit ledger by product, count ID, reason, or staff..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No cycle count audit records found matching your query.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-300 font-semibold">
                      <tr>
                        <th className="p-3">Count Ref / Date</th>
                        <th className="p-3">Product</th>
                        <th className="p-3 text-right">System</th>
                        <th className="p-3 text-right">Counted</th>
                        <th className="p-3 text-right">Variance</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((rec) => {
                        const isMatch = rec.discrepancy === 0;
                        const isGain = rec.discrepancy > 0;
                        return (
                          <tr key={rec.count_id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">
                              <div>{rec.count_id}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{rec.date_time}</div>
                              <div className="text-[10px] text-slate-500">{rec.staff_name}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800">{rec.item_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{rec.item_sn}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{rec.reason}</div>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                              {rec.system_qty} {rec.unit}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-amber-700">
                              {rec.counted_qty} {rec.unit}
                            </td>
                            <td className="p-3 text-right font-mono font-black">
                              <span
                                className={
                                  isMatch ? 'text-emerald-600' : isGain ? 'text-blue-600' : 'text-rose-600'
                                }
                              >
                                {isGain ? `+${rec.discrepancy}` : rec.discrepancy} {rec.unit}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {rec.adjusted ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Reconciled
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Audited Only
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handlePrintSlip(rec)}
                                title="Print Count Slip"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
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
        </div>

        {/* Printable Reconciliation Slip (Rendered in hidden container or printed modal) */}
        {printingRecord && (
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
                <span className="font-bold">{printingRecord.count_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{printingRecord.date_time}</span>
              </div>
              <div className="flex justify-between">
                <span>Auditing Inspector:</span>
                <span>{printingRecord.staff_name} ({printingRecord.role})</span>
              </div>
            </div>

            <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-bold">Item:</span>
                <span className="font-bold">{printingRecord.item_name} ({printingRecord.item_sn})</span>
              </div>
              <div className="flex justify-between">
                <span>Pre-Audit System Qty:</span>
                <span>{printingRecord.system_qty} {printingRecord.unit}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Physical Scale Count:</span>
                <span>{printingRecord.counted_qty} {printingRecord.unit}</span>
              </div>
              <div className="flex justify-between font-black">
                <span>Discrepancy / Variance:</span>
                <span>{printingRecord.discrepancy > 0 ? `+${printingRecord.discrepancy}` : printingRecord.discrepancy} {printingRecord.unit}</span>
              </div>
              <div className="flex justify-between">
                <span>Database Stock Reconciled:</span>
                <span>{printingRecord.adjusted ? 'YES (Updated Live)' : 'NO (Audit Logged)'}</span>
              </div>
            </div>

            <div className="py-3 border-b border-dashed border-slate-400">
              <span className="block font-bold">Reason / Notes:</span>
              <p className="text-[11px] text-slate-700 mt-0.5">{printingRecord.reason}</p>
            </div>

            <div className="pt-6 space-y-4 text-center">
              <div className="flex justify-between pt-6 text-[10px]">
                <div className="border-t border-slate-400 w-28 pt-1">Auditor Sign</div>
                <div className="border-t border-slate-400 w-28 pt-1">Manager Sign</div>
              </div>
              <p className="text-[9px] text-slate-500">Official Physical Inventory Audit Document - Permanent SQLite Ledger Record</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
