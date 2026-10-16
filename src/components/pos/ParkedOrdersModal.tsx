import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { ParkedOrder } from '../../types';
import { 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  X, 
  Clock, 
  Receipt, 
  User, 
  AlertCircle,
  CheckCircle2,
  Package,
  Search,
  RotateCcw,
  ShoppingBag
} from 'lucide-react';
import { VoidOrderModal } from './VoidOrderModal';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface ParkedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeOrder?: (orderId: string) => void;
}

const ParkedOrdersModalContent: React.FC<ParkedOrdersModalProps> = ({
  isOpen,
  onClose,
  onResumeOrder,
}) => {
  const { parkedOrders, resumeParkedOrder } = usePos();
  const [search, setSearch] = useState('');
  const [orderToVoid, setOrderToVoid] = useState<ParkedOrder | null>(null);
  const [resumeSuccessMsg, setResumeSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Defensive array fallback
  const safeOrders: ParkedOrder[] = useMemo(() => {
    if (!Array.isArray(parkedOrders)) return [];
    return parkedOrders.filter(Boolean);
  }, [parkedOrders]);

  const filteredOrders = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return safeOrders;

    return safeOrders.filter(order => {
      if (!order) return false;
      const label = String(order.order_label || (order as any).label || `Order #${order.order_number || ''}`).toLowerCase();
      const customer = String(order.customer_name || '').toLowerCase();
      const reason = String(order.park_reason || (order as any).notes || '').toLowerCase();
      const itemsMatch = Array.isArray(order.items) && order.items.some(i => {
        if (!i) return false;
        return String(i.item_name || '').toLowerCase().includes(s);
      });
      return label.includes(s) || customer.includes(s) || reason.includes(s) || itemsMatch;
    });
  }, [safeOrders, search]);

  const handleResume = (orderId: string) => {
    if (!orderId) return;
    const res = resumeParkedOrder(orderId);
    if (res.success) {
      setResumeSuccessMsg('Order successfully restored to active checkout!');
      setTimeout(() => {
        setResumeSuccessMsg(null);
        onClose();
        if (onResumeOrder) onResumeOrder(orderId);
      }, 400);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-fadeIn flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <PauseCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-white">Held & Parked Orders</h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                    {safeOrders.length} in Queue
                  </span>
                </div>
                <p className="text-xs text-slate-400">Walk-in customer orders paused for later completion</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar (only shown if there are orders or an active search) */}
          {(safeOrders.length > 0 || search.length > 0) && (
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center space-x-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search held orders by customer, items, or hold reason..."
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* List of Parked Orders / Empty State */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {resumeSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resumeSuccessMsg}</span>
              </div>
            )}

            {safeOrders.length === 0 ? (
              /* Robust Empty State when no orders are held */
              <div className="text-center py-12 px-4 space-y-4 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 mx-auto flex items-center justify-center shadow-xs">
                  <PauseCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">No Held Orders in Queue</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    There are currently no customer orders placed on hold. When a customer steps away or needs time to arrange payment, you can click <strong className="text-slate-800">"Hold / Park Order"</strong> on the checkout register to temporarily store their basket without losing items.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Return to POS Register</span>
                  </button>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              /* Empty state for search filter mismatch */
              <div className="text-center py-10 space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">No matching held orders found</p>
                <p className="text-xs text-slate-400">No orders match "{search}". Try searching by another keyword.</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs text-amber-600 hover:underline font-semibold"
                >
                  Clear search query
                </button>
              </div>
            ) : (
              filteredOrders.map(order => {
                const orderId = order.order_id || (order as any).id || `ORD-${order.order_number || Math.random()}`;
                const orderLabel = order.order_label || (order as any).label || (order.customer_name ? `${order.customer_name} (Held)` : `Held Order #${order.order_number || 1}`);
                const orderNum = order.order_number || 1;
                const custName = order.customer_name || 'Walk-in Customer';
                const holdReason = order.park_reason || (order as any).notes || null;
                const heldTime = order.parked_at || order.created_at || 'Recently';
                const items = Array.isArray(order.items) ? order.items : [];
                const discount = Number(order.customDiscount) || Number((order as any).discount_amount) || 0;
                const totalAmt = items.reduce((acc, i) => {
                  const amt = Number(i.total_amount);
                  if (!isNaN(amt) && amt > 0) return acc + amt;
                  const qty = Number(i.quantity_sold) || 0;
                  const price = Number(i.unit_price) || 0;
                  return acc + (qty * price);
                }, 0) - discount;

                return (
                  <div
                    key={orderId}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-4 shadow-xs transition-all space-y-3 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          #{orderNum}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{orderLabel}</h4>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span className="flex items-center space-x-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{custName}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-amber-700 font-medium">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Held: {heldTime}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Total Payable:</span>
                        <span className="font-mono text-base font-bold text-slate-900">
                          ₦{Math.max(0, totalAmt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Hold Reason Banner */}
                    {holdReason && (
                      <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-center space-x-2">
                        <span className="font-semibold text-[10px] uppercase tracking-wider text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded shrink-0">
                          Hold Reason
                        </span>
                        <span className="text-[11px]">{holdReason}</span>
                      </div>
                    )}

                    {/* Items preview */}
                    <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 mb-1">
                        Basket Items ({items.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">No items recorded</span>
                        ) : (
                          items.map((item, idx) => (
                            <span
                              key={idx}
                              className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-[11px] text-slate-700 flex items-center space-x-1"
                            >
                              <Package className="w-3 h-3 text-emerald-600" />
                              <span>
                                {item.quantity_sold || 1} {item.unit || 'unit'} {item.item_name || 'Item'}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setOrderToVoid(order)}
                        className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 font-medium cursor-pointer"
                        title="Customer walked away? Cancel order & log reason"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel / Void Order</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResume(orderId)}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Resume Checkout</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>Multiple customer orders can be held simultaneously</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested Void Order Modal if staff decides to abort a parked order */}
      {orderToVoid && (
        <VoidOrderModal
          isOpen={true}
          order={orderToVoid}
          onClose={() => setOrderToVoid(null)}
          onVoidConfirmed={() => setOrderToVoid(null)}
        />
      )}
    </>
  );
};

export const ParkedOrdersModal: React.FC<ParkedOrdersModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <ErrorBoundary
      fallbackTitle="Could not display Held Orders"
      fallbackMessage="An unexpected error occurred while loading held orders. Click below to recover."
      onReset={props.onClose}
    >
      <ParkedOrdersModalContent {...props} />
    </ErrorBoundary>
  );
};
