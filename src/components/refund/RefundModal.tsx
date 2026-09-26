import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction } from '../../types';
import { 
  RotateCcw, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Scale, 
  ShieldAlert, 
  Check,
  Zap,
  RotateCcw as ResetIcon,
  ShoppingBag,
  Banknote,
  CreditCard,
  Building2,
  Package
} from 'lucide-react';

interface RefundModalProps {
  initialTransaction: SaleTransaction | null;
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({ initialTransaction, onClose }) => {
  const { sales, refunds, processBatchRefund, activeStaff, employees } = usePos();

  const [selectedTxId, setSelectedTxId] = useState<string>(initialTransaction?.transaction_id || '');
  const [reason, setReason] = useState<string>('Spoilt / Expired Fish');
  const [managerPin, setManagerPin] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Map of item_sn -> string quantity input
  const [itemInputs, setItemInputs] = useState<{ [sn: string]: string }>({});

  const isManagerOrAdmin = activeStaff.role === 'Manager' || activeStaff.role === 'Admin';

  // Sync selected transaction
  const currentTx = useMemo(() => {
    return sales.find(s => s.transaction_id === selectedTxId) || initialTransaction;
  }, [sales, selectedTxId, initialTransaction]);

  // Normalized list of items in the sale transaction with previously refunded & max remaining calculation
  const itemsList = useMemo(() => {
    if (!currentTx) return [];
    const rawItems = (currentTx.items && currentTx.items.length > 0)
      ? currentTx.items
      : [{
          item_sn: currentTx.item_sn || '',
          item_name: currentTx.item_name || 'Fish Product',
          quantity_sold: currentTx.quantity_sold || 0,
          unit_price: currentTx.unit_price || 0,
          total_amount: currentTx.final_amount || currentTx.total_amount || 0,
          unit: 'KG',
        }];

    return rawItems.map(item => {
      const previouslyRefunded = refunds
        .filter(r => r.original_transaction_id === currentTx.transaction_id && r.item_sn === item.item_sn)
        .reduce((acc, r) => acc + r.quantity_refunded, 0);
      const roundedPrev = Math.round(previouslyRefunded * 1000) / 1000;
      const maxRefundable = Math.max(0, Math.round(((item.quantity_sold || 0) - roundedPrev) * 1000) / 1000);

      return {
        ...item,
        unit: item.unit || 'KG',
        previouslyRefunded: roundedPrev,
        maxRefundable,
      };
    });
  }, [currentTx, refunds]);

  // Transaction Financial Metrics & Net Remaining Balance
  const originalNetTotal = currentTx?.final_amount || 0;
  const originalSubtotal = currentTx?.total_amount || originalNetTotal;
  const discountRatio = useMemo(() => {
    if (!currentTx || originalSubtotal <= 0) return 1;
    return originalNetTotal / originalSubtotal;
  }, [currentTx, originalNetTotal, originalSubtotal]);

  const priorTotalRefunded = useMemo(() => {
    if (!currentTx) return 0;
    return refunds
      .filter(r => r.original_transaction_id === currentTx.transaction_id)
      .reduce((acc, r) => acc + r.refund_amount, 0);
  }, [currentTx, refunds]);

  const remainingNetBalance = Math.max(0, originalNetTotal - priorTotalRefunded);
  const isEntireTxAlreadyRefunded = useMemo(() => {
    if (!currentTx) return false;
    if (currentTx.status === 'REFUNDED') return true;
    if (remainingNetBalance <= 0) return true;
    return itemsList.length > 0 && itemsList.every(i => i.maxRefundable <= 0);
  }, [currentTx, remainingNetBalance, itemsList]);

  // Reset inputs when transaction changes
  useEffect(() => {
    if (currentTx && itemsList.length > 0) {
      const initial: { [sn: string]: string } = {};
      itemsList.forEach(it => {
        initial[it.item_sn] = '';
      });
      setItemInputs(initial);
      setError(null);
      setSuccess(null);
    }
  }, [currentTx?.transaction_id]);

  // Handle single item quantity change
  const handleItemQuantityChange = (itemSn: string, value: string) => {
    setItemInputs(prev => ({
      ...prev,
      [itemSn]: value,
    }));
    setError(null);
  };

  // ONE-CLICK FULL REFUND: Auto-fill every item with maximum remaining returnable quantity
  const handleRefundEntireTransaction = () => {
    if (isEntireTxAlreadyRefunded) return;
    const fullInputs: { [sn: string]: string } = {};
    itemsList.forEach(it => {
      fullInputs[it.item_sn] = it.maxRefundable > 0 ? it.maxRefundable.toString() : '0';
    });
    setItemInputs(fullInputs);
    setError(null);
  };

  // Quick Action: Clear all inputs
  const handleClearAllQuantities = () => {
    const emptyInputs: { [sn: string]: string } = {};
    itemsList.forEach(it => {
      emptyInputs[it.item_sn] = '';
    });
    setItemInputs(emptyInputs);
    setError(null);
  };

  // Validation checks across all items
  const parsedItems = useMemo(() => {
    return itemsList.map(it => {
      const inputStr = (itemInputs[it.item_sn] || '').trim();
      const isSet = inputStr !== '';
      const num = parseFloat(inputStr);
      const isInvalidNum = isSet && (isNaN(num) || num < 0);
      const isExceeding = !isNaN(num) && num > it.maxRefundable;
      const quantityToReturn = !isNaN(num) && num > 0 && !isExceeding ? num : 0;

      // Calculate line refund amount taking into account any original order discount ratio
      const calculatedLineAmount = Math.round(quantityToReturn * it.unit_price * discountRatio);

      return {
        ...it,
        inputStr,
        isSet,
        parsedValue: num,
        isInvalidNum,
        isExceeding,
        quantityToReturn,
        calculatedLineAmount,
      };
    });
  }, [itemsList, itemInputs, discountRatio]);

  const hasExceedingItems = parsedItems.some(i => i.isExceeding);
  const hasInvalidNumbers = parsedItems.some(i => i.isInvalidNum);
  const itemsToRefund = useMemo(() => {
    return parsedItems.filter(i => i.quantityToReturn > 0);
  }, [parsedItems]);

  const totalKgRestocked = useMemo(() => {
    const sum = itemsToRefund.reduce((acc, i) => acc + i.quantityToReturn, 0);
    return Math.round(sum * 1000) / 1000;
  }, [itemsToRefund]);

  // Check if every remaining refundable item is set to maximum
  const isAllRemainingItemsAtMax = useMemo(() => {
    if (itemsList.length === 0 || isEntireTxAlreadyRefunded) return false;
    const refundableItems = itemsList.filter(i => i.maxRefundable > 0);
    if (refundableItems.length === 0) return false;

    return refundableItems.every(it => {
      const parsed = parsedItems.find(p => p.item_sn === it.item_sn);
      if (!parsed) return false;
      return Math.abs(parsed.quantityToReturn - it.maxRefundable) < 0.001;
    });
  }, [itemsList, parsedItems, isEntireTxAlreadyRefunded]);

  // Total Expected Refund Amount with Total Amount Verification
  const calculatedRefundTotal = useMemo(() => {
    if (itemsToRefund.length === 0) return 0;

    // Requirement 3: If all remaining items are being refunded, automatically match the exact original net total / remaining balance
    if (isAllRemainingItemsAtMax) {
      return remainingNetBalance;
    }

    // Proportional calculation for partial returns
    const sum = itemsToRefund.reduce((acc, i) => acc + i.calculatedLineAmount, 0);
    return Math.min(sum, remainingNetBalance);
  }, [itemsToRefund, isAllRemainingItemsAtMax, remainingNetBalance]);

  const isFormValid = itemsToRefund.length > 0 && !hasExceedingItems && !hasInvalidNumbers && !isEntireTxAlreadyRefunded;

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
      setError(`Access Denied: ${staff.role} ${staff.staff_name} cannot authorize refunds. Only Manager or Admin can authorize customer returns.`);
      return;
    }
    setAuthorizedBy(staff.staff_id);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentTx) {
      setError('Please select a valid transaction.');
      return;
    }

    if (isEntireTxAlreadyRefunded) {
      setError('This transaction has already been completely refunded.');
      return;
    }

    if (itemsToRefund.length === 0) {
      setError('Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    if (hasExceedingItems) {
      setError('One or more items exceed their maximum allowable return quantity.');
      return;
    }

    if (hasInvalidNumbers) {
      setError('Please enter valid positive decimal numbers for return quantities.');
      return;
    }

    // Role security check: Strictly Manager and Admin Only
    if (!isManagerOrAdmin && !authorizedBy) {
      setError('Access Denied: Customer refunds are strictly restricted to Manager and Admin accounts.');
      return;
    }

    // Batch Process all items simultaneously in one single action (Requirement 4)
    const res = processBatchRefund(
      currentTx.transaction_id,
      itemsToRefund.map(i => ({ item_sn: i.item_sn, quantity: i.quantityToReturn })),
      reason,
      authorizedBy || undefined,
      calculatedRefundTotal
    );

    if (!res.success) {
      setError(res.error || 'Failed to process refund');
    } else {
      const isFull = res.isFullRefund;
      setSuccess(
        isFull
          ? `Full refund of ₦${(res.totalRefundAmount || calculatedRefundTotal).toLocaleString()} completed! Entire basket restocked (+${totalKgRestocked} KG) and transaction marked as "Fully Refunded".`
          : `Partial refund of ₦${(res.totalRefundAmount || calculatedRefundTotal).toLocaleString()} completed for ${itemsToRefund.length} item(s)! Inventory and audit ledger synchronized.`
      );
      setTimeout(() => {
        onClose();
      }, 1600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-rose-950 text-white p-4 flex items-center justify-between border-b border-rose-900 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <RotateCcw className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Process Customer Return / Refund</h3>
              <p className="text-[11px] text-rose-300">
                Batch processing, float precision restock, and cryptographic audit logging
              </p>
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2 animate-in fade-in duration-100">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start space-x-2 animate-in fade-in duration-100">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-semibold">{success}</span>
            </div>
          )}

          {/* Select Sale Transaction */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Sale Transaction *
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="">-- Choose Transaction --</option>
              {sales.map(s => (
                <option key={s.transaction_id} value={s.transaction_id}>
                  {s.transaction_id} - ₦{s.final_amount.toLocaleString()} ({s.date_time.split(' ')[0]}) • {s.payment_method}
                  {s.status === 'REFUNDED' ? ' [Fully Refunded]' : s.status === 'PARTIALLY_REFUNDED' ? ' [Partially Refunded]' : ''}
                </option>
              ))}
            </select>
          </div>

          {currentTx && (
            <>
              {/* Transaction Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 font-mono">{currentTx.transaction_id}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">{currentTx.date_time}</span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {currentTx.status === 'REFUNDED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Fully Refunded
                      </span>
                    ) : currentTx.status === 'PARTIALLY_REFUNDED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Partially Refunded
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Original Net</span>
                    <span className="font-mono font-bold text-slate-900">₦{originalNetTotal.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Prior Refunds</span>
                    <span className="font-mono font-bold text-rose-600">-₦{priorTotalRefunded.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Remaining Refundable</span>
                    <span className="font-mono font-black text-emerald-700">₦{remainingNetBalance.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Payment Method</span>
                    <span className="font-medium text-slate-700 flex items-center space-x-1 truncate">
                      {currentTx.payment_method === 'Cash' ? (
                        <Banknote className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <CreditCard className="w-3 h-3 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate">{currentTx.pos_terminal_name || currentTx.bank_name || currentTx.payment_method}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement 1: Prominent One-Click "Refund Entire Transaction" Action Box */}
              {!isEntireTxAlreadyRefunded ? (
                <div className="p-3 bg-gradient-to-r from-rose-50 via-rose-100/50 to-amber-50 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5 font-bold text-rose-950 text-xs">
                      <Zap className="w-4 h-4 text-rose-600 fill-rose-600" />
                      <span>One-Click Full Order Return</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Populates all {itemsList.length} items in the cart with their maximum remaining weights.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefundEntireTransaction}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs transition-all shadow-sm shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refund Entire Transaction (₦{remainingNetBalance.toLocaleString()})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAllQuantities}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title="Clear all quantity inputs"
                    >
                      <ResetIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>This transaction has already been 100% refunded. No remaining refundable balance.</span>
                </div>
              )}

              {/* Requirement 2: Itemized Return Quantities for Every Item in Cart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cart Items & Quantities to Return (Supports Decimals e.g. 1.5, 0.25)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {itemsList.length} Item{itemsList.length > 1 ? 's' : ''} in Basket
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {parsedItems.map(item => {
                    const isFullyReturned = item.maxRefundable <= 0;

                    return (
                      <div 
                        key={item.item_sn}
                        className={`p-3 rounded-xl border transition-all ${
                          item.isExceeding
                            ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                            : item.quantityToReturn > 0
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          {/* Item Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 truncate text-xs">{item.item_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ₦{item.unit_price.toLocaleString()}/{item.unit}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                              <span>Original: {item.quantity_sold} {item.unit}</span>
                              {item.previouslyRefunded > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-700 font-semibold">Returned: {item.previouslyRefunded} {item.unit}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-bold text-emerald-700">Remaining: {item.maxRefundable} {item.unit}</span>
                            </div>
                          </div>

                          {/* Quantity Input & Max Button */}
                          <div className="flex items-center space-x-2 shrink-0">
                            {/* Clickable Quick Max Pill */}
                            <button
                              type="button"
                              onClick={() => handleItemQuantityChange(item.item_sn, item.maxRefundable.toString())}
                              disabled={isFullyReturned}
                              className="px-2 py-1 rounded-md bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 font-mono font-bold text-[10px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Click to auto-fill maximum remaining returnable quantity for this item"
                            >
                              Max: {item.maxRefundable} {item.unit}
                            </button>

                            {/* Decimal Input Field */}
                            <div className="relative w-28">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={item.maxRefundable}
                                disabled={isFullyReturned}
                                value={itemInputs[item.item_sn] ?? ''}
                                onChange={(e) => handleItemQuantityChange(item.item_sn, e.target.value)}
                                placeholder="0.00"
                                className={`w-full pl-2.5 pr-8 py-1.5 rounded-lg font-mono font-bold text-xs text-right transition-all focus:outline-none ${
                                  item.isExceeding
                                    ? 'border-2 border-rose-500 bg-rose-50/60 ring-1 ring-rose-200 text-rose-900'
                                    : 'border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900'
                                }`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-[10px] uppercase pointer-events-none">
                                {item.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Error Warning if Exceeds Max */}
                        {item.isExceeding && (
                          <div className="mt-1.5 text-[10px] text-rose-700 font-semibold flex items-center space-x-1 animate-in fade-in duration-100">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              Cannot return {item.parsedValue} {item.unit}. Maximum remaining allowable return is {item.maxRefundable} {item.unit}.
                            </span>
                          </div>
                        )}

                        {/* Subtotal line refund */}
                        {item.quantityToReturn > 0 && !item.isExceeding && (
                          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
                            <span className="text-slate-600">Line Refund Impact:</span>
                            <span className="font-mono font-bold text-rose-700">
                              -₦{item.calculatedLineAmount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                  <option value="Entire Order Returned">Entire Order Returned by Customer</option>
                </select>
              </div>

              {/* Requirement 3: Total Expected Return Impact & Dynamic Amount Verification Box */}
              <div className={`p-4 rounded-xl border space-y-2.5 transition-colors ${
                isFormValid
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center space-x-1.5 text-slate-800">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>Expected Return Impact & Batch Calculation:</span>
                  </span>
                  {isAllRemainingItemsAtMax && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      Full Transaction Refund Verified
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center pt-1.5 border-t border-amber-200/70">
                  <span className="font-semibold text-slate-700">Total Amount to Refund Customer:</span>
                  <span className={`font-mono font-black text-lg ${
                    isFormValid ? 'text-rose-700' : 'text-slate-400'
                  }`}>
                    ₦{calculatedRefundTotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-dashed border-amber-200/70">
                  <span className="text-slate-600">Total Stock Restored to Cold Room:</span>
                  <span className={`font-mono font-bold ${
                    isFormValid ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    +{isFormValid ? totalKgRestocked : 0} KG across {itemsToRefund.length} item(s)
                  </span>
                </div>

                {/* Settlement Channel Info */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-amber-200/50">
                  <span>Settlement Deduction Channel:</span>
                  <span className="font-semibold text-slate-700">
                    {currentTx.payment_method === 'Cash' 
                      ? `Cashier Till Float (${currentTx.staff_id})` 
                      : currentTx.pos_terminal_name 
                      ? `POS Terminal: ${currentTx.pos_terminal_name}` 
                      : currentTx.bank_name 
                      ? `Bank: ${currentTx.bank_name}` 
                      : currentTx.payment_method}
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
          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
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
                !isFormValid || 
                !!success || 
                (!isManagerOrAdmin && !authorizedBy)
              }
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-sm flex items-center space-x-1.5 transition-all ${
                !currentTx || !isFormValid || !!success || (!isManagerOrAdmin && !authorizedBy)
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-98 cursor-pointer shadow-rose-600/20'
              }`}
            >
              <span>
                {isAllRemainingItemsAtMax 
                  ? `Confirm Full Refund (₦${calculatedRefundTotal.toLocaleString()})`
                  : `Confirm Refund (₦${calculatedRefundTotal.toLocaleString()})`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
