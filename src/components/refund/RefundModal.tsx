import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction } from '../../types';
import { RotateCcw, X, AlertTriangle, CheckCircle, ArrowRight, Scale, ShieldAlert, Check } from 'lucide-react';

interface RefundModalProps {
  initialTransaction: SaleTransaction | null;
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({ initialTransaction, onClose }) => {
  const { sales, refunds, processRefund, activeStaff, employees } = usePos();

  const [selectedTxId, setSelectedTxId] = useState<string>(initialTransaction?.transaction_id || '');
  const [selectedItemSn, setSelectedItemSn] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [reason, setReason] = useState<string>('Spoilt / Expired Fish');
  const [managerPin, setManagerPin] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isManagerOrAdmin = activeStaff.role === 'Manager' || activeStaff.role === 'Admin';

  // Sync selected transaction
  const currentTx = useMemo(() => {
    return sales.find(s => s.transaction_id === selectedTxId) || initialTransaction;
  }, [sales, selectedTxId, initialTransaction]);

  // When transaction or items change, default selected item
  useEffect(() => {
    if (currentTx) {
      if (currentTx.items && currentTx.items.length > 0) {
        setSelectedItemSn(currentTx.items[0].item_sn);
      } else {
        setSelectedItemSn(currentTx.item_sn || '');
      }
    }
  }, [selectedTxId, currentTx]);

  // Active item being refunded
  const activeItem = useMemo(() => {
    if (!currentTx) return null;
    return currentTx.items?.find(i => i.item_sn === selectedItemSn) || {
      item_sn: currentTx.item_sn || '',
      item_name: currentTx.item_name || 'Fish Product',
      quantity_sold: currentTx.quantity_sold || 0,
      unit_price: currentTx.unit_price || 0,
      total_amount: currentTx.total_amount || 0,
      unit: 'KG',
    };
  }, [currentTx, selectedItemSn]);

  // Compute previously refunded quantity for this specific item on this transaction
  const previouslyRefunded = useMemo(() => {
    if (!currentTx || !activeItem?.item_sn) return 0;
    const sum = refunds
      .filter(r => r.original_transaction_id === currentTx.transaction_id && r.item_sn === activeItem.item_sn)
      .reduce((acc, r) => acc + r.quantity_refunded, 0);
    return Math.round(sum * 1000) / 1000;
  }, [refunds, currentTx, activeItem?.item_sn]);

  // Max refundable quantity remaining for this item
  const originalSoldQty = activeItem?.quantity_sold ?? 0;
  const maxRefundable = useMemo(() => {
    const remaining = Math.max(0, originalSoldQty - previouslyRefunded);
    return Math.round(remaining * 1000) / 1000;
  }, [originalSoldQty, previouslyRefunded]);

  const unit = activeItem?.unit || 'KG';
  const unitPrice = activeItem?.unit_price ?? 0;

  // Auto-populate default initial quantity when item changes
  useEffect(() => {
    if (maxRefundable > 0) {
      // If max is less than 1, set to max; otherwise set to 1
      const defaultQty = maxRefundable < 1 ? maxRefundable.toString() : '1';
      setQuantityInput(defaultQty);
    } else {
      setQuantityInput('0');
    }
    setError(null);
  }, [selectedItemSn, maxRefundable]);

  // Float quantity parsing & validation
  const parsedQuantity = parseFloat(quantityInput);
  const isInputEmpty = quantityInput.trim() === '';
  const isNaNValue = isNaN(parsedQuantity);
  const isZeroOrNegative = !isNaNValue && parsedQuantity <= 0;
  const isExceedingMax = !isNaNValue && parsedQuantity > maxRefundable;
  const isFullyRefundedAlready = maxRefundable <= 0;

  const isQuantityValid = !isInputEmpty && !isNaNValue && !isZeroOrNegative && !isExceedingMax && !isFullyRefundedAlready;

  // Dynamic proportional calculation: exact unit price multiplied by float quantity
  const calculatedRefundAmount = useMemo(() => {
    if (!isQuantityValid) return 0;
    return Math.round(parsedQuantity * unitPrice);
  }, [isQuantityValid, parsedQuantity, unitPrice]);

  const handleAuthorizePin = () => {
    if (managerPin.length !== 4) {
      setError('Please enter a 4-digit Manager or Admin PIN.');
      return;
    }
    const staff = employees.find(e => e.pin === managerPin.trim());
    if (!staff) {
      setError('Invalid PIN entered.');
      return;
    }
    if (staff.role !== 'Manager' && staff.role !== 'Admin') {
      setError(`Access Denied: ${staff.role} ${staff.staff_name} cannot authorize refunds. Only Manager (Chidinma: 4444) or Admin (Alex: 9999) can authorize customer returns.`);
      return;
    }
    setAuthorizedBy(staff.staff_id);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentTx || !activeItem || !activeItem.item_sn) {
      setError('Please select a valid transaction and item.');
      return;
    }

    if (isFullyRefundedAlready) {
      setError(`This item has already been fully refunded (${previouslyRefunded} ${unit} returned).`);
      return;
    }

    if (isNaNValue || isZeroOrNegative) {
      setError('Please enter a valid positive return quantity (greater than 0).');
      return;
    }

    if (isExceedingMax) {
      setError(`Cannot refund ${parsedQuantity} ${unit}. The maximum allowable return quantity is ${maxRefundable} ${unit}.`);
      return;
    }

    // Role security check: Strictly Manager and Admin Only
    if (!isManagerOrAdmin && !authorizedBy) {
      setError('Access Denied: Customer refunds are strictly restricted to Manager and Admin accounts.');
      return;
    }

    const res = processRefund(
      currentTx.transaction_id,
      activeItem.item_sn,
      parsedQuantity,
      reason,
      authorizedBy || undefined
    );

    if (!res.success) {
      setError(res.error || 'Failed to process refund');
    } else {
      setSuccess(`Refund of ₦${calculatedRefundAmount.toLocaleString()} (${parsedQuantity} ${unit}) completed successfully! Stock restored and audit trail recorded.`);
      setTimeout(() => {
        onClose();
      }, 1600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
        
        {/* Header */}
        <div className="bg-rose-950 text-white p-4 flex items-center justify-between border-b border-rose-900">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <RotateCcw className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Process Customer Return / Refund</h3>
              <p className="text-[11px] text-rose-300">Restores fish batch inventory & records refund audit</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-semibold">{success}</span>
            </div>
          )}

          {/* Select Transaction */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Sale Transaction *
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Item to Refund *
                  </label>
                  <select
                    value={selectedItemSn}
                    onChange={(e) => setSelectedItemSn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {currentTx.items.map(item => (
                      <option key={item.item_sn} value={item.item_sn}>
                        {item.item_name} ({item.quantity_sold} {item.unit} sold @ ₦{item.unit_price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity to Refund (Supports Decimals e.g. 1.5, 0.25) */}
              <div>
                <div className="flex items-center justify-between font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center space-x-1.5">
                    <Scale className="w-3.5 h-3.5 text-slate-500" />
                    <span>Quantity to Return / Refund *</span>
                  </span>
                  
                  {/* Clean Max Display with Clickable Fill */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Max Returnable:
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantityInput(maxRefundable.toString())}
                      disabled={maxRefundable <= 0}
                      className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-mono font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                      title="Click to fill maximum allowable return quantity"
                    >
                      {maxRefundable} {unit} (Max)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    max={maxRefundable}
                    disabled={isFullyRefundedAlready}
                    required
                    value={quantityInput}
                    onChange={(e) => {
                      setQuantityInput(e.target.value);
                      setError(null);
                    }}
                    placeholder={`e.g. 1.5 or 0.25 ${unit}`}
                    className={`w-full pl-3 pr-14 py-2.5 rounded-xl font-mono font-bold text-sm text-slate-900 transition-all focus:outline-none ${
                      isExceedingMax || isZeroOrNegative
                        ? 'border-2 border-rose-500 bg-rose-50/60 ring-2 ring-rose-200'
                        : 'border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs uppercase pointer-events-none">
                    {unit}
                  </span>
                </div>

                {/* Instant Validation Feedback */}
                {isExceedingMax && (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center space-x-1.5 animate-in fade-in duration-100">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>
                      <strong>Exceeds limit:</strong> Entered {parsedQuantity} {unit}, but only <strong>{maxRefundable} {unit}</strong> was purchased or remains returnable.
                    </span>
                  </div>
                )}

                {isZeroOrNegative && !isInputEmpty && (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>Quantity must be a positive number greater than 0.</span>
                  </div>
                )}

                {isFullyRefundedAlready && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>This item has already been fully returned ({previouslyRefunded} {unit} refunded).</span>
                  </div>
                )}

                {/* Contextual Purchase Details Pill */}
                {previouslyRefunded > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>Sold: {originalSoldQty} {unit}</span>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">Already Returned: {previouslyRefunded} {unit}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">Remaining: {maxRefundable} {unit}</span>
                  </div>
                )}
              </div>

              {/* Reason for Return */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Return *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="Spoilt / Expired Fish">Spoilt / Expired Fish</option>
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Quality Discrepancy">Quality Discrepancy / Size Issue</option>
                  <option value="Incorrect Weight Recorded">Incorrect Weight Recorded</option>
                  <option value="Wrong Item Dispensed">Wrong Item Dispensed</option>
                </select>
              </div>

              {/* Dynamic Proportional Expected Return Impact Box */}
              <div className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                isQuantityValid
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>Expected Return Impact:</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Rate: ₦{unitPrice.toLocaleString()}/{unit}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
                  <span className="font-semibold text-slate-700">Amount to Refund Customer:</span>
                  <span className={`font-mono font-black text-base ${
                    isQuantityValid ? 'text-rose-700' : 'text-slate-400'
                  }`}>
                    ₦{calculatedRefundAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-dashed border-amber-200/60">
                  <span className="text-slate-600">Stock Returned to Cold Room:</span>
                  <span className={`font-mono font-bold ${
                    isQuantityValid ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    +{isQuantityValid ? parsedQuantity : 0} {unit} ({activeItem?.item_name})
                  </span>
                </div>
              </div>

              {/* Manager & Admin Authorization Box for Non-Manager Accounts */}
              {!isManagerOrAdmin && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-900 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Manager / Admin Authorization Required</span>
                    </span>
                    {authorizedBy && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Authorized</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Customer refunds are strictly restricted to <strong>Manager</strong> and <strong>Admin</strong> accounts. Please ask a Manager (Chidinma: 4444) or Admin (Alex: 9999) to authorize with their PIN.
                  </p>
                  {!authorizedBy ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Manager PIN"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                        className="bg-white border border-rose-300 rounded-lg px-3 py-1.5 font-mono text-center font-bold tracking-widest text-xs flex-1 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAuthorizePin}
                        className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Authorize
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span>Refund authorization granted by <strong>{authorizedBy}</strong>.</span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase font-mono">READY</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !currentTx || 
                !isQuantityValid || 
                !!success || 
                (!isManagerOrAdmin && !authorizedBy)
              }
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-sm flex items-center space-x-1.5 transition-all ${
                !currentTx || !isQuantityValid || !!success || (!isManagerOrAdmin && !authorizedBy)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-98 cursor-pointer shadow-rose-600/20'
              }`}
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
