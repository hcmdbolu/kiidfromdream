import React from 'react';
import { RefundRecord } from '../../types';
import { usePos } from '../../context/PosContext';
import { Printer, X, RotateCcw, ShieldCheck } from 'lucide-react';

interface RefundVoucherModalProps {
  refund: RefundRecord | null;
  onClose: () => void;
}

export const RefundVoucherModal: React.FC<RefundVoucherModalProps> = ({ refund, onClose }) => {
  const { customers, employees, receiptSettings } = usePos();

  if (!refund) return null;

  const customer = customers.find(c => c.customer_id === refund.customer_id);
  const cashier = employees.find(e => e.staff_id === refund.staff_id);
  const authorizer = employees.find(e => e.staff_id === refund.authorized_by);

  const handlePrint = () => {
    window.print();
  };

  const items = Array.isArray(refund.items) && refund.items.length > 0
    ? refund.items
    : [{
        item_sn: refund.item_sn,
        item_name: refund.item_name,
        quantity_refunded: refund.quantity_refunded,
        unit_price: refund.quantity_refunded > 0 ? Math.round((refund.refund_amount / refund.quantity_refunded) * 100) / 100 : 0,
        refund_amount: refund.refund_amount,
        unit: 'KG',
      }];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Action Header (Hidden in Print) */}
        <div className="bg-slate-900 text-white p-3 px-4 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold tracking-wide">REFUND VOUCHER</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div 
          id="printable-receipt" 
          className={`p-6 bg-[#fafafa] font-mono text-xs text-slate-800 space-y-3 mx-auto ${
            receiptSettings.paper_width === '58mm' ? 'max-w-[270px] receipt-58mm' : 'max-w-[340px] receipt-80mm'
          }`}
        >
          {/* Business Header & Logo */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
            {receiptSettings.show_logo && receiptSettings.logo_base64 && (
              <div className="flex justify-center mb-2">
                <img
                  src={receiptSettings.logo_base64}
                  alt={receiptSettings.business_name}
                  className="max-h-14 max-w-[180px] object-contain filter grayscale contrast-125"
                />
              </div>
            )}
            <h2 className="text-base font-extrabold tracking-wider text-slate-950 uppercase">
              {receiptSettings.business_name || 'KIID FROM DREAM LTD'}
            </h2>
            {receiptSettings.tagline && (
              <p className="text-[10px] text-slate-600 uppercase font-semibold">
                {receiptSettings.tagline}
              </p>
            )}
            {receiptSettings.address_line1 && (
              <p className="text-[10px] text-slate-500">
                {receiptSettings.address_line1}
              </p>
            )}
            {receiptSettings.phone_numbers && (
              <p className="text-[10px] text-slate-500">
                Tel: {receiptSettings.phone_numbers}
              </p>
            )}

            <div className="mt-2 pt-2 border-t border-dotted border-slate-300">
              <span className="inline-block bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                {refund.is_full_refund ? 'OFFICIAL FULL REFUND VOUCHER' : 'OFFICIAL PARTIAL REFUND VOUCHER'}
              </span>
            </div>
          </div>

          {/* Refund Transaction Details */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-3 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Voucher No:</span>
              <span className="font-bold text-slate-900">{refund.refund_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Original Txn:</span>
              <span className="font-bold text-slate-900">{refund.original_transaction_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date & Time:</span>
              <span>{refund.date_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-semibold">{customer ? customer.full_name : (refund.customer_id || 'Walk-in Customer')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Processed By:</span>
              <span>{cashier ? cashier.staff_name : refund.staff_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Authorized By:</span>
              <span className="font-bold text-slate-900">{authorizer ? authorizer.staff_name : (refund.authorized_by || 'Store Manager')}</span>
            </div>
          </div>

          {/* Returned Items List */}
          <div className="border-b border-dashed border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase text-slate-600 mb-1 flex justify-between border-b border-slate-200 pb-0.5">
              <span>Item Description</span>
              <span>Refunded</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start text-[11px]">
                  <div className="pr-2">
                    <p className="font-bold text-slate-900 leading-tight">{it.item_name}</p>
                    <p className="text-[10px] text-slate-500">
                      {it.quantity_refunded} {it.unit || 'KG'} × ₦{Number(it.unit_price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 whitespace-nowrap">
                    ₦{Number(it.refund_amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between items-baseline pt-1">
              <span className="font-bold text-sm text-slate-900">TOTAL REFUND PAID:</span>
              <span className="font-black text-sm text-rose-700 font-mono">
                ₦{Number(refund.refund_amount || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600 pt-1">
              <span>Disbursement Method:</span>
              <span className="font-semibold text-slate-800">
                {refund.payment_method === 'Cash'
                  ? 'Cash Drawer Float'
                  : refund.pos_terminal_name
                  ? `POS: ${refund.pos_terminal_name}`
                  : refund.bank_name
                  ? `Bank: ${refund.bank_name}`
                  : refund.payment_method || 'Cash'
                }
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Return Reason:</span>
              <span className="font-medium text-slate-800 text-right max-w-[170px] truncate">
                {refund.reason}
              </span>
            </div>
          </div>

          {/* Signatures & Policy Notice */}
          <div className="pt-2 text-center space-y-4">
            <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] text-slate-500">
              <div className="border-t border-slate-400 pt-1">
                <span>Customer Signature</span>
              </div>
              <div className="border-t border-slate-400 pt-1">
                <span>Manager Signature</span>
              </div>
            </div>

            {/* Thermal Barcode Stamp */}
            <div className="pt-1 flex flex-col items-center justify-center space-y-1">
              <div className="h-7 w-40 flex items-center justify-center space-x-1 opacity-80">
                <div className="w-1 h-full bg-slate-800" />
                <div className="w-0.5 h-full bg-slate-800" />
                <div className="w-1.5 h-full bg-slate-800" />
                <div className="w-0.5 h-full bg-slate-800" />
                <div className="w-1 h-full bg-slate-800" />
                <div className="w-2 h-full bg-slate-800" />
                <div className="w-0.5 h-full bg-slate-800" />
                <div className="w-1.5 h-full bg-slate-800" />
              </div>
              <p className="text-[9px] tracking-widest text-slate-500 font-mono">
                *{refund.refund_id}*
              </p>
            </div>

            <p className="text-[9px] text-slate-400 leading-tight">
              Inventory returned to active stock. Refund disbursed under supervisor authorization.
            </p>
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Voucher</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
