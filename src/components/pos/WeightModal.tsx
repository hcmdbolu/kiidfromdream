import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { Scale, Check, X, Plus, Minus, AlertCircle } from 'lucide-react';

interface WeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currentQuantity: number;
  onConfirm: (quantity: number) => void;
}

export const WeightModal: React.FC<WeightModalProps> = ({
  isOpen,
  onClose,
  product,
  currentQuantity,
  onConfirm,
}) => {
  const [weightStr, setWeightStr] = useState<string>('1.0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setWeightStr(currentQuantity > 0 ? currentQuantity.toString() : '1.0');
      setError(null);
    }
  }, [isOpen, product, currentQuantity]);

  if (!isOpen || !product) return null;

  const currentWeightNum = parseFloat(weightStr) || 0;
  const calculatedTotal = Math.round(currentWeightNum * product.selling_price);

  const presets = [0.5, 0.75, 1.0, 1.2, 1.3, 1.5, 2.0, 2.5, 3.0, 5.0];

  const handlePresetClick = (presetVal: number) => {
    setError(null);
    if (presetVal > product.quantity) {
      setError(`Requested ${presetVal} ${product.product_measure_unit} exceeds available stock (${product.quantity} ${product.product_measure_unit}).`);
      setWeightStr(product.quantity.toString());
      return;
    }
    setWeightStr(presetVal.toString());
  };

  const handleAdjust = (delta: number) => {
    setError(null);
    const newQty = Math.max(0.1, Math.round((currentWeightNum + delta) * 100) / 100);
    if (newQty > product.quantity) {
      setError(`Cannot exceed current stock (${product.quantity} ${product.product_measure_unit}).`);
      setWeightStr(product.quantity.toString());
      return;
    }
    setWeightStr(newQty.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(weightStr);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid weight or quantity.');
      return;
    }
    if (parsed > product.quantity) {
      setError(`Stock insufficient: only ${product.quantity} ${product.product_measure_unit} available in store.`);
      return;
    }
    onConfirm(Math.round(parsed * 1000) / 1000);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Scale Measurement & Price Recalculation</h3>
              <p className="text-[11px] text-slate-400">Override exact weight/quantity at POS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Fish Item Info */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-900 text-sm">{product.item_name}</div>
              <div className="text-[11px] text-slate-500">
                SN: <span className="font-mono">{product.item_sn}</span> • Rate: <span className="font-bold text-slate-800">₦{product.selling_price.toLocaleString()}/{product.product_measure_unit}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Available</span>
              <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {product.quantity} {product.product_measure_unit}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Quick Weight Presets ({product.product_measure_unit}):
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {presets.map(val => {
                const isSelected = currentWeightNum === val;
                const isExceeding = val > product.quantity;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={isExceeding}
                    onClick={() => handlePresetClick(val)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isExceeding
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {val} {product.product_measure_unit}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Precision Input with Steppers */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Exact Scale Reading / Measured Weight:
            </label>
            <div className="flex items-center space-x-2">
              {/* Micro Steppers */}
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => handleAdjust(-0.5)}
                  className="px-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  title="Minus 0.5"
                >
                  -0.5
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(-0.1)}
                  className="px-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  title="Minus 0.1"
                >
                  -0.1
                </button>
              </div>

              {/* Number Input */}
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={product.quantity}
                  value={weightStr}
                  onChange={(e) => {
                    setError(null);
                    setWeightStr(e.target.value);
                  }}
                  autoFocus
                  placeholder="e.g. 1.2 or 1.3"
                  className="w-full text-center py-2.5 px-3 bg-white border-2 border-emerald-500 rounded-xl font-mono text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {product.product_measure_unit}
                </span>
              </div>

              {/* Add Micro Steppers */}
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => handleAdjust(0.1)}
                  className="px-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  title="Plus 0.1"
                >
                  +0.1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(0.5)}
                  className="px-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  title="Plus 0.5"
                >
                  +0.5
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Recalculated Final Price Box */}
          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-emerald-800">
              <span>Automatic Price Recalculation:</span>
              <span className="font-mono text-[11px] text-slate-500">
                {currentWeightNum} {product.product_measure_unit} × ₦{product.selling_price.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">Calculated Final Amount:</span>
              <span className="font-mono text-xl font-extrabold text-emerald-700">
                ₦{calculatedTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center space-x-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Set Weight</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
