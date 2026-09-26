import React, { useState } from 'react';
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
  Fish,
  Search
} from 'lucide-react';
import { VoidOrderModal } from './VoidOrderModal';

interface ParkedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeOrder?: (orderId: string) => void;
}

export const ParkedOrdersModal: React.FC<ParkedOrdersModalProps> = ({
  isOpen,
  onClose,
  onResumeOrder,
}) => {
  const { parkedOrders, resumeParkedOrder } = usePos();
  const [search, setSearch] = useState('');
  const [orderToVoid, setOrderToVoid] = useState<ParkedOrder | null>(null);
  const [resumeSuccessMsg, setResumeSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredOrders = parkedOrders.filter(order => {
    const s = search.toLowerCase();
    return (
      order.order_label.toLowerCase().includes(s) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(s)) ||
      (order.park_reason && order.park_reason.toLowerCase().includes(s)) ||
      order.items.some(i => i.item_name.toLowerCase().includes(s))
    );
  });

  const handleResume = (orderId: string) => {
    const res = resumeParkedOrder(orderId);
    if (res.success) {
      setResumeSuccessMsg(`Resumed order successfully!`);
      setTimeout(() => {
        setResumeSuccessMsg(null);
        onClose();
        if (onResumeOrder) onResumeOrder(orderId);
      }, 500);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-fadeIn flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <PauseCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-white">Held & Parked Orders</h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                    {parkedOrders.length} in Queue
                  </span>
                </div>
                <p className="text-xs text-slate-400">Walk-in customers waiting to resume payment processing</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
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
          </div>

          {/* List of Parked Orders */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {resumeSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resumeSuccessMsg}</span>
              </div>
            )}

            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <PauseCircle className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No Held Orders in Queue</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When a customer steps away or awaits a bank transfer confirmation, click <strong>"Hold / Park Order"</strong> on the checkout panel to pause their basket and serve the next walk-in customer.
                </p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const totalAmt = order.items.reduce((acc, i) => acc + i.total_amount, 0) - order.customDiscount;
                return (
                  <div
                    key={order.order_id}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-4 shadow-xs transition-all space-y-3 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-mono font-bold text-xs flex items-center justify-center">
                          #{order.order_number}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{order.order_label}</h4>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span className="flex items-center space-x-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{order.customer_name || 'Walk-in'}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-amber-700 font-medium">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Held at {order.parked_at || order.created_at}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Total Payable:</span>
                        <span className="font-mono text-base font-bold text-slate-900">₦{totalAmt.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Hold Reason Banner */}
                    {order.park_reason && (
                      <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-center space-x-2">
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded">
                          Hold Reason
                        </span>
                        <span className="text-[11px]">{order.park_reason}</span>
                      </div>
                    )}

                    {/* Items preview */}
                    <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 mb-1">
                        Basket Items ({order.items.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {order.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-[11px] text-slate-700 flex items-center space-x-1"
                          >
                            <Fish className="w-3 h-3 text-emerald-600" />
                            <span>{item.quantity_sold}{item.unit} {item.item_name}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setOrderToVoid(order)}
                        className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 font-medium"
                        title="Customer walked away? Cancel order & log reason"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel / Void Order</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResume(order.order_id)}
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
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Multiple walk-in customers can be parked simultaneously</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium transition-colors"
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
