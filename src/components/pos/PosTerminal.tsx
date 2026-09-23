import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { ProductCategory, PaymentMethod } from '../../types';
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
  ShieldCheck
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';
import { Employee } from '../../types';

interface PosTerminalProps {
  onOpenCustomerModal: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({ onOpenCustomerModal }) => {
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
  } = usePos();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  // Discount Panel & PIN Auth State (Admin & Manager only)
  const [isDiscountPanelOpen, setIsDiscountPanelOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [overrideStaff, setOverrideStaff] = useState<Employee | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('5');
  const [discountReasonText, setDiscountReasonText] = useState<string>('Manager Approved Discount');
  const [discountError, setDiscountError] = useState<string | null>(null);

  const categories = ['All', 'Freshwater Fish', 'Saltwater Fish', 'Frozen Fish', 'Dried Fish'];

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

  // Cash change calculation
  const cashAmountNum = parseFloat(cashTendered) || 0;
  const changeDue = selectedPaymentMethod === 'Cash' && cashAmountNum > cartFinalTotal 
    ? cashAmountNum - cartFinalTotal 
    : 0;

  const handleCheckout = () => {
    setCheckoutError(null);
    setCheckoutSuccess(null);

    if (cart.length === 0) {
      setCheckoutError('Please add fish products to the cart before checking out.');
      return;
    }

    if (selectedPaymentMethod === 'Cash' && cashAmountNum > 0 && cashAmountNum < cartFinalTotal) {
      setCheckoutError(`Tendered amount ₦${cashAmountNum.toLocaleString()} is less than total ₦${cartFinalTotal.toLocaleString()}`);
      return;
    }

    const res = processCheckout(selectedPaymentMethod);
    if (!res.success) {
      setCheckoutError(res.error || 'Failed to process checkout');
    } else {
      setCheckoutSuccess(`Sale completed! Receipt TXN ${res.transaction?.transaction_id} generated.`);
      setCashTendered('');
      setIsDiscountPanelOpen(false);
      setOverrideStaff(null);
      setTimeout(() => setCheckoutSuccess(null), 4000);
    }
  };

  const canDirectlyApplyDiscount = hasPermission('CAN_APPLY_DISCOUNT');

  const handleOpenDiscount = () => {
    setDiscountError(null);
    if (canDirectlyApplyDiscount) {
      setOverrideStaff(null);
      setIsDiscountPanelOpen(true);
    } else {
      setIsPinModalOpen(true);
    }
  };

  const handlePinSuccess = (authorizedStaff: Employee) => {
    setIsPinModalOpen(false);
    setOverrideStaff(authorizedStaff);
    setIsDiscountPanelOpen(true);
  };

  const handleApplyDiscountSubmit = (e?: React.FormEvent) => {
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

    const authName = overrideStaff 
      ? `${overrideStaff.staff_name} (${overrideStaff.role})`
      : `${activeStaff.staff_name} (${activeStaff.role})`;

    const reason = discountReasonText.trim() 
      ? `${discountReasonText.trim()} (${discountType === 'percent' ? `${num}%` : `₦${num.toLocaleString()}`})`
      : `Manager Approved Discount (${discountType === 'percent' ? `${num}%` : `₦${num.toLocaleString()}`})`;

    const res = applyCustomDiscount(calculatedDiscountNaira, reason, authName);
    if (!res.success) {
      setDiscountError(res.error || 'Failed to apply discount.');
    } else {
      setIsDiscountPanelOpen(false);
      setOverrideStaff(null);
    }
  };

  const now = new Date();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                placeholder="Search fish by name or SN (e.g., Catfish, FISH-00045)..."
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
                <p className="text-slate-500 font-medium text-sm">No fish items found matching your search.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredProducts.map(product => {
                const isOutOfStock = product.quantity <= 0;
                const isLowStock = product.quantity > 0 && product.quantity <= product.reorder_level;
                
                // Expiry calculation
                const expiryDate = new Date(product.expiry_date);
                const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = diffDays >= 0 && diffDays <= 3;
                const isExpired = diffDays < 0;

                // Profit margin calculation: (Selling Price - Cost) / Cost * 100%
                const profitMargin = product.item_cost > 0 
                  ? Math.round(((product.selling_price - product.item_cost) / product.item_cost) * 100) 
                  : 0;

                const inCart = cart.find(c => c.item_sn === product.item_sn);

                return (
                  <div
                    key={product.item_sn}
                    className={`bg-white rounded-xl border transition-all duration-150 flex flex-col justify-between overflow-hidden relative group ${
                      isOutOfStock 
                        ? 'opacity-60 border-slate-200 bg-slate-50' 
                        : 'border-slate-200 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    {/* Top Image & Badges */}
                    <div className="relative h-32 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={product.item_picture}
                        alt={product.item_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                      {/* SN Tag */}
                      <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded font-semibold">
                        {product.item_sn}
                      </span>

                      {/* Expiry Warning */}
                      {isExpiringSoon && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm animate-pulse">
                          Exp in {diffDays}d
                        </span>
                      )}
                      {isExpired && (
                        <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                          EXPIRED
                        </span>
                      )}

                      {/* Stock pill */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded backdrop-blur-md shadow-sm ${
                          isOutOfStock
                            ? 'bg-rose-600 text-white'
                            : isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600/90 text-white'
                        }`}>
                          {isOutOfStock ? 'OUT OF STOCK' : `${product.quantity} ${product.product_measure_unit} LEFT`}
                        </span>

                        <span className="text-[10px] font-semibold bg-white/90 text-slate-800 px-1.5 py-0.5 rounded shadow-sm">
                          {profitMargin}% profit
                        </span>
                      </div>
                    </div>

                    {/* Details Body */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-1">
                          {product.item_name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {product.product_category}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">Price</div>
                          <div className="text-base font-bold text-slate-900">
                            ₦{product.selling_price.toLocaleString()}
                            <span className="text-[10px] font-normal text-slate-500">/{product.product_measure_unit}</span>
                          </div>
                        </div>

                        {/* Add / Adjust Control */}
                        {isOutOfStock ? (
                          <button
                            disabled
                            className="px-3 py-1.5 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed"
                          >
                            Out of Stock
                          </button>
                        ) : inCart ? (
                          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-300 rounded-lg p-1">
                            <button
                              onClick={() => updateCartQuantity(product.item_sn, inCart.quantity_sold - 1)}
                              className="w-6 h-6 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-emerald-100"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-emerald-900 px-1">
                              {inCart.quantity_sold}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(product.item_sn, inCart.quantity_sold + 1)}
                              disabled={inCart.quantity_sold >= product.quantity}
                              className="w-6 h-6 rounded bg-emerald-600 text-white shadow-xs flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product, 1)}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
                    <h3 className="font-bold text-slate-900 text-sm">Order Summary</h3>
                    <p className="text-[11px] text-slate-500">{cart.length} item(s) • {cartTotalQuantity} unit(s)</p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Customer Selector Box */}
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer Account</span>
                  </span>
                  <button
                    onClick={onOpenCustomerModal}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 text-[11px]"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ New Customer</span>
                  </button>
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
                      <span>Preferred Fish: <strong className="text-slate-700">{selectedCustomer.preferred_product}</strong></span>
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
                    Your cart is empty. Select fish products from the catalogue.
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.item_sn} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex-1 pr-2">
                        <div className="font-semibold text-slate-800 line-clamp-1">{item.item_name}</div>
                        <div className="text-slate-400 text-[11px]">
                          {item.item_sn} • ₦{item.unit_price.toLocaleString()} / {item.unit}
                        </div>
                      </div>

                      {/* Qty Stepper */}
                      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md">
                        <button
                          onClick={() => updateCartQuantity(item.item_sn, item.quantity_sold - 1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900">{item.quantity_sold}</span>
                        <button
                          onClick={() => updateCartQuantity(item.item_sn, item.quantity_sold + 1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right pl-3 min-w-[75px]">
                        <div className="font-bold text-slate-900">₦{item.total_amount.toLocaleString()}</div>
                        <button
                          onClick={() => removeFromCart(item.item_sn)}
                          className="text-[10px] text-rose-500 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Checkout & Payment Section */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
              {/* Discount Controls & Status (Admin & Manager Controlled) */}
              <div className="space-y-2">
                {customDiscount > 0 ? (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-md bg-amber-200/80 text-amber-800 flex items-center justify-center font-bold">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-amber-900 flex items-center space-x-1.5">
                          <span>Custom Discount: -₦{customDiscount.toLocaleString()}</span>
                          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Approved
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
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold underline px-1.5 py-1"
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
                        className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                          canDirectlyApplyDiscount
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {canDirectlyApplyDiscount ? (
                          <>
                            <Tag className="w-3.5 h-3.5 text-emerald-700" />
                            <span>+ Add Discount to Order (Manager / Admin)</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            <span>+ Add Discount (Requires Manager / Admin PIN)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-300 text-xs space-y-2.5 animate-fadeIn">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Authorize Order Discount</span>
                          </div>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                            {overrideStaff 
                              ? `Auth: ${overrideStaff.staff_name} (${overrideStaff.role})`
                              : `Auth: ${activeStaff.staff_name} (${activeStaff.role})`}
                          </span>
                        </div>

                        {discountError && (
                          <div className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[11px]">
                            {discountError}
                          </div>
                        )}

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
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                            placeholder="Reason (e.g., Preferred Customer Agreement, Bulk Goodwill, Clearance)"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="flex space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsDiscountPanelOpen(false);
                              setOverrideStaff(null);
                            }}
                            className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyDiscountSubmit}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-sm"
                          >
                            Apply Discount
                          </button>
                        </div>
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

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Total Payable</span>
                  <span className="text-xl font-extrabold text-slate-950">
                    ₦{cartFinalTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'Cash', label: 'Cash', icon: Banknote },
                    { id: 'Debit/Credit Card', label: 'Card / POS', icon: CreditCard },
                    { id: 'Mobile Money', label: 'Transfer / MoMo', icon: Smartphone },
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
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Tendered Calculator (if Cash chosen) */}
              {selectedPaymentMethod === 'Cash' && cart.length > 0 && (
                <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">Cash Tendered (₦):</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={`Min ₦${cartFinalTotal.toLocaleString()}`}
                      className="w-36 px-2 py-1 bg-white border border-amber-300 rounded text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between font-bold text-amber-950 text-xs pt-1 border-t border-amber-200">
                      <span>Change Due to Customer:</span>
                      <span className="text-emerald-700 font-mono">₦{changeDue.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

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
                disabled={cart.length === 0}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
              >
                <span>Complete Sale & Print Receipt</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Security PIN Authorization Modal for Discounts (Manager or Admin PIN Required) */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title="Manager / Admin Discount Authorization"
        subtitle="Enter 4-digit PIN of a Manager or Admin to authorize customer discount on this order"
        requiredRole={['Manager', 'Admin']}
        mode="OVERRIDE"
        actionDescription="Apply custom order discount to customer checkout"
        onSuccess={handlePinSuccess}
      />
    </div>
  );
};
