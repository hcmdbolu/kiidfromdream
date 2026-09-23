import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Product } from '../../types';
import { ClipboardCheck, X, AlertCircle, CheckCircle2, Scale, ArrowRight } from 'lucide-react';

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
  const { products, performCycleCount, activeStaff } = usePos();

  const [selectedSn, setSelectedSn] = useState<string>(
    preselectedProduct?.item_sn || products[0]?.item_sn || ''
  );
  const [countedQty, setCountedQty] = useState<number>(
    preselectedProduct?.quantity || products[0]?.quantity || 0
  );
  const [reason, setReason] = useState<string>('Routine physical audit & scale calibration');
  const [adjustStock, setAdjustStock] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentProduct = products.find(p => p.item_sn === selectedSn) || products[0];
  const systemQty = currentProduct?.quantity ?? 0;
  const discrepancy = (countedQty ?? 0) - systemQty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentProduct) {
      setError('Please select a valid fish product to count.');
      return;
    }

    if (countedQty < 0) {
      setError('Counted quantity cannot be negative.');
      return;
    }

    const res = performCycleCount({
      item_sn: currentProduct.item_sn,
      counted_qty: countedQty,
      reason,
      adjustStock,
    });

    if (!res.success) {
      setError(res.error || 'Failed to complete cycle count.');
    } else {
      setSuccess(`Cycle count recorded (${res.record?.count_id}). Stock ${adjustStock ? 'reconciled to ' + countedQty + ' ' + currentProduct.product_measure_unit : 'audited without adjustment'}.`);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Physical Stock Cycle Count</h3>
              <p className="text-xs text-slate-400">
                Supervisor Inventory Audit & Discrepancy Reconciliation
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product to Audit
            </label>
            <select
              value={selectedSn}
              onChange={(e) => {
                const sn = e.target.value;
                setSelectedSn(sn);
                const prod = products.find(p => p.item_sn === sn);
                if (prod) setCountedQty(prod.quantity);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            >
              {products.map(p => (
                <option key={p.item_sn} value={p.item_sn}>
                  {p.item_sn} - {p.item_name} ({p.quantity} {p.product_measure_unit} in system)
                </option>
              ))}
            </select>
          </div>

          {/* Current vs Counted Cards */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Current System Stock
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {systemQty} <span className="text-xs font-normal text-slate-500">{currentProduct?.product_measure_unit}</span>
              </div>
              <span className="text-[10px] text-slate-400">From database records</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Calculated Variance
              </span>
              <div className={`text-xl font-black font-mono mt-0.5 ${
                discrepancy === 0 ? 'text-emerald-600' : discrepancy > 0 ? 'text-blue-600' : 'text-rose-600'
              }`}>
                {discrepancy > 0 ? `+${discrepancy}` : discrepancy}{' '}
                <span className="text-xs font-normal">{currentProduct?.product_measure_unit}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {discrepancy === 0 ? 'Exact match' : discrepancy > 0 ? 'Surplus / excess' : 'Shrinkage / loss'}
              </span>
            </div>
          </div>

          {/* Counted Quantity Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Actual Physical Weight / Count ({currentProduct?.product_measure_unit})</span>
              <span className="text-[11px] text-amber-700 font-medium">Weighing scale reading</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
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

          {/* Reason for Audit / Discrepancy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason / Justification
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            >
              <option value="Routine physical audit & scale calibration">Routine physical audit & scale calibration</option>
              <option value="Water evaporation & melting ice weight loss">Water evaporation & melting ice weight loss</option>
              <option value="Fish trimming, scaling, and gutting loss">Fish trimming, scaling, and gutting loss</option>
              <option value="Damaged / spoiled stock condemned">Damaged / spoiled stock condemned</option>
              <option value="Data entry / cashier miscount correction">Data entry / cashier miscount correction</option>
              <option value="Suspected theft / inventory shrinkage investigation">Suspected theft / inventory shrinkage investigation</option>
            </select>
          </div>

          {/* Reconcile Checkbox */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center space-x-3">
            <input
              type="checkbox"
              id="adjustStock"
              checked={adjustStock}
              onChange={(e) => setAdjustStock(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
            />
            <label htmlFor="adjustStock" className="text-xs text-slate-700 font-medium cursor-pointer">
              <span className="font-bold text-slate-900 block">Reconcile System Inventory</span>
              Update database stock immediately to match the counted {countedQty} {currentProduct?.product_measure_unit}.
            </label>
          </div>

          {/* Staff Info Note */}
          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <span>Inspector: <strong className="text-slate-800">{activeStaff.staff_name}</strong> ({activeStaff.role})</span>
            <span className="font-mono text-emerald-600 font-semibold">Immutable Trail Protected</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-1.5"
            >
              <Scale className="w-4 h-4" />
              <span>Record & Log Cycle Count</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
