import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { ProductCategory, PaymentMethod, SplitPaymentDetail, Product, Employee, ActiveWalkInOrder, ParkedOrder } from '../../types';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Building2, 
  Receipt, 
  UserPlus, 
  Award, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Sparkles,
  ArrowRight,
  Lock,
  Percent,
  UserCheck,
  ShieldCheck,
  Scale,
  Split,
  Layers,
  Calculator,
  HelpCircle,
  PauseCircle,
  Clock,
  Users,
  PlayCircle,
  X,
  Copy,
  Check,
  KeyRound
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';
import { WeightModal } from './WeightModal';
import { ParkedOrdersModal } from './ParkedOrdersModal';
import { ParkOrderPromptModal } from './ParkOrderPromptModal';
import { VoidOrderModal } from './VoidOrderModal';
import { ProductCard } from './ProductCard';
import { CartItemRow } from './CartItemRow';
import { DiscountPinModal } from './DiscountPinModal';
import { ConfigureDiscountPinModal } from './ConfigureDiscountPinModal';
import { evaluateDiscountRule } from '../../utils/discountRules';
import { DiscountRule } from '../../types';

interface PosTerminalProps {
  onOpenCustomerModal: () => void;
  openParkedOrdersDirectly?: boolean;
  onClearOpenParkedOrdersDirectly?: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({ 
  onOpenCustomerModal,
  openParkedOrdersDirectly,
  onClearOpenParkedOrdersDirectly,
}) => {
  const {
    products,
    customers,
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    selectedCustomerId,
    setSelectedCustomerId,
    customDiscount,
    customDiscountReason,
    discountAuthorizedBy,
    applyCustomDiscount,
    clearDiscount,
    cartSubtotal,
    cartTotalQuantity,
    calculatedDiscounts,
    cartFinalTotal,
    processCheckout,
    activeStaff,
    hasPermission,
    activeOrders,
    activeOrderId,
    createWalkInOrder,
    switchActiveOrder,
    closeOrderTab,
    updateOrderLabel,
    parkedOrders,
    parkActiveOrder,
    resumeParkedOrder,
    voidedOrders,
    cancelAndVoidOrder,
    posTerminals,
    categories: dynamicCategories,
    discountSecurityConfig,
    discountRules,
    selectedDiscountRuleId,
    verifyDiscountAuthorizationPin,
    updateDiscountPin,
    applyDiscountWithPin,
    applyPreApprovedRule,
    validateCartProfitMargin,
  } = usePos();

  // Active POS Devices and Bank Accounts
  const activePosDevices = useMemo(() => {
    return posTerminals.filter(t => t.type === 'POS_TERMINAL' && t.status === 'Active');
  }, [posTerminals]);

  const activeBankAccounts = useMemo(() => {
    return posTerminals.filter(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.status === 'Active');
  }, [posTerminals]);

  const defaultPosDevice = useMemo(() => {
    return activePosDevices.find(t => t.is_default) || activePosDevices[0];
  }, [activePosDevices]);

  const defaultBankAccount = useMemo(() => {
    return activeBankAccounts.find(t => t.is_default) || activeBankAccounts[0];
  }, [activeBankAccounts]);

  // Terminal & Account Selection State
  const [selectedPosTerminalId, setSelectedPosTerminalId] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [splitSecondPosTerminalId, setSplitSecondPosTerminalId] = useState<string>('');
  const [splitSecondBankAccountId, setSplitSecondBankAccountId] = useState<string>('');
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);

  useEffect(() => {
    if (!selectedPosTerminalId && defaultPosDevice) {
      setSelectedPosTerminalId(defaultPosDevice.id);
    }
    if (!splitSecondPosTerminalId && defaultPosDevice) {
      setSplitSecondPosTerminalId(defaultPosDevice.id);
    }
  }, [defaultPosDevice, selectedPosTerminalId, splitSecondPosTerminalId]);

  useEffect(() => {
    if (!selectedBankAccountId && defaultBankAccount) {
      setSelectedBankAccountId(defaultBankAccount.id);
    }
    if (!splitSecondBankAccountId && defaultBankAccount) {
      setSplitSecondBankAccountId(defaultBankAccount.id);
    }
  }, [defaultBankAccount, selectedBankAccountId, splitSecondBankAccountId]);

  // Multi-Order & Walk-in Queue Modals
  const [isParkPromptOpen, setIsParkPromptOpen] = useState(false);
  const [isParkedListOpen, setIsParkedListOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [orderForVoidModal, setOrderForVoidModal] = useState<ActiveWalkInOrder | ParkedOrder | null>(null);

  useEffect(() => {
    if (openParkedOrdersDirectly) {
      setIsParkedListOpen(true);
      if (onClearOpenParkedOrdersDirectly) {
        onClearOpenParkedOrdersDirectly();
      }
    }
  }, [openParkedOrdersDirectly, onClearOpenParkedOrdersDirectly]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Payment Mode: Single Payment (100%) vs Split Payment (Multi-Tender)
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [singleRef, setSingleRef] = useState<string>(''); // e.g. Transfer session ID or POS RRN

  // Credit / Pay Later Terms State
  const [creditDeposit, setCreditDeposit] = useState<string>('0');
  const [creditDepositMethod, setCreditDepositMethod] = useState<'Cash' | 'POS' | 'Bank Transfer'>('Cash');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  // Split-Payment State
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitCashTendered, setSplitCashTendered] = useState<string>('');
  const [splitSecondMethod, setSplitSecondMethod] = useState<'Bank Transfer' | 'POS'>('Bank Transfer');
  const [splitSecondAmount, setSplitSecondAmount] = useState<string>('');
  const [splitSecondRef, setSplitSecondRef] = useState<string>('');
  const [splitThirdMethod, setSplitThirdMethod] = useState<'POS' | 'Bank Transfer' | null>(null);
  const [splitThirdAmount, setSplitThirdAmount] = useState<string>('');
  const [splitThirdRef, setSplitThirdRef] = useState<string>('');

  // Weight / Scale Measurement Modal State
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [weighingInitialQty, setWeighingInitialQty] = useState<number>(1);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  // Discount Panel & PIN Auth State
  const [isDiscountPanelOpen, setIsDiscountPanelOpen] = useState(false);
  const [isDiscountPinModalOpen, setIsDiscountPinModalOpen] = useState(false);
  const [isConfigurePinModalOpen, setIsConfigurePinModalOpen] = useState(false);
  const [discountTab, setDiscountTab] = useState<'rules' | 'custom'>('rules');
  const [pendingDiscountAuth, setPendingDiscountAuth] = useState<{
    title: string;
    amountNaira: number;
    description: string;
    ruleId?: string;
  } | null>(null);

  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('5');
  const [discountReasonText, setDiscountReasonText] = useState<string>('Manager Approved Discount');
  const [discountError, setDiscountError] = useState<string | null>(null);

  const canManageDiscountPin = ['Supervisor', 'Manager', 'Admin', 'Super Admin'].includes(activeStaff.role) || hasPermission('CAN_SYSTEM_CONFIG');

  const categories = useMemo(() => {
    const fromDb = dynamicCategories.map(c => c.name);
    const fromProducts = products.map(p => p.product_category).filter(Boolean);
    const defaultCategories = ['General', 'Groceries', 'Beverages', 'Food & Snacks', 'Perishables', 'Frozen Goods'];
    const merged = Array.from(new Set([...fromDb, ...fromProducts, ...defaultCategories]));
    return ['All', ...merged];
  }, [dynamicCategories, products]);

  // Automatically update second split when cash amount or cart final total changes
  useEffect(() => {
    if (paymentMode === 'split') {
      const cashVal = parseFloat(splitCashAmount) || 0;
      const thirdVal = parseFloat(splitThirdAmount) || 0;
      const remaining = Math.max(0, cartFinalTotal - cashVal - thirdVal);
      setSplitSecondAmount(remaining > 0 ? remaining.toString() : '0');
    }
  }, [splitCashAmount, splitThirdAmount, cartFinalTotal, paymentMode]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (product.status !== 'Active') return false;
      const matchesCategory = selectedCategory === 'All' || product.product_category === selectedCategory;
      const matchesSearch = 
        product.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.item_sn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  // Cash change calculation for single payment
  const cashAmountNum = parseFloat(cashTendered) || 0;
  const changeDueSingle = selectedPaymentMethod === 'Cash' && cashAmountNum > cartFinalTotal 
    ? cashAmountNum - cartFinalTotal 
    : 0;

  // Split-Payment Calculations
  const splitCashNum = parseFloat(splitCashAmount) || 0;
  const splitSecondNum = parseFloat(splitSecondAmount) || 0;
  const splitThirdNum = parseFloat(splitThirdAmount) || 0;
  const totalSplitAllocated = splitCashNum + splitSecondNum + splitThirdNum;
  const splitRemainingBalance = cartFinalTotal - totalSplitAllocated;

  const splitCashHanded = parseFloat(splitCashTendered) || 0;
  const splitCashChangeDue = splitCashHanded > splitCashNum ? splitCashHanded - splitCashNum : 0;

  // Open scale modal
  const handleOpenWeigh = (product: Product, currentQty: number = 1) => {
    setWeighingProduct(product);
    setWeighingInitialQty(currentQty);
    setIsWeighModalOpen(true);
  };

  const handleConfirmWeight = (quantity: number) => {
    if (!weighingProduct) return;
    const inCart = cart.find(c => c.item_sn === weighingProduct.item_sn);
    if (inCart) {
      updateCartQuantity(weighingProduct.item_sn, quantity);
    } else {
      addToCart(weighingProduct, quantity);
    }
    setIsWeighModalOpen(false);
    setWeighingProduct(null);
  };

  // Helper to pre-set cash amount shortcuts
  const handleSetCashShare = (fraction: number) => {
    const share = Math.round(cartFinalTotal * fraction);
    setSplitCashAmount(share.toString());
  };

  const handleCheckout = () => {
    setCheckoutError(null);
    setCheckoutSuccess(null);

    if (cart.length === 0) {
      setCheckoutError('Please add products to the cart before checking out.');
      return;
    }

    if (paymentMode === 'single') {
      if (selectedPaymentMethod === 'Cash' && cashAmountNum > 0 && cashAmountNum < cartFinalTotal) {
        setCheckoutError(`Tendered amount ₦${cashAmountNum.toLocaleString()} is less than total ₦${cartFinalTotal.toLocaleString()}`);
        return;
      }

      // Build paymentMeta for POS terminal or Bank account tracking
      let paymentMeta: {
        pos_terminal_id?: string;
        pos_terminal_name?: string;
        bank_account_number?: string;
        bank_name?: string;
        payment_reference?: string;
        credit_amount?: number;
        deposit_amount?: number;
        balance_due?: number;
        payment_due_date?: string;
        deposit_payment_method?: 'Cash' | 'POS' | 'Bank Transfer' | 'Transfer' | string;
      } | undefined = undefined;

      if (selectedPaymentMethod === 'POS') {
        const term = posTerminals.find(t => t.id === selectedPosTerminalId) || activePosDevices[0];
        paymentMeta = {
          pos_terminal_id: term?.id,
          pos_terminal_name: term?.name,
          bank_account_number: term?.account_number,
          bank_name: term?.bank_name,
          payment_reference: singleRef.trim() || undefined,
        };
      } else if (selectedPaymentMethod === 'Bank Transfer') {
        const bank = posTerminals.find(t => t.id === selectedBankAccountId) || activeBankAccounts[0];
        paymentMeta = {
          pos_terminal_id: bank?.id,
          pos_terminal_name: bank?.name,
          bank_account_number: bank?.account_number,
          bank_name: bank?.bank_name,
          payment_reference: singleRef.trim() || undefined,
        };
      } else if (selectedPaymentMethod === 'Cash') {
        paymentMeta = {
          payment_reference: 'CASH-DRAWER',
        };
      } else if (selectedPaymentMethod === 'Credit / Pay Later') {
        const depNum = Math.max(0, Number(creditDeposit) || 0);
        const creditAmt = Math.max(0, cartFinalTotal - depNum);
        paymentMeta = {
          credit_amount: creditAmt,
          deposit_amount: depNum,
          balance_due: creditAmt,
          payment_due_date: creditDueDate,
          deposit_payment_method: depNum > 0 ? creditDepositMethod : undefined,
          payment_reference: `CREDIT-${Date.now().toString().slice(-6)}`,
        };
      }

      const res = processCheckout(
        selectedPaymentMethod,
        undefined,
        selectedPaymentMethod === 'Cash'
          ? (cashAmountNum || cartFinalTotal)
          : selectedPaymentMethod === 'Credit / Pay Later'
          ? (Number(creditDeposit) || 0)
          : cartFinalTotal,
        selectedPaymentMethod === 'Credit / Pay Later' ? 0 : changeDueSingle,
        paymentMeta
      );

      if (!res.success) {
        setCheckoutError(res.error || 'Failed to process checkout');
      } else {
        setCheckoutSuccess(`Sale completed! Receipt TXN ${res.transaction?.transaction_id} generated.`);
        setCashTendered('');
        setSingleRef('');
        setIsDiscountPanelOpen(false);
        setTimeout(() => setCheckoutSuccess(null), 4000);
      }
    } else {
      // Split payment mode
      if (Math.abs(splitRemainingBalance) > 1) {
        setCheckoutError(`Payment allocations do not match total order (₦${cartFinalTotal.toLocaleString()}). Remaining balance: ₦${splitRemainingBalance.toLocaleString()}`);
        return;
      }

      if (splitCashNum <= 0 && splitSecondNum <= 0) {
        setCheckoutError('Please allocate amounts for split payment.');
        return;
      }

      const splits: SplitPaymentDetail[] = [];
      if (splitCashNum > 0) {
        splits.push({
          method: 'Cash',
          amount: splitCashNum,
          notes: splitCashChangeDue > 0 ? `Tendered ₦${splitCashHanded.toLocaleString()}, Change ₦${splitCashChangeDue.toLocaleString()}` : undefined
        });
      }
      if (splitSecondNum > 0) {
        let secondMeta: {
          pos_terminal_id?: string;
          pos_terminal_name?: string;
          bank_account_number?: string;
          bank_name?: string;
        } = {};

        if (splitSecondMethod === 'POS') {
          const term = posTerminals.find(t => t.id === splitSecondPosTerminalId) || activePosDevices[0];
          secondMeta = {
            pos_terminal_id: term?.id,
            pos_terminal_name: term?.name,
            bank_account_number: term?.account_number,
            bank_name: term?.bank_name,
          };
        } else if (splitSecondMethod === 'Bank Transfer') {
          const bank = posTerminals.find(t => t.id === splitSecondBankAccountId) || activeBankAccounts[0];
          secondMeta = {
            pos_terminal_id: bank?.id,
            pos_terminal_name: bank?.name,
            bank_account_number: bank?.account_number,
            bank_name: bank?.bank_name,
          };
        }

        splits.push({
          method: splitSecondMethod,
          amount: splitSecondNum,
          reference: splitSecondRef.trim() || undefined,
          ...secondMeta
        });
      }
      if (splitThirdMethod && splitThirdNum > 0) {
        splits.push({
          method: splitThirdMethod,
          amount: splitThirdNum,
          reference: splitThirdRef.trim() || undefined
        });
      }

      const totalPaid = totalSplitAllocated + (splitCashChangeDue > 0 ? splitCashChangeDue : 0);

      const res = processCheckout(
        'Split Payment',
        splits,
        totalPaid,
        splitCashChangeDue
      );

      if (!res.success) {
        setCheckoutError(res.error || 'Failed to process split checkout');
      } else {
        setCheckoutSuccess(`Split sale completed! Receipt TXN ${res.transaction?.transaction_id} generated.`);
        setSplitCashAmount('');
        setSplitCashTendered('');
        setSplitSecondRef('');
        setSplitThirdMethod(null);
        setSplitThirdAmount('');
        setSplitThirdRef('');
        setIsDiscountPanelOpen(false);
        setTimeout(() => setCheckoutSuccess(null), 4000);
      }
    }
  };

  const canDirectlyApplyDiscount = hasPermission('CAN_APPLY_DISCOUNT');

  // Evaluated discount rules against active cart
  const evaluatedRules = useMemo(() => {
    return discountRules.map(rule => {
      const evalResult = evaluateDiscountRule(rule, cart, selectedCustomer || null, cartSubtotal);
      return {
        rule,
        ...evalResult,
      };
    });
  }, [discountRules, cart, selectedCustomer, cartSubtotal]);

  // Real-time Cart Profit Margin validation
  const cartMargin = useMemo(() => {
    return validateCartProfitMargin();
  }, [cart, calculatedDiscounts, validateCartProfitMargin]);

  // Detected bulk discount rule qualified by current cart
  const qualifiedBulkRule = useMemo(() => {
    return evaluatedRules.find(r => r.isQualified && r.calculatedDiscount > 0 && selectedDiscountRuleId !== r.rule.rule_id);
  }, [evaluatedRules, selectedDiscountRuleId]);

  const handleOpenDiscount = () => {
    setDiscountError(null);
    setIsDiscountPanelOpen(true);
  };

  const handleSelectRule = (rule: DiscountRule, calculatedDiscount: number) => {
    setDiscountError(null);
    if (rule.requires_manager_approval) {
      setPendingDiscountAuth({
        title: rule.name,
        amountNaira: calculatedDiscount,
        description: rule.description,
        ruleId: rule.rule_id,
      });
      setIsDiscountPinModalOpen(true);
    } else {
      const res = applyPreApprovedRule(rule.rule_id);
      if (!res.success) {
        setDiscountError(res.error || 'Failed to apply rule');
      } else {
        setIsDiscountPanelOpen(false);
      }
    }
  };

  const handleApplyCustomDiscountSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDiscountError(null);
    const num = parseFloat(discountValue);
    if (isNaN(num) || num <= 0) {
      setDiscountError('Please enter a valid positive discount value.');
      return;
    }

    let calculatedDiscountNaira = 0;
    if (discountType === 'percent') {
      if (num > 100) {
        setDiscountError('Percentage discount cannot exceed 100%.');
        return;
      }
      calculatedDiscountNaira = Math.round((cartSubtotal * num) / 100);
    } else {
      if (num > cartSubtotal) {
        setDiscountError(`Discount amount cannot exceed cart subtotal (₦${cartSubtotal.toLocaleString()}).`);
        return;
      }
      calculatedDiscountNaira = Math.round(num);
    }

    const reason = discountReasonText.trim() 
      ? `${discountReasonText.trim()} (${discountType === 'percent' ? `${num}%` : `₦${num.toLocaleString()}`})`
      : `Manager Approved Discount (${discountType === 'percent' ? `${num}%` : `₦${num.toLocaleString()}`})`;

    // Check store maximum discount percentage policy
    const maxPercentCap = discountSecurityConfig.max_discount_percent_cap || 100;
    const effectivePercent = cartSubtotal > 0 ? (calculatedDiscountNaira / cartSubtotal) * 100 : 0;
    if (effectivePercent > maxPercentCap) {
      setDiscountError(`Proposed discount of ${effectivePercent.toFixed(1)}% exceeds the management policy ceiling of ${maxPercentCap}%.`);
      return;
    }

    if (canDirectlyApplyDiscount) {
      const res = applyCustomDiscount(
        calculatedDiscountNaira, 
        reason, 
        `${activeStaff.staff_name} (${activeStaff.role})`
      );
      if (!res.success) {
        setDiscountError(res.error || 'Failed to apply discount.');
      } else {
        setIsDiscountPanelOpen(false);
      }
    } else {
      // Cashier enforces discount with Store Discount PIN set by manager
      setPendingDiscountAuth({
        title: 'Custom Order Discount',
        amountNaira: calculatedDiscountNaira,
        description: reason,
      });
      setIsDiscountPinModalOpen(true);
    }
  };

  const handleDiscountPinSuccess = (pin: string) => {
    if (!pendingDiscountAuth) return;
    const res = applyDiscountWithPin(
      pin,
      pendingDiscountAuth.amountNaira,
      pendingDiscountAuth.description,
      pendingDiscountAuth.ruleId
    );
    if (res.success) {
      setIsDiscountPinModalOpen(false);
      setIsDiscountPanelOpen(false);
      setPendingDiscountAuth(null);
      setDiscountError(null);
    } else {
      setDiscountError(res.error || 'Invalid Store Discount PIN');
    }
  };

  const now = new Date();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      
      {/* MULTI-ORDER & WALK-IN QUEUING WORKSPACE BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Active Walk-in Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 flex-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1 pr-2 flex items-center space-x-1 shrink-0">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Walk-Ins:</span>
          </div>

          {activeOrders.map(order => {
            const isActive = order.id === activeOrderId;
            const orderItemsCount = order.id === activeOrderId ? cart.length : (order.cart?.length || 0);
            const orderTotal = order.id === activeOrderId ? cartFinalTotal : (order.cart?.reduce((a, b) => a + b.total_amount, 0) || 0);

            return (
              <div
                key={order.id}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                onClick={() => switchActiveOrder(order.id)}
              >
                <span className="font-bold">{order.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {orderItemsCount} items • ₦{orderTotal.toLocaleString()}
                </span>
                {activeOrders.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (orderItemsCount > 0) {
                        setOrderForVoidModal(order);
                        setIsVoidModalOpen(true);
                      } else {
                        closeOrderTab(order.id);
                      }
                    }}
                    className={`p-0.5 rounded-full hover:bg-black/10 transition-colors ${
                      isActive ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                    }`}
                    title="Close or Void walk-in tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Walk-In Order Button */}
          <button
            type="button"
            onClick={() => createWalkInOrder()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-dashed border-emerald-400 hover:border-emerald-600 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 text-xs font-semibold transition-all shrink-0 cursor-pointer"
            title="Open another walk-in customer checkout tab simultaneously"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Walk-in</span>
          </button>
        </div>

        {/* Queue Control Buttons: Hold / Park, View Held, Void Order */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Park / Hold Current Order */}
          <button
            type="button"
            onClick={() => setIsParkPromptOpen(true)}
            disabled={cart.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            title="Hold/Pause Customer A order to take Customer B"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Hold / Park Order</span>
          </button>

          {/* View Parked Orders Queue Button */}
          <button
            type="button"
            onClick={() => setIsParkedListOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs relative cursor-pointer"
            title="View all held orders awaiting customer return"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Held Orders</span>
            {parkedOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-[10px]">
                {parkedOrders.length}
              </span>
            )}
          </button>

          {/* Dedicated Void / Cancel Order Button */}
          <button
            type="button"
            onClick={() => {
              const cur = activeOrders.find(o => o.id === activeOrderId);
              setOrderForVoidModal(cur || null);
              setIsVoidModalOpen(true);
            }}
            disabled={cart.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Abort order and log cancellation reason with inventory integrity"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Void Order</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Section: Product Catalogue & Search (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full px-2 py-0.5"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300 p-8">
                <p className="text-slate-500 font-medium text-sm">No items found matching your search.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredProducts.map(product => (
                <ProductCard
                  key={product.item_sn}
                  product={product}
                  inCart={cart.find(c => c.item_sn === product.item_sn)}
                  currentTime={now}
                  onAddToCart={addToCart}
                  onUpdateCartQuantity={updateCartQuantity}
                  onOpenWeigh={handleOpenWeigh}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Section: Active Cart & Checkout Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between h-full">
            
            {/* Header: Customer Select & Cart Status */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{activeOrders.find(o => o.id === activeOrderId)?.label || 'Order Summary'}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold uppercase">Active</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">{cart.length} item(s) • {cartTotalQuantity} unit(s)</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {cart.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsParkPromptOpen(true)}
                        className="text-xs text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
                        title="Hold/Pause order"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        <span>Hold</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = activeOrders.find(o => o.id === activeOrderId);
                          setOrderForVoidModal(cur || null);
                          setIsVoidModalOpen(true);
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
                        title="Cancel & Void order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Void</span>
                      </button>
                      <button
                        onClick={clearCart}
                        className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
                        title="Clear basket items"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Selector Box */}
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer Account</span>
                  </span>
                  {activeStaff.role !== 'Cashier' && (
                    <button
                      onClick={onOpenCustomerModal}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 text-[11px] cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ New Customer</span>
                    </button>
                  )}
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-md py-2 px-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Walk-in">Walk-in Customer (Standard Retail)</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.full_name} ({c.customer_type}){c.discount_percent ? ` • ${c.discount_percent}% VIP Discount` : ''}
                    </option>
                  ))}
                </select>

                {/* Customer Details & Approved Rate Banner */}
                {selectedCustomer && (
                  <div className="pt-2 border-t border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Preferred Item: <strong className="text-slate-700">{selectedCustomer.preferred_product}</strong></span>
                      <span>Total Spent: <strong className="text-slate-700">₦{selectedCustomer.total_spent.toLocaleString()}</strong></span>
                    </div>

                    {/* Customer Agreed Discount Badge (if granted by Admin/Manager) */}
                    {selectedCustomer.discount_percent && selectedCustomer.discount_percent > 0 ? (
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Percent className="w-3.5 h-3.5 text-emerald-600" />
                          <div>
                            <span className="font-bold text-emerald-900">{selectedCustomer.discount_percent}% Customer Discount</span>
                            <div className="text-[10px] text-emerald-700">{selectedCustomer.discount_notes || 'Manager Approved VIP Rate'}</div>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          -₦{calculatedDiscounts.customerDiscount.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                        <span>Pricing: Standard Rate</span>
                        <span className="text-slate-400">Order discounts require Manager/Admin PIN</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Your cart is empty. Select items from the catalogue.
                  </div>
                ) : (
                  cart.map(item => (
                    <CartItemRow
                      key={item.cart_item_id || `${item.item_sn}_${item.sell_unit || 'BASE'}`}
                      item={item}
                      product={products.find(p => p.item_sn === item.item_sn)}
                      onUpdateQuantity={updateCartQuantity}
                      onRemove={removeFromCart}
                      onOpenWeigh={handleOpenWeigh}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Bottom Checkout & Payment Section */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
              {/* Discount Controls & Status */}
              <div className="space-y-2">
                {customDiscount > 0 ? (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center font-bold shrink-0">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-amber-900 flex items-center space-x-1.5">
                          <span>Discount Applied: -₦{customDiscount.toLocaleString()}</span>
                          <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-amber-200/60 text-amber-900 border border-amber-300">
                            Authorized
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-700">
                          {customDiscountReason} • By: <span className="font-medium">{discountAuthorizedBy || 'Manager'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearDiscount}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold underline px-1.5 py-1 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    {!isDiscountPanelOpen ? (
                      <button
                        type="button"
                        onClick={handleOpenDiscount}
                        disabled={cart.length === 0}
                        className="w-full py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ Apply Discount / Offer (Manager PIN & Bulk Rules)</span>
                      </button>
                    ) : (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 text-xs space-y-3 animate-fadeIn">
                        
                        {/* Panel Header */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                            <Tag className="w-4 h-4 text-emerald-600" />
                            <span>Order Discounts & Offers</span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {canManageDiscountPin && (
                              <button
                                type="button"
                                onClick={() => setIsConfigurePinModalOpen(true)}
                                className="flex items-center space-x-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer"
                                title="Set or change the Store Discount PIN"
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Set Discount PIN</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setIsDiscountPanelOpen(false);
                                setDiscountError(null);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {discountError && (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center space-x-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{discountError}</span>
                          </div>
                        )}

                        {/* Tabs: Management Pre-Approved Rules vs Custom Override */}
                        <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[11px]">
                          <button
                            type="button"
                            onClick={() => setDiscountTab('rules')}
                            className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                              discountTab === 'rules'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Management Rules ({evaluatedRules.filter(r => r.isQualified).length} Qualified)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountTab('custom')}
                            className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                              discountTab === 'custom'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Custom Override ({canDirectlyApplyDiscount ? 'Direct' : 'PIN Required'})
                          </button>
                        </div>

                        {/* Tab 1: Management Rules */}
                        {discountTab === 'rules' && (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {evaluatedRules.map(({ rule, isQualified, qualifyingDetails, calculatedDiscount }) => (
                              <div
                                key={rule.rule_id}
                                className={`p-2 rounded-xl border text-xs transition-all ${
                                  isQualified
                                    ? 'bg-emerald-50/70 border-emerald-300'
                                    : 'bg-white border-slate-200 opacity-80'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                    <span>{rule.name}</span>
                                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                      rule.discount_type === 'PERCENT'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {rule.discount_type === 'PERCENT' ? `${rule.discount_value}% OFF` : `₦${rule.discount_value.toLocaleString()} OFF`}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleSelectRule(rule, calculatedDiscount)}
                                    disabled={!isQualified}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                      isQualified
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {rule.requires_manager_approval ? 'Authorize with PIN' : 'Apply Rule'}
                                  </button>
                                </div>

                                <div className="text-[11px] text-slate-500">
                                  {rule.description}
                                </div>

                                <div className="mt-1 flex items-center justify-between text-[10px]">
                                  <span className={isQualified ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                                    {qualifyingDetails}
                                  </span>
                                  {isQualified && (
                                    <span className="font-mono font-bold text-emerald-800">
                                      Save ₦{calculatedDiscount.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tab 2: Custom Discount */}
                        {discountTab === 'custom' && (
                          <div className="space-y-2.5">
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => setDiscountType('percent')}
                                className={`flex-1 py-1 text-xs font-medium rounded ${
                                  discountType === 'percent'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Percentage (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountType('fixed')}
                                className={`flex-1 py-1 text-xs font-medium rounded ${
                                  discountType === 'fixed'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                Fixed Amount (₦)
                              </button>
                            </div>

                            {discountType === 'percent' && (
                              <div className="flex space-x-1">
                                {['5', '10', '15', '20'].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => setDiscountValue(pct)}
                                    className={`flex-1 py-1 text-[11px] rounded border ${
                                      discountValue === pct
                                        ? 'bg-emerald-100 border-emerald-500 font-bold text-emerald-800'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                                  {discountType === 'percent' ? 'Discount Rate (%)' : 'Discount Amount (₦)'}
                                </label>
                                <input
                                  type="number"
                                  value={discountValue}
                                  onChange={(e) => setDiscountValue(e.target.value)}
                                  placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 1000'}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                                  Estimated Cut
                                </label>
                                <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-xs text-slate-800">
                                  -₦{(
                                    discountType === 'percent'
                                      ? Math.round((cartSubtotal * (parseFloat(discountValue) || 0)) / 100)
                                      : Math.round(parseFloat(discountValue) || 0)
                                  ).toLocaleString()}
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                                Reason / Audit Note
                              </label>
                              <input
                                type="text"
                                value={discountReasonText}
                                onChange={(e) => setDiscountReasonText(e.target.value)}
                                placeholder="Reason (e.g. Bulk goodwill, Preferred customer, Clearance)"
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div className="flex space-x-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsDiscountPanelOpen(false)}
                                className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyCustomDiscountSubmit}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-sm cursor-pointer"
                              >
                                {canDirectlyApplyDiscount ? 'Apply Discount' : 'Authorize with Store PIN'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Auto Wholesale Discount Badge */}
              {calculatedDiscounts.wholesaleDiscount > 0 && (
                <div className="flex items-center justify-between text-xs bg-purple-50 text-purple-700 px-2.5 py-1.5 rounded-lg border border-purple-200">
                  <span className="flex items-center space-x-1 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Wholesale Bulk Discount (10% on 50kg+)</span>
                  </span>
                  <span className="font-bold">-₦{calculatedDiscounts.wholesaleDiscount.toLocaleString()}</span>
                </div>
              )}

              {/* One-Click Qualified Bulk Discount Alert Banner */}
              {qualifiedBulkRule && (
                <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg text-xs animate-in fade-in duration-300">
                  <div className="flex items-center space-x-2 overflow-hidden pr-2">
                    <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-purple-950 block truncate text-[11px]">{qualifiedBulkRule.rule.name}</span>
                      <span className="text-[10px] text-purple-700 font-semibold block truncate">
                        Qualified for ₦{qualifiedBulkRule.calculatedDiscount.toLocaleString()} bulk discount savings!
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectRule(qualifiedBulkRule.rule, qualifiedBulkRule.calculatedDiscount)}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-md text-[11px] font-bold shadow-xs cursor-pointer shrink-0 transition-all"
                  >
                    Apply Rule
                  </button>
                </div>
              )}

              {/* Price Calculation Summary */}
              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">₦{cartSubtotal.toLocaleString()}</span>
                </div>

                {calculatedDiscounts.customerDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Customer Agreed Discount ({selectedCustomer?.discount_percent}%)</span>
                    <span>-₦{calculatedDiscounts.customerDiscount.toLocaleString()}</span>
                  </div>
                )}

                {calculatedDiscounts.customDiscount > 0 && (
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Manager Discount</span>
                    <span>-₦{calculatedDiscounts.customDiscount.toLocaleString()}</span>
                  </div>
                )}

                {calculatedDiscounts.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                    <span>Total Discount Savings</span>
                    <span>-₦{calculatedDiscounts.totalDiscount.toLocaleString()}</span>
                  </div>
                )}

                {Boolean(calculatedDiscounts.disallowedDiscount && calculatedDiscounts.disallowedDiscount > 0) && (
                  <div className="flex items-center justify-between text-[11px] bg-sky-50 text-sky-800 p-2 rounded-lg border border-sky-200">
                    <span className="flex items-center space-x-1 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>Best Discount Policy Active</span>
                    </span>
                    <span className="font-bold text-sky-700">Protected: ₦{Number(calculatedDiscounts.disallowedDiscount || 0).toLocaleString()}</span>
                  </div>
                )}

                {/* Real-Time Gross Profit & Profit Margin Widget */}
                {cart.length > 0 && (
                  <div className={`flex items-center justify-between text-[11px] p-2 rounded-lg border font-mono ${
                    cartMargin.projectedMarginPercent >= 20 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : cartMargin.projectedMarginPercent >= 5
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`} title={`Wholesale Acquisition Cost: ₦${cartMargin.totalCost.toLocaleString()} | Projected Gross Profit: ₦${cartMargin.projectedGrossProfit.toLocaleString()}`}>
                    <span className="flex items-center space-x-1 font-semibold">
                      <Percent className="w-3.5 h-3.5 shrink-0" />
                      <span>Gross Profit / Margin:</span>
                    </span>
                    <span className="font-bold">
                      ₦{cartMargin.projectedGrossProfit.toLocaleString()} ({cartMargin.projectedMarginPercent}%)
                    </span>
                  </div>
                )}

                {calculatedDiscounts.profitMarginValid === false && (
                  <div className="flex items-center justify-between text-[11px] bg-rose-50 text-rose-800 p-2 rounded-lg border border-rose-200">
                    <span className="flex items-center space-x-1 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Breaches Cost Floor</span>
                    </span>
                    <span className="font-bold text-rose-700">-₦{Math.abs(Number(calculatedDiscounts.grossMarginRemaining) || 0).toLocaleString()} below cost</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Total Payable</span>
                  <span className="text-xl font-extrabold text-slate-950">
                    ₦{cartFinalTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Mode Selector Tabs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Payment Method
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {paymentMode === 'split' ? 'Split payment mode active' : 'Full payment mode'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('single')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                      paymentMode === 'single'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Single Tender (100%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('split');
                      if (!splitCashAmount && cartFinalTotal > 0) {
                        setSplitCashAmount(Math.round(cartFinalTotal / 2).toString());
                      }
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                      paymentMode === 'split'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Split Payment (Multi-Tender)</span>
                  </button>
                </div>

                {/* SINGLE PAYMENT MODE */}
                {paymentMode === 'single' ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {[
                        { id: 'Cash', label: 'Cash', icon: Banknote },
                        { id: 'Bank Transfer', label: 'Transfer', icon: Building2 },
                        { id: 'POS', label: 'POS Terminal', icon: CreditCard },
                        { id: 'Credit / Pay Later', label: 'Credit / Debt', icon: Clock },
                      ].map(m => {
                        const Icon = m.icon;
                        const isSelected = selectedPaymentMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(m.id as PaymentMethod)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border font-medium transition-all ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className={`w-4 h-4 mb-1 ${m.id === 'Credit / Pay Later' ? 'text-indigo-400' : 'text-emerald-500'}`} />
                            <span className="text-[11px] font-semibold">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dedicated Credit / Pay Later Terms Panel */}
                    {selectedPaymentMethod === 'Credit / Pay Later' && cart.length > 0 && (
                      <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-950 flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            <span>Customer Credit & Debt Terms</span>
                          </span>
                          {selectedCustomer && selectedCustomerId !== 'Walk-in' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              {selectedCustomer.full_name}
                            </span>
                          )}
                        </div>

                        {(!selectedCustomer || selectedCustomerId === 'Walk-in') ? (
                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Registered Customer Required:</strong> Select a customer account above to authorize and record credit sales.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-slate-500 block">Current Balance / Debt:</span>
                                <span className={`font-mono font-bold ${(Number(selectedCustomer.balance) || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  ₦{(Number(selectedCustomer.balance) || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-indigo-100">
                                <span className="text-slate-500 block">Total Debt After Sale:</span>
                                <span className="font-mono font-bold text-indigo-900">
                                  ₦{((Number(selectedCustomer.balance) || 0) + Math.max(0, cartFinalTotal - (Number(creditDeposit) || 0))).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Down Payment / Deposit (₦)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={cartFinalTotal}
                                  value={creditDeposit}
                                  onChange={(e) => setCreditDeposit(e.target.value)}
                                  placeholder="0 (if full credit)"
                                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-right font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Settlement Due Date
                                </label>
                                <input
                                  type="date"
                                  value={creditDueDate}
                                  onChange={(e) => setCreditDueDate(e.target.value)}
                                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>

                            {(Number(creditDeposit) || 0) > 0 && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Deposit Payment Channel
                                </label>
                                <div className="grid grid-cols-3 gap-1 text-[10px]">
                                  {(['Cash', 'POS', 'Bank Transfer'] as const).map(m => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setCreditDepositMethod(m)}
                                      className={`py-1 rounded font-semibold border ${
                                        creditDepositMethod === m
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-white text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="p-2 bg-white rounded-lg border border-indigo-100 flex justify-between items-center text-xs">
                              <span className="text-slate-600 font-medium">Debt Incurred Today:</span>
                              <span className="font-mono font-black text-rose-600 text-sm">
                                ₦{Math.max(0, cartFinalTotal - (Number(creditDeposit) || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cash Tendered Calculator (if Cash chosen) */}
                    {selectedPaymentMethod === 'Cash' && cart.length > 0 && (
                      <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900">Cash Tendered by Customer:</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">₦</span>
                            <input
                              type="number"
                              value={cashTendered}
                              onChange={(e) => setCashTendered(e.target.value)}
                              placeholder={`Exact ₦${cartFinalTotal.toLocaleString()}`}
                              className="w-36 pl-6 pr-2 py-1.5 bg-white border border-amber-300 rounded-lg text-right font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        {/* Quick cash denomination buttons */}
                        <div className="flex space-x-1.5 pt-0.5">
                          {[cartFinalTotal, Math.ceil(cartFinalTotal / 1000) * 1000, Math.ceil(cartFinalTotal / 5000) * 5000].filter((v, i, a) => a.indexOf(v) === i && v >= cartFinalTotal).slice(0, 3).map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCashTendered(amt.toString())}
                              className="px-2 py-0.5 bg-amber-100/70 hover:bg-amber-200 text-amber-900 rounded font-mono text-[10px]"
                            >
                              ₦{amt.toLocaleString()}
                            </button>
                          ))}
                        </div>

                        {changeDueSingle > 0 && (
                          <div className="flex justify-between font-bold text-amber-950 text-xs pt-1.5 border-t border-amber-200">
                            <span>Change Due to Customer:</span>
                            <span className="text-emerald-700 font-mono text-sm">₦{changeDueSingle.toLocaleString()}</span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
                          <span>Customer wants to pay partially in Cash?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMode('split');
                              if (cashAmountNum > 0 && cashAmountNum < cartFinalTotal) {
                                setSplitCashAmount(cashAmountNum.toString());
                              } else {
                                setSplitCashAmount(Math.round(cartFinalTotal / 2).toString());
                              }
                            }}
                            className="font-bold text-emerald-700 hover:underline flex items-center space-x-1"
                          >
                            <Split className="w-3 h-3" />
                            <span>Switch to Split Tender</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dedicated POS Terminal Selection */}
                    {selectedPaymentMethod === 'POS' && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                            <span>Select POS Terminal Device:</span>
                          </label>
                          <span className="text-[10px] text-slate-400">Card Swiped / Tapped</span>
                        </div>

                        {activePosDevices.length > 0 ? (
                          <div className="space-y-1.5">
                            <select
                              value={selectedPosTerminalId}
                              onChange={(e) => setSelectedPosTerminalId(e.target.value)}
                              className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {activePosDevices.map(term => (
                                <option key={term.id} value={term.id}>
                                  {term.name} ({term.provider} - {term.terminal_id || term.account_number}) {term.is_default ? '★ Default' : ''}
                                </option>
                              ))}
                            </select>

                            {/* Active Terminal Info Pill */}
                            {(() => {
                              const t = posTerminals.find(dev => dev.id === selectedPosTerminalId) || activePosDevices[0];
                              if (!t) return null;
                              return (
                                <div className="p-2 bg-purple-50/70 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-center justify-between">
                                  <div>
                                    <div className="font-bold flex items-center space-x-1">
                                      <span>{t.name}</span>
                                      {t.terminal_id && <span className="font-mono text-[10px] text-purple-700">({t.terminal_id})</span>}
                                    </div>
                                    <div className="text-[10px] text-purple-700">
                                      Settles into: {t.bank_name} ({t.account_number})
                                    </div>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 font-bold text-[9px] uppercase font-mono">
                                    {t.provider}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="p-2 rounded bg-amber-50 text-amber-800 text-[11px]">
                            No POS devices configured. Transaction will use default terminal.
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                            POS Terminal RRN / Slip Number (Optional):
                          </label>
                          <input
                            type="text"
                            value={singleRef}
                            onChange={(e) => setSingleRef(e.target.value)}
                            placeholder="e.g. STANBIC-RRN-9921 or POS Ref"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Dedicated Commercial Bank Account Selection */}
                    {selectedPaymentMethod === 'Bank Transfer' && (
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-blue-950 flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Select Bank Transfer Account:</span>
                          </label>
                          <span className="text-[10px] text-blue-700 font-semibold">Direct Customer Transfer</span>
                        </div>

                        {activeBankAccounts.length > 0 ? (
                          <select
                            value={selectedBankAccountId}
                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {activeBankAccounts.map(bank => (
                              <option key={bank.id} value={bank.id}>
                                {bank.name} — {bank.bank_name} ({bank.account_number}) {bank.is_default ? '★ Default' : ''}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        {/* Customer Account Details Card for Instant Copy */}
                        {(() => {
                          const bank = posTerminals.find(b => b.id === selectedBankAccountId) || activeBankAccounts[0];
                          if (!bank) return null;
                          return (
                            <div className="p-2.5 bg-white rounded-lg border border-blue-200 shadow-xs space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold">
                                <span>{bank.bank_name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(bank.account_number);
                                    setCopiedBankAcc(true);
                                    setTimeout(() => setCopiedBankAcc(false), 2500);
                                  }}
                                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                                >
                                  {copiedBankAcc ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Account</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="font-mono font-black text-slate-900 text-sm tracking-wider">
                                {bank.account_number}
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                {bank.account_name}
                              </div>
                            </div>
                          );
                        })()}

                        <div>
                          <label className="text-[10px] font-semibold text-blue-900 block mb-1">
                            Transfer Session ID / Bank Reference (Optional):
                          </label>
                          <input
                            type="text"
                            value={singleRef}
                            onChange={(e) => setSingleRef(e.target.value)}
                            placeholder="e.g. TRF-GTB-891238 or sender name"
                            className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* SPLIT-PAYMENT (MULTI-TENDER) MODE */
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border-2 border-emerald-500/40 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                        <Split className="w-4 h-4 text-emerald-600" />
                        <span>Split-Payment Allocation</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Total: ₦{cartFinalTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* STEP 1: SPECIFY CASH AMOUNT */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          <span>1. Cash Amount Specified:</span>
                        </span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">₦</span>
                          <input
                            type="number"
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value)}
                            placeholder="e.g. 25000"
                            className="w-36 pl-5 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Cash share preset shortcuts */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400">Quick Cash Share:</span>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => handleSetCashShare(0.5)}
                            className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[10px]"
                          >
                            50% (₦{Math.round(cartFinalTotal * 0.5).toLocaleString()})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCashShare(0.25)}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px]"
                          >
                            25%
                          </button>
                          <button
                            type="button"
                            onClick={() => setSplitCashAmount(cartFinalTotal.toString())}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px]"
                          >
                            100%
                          </button>
                          <button
                            type="button"
                            onClick={() => setSplitCashAmount('0')}
                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-rose-600 font-semibold text-[10px]"
                          >
                            0
                          </button>
                        </div>
                      </div>

                      {/* Optional Cash Notes Handed (Change Calculator) */}
                      {splitCashNum > 0 && (
                        <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600">Physical Notes Received (₦):</span>
                          <input
                            type="number"
                            value={splitCashTendered}
                            onChange={(e) => setSplitCashTendered(e.target.value)}
                            placeholder={`e.g. ₦${splitCashNum.toLocaleString()}`}
                            className="w-32 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-right font-mono text-xs focus:outline-none"
                          />
                        </div>
                      )}
                      {splitCashChangeDue > 0 && (
                        <div className="flex justify-between text-xs font-bold text-amber-900 bg-amber-50 p-1.5 rounded">
                          <span>Cash Change to Return:</span>
                          <span className="font-mono text-emerald-700">₦{splitCashChangeDue.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* STEP 2: ROUTE REMAINING BALANCE */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-emerald-600" />
                          <span>2. Route Balance:</span>
                        </span>
                        <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ₦{splitSecondNum.toLocaleString()}
                        </span>
                      </div>

                      {/* Route selector: Bank Transfer vs POS Terminal */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSplitSecondMethod('Bank Transfer')}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            splitSecondMethod === 'Bank Transfer'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Bank Transfer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSplitSecondMethod('POS')}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                            splitSecondMethod === 'POS'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                          <span>POS Terminal</span>
                        </button>
                      </div>

                      {/* Device / Bank Selector for Split Route */}
                      {splitSecondMethod === 'POS' && activePosDevices.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-600 block">
                            Target POS Device:
                          </label>
                          <select
                            value={splitSecondPosTerminalId}
                            onChange={(e) => setSplitSecondPosTerminalId(e.target.value)}
                            className="w-full py-1 px-2 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-none"
                          >
                            {activePosDevices.map(term => (
                              <option key={term.id} value={term.id}>
                                {term.name} ({term.provider} - {term.terminal_id || term.account_number})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {splitSecondMethod === 'Bank Transfer' && activeBankAccounts.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-600 block">
                            Target Commercial Bank Account:
                          </label>
                          <select
                            value={splitSecondBankAccountId}
                            onChange={(e) => setSplitSecondBankAccountId(e.target.value)}
                            className="w-full py-1 px-2 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-none"
                          >
                            {activeBankAccounts.map(bank => (
                              <option key={bank.id} value={bank.id}>
                                {bank.bank_name} - {bank.account_number} ({bank.name})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Reference input for second method */}
                      <div>
                        <input
                          type="text"
                          value={splitSecondRef}
                          onChange={(e) => setSplitSecondRef(e.target.value)}
                          placeholder={
                            splitSecondMethod === 'Bank Transfer'
                              ? 'Transfer Session ID / Bank Reference (Optional)'
                              : 'POS Terminal Auth / RRN Slip Code (Optional)'
                          }
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* ALLOCATION BALANCE STATUS */}
                    <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      Math.abs(splitRemainingBalance) === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <div className="flex items-center space-x-1.5">
                        {Math.abs(splitRemainingBalance) === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold">
                            {Math.abs(splitRemainingBalance) === 0 
                              ? 'Split Fully Balanced (100% Allocated)' 
                              : `Unallocated Balance: ₦${splitRemainingBalance.toLocaleString()}`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Cash: ₦{splitCashNum.toLocaleString()} + {splitSecondMethod}: ₦{splitSecondNum.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const cashVal = parseFloat(splitCashAmount) || 0;
                          setSplitSecondAmount(Math.max(0, cartFinalTotal - cashVal).toString());
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:underline px-1.5 py-0.5 bg-white rounded border border-emerald-300"
                      >
                        Auto-Balance
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Alert Feedback */}
              {checkoutError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {checkoutSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{checkoutSuccess}</span>
                </div>
              )}

              {/* Checkout Action Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || (paymentMode === 'split' && Math.abs(splitRemainingBalance) > 1)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
              >
                <span>Complete Sale & Print Receipt</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Dedicated Store Discount PIN Modal for Cashier Authorization */}
      <DiscountPinModal
        isOpen={isDiscountPinModalOpen}
        onClose={() => {
          setIsDiscountPinModalOpen(false);
          setPendingDiscountAuth(null);
        }}
        discountSummary={pendingDiscountAuth ? {
          title: pendingDiscountAuth.title,
          amountNaira: pendingDiscountAuth.amountNaira,
          description: pendingDiscountAuth.description,
        } : {
          title: 'Store Discount',
          amountNaira: 0,
          description: '',
        }}
        onSuccess={handleDiscountPinSuccess}
      />

      {/* Configure Store Discount PIN Modal for Managers & Admins */}
      <ConfigureDiscountPinModal
        isOpen={isConfigurePinModalOpen}
        onClose={() => setIsConfigurePinModalOpen(false)}
      />

      {/* Scale Reading & Weight Override Modal */}
      <WeightModal
        isOpen={isWeighModalOpen}
        onClose={() => {
          setIsWeighModalOpen(false);
          setWeighingProduct(null);
        }}
        product={weighingProduct}
        currentQuantity={weighingInitialQty}
        onConfirm={handleConfirmWeight}
      />

      {/* Hold / Park Order Prompt Dialog */}
      <ParkOrderPromptModal
        isOpen={isParkPromptOpen}
        onClose={() => setIsParkPromptOpen(false)}
      />

      {/* Held / Parked Walk-In Orders List Modal */}
      <ParkedOrdersModal
        isOpen={isParkedListOpen}
        onClose={() => setIsParkedListOpen(false)}
      />

      {/* Dedicated Void / Cancel Order Modal */}
      <VoidOrderModal
        isOpen={isVoidModalOpen}
        order={orderForVoidModal}
        onClose={() => {
          setIsVoidModalOpen(false);
          setOrderForVoidModal(null);
        }}
        onVoidConfirmed={() => {
          setIsVoidModalOpen(false);
          setOrderForVoidModal(null);
        }}
      />
    </div>
  );
};
