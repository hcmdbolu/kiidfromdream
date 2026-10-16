import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { SaleTransaction, RefundRecord } from '../../types';
import { verifyPin } from '../../utils/security';
import { RefundVoucherModal } from './RefundVoucherModal';
import { 
  RotateCcw, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  RotateCcw as ResetIcon,
  CreditCard,
  Banknote,
  Building2,
  Package,
  Layers,
  ShieldCheck,
  CheckCheck,
  Printer,
  Split
} from 'lucide-react';

interface RefundModalProps {
  initialTransaction: SaleTransaction | null;
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({ initialTransaction, onClose }) => {
  const { 
    sales, 
    products, 
    processBatchRefund, 
    getRefundableItemsForTransaction, 
    getTransactionRefundSummary,
    activeStaff, 
    employees,
    posTerminals 
  } = usePos();

  const [selectedTxId, setSelectedTxId] = useState<string>(initialTransaction?.transaction_id || '');
  const [itemRefundQuantities, setItemRefundQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>('Customer Changed Mind');
  const [customReasonNote, setCustomReasonNote] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [completedRefundRecord, setCompletedRefundRecord] = useState<RefundRecord | null>(null);
  const [disbursementChannel, setDisbursementChannel] = useState<'ORIGINAL_CHANNEL' | 'STORE_VOUCHER' | 'BANK_REVERSAL' | 'CASH_OVERRIDE'>('ORIGINAL_CHANNEL');
  const [disbursementReference, setDisbursementReference] = useState<string>('');

  const isManagerOrAdmin = ['Manager', 'Admin', 'Super Admin', 'Supervisor'].includes(activeStaff.role);

  // Current transaction
  const currentTx = useMemo(() => {
    return sales.find(s => s.transaction_id === selectedTxId) || initialTransaction;
  }, [sales, selectedTxId, initialTransaction]);

  // Refundable items for current transaction
  const refundableItems = useMemo(() => {
    if (!currentTx) return [];
    return getRefundableItemsForTransaction(currentTx.transaction_id);
  }, [currentTx, getRefundableItemsForTransaction]);

  // Summary of existing and remaining refunds for this transaction
  const refundSummary = useMemo(() => {
    if (!currentTx) {
      return {
        originalTotal: 0,
        alreadyRefundedTotal: 0,
        remainingRefundableTotal: 0,
        isFullyRefunded: false,
        isPartiallyRefunded: false,
        items: [],
      };
    }
    return getTransactionRefundSummary(currentTx.transaction_id);
  }, [currentTx, getTransactionRefundSummary]);

  // Reset/sync quantities and default disbursement mode whenever selected transaction changes
  useEffect(() => {
    if (currentTx) {
      const initialQtys: Record<string, number> = {};
      const items = getRefundableItemsForTransaction(currentTx.transaction_id);
      
      // Default to 0 for all items so manager can pick or click "Refund Entire Transaction"
      items.forEach(it => {
        initialQtys[it.item_sn] = 0;
      });
      setItemRefundQuantities(initialQtys);
      setError(null);
      setSuccess(null);

      // Default disbursement channel: Cash -> Cash; Non-cash (POS/Bank) -> Store Voucher
      if (currentTx.payment_method === 'Cash') {
        setDisbursementChannel('ORIGINAL_CHANNEL');
      } else {
        setDisbursementChannel('STORE_VOUCHER');
      }
      setDisbursementReference('');
    }
  }, [selectedTxId, currentTx, getRefundableItemsForTransaction]);

  // Proportional discount factor
  const discountFactor = useMemo(() => {
    if (!currentTx || currentTx.total_amount <= 0) return 1;
    return currentTx.final_amount / currentTx.total_amount;
  }, [currentTx]);

  // Check if ALL remaining returnable quantities are currently selected
  const isFullRefundSelected = useMemo(() => {
    if (refundableItems.length === 0) return false;
    return refundableItems.every(it => {
      const selected = itemRefundQuantities[it.item_sn] || 0;
      return it.remaining_qty > 0 ? Math.abs(selected - it.remaining_qty) < 0.001 : true;
    }) && refundableItems.some(it => (itemRefundQuantities[it.item_sn] || 0) > 0);
  }, [refundableItems, itemRefundQuantities]);

  // Total quantity being refunded across all items
  const totalQuantityToRefund = useMemo(() => {
    return Object.values(itemRefundQuantities).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, [itemRefundQuantities]);

  // Calculate total expected refund amount
  const calculatedTotalRefundAmount = useMemo(() => {
    if (!currentTx) return 0;

    // If manager clicked "Refund Entire Transaction" (all remaining items selected),
    // refund the EXACT remaining net balance to avoid any rounding discrepancies
    if (isFullRefundSelected) {
      return refundSummary.remainingRefundableTotal;
    }

    let total = 0;
    refundableItems.forEach(it => {
      const qty = itemRefundQuantities[it.item_sn] || 0;
      if (qty > 0) {
        total += Math.round(qty * it.unit_price * discountFactor * 100) / 100;
      }
    });

    return Math.min(total, refundSummary.remainingRefundableTotal);
  }, [currentTx, isFullRefundSelected, refundSummary, refundableItems, itemRefundQuantities, discountFactor]);

  // One-Click "Refund Entire Transaction" Handler
  const handleRefundEntireTransaction = () => {
    if (!currentTx || refundableItems.length === 0) return;
    const fullQtys: Record<string, number> = {};
    refundableItems.forEach(it => {
      fullQtys[it.item_sn] = it.remaining_qty;
    });
    setItemRefundQuantities(fullQtys);
    setError(null);
  };

  // Reset all quantities to 0
  const handleResetQuantities = () => {
    const zeroQtys: Record<string, number> = {};
    refundableItems.forEach(it => {
      zeroQtys[it.item_sn] = 0;
    });
    setItemRefundQuantities(zeroQtys);
    setError(null);
  };

  // Update quantity for a specific item
  const handleItemQuantityChange = (itemSn: string, value: string, maxQty: number) => {
    const val = parseFloat(value);
    if (isNaN(val) || val < 0) {
      setItemRefundQuantities(prev => ({ ...prev, [itemSn]: 0 }));
      return;
    }
    const cleanQty = Math.min(val, maxQty);
    setItemRefundQuantities(prev => ({ ...prev, [itemSn]: cleanQty }));
  };

  // Quick set max for a single item
  const handleSetItemMax = (itemSn: string, maxQty: number) => {
    setItemRefundQuantities(prev => ({ ...prev, [itemSn]: maxQty }));
  };

  // Manager, Supervisor, or Admin PIN/Password Authorization
  const handleAuthorizePin = () => {
    const cleanPin = managerPin.trim();
    if (!cleanPin) {
      setError('Please enter Manager, Supervisor, or Admin PIN/Password.');
      return;
    }
    const staff = employees.find(e => 
      verifyPin(cleanPin, e.pin) || (e.password && verifyPin(cleanPin, e.password))
    );
    if (!staff) {
      setError('Invalid PIN or password entered.');
      return;
    }
    const allowedRoles = ['Manager', 'Admin', 'Super Admin', 'Supervisor'];
    if (!allowedRoles.includes(staff.role)) {
      setError(`Access Denied: ${staff.role} ${staff.staff_name} cannot authorize customer returns. Only a Manager, Supervisor, or Admin can authorize.`);
      return;
    }
    setAuthorizedBy(staff.staff_id);
    setError(null);
  };

  // Submit Batch Refund
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentTx) {
      setError('Please select a valid transaction.');
      return;
    }

    if (refundSummary.isFullyRefunded) {
      setError('This transaction has already been fully refunded.');
      return;
    }

    // Role security check: Strictly Manager, Supervisor, and Admin Only
    if (!isManagerOrAdmin && !authorizedBy) {
      setError('Access Denied: Customer refunds are strictly restricted to Manager and Admin accounts.');
      return;
    }

    // Prepare items payload
    const itemsToRefund = Object.entries(itemRefundQuantities)
      .filter(([_, qty]) => (Number(qty) || 0) > 0)
      .map(([item_sn, quantity]) => ({
        item_sn,
        quantity: Math.round(Number(quantity) * 1000) / 1000,
      }));

    if (itemsToRefund.length === 0) {
      setError('Please specify a return quantity greater than 0 for at least one item, or click "Refund Entire Transaction".');
      return;
    }

    setIsSubmitting(true);

    const effectiveReason = customReasonNote.trim() 
      ? `${reason} - ${customReasonNote.trim()}` 
      : reason;

    const res = processBatchRefund({
      originalTxnId: currentTx.transaction_id,
      items: itemsToRefund,
      reason: effectiveReason,
      authorizedByStaffId: authorizedBy || undefined,
      disbursementChannel,
      disbursementReference: disbursementReference.trim() || undefined,
      cashierStaffId: currentTx.staff_id,
      bankAccountId: currentTx.bank_account_id,
      posTerminalId: currentTx.pos_terminal_id,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to process refund');
    } else {
      if (res.refundRecord) {
        setCompletedRefundRecord(res.refundRecord);
      } else {
        setSuccess('Refund processed successfully! Transaction status updated, inventory restocked, and audit ledger updated.');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }
  };

  // Payment mapping details of the original transaction
  const paymentDetails = useMemo(() => {
    if (!currentTx) return null;
    if (currentTx.payment_splits && currentTx.payment_splits.length > 0) {
      const splitDescriptions = currentTx.payment_splits.map(s => `${s.method}: ₦${s.amount.toLocaleString()}`).join(', ');
      return {
        type: 'Split',
        label: `Split Payment (${splitDescriptions}) - Proportionately Debited`,
        icon: Split,
        color: 'text-amber-700 bg-amber-50 border-amber-200',
      };
    }
    if (currentTx.payment_method === 'Cash') {
      const cashier = employees.find(e => e.staff_id === currentTx.staff_id);
      return {
        type: 'Cash',
        label: `Cashier Drawer Float (${cashier ? cashier.staff_name : currentTx.staff_id})`,
        icon: Banknote,
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      };
    }
    if (currentTx.payment_method === 'POS' || currentTx.payment_method === 'Debit/Credit Card') {
      return {
        type: 'POS',
        label: currentTx.pos_terminal_name ? `POS Terminal: ${currentTx.pos_terminal_name}` : 'POS Terminal / Card Settlement',
        icon: CreditCard,
        color: 'text-purple-700 bg-purple-50 border-purple-200',
      };
    }
    if (currentTx.payment_method === 'Bank Transfer') {
      return {
        type: 'Transfer',
        label: currentTx.bank_name ? `Bank Account: ${currentTx.bank_name} (${currentTx.bank_account_number || ''})` : 'Bank Transfer Settlement Account',
        icon: Building2,
        color: 'text-blue-700 bg-blue-50 border-blue-200',
      };
    }
    return {
      type: currentTx.payment_method,
      label: currentTx.payment_method,
      icon: Layers,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
    };
  }, [currentTx, employees]);

  if (completedRefundRecord) {
    return (
      <RefundVoucherModal
        refund={completedRefundRecord}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-rose-800/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-sm sm:text-base tracking-tight">Customer Return & Refund Processing</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Manager Only
                </span>
              </div>
              <p className="text-[11px] text-rose-200/80 mt-0.5">
                Restores item inventory, syncs cash/bank balances, and logs to cryptographic ledger
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-start space-x-3 animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-xs">Refund Completed Successfully!</div>
                <div className="text-[11px] text-emerald-800 leading-relaxed">{success}</div>
              </div>
            </div>
          )}

          {/* Transaction Selection Bar */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 uppercase text-[10px] tracking-wider">
              Select Sale Transaction to Refund *
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            >
              <option value="">-- Choose Transaction to Refund --</option>
              {sales.map(s => (
                <option key={s.transaction_id} value={s.transaction_id}>
                  {s.transaction_id} • ₦{s.final_amount.toLocaleString()} ({s.payment_method}) • {s.date_time} {s.status === 'REFUNDED' ? '[ALREADY REFUNDED]' : s.status === 'PARTIALLY_REFUNDED' ? '[PARTIAL REFUND]' : ''}
                </option>
              ))}
            </select>
          </div>

          {currentTx && (
            <>
              {/* Transaction Metadata & Status Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-slate-900 text-sm">{currentTx.transaction_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      currentTx.status === 'REFUNDED' 
                        ? 'bg-rose-100 text-rose-800 border-rose-300' 
                        : currentTx.status === 'PARTIALLY_REFUNDED'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {currentTx.status === 'REFUNDED' ? 'Fully Refunded' : currentTx.status === 'PARTIALLY_REFUNDED' ? 'Partially Refunded' : 'Completed Sale'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {currentTx.date_time}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Original Net Total</span>
                    <span className="font-bold font-mono text-slate-900 text-xs">₦{currentTx.final_amount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Already Refunded</span>
                    <span className={`font-bold font-mono text-xs ${refundSummary.alreadyRefundedTotal > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      ₦{refundSummary.alreadyRefundedTotal.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Max Returnable Balance</span>
                    <span className="font-bold font-mono text-emerald-700 text-xs">
                      ₦{refundSummary.remainingRefundableTotal.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Original Payment Method</span>
                    {paymentDetails && (
                      <span className={`inline-flex items-center space-x-1 font-semibold text-[10px] px-2 py-0.5 rounded border ${paymentDetails.color}`}>
                        <paymentDetails.icon className="w-3 h-3" />
                        <span className="truncate max-w-[110px]">{paymentDetails.type}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Disbursement Channel Selector for Non-Cash Transactions */}
                {currentTx.payment_method !== 'Cash' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Refund Disbursement Channel</span>
                      </span>
                      <span className="text-[10px] text-amber-700 bg-amber-100 font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                        Original: {currentTx.payment_method}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDisbursementChannel('STORE_VOUCHER')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          disbursementChannel === 'STORE_VOUCHER'
                            ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">Store Voucher</span>
                          <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">Recommended</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Issue printable voucher. Zero drawer float impact.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDisbursementChannel('BANK_REVERSAL')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          disbursementChannel === 'BANK_REVERSAL'
                            ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">Bank Reversal</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Disburse via corporate bank transfer. Drawer untouched.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDisbursementChannel('CASH_OVERRIDE')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          disbursementChannel === 'CASH_OVERRIDE'
                            ? 'bg-amber-50/80 border-amber-500 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">Cash Override</span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Alert</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Pay cash from drawer. Deducts cashier float.
                        </p>
                      </button>
                    </div>

                    {disbursementChannel === 'BANK_REVERSAL' && (
                      <div className="pt-1">
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">
                          Outward Bank Transfer Reference / Session ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={disbursementReference}
                          onChange={(e) => setDisbursementReference(e.target.value)}
                          placeholder="e.g. TRF-REV-90281203"
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    {disbursementChannel === 'CASH_OVERRIDE' && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Warning: Paying physical cash for a card/transfer sale will deduct from Cashier float and generate an audit security log.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* One-Click Action Banner: Full Refund vs Custom Item Selection */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-xl">
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    <span>Quick Refund Actions</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Auto-fill every item with maximum returnable decimal quantities in one click.
                  </p>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleRefundEntireTransaction}
                    disabled={refundSummary.isFullyRefunded}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 text-white rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    title="Populate return fields for every item with full remaining quantities"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Refund Entire Transaction</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetQuantities}
                    className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                    title="Reset all return inputs to 0"
                  >
                    <ResetIcon className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Itemized Basket Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                    Basket Items to Return ({refundableItems.length} Products)
                  </label>
                  {isFullRefundSelected && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                      ✓ Entire Order Selected
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item / SKU</th>
                        <th className="py-2.5 px-3 text-right">Sold Qty</th>
                        <th className="py-2.5 px-3 text-right">Returnable</th>
                        <th className="py-2.5 px-3 text-center w-36">Return Qty</th>
                        <th className="py-2.5 px-3 text-right">Refund Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {refundableItems.map(item => {
                        const currentInputQty = itemRefundQuantities[item.item_sn] ?? 0;
                        const lineRefund = Math.round(currentInputQty * item.unit_price * discountFactor * 100) / 100;
                        const isSoldOutForRefund = item.remaining_qty <= 0.001;

                        return (
                          <tr key={item.item_sn} className={`hover:bg-slate-50 transition-colors ${currentInputQty > 0 ? 'bg-rose-50/40' : ''}`}>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.item_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.item_sn} • ₦{item.unit_price.toLocaleString()}/{item.unit}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {item.original_qty} {item.unit}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {isSoldOutForRefund ? (
                                <span className="text-slate-400 text-[10px]">Fully Returned</span>
                              ) : (
                                <span className="text-emerald-700">{item.remaining_qty} {item.unit}</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1.5 justify-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={item.remaining_qty}
                                  disabled={isSoldOutForRefund || refundSummary.isFullyRefunded}
                                  value={currentInputQty === 0 ? '' : currentInputQty}
                                  placeholder="0"
                                  onChange={(e) => handleItemQuantityChange(item.item_sn, e.target.value, item.remaining_qty)}
                                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono text-right text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <button
                                  type="button"
                                  disabled={isSoldOutForRefund || refundSummary.isFullyRefunded}
                                  onClick={() => handleSetItemMax(item.item_sn, item.remaining_qty)}
                                  className="px-1.5 py-1 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors disabled:opacity-30 cursor-pointer"
                                  title="Return maximum remaining for this item"
                                >
                                  Max
                                </button>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ₦{lineRefund.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reason Selection & Custom Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1 uppercase text-[10px] tracking-wider">
                    Reason for Return *
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="Customer Changed Mind">Customer Changed Mind</option>
                    <option value="Spoilt / Expired Goods">Spoilt / Expired Goods</option>
                    <option value="Quality Discrepancy">Quality Discrepancy / Size Issue</option>
                    <option value="Incorrect Weight Recorded">Incorrect Weight Recorded</option>
                    <option value="Wrong Item Dispensed">Wrong Item Dispensed</option>
                    <option value="Customer Overcharged">Customer Overcharged</option>
                    <option value="Other">Other (Specify in notes)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 uppercase text-[10px] tracking-wider">
                    Additional Inspection / Approval Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Item inspected by manager, returned in original condition"
                    value={customReasonNote}
                    onChange={(e) => setCustomReasonNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Dynamic Impact & Financial Verification Box */}
              <div className="p-4 bg-gradient-to-br from-rose-50 via-rose-50/40 to-slate-50 border-2 border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-rose-200/80 pb-2">
                  <span className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Dynamic Refund & Ledger Impact Summary</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-200/70 text-rose-900">
                    {isFullRefundSelected ? 'Full Basket Refund' : 'Partial Item Return'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-bold">Total Customer Refund Due:</span>
                    <span className="text-xl font-black font-mono text-rose-700">
                      ₦{calculatedTotalRefundAmount.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Exact net amount returned to customer.
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-bold">Inventory Restocked:</span>
                    <span className="text-base font-bold font-mono text-emerald-700 flex items-center space-x-1">
                      <span>+{Math.round(totalQuantityToRefund * 1000) / 1000}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({Object.values(itemRefundQuantities).filter(q => q > 0).length} items)
                      </span>
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Added back to current on-hand stock automatically.
                    </p>
                  </div>
                </div>

                {paymentDetails && (
                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Balance Deduction Source:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {paymentDetails.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Manager & Admin PIN Verification (For Non-Manager/Admin Users) */}
              {!isManagerOrAdmin && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-900 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Manager / Admin Authorization Required</span>
                    </span>
                    {authorizedBy && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Authorized by {authorizedBy}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Customer refunds are restricted to <strong>Manager</strong> and <strong>Admin</strong> accounts. Cashiers and Supervisors cannot execute refunds. Please ask a Manager (Chidinma: 4444) or Admin (Alex: 9999) to authorize with their 4-digit PIN.
                  </p>
                  {!authorizedBy ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Manager / Admin PIN"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        className="bg-white border border-rose-300 rounded-xl px-3 py-2 font-mono text-center font-bold tracking-widest text-xs flex-1 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAuthorizePin}
                        className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Authorize
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span>Authorization approved for this refund session.</span>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Ready</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                !currentTx || 
                calculatedTotalRefundAmount <= 0 || 
                isSubmitting || 
                !!success || 
                refundSummary.isFullyRefunded || 
                (!isManagerOrAdmin && !authorizedBy)
              }
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 active:from-rose-800 active:to-rose-900 disabled:opacity-40 text-white rounded-xl font-black shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>
                {isFullRefundSelected 
                  ? `Confirm Full Refund (₦${calculatedTotalRefundAmount.toLocaleString()})`
                  : `Confirm Refund (₦${calculatedTotalRefundAmount.toLocaleString()})`
                }
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
