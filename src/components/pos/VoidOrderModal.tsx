import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { ActiveWalkInOrder, ParkedOrder } from '../../types';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  ShieldCheck, 
  Clock, 
  Receipt,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface VoidOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ActiveWalkInOrder | ParkedOrder | null;
  onVoidConfirmed?: () => void;
}

const COMMON_VOID_REASONS = [
  'Customer walked away / abandoned basket',
  'Insufficient funds / card or transfer declined',
  'Bank transfer timed out / credit alert not received',
  'Wrong fish item or weight entered (cashier mistake)',
  'Customer disputed pricing / changed mind at checkout',
  'Fish quality rejection / customer requested cancellation',
  'Duplicate entry / cashier testing',
  'Other operational issue',
];

export const VoidOrderModal: React.FC<VoidOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onVoidConfirmed,
}) => {
  const { cancelAndVoidOrder, activeStaff } = usePos();
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_VOID_REASONS[0]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const orderId = 'order_id' in order ? order.order_id : order.id;
  const orderLabel = 'order_label' in order ? order.order_label : order.label;
  const items = 'items' in order ? order.items : order.cart;
  const totalAmount = items.reduce((sum, item) => sum + item.total_amount, 0);

  const handleConfirmVoid = () => {
    setErrorMsg(null);
    if (!selectedReason) {
      setErrorMsg('Please select a cancellation reason.');
      return;
    }

    setIsSubmitting(true);
    const finalReason = selectedReason === 'Other operational issue' && customNotes.trim()
      ? `Other: ${customNotes.trim()}`
      : selectedReason;

    const res = cancelAndVoidOrder(orderId, finalReason, customNotes.trim());
    setIsSubmitting(false);

    if (res.success) {
      onClose();
      if (onVoidConfirmed) onVoidConfirmed();
    } else {
      setErrorMsg(res.error || 'Failed to void order.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Void / Cancel Order</h3>
              <p className="text-xs text-rose-100">Abort transaction & log cancellation reason</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-rose-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Order Summary Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                <Receipt className="w-4 h-4 text-slate-500" />
                <span>Order Reference: <strong className="text-slate-900">{orderLabel}</strong></span>
              </span>
              <span className="font-mono text-slate-500 text-[11px]">{orderId}</span>
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/60 pr-1 text-xs">
              {items.length === 0 ? (
                <div className="py-2 text-slate-400 text-center italic text-xs">Empty order cart</div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800">{item.item_name}</span>
                      <span className="text-[11px] text-slate-500 ml-1.5">({item.quantity_sold} {item.unit})</span>
                    </div>
                    <span className="font-mono text-slate-700 font-semibold">₦{item.total_amount.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-xs text-slate-900">
              <span>Total Aborted Value:</span>
              <span className="font-mono text-rose-600 text-sm">₦{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Void Reason Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Select Void / Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {COMMON_VOID_REASONS.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes / Details */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Additional Notes or Incident Detail (Optional)
            </label>
            <textarea
              rows={2}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Customer spent 15 minutes waiting for OPay alert which failed; left basket at counter."
              className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Inventory Integrity Assurance Banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-900">
            <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Inventory & Accounting Integrity Protected</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Because checkout was aborted before tender was completed, all stock quantities remain verified in catalog inventory. This cancellation will be logged in the immutable audit ledger with cashier attribution ({activeStaff.staff_name}).
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Keep Order (Do Not Void)
          </button>
          <button
            type="button"
            onClick={handleConfirmVoid}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Voiding...' : 'Confirm Void Order'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
