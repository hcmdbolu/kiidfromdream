import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction } from '../../types';
import { RotateCcw, X, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface RefundModalProps {
  initialTransaction: SaleTransaction | null;
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({ initialTransaction, onClose }) => {
  const { sales, products, processRefund, activeStaff, hasPermission, requestOverride } = usePos();

  const [selectedTxId, setSelectedTxId] = useState<string>(initialTransaction?.transaction_id || '');
  const [selectedItemSn, setSelectedItemSn] = useState<string>('');
  const [quantityToRefund, setQuantityToRefund] = useState<number>(1);
  const [reason, setReason] = useState<string>('Spoilt / Expired Fish');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canDirectlyRefund = hasPermission('CAN_REFUND');

  // Sync selected transaction
  const currentTx = sales.find(s => s.transaction_id === selectedTxId) || initialTransaction;

  useEffect(() => {
    if (currentTx) {
      if (currentTx.items && currentTx.items.length > 0) {
        setSelectedItemSn(currentTx.items[0].item_sn);
        setQuantityToRefund(1);
      } else {
        setSelectedItemSn(currentTx.item_sn || '');
        setQuantityToRefund(1);
      }
    }
  }, [selectedTxId]);

  const activeItem = currentTx?.items?.find(i => i.item_sn === selectedItemSn) || (currentTx ? {
    item_sn: currentTx.item_sn,
    item_name: currentTx.item_name,
    quantity_sold: currentTx.quantity_sold,
    unit_price: currentTx.unit_price,
    total_amount: currentTx.total_amount,
    unit: 'KG',
  } : null);

  const maxRefundable = activeItem?.quantity_sold ?? 1;
  const unitPrice = activeItem?.unit_price ?? 0;
  const calculatedRefundAmount = quantityToRefund * unitPrice;

  const handleAuthorizePin = () => {
    if (supervisorPin.length !== 4) {
      setError('Please enter a 4-digit Supervisor/Manager PIN.');
      return;
    }
    const res = requestOverride(supervisorPin, `Refund for ₦${calculatedRefundAmount} on ${currentTx?.transaction_id}`);
    if (res.success && res.authorizedBy) {
      setAuthorizedBy(res.authorizedBy.staff_id);
      setError(null);
    } else {
      setError(res.error || 'Invalid supervisor PIN.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentTx || !activeItem || !activeItem.item_sn) {
      setError('Please select a valid transaction and item.');
      return;
    }

    if (quantityToRefund <= 0 || quantityToRefund > maxRefundable) {
      setError(`Refund quantity must be between 1 and ${maxRefundable}.`);
      return;
    }

    // Role security check
    if (!canDirectlyRefund && !authorizedBy) {
      setError('Cashiers cannot issue refunds without Supervisor/Manager PIN approval.');
      return;
    }

    const res = processRefund(
      currentTx.transaction_id,
      activeItem.item_sn,
      quantityToRefund,
      reason,
      authorizedBy || undefined
    );

    if (!res.success) {
      setError(res.error || 'Failed to process refund');
    } else {
      setSuccess('Refund completed successfully! Stock restored and audit trail recorded.');
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
        
        {/* Header */}
        <div className="bg-rose-950 text-white p-4 flex items-center justify-between border-b border-rose-900">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-bold text-sm">Process Customer Return / Refund</h3>
              <p className="text-[11px] text-rose-300">Restores fish batch inventory & records refund audit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-rose-300 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Select Transaction */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Sale Transaction *
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
            >
              <option value="">-- Choose Transaction --</option>
              {sales.map(s => (
                <option key={s.transaction_id} value={s.transaction_id}>
                  {s.transaction_id} - ₦{s.final_amount.toLocaleString()} ({s.date_time.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          {currentTx && (
            <>
              {/* Select Item to Refund */}
              {currentTx.items && currentTx.items.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Item to Refund *
                  </label>
                  <select
                    value={selectedItemSn}
                    onChange={(e) => setSelectedItemSn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    {currentTx.items.map(item => (
                      <option key={item.item_sn} value={item.item_sn}>
                        {item.item_name} ({item.quantity_sold} {item.unit} sold @ ₦{item.unit_price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity to Refund */}
              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>Quantity to Return / Refund *</span>
                  <span className="text-slate-400 font-normal">Max: {maxRefundable} KG</span>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={maxRefundable}
                  value={quantityToRefund}
                  onChange={(e) => setQuantityToRefund(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
                />
              </div>

              {/* Reason for Return */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Return *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="Spoilt / Expired Fish">Spoilt / Expired Fish</option>
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Quality Discrepancy">Quality Discrepancy / Size Issue</option>
                  <option value="Incorrect Weight Recorded">Incorrect Weight Recorded</option>
                  <option value="Wrong Item Dispensed">Wrong Item Dispensed</option>
                </select>
              </div>

              {/* Refund Impact Box */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                <div className="font-bold text-xs">Expected Return Impact:</div>
                <div className="flex justify-between">
                  <span>Amount to Refund Customer:</span>
                  <span className="font-bold font-mono text-rose-700">₦{calculatedRefundAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Stock to Restock:</span>
                  <span className="font-bold text-emerald-700">+{quantityToRefund} KG ({activeItem?.item_name})</span>
                </div>
              </div>

              {/* Supervisor Authorization Box for Cashier */}
              {!canDirectlyRefund && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Supervisor PIN Authorization Required</span>
                    </span>
                    {authorizedBy && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        ✓ Authorized
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Your role is <strong>Cashier</strong>. A Supervisor (Ibrahim: 3333), Manager (Chidinma: 4444), or Admin (Alex: 9999) must enter their 4-digit PIN to authorize this return.
                  </p>
                  {!authorizedBy ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Enter 4-digit PIN"
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 font-mono text-center font-bold tracking-widest text-xs flex-1 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAuthorizePin}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg text-xs transition-colors"
                      >
                        Authorize
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      Approval granted by <strong>{authorizedBy}</strong>. Proceed with refund.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!currentTx || !!success}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm flex items-center space-x-1"
            >
              <span>Confirm Refund</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
