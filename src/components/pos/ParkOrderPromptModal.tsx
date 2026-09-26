import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Clock, PauseCircle, X, AlertCircle, Sparkles } from 'lucide-react';

interface ParkOrderPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_HOLD_REASONS = [
  'Awaiting bank transfer credit alert / confirmation',
  'Customer stepped away to withdraw cash at ATM',
  'Customer went back to choose additional fish / items',
  'POS card payment pending terminal reconnect',
  'Customer on phone confirming order details with buyer',
  'General walk-in queue hold',
];

export const ParkOrderPromptModal: React.FC<ParkOrderPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { parkActiveOrder, activeOrders, activeOrderId, cart, cartFinalTotal, customers, selectedCustomerId } = usePos();
  const currentOrder = activeOrders.find(o => o.id === activeOrderId);
  const currentCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  const [reason, setReason] = useState<string>(COMMON_HOLD_REASONS[0]);
  const [customLabel, setCustomLabel] = useState<string>(() => {
    if (currentCustomer && currentCustomer.customer_id !== 'Walk-in') {
      return `${currentCustomer.full_name} (Held)`;
    }
    return currentOrder?.label || 'Walk-in Customer';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmPark = () => {
    setErrorMsg(null);
    if (cart.length === 0) {
      setErrorMsg('Cannot hold an empty cart. Please add fish items first.');
      return;
    }

    const res = parkActiveOrder(reason, customLabel);
    if (res.success) {
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.error || 'Failed to park order.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <PauseCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Hold / Park Walk-in Order</h3>
              <p className="text-xs text-amber-100">Pause Customer A to seamlessly take Customer B</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-amber-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Order Summary */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Holding Active Order:</span>
              <strong className="text-slate-900 text-sm">{currentOrder?.label || 'Walk-in'}</strong>
              <div className="text-slate-600 text-[11px] mt-0.5">{cart.length} item(s) in basket</div>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[11px] block">Order Amount:</span>
              <span className="font-mono text-amber-700 font-bold text-base">₦{cartFinalTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Custom Order Nickname / Reference */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Order Label / Customer Reference
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Walk-in #1 or Customer in blue cap"
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-500">Helps cashier easily identify customer when resuming.</p>
          </div>

          {/* Reason for hold */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Reason for Hold
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {COMMON_HOLD_REASONS.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
            Once parked, this order moves to your <strong>Held / Parked Queue</strong>. The register clears so you can immediately attend to the next waiting customer.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmPark}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Hold & Next Customer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
