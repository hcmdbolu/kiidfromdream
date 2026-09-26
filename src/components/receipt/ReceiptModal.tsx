import React from 'react';
import { SaleTransaction } from '../../types';
import { usePos } from '../../context/PosContext';
import { Printer, X, Check, Fish, Sparkles } from 'lucide-react';

interface ReceiptModalProps {
  transaction: SaleTransaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { customers, employees } = usePos();

  if (!transaction) return null;

  const customer = customers.find(c => c.customer_id === transaction.customer_id);
  const cashier = employees.find(e => e.staff_id === transaction.staff_id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Action Header */}
        <div className="bg-slate-900 text-white p-3 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Fish className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide">POS RECEIPT</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div id="printable-receipt" className="p-6 bg-[#fafafa] font-mono text-xs text-slate-800 space-y-3">
          
          {/* Business Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-base font-extrabold tracking-wider text-slate-950">KIIDFROMDREAM</h2>
            <p className="text-[10px] text-slate-600 uppercase font-semibold">Fresh & Saltwater Fish Hub</p>
            <p className="text-[10px] text-slate-500 mt-1">Lekki Fish Terminal, Phase 1, Lagos</p>
            <p className="text-[10px] text-slate-500">Tel: +234 803 123 4567 / 0800-FISH-POS</p>
          </div>

          {/* Meta Info */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Txn ID:</span>
              <span className="font-bold text-slate-900">{transaction.transaction_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{transaction.date_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span>{cashier ? `${cashier.staff_name} (${cashier.staff_id})` : transaction.staff_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-bold text-slate-800">
                {customer ? `${customer.full_name}` : 'Walk-in Customer'}
              </span>
            </div>
            {customer && (
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Cust ID:</span>
                <span>{customer.customer_id}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 pb-1 border-b border-slate-200">
              <span className="w-1/2">ITEM</span>
              <span className="w-1/4 text-center">QTY</span>
              <span className="w-1/4 text-right">PRICE (₦)</span>
            </div>

            <div className="pt-2 space-y-1.5">
              {transaction.items && transaction.items.length > 0 ? (
                transaction.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-medium">
                      <span className="w-1/2 truncate font-bold text-slate-900">{item.item_name}</span>
                      <span className="w-1/4 text-center text-slate-600">
                        {item.quantity_sold} {item.unit}
                      </span>
                      <span className="w-1/4 text-right font-bold text-slate-900">
                        {item.total_amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.item_sn} @ ₦{item.unit_price.toLocaleString()}/{item.unit}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>{transaction.item_name}</span>
                  <span>{transaction.quantity_sold} KG</span>
                  <span>{transaction.total_amount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Totals & Discounts */}
          <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-bold">₦{transaction.total_amount.toLocaleString()}</span>
            </div>

            {transaction.discount_applied > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount ({transaction.discount_reason}):</span>
                <span>-₦{transaction.discount_applied.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-slate-950 pt-1 border-t border-slate-300">
              <span>TOTAL PAID:</span>
              <span>₦{transaction.final_amount.toLocaleString()}</span>
            </div>

            {/* Payment Method / Split Details */}
            {transaction.payment_splits && transaction.payment_splits.length > 0 ? (
              <div className="bg-slate-100/90 p-2 rounded border border-slate-200 text-[10px] space-y-1 my-1">
                <div className="font-bold text-slate-800 flex justify-between">
                  <span>PAYMENT MODE:</span>
                  <span className="text-emerald-800">SPLIT PAYMENT</span>
                </div>
                <div className="pt-0.5 space-y-0.5 border-t border-slate-200">
                  {transaction.payment_splits.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>
                        • {s.method}
                        {s.reference ? ` [${s.reference}]` : ''}
                      </span>
                      <span className="font-bold font-mono">₦{s.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {transaction.change_due && transaction.change_due > 0 ? (
                    <div className="flex justify-between text-emerald-800 font-bold pt-0.5 border-t border-slate-200">
                      <span>Cash Change Given:</span>
                      <span className="font-mono">₦{transaction.change_due.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5 pt-0.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Payment Mode:</span>
                  <span className="font-semibold uppercase text-slate-800">{transaction.payment_method}</span>
                </div>
                {transaction.change_due && transaction.change_due > 0 ? (
                  <div className="flex justify-between text-[10px] text-emerald-800 font-bold">
                    <span>Cash Change Given:</span>
                    <span className="font-mono">₦{transaction.change_due.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Customer & Discount Authorization Section */}
          {customer && (
            <div className="bg-slate-100/80 p-2 rounded border border-slate-200 text-[10px] space-y-0.5">
              <div className="flex justify-between text-slate-800">
                <span>Customer Account:</span>
                <span className="font-bold">{customer.full_name} ({customer.customer_type})</span>
              </div>
              {transaction.discount_applied > 0 && (
                <div className="flex justify-between text-emerald-800 font-semibold pt-0.5 border-t border-slate-200">
                  <span>Discount Authorization:</span>
                  <span>{transaction.discount_authorized_by || 'Manager Approved'}</span>
                </div>
              )}
            </div>
          )}

          {/* Barcode & Footer */}
          <div className="text-center pt-2 space-y-1.5">
            {/* Simulated thermal barcode lines */}
            <div className="flex justify-center items-center h-8 space-x-1 px-4">
              <div className="w-1 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-1.5 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-2 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-1 h-full bg-slate-800" />
              <div className="w-1.5 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-1 h-full bg-slate-800" />
              <div className="w-2 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-1.5 h-full bg-slate-800" />
            </div>
            <p className="text-[9px] tracking-widest text-slate-500 font-mono">
              *{transaction.transaction_id}*
            </p>

            <p className="text-[10px] font-bold text-slate-700">Thank you for choosing KIIDFROMDREAM!</p>
            <p className="text-[9px] text-slate-500">Fresh fish guaranteed. Inspect fish upon receipt.</p>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
