import React from 'react';
import { SaleTransaction } from '../../types';
import { usePos } from '../../context/PosContext';
import { Printer, X, Receipt } from 'lucide-react';

interface ReceiptModalProps {
  transaction: SaleTransaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { customers, employees, receiptSettings } = usePos();
  const [detectedPrinter, setDetectedPrinter] = React.useState<string | null>(null);
  const [isPrinting, setIsPrinting] = React.useState(false);

  React.useEffect(() => {
    if (window.electronAPI?.getPrinters) {
      window.electronAPI.getPrinters().then(printers => {
        if (Array.isArray(printers) && printers.length > 0) {
          const thermalMatch = printers.find(p => 
            /pos|thermal|receipt|xp-|rp-|epson|zj-|58|80|munbyn/i.test(p.name) ||
            /pos|thermal|receipt|xp-|rp-|epson|zj-|58|80|munbyn/i.test(p.displayName || '')
          );
          const defaultPrinter = printers.find(p => p.isDefault);
          const chosen = thermalMatch?.name || defaultPrinter?.name || printers[0]?.name;
          if (chosen) setDetectedPrinter(chosen);
        }
      }).catch(() => {});
    }
  }, []);

  if (!transaction) return null;

  const customer = customers.find(c => c.customer_id === transaction.customer_id);
  const cashier = employees.find(e => e.staff_id === transaction.staff_id);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt({
          deviceName: detectedPrinter || undefined,
          silent: false,
        });
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Native print error, falling back to window.print:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const is58mm = receiptSettings.paper_width === '58mm';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is58mm ? '56mm' : '78mm'} !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2px 4px !important;
            height: fit-content !important;
            max-height: max-content !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all ${
        is58mm ? 'max-w-[270px]' : 'max-w-[325px]'
      } w-full my-auto`}>
        
        {/* Action Header (Sleek & Compact) */}
        <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-1.5 overflow-hidden">
            <Receipt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold tracking-wide shrink-0">POS RECEIPT</span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
              {receiptSettings.paper_width || '80mm'}
            </span>
            {detectedPrinter && (
              <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1 py-0.5 rounded truncate max-w-[80px]" title={`Auto-detected: ${detectedPrinter}`}>
                {detectedPrinter}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3 h-3" />
              <span>{isPrinting ? 'Printing...' : 'Print'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div className="max-h-[82vh] overflow-y-auto p-2 bg-slate-100/60">
          <div 
            id="printable-receipt" 
            className={`bg-white font-mono text-slate-900 border border-slate-200 shadow-sm mx-auto transition-all ${
              is58mm 
                ? 'w-[235px] px-2.5 py-3 text-[10px] space-y-2 receipt-58mm' 
                : 'w-[280px] px-3.5 py-3 text-[10.5px] space-y-2.5 receipt-80mm'
            }`}
          >
            
            {/* Business Header & Logo */}
            <div className="text-center border-b border-dashed border-slate-300 pb-2 space-y-0.5">
              {receiptSettings.show_logo && receiptSettings.logo_base64 && (
                <div className="flex justify-center mb-1">
                  <img
                    src={receiptSettings.logo_base64}
                    alt={receiptSettings.business_name}
                    className="max-h-11 max-w-[150px] object-contain filter grayscale contrast-125"
                  />
                </div>
              )}
              <h2 className="text-[12.5px] font-black tracking-wide text-slate-950 uppercase leading-snug">
                {receiptSettings.business_name || 'KIID FROM DREAM LTD'}
              </h2>
              {receiptSettings.tagline && (
                <p className="text-[9px] text-slate-600 uppercase font-semibold leading-tight">
                  {receiptSettings.tagline}
                </p>
              )}
              <div className="text-[8.5px] text-slate-500 leading-tight space-y-0.5 pt-0.5">
                {receiptSettings.address_line1 && <p>{receiptSettings.address_line1}</p>}
                {receiptSettings.address_line2 && <p>{receiptSettings.address_line2}</p>}
                {receiptSettings.phone_numbers && <p className="font-semibold text-slate-600">Tel: {receiptSettings.phone_numbers}</p>}
                {receiptSettings.show_tax_details && receiptSettings.tax_or_cac_number && (
                  <p className="text-slate-400 font-mono tracking-wider pt-0.5">{receiptSettings.tax_or_cac_number}</p>
                )}
              </div>
            </div>

            {/* Meta Info (High contrast & tight vertical spacing) */}
            <div className="text-[9.5px] space-y-0.5 border-b border-dashed border-slate-300 pb-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Txn ID:</span>
                <span className="font-bold text-slate-950 font-mono">{transaction.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-800">{transaction.date_time}</span>
              </div>
              {receiptSettings.show_cashier_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="text-slate-800">{cashier ? `${cashier.staff_name} (${cashier.staff_id})` : transaction.staff_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">
                  {customer ? `${customer.full_name}` : 'Walk-in Customer'}
                </span>
              </div>
              {customer && (
                <div className="flex justify-between text-[8.5px] text-slate-500">
                  <span>Cust ID:</span>
                  <span className="font-mono">{customer.customer_id}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between font-bold text-[9px] text-slate-500 pb-1 border-b border-slate-200 uppercase tracking-wider">
                <span className="w-[52%]">ITEM</span>
                <span className="w-[20%] text-center">QTY</span>
                <span className="w-[28%] text-right">TOTAL</span>
              </div>

              <div className="pt-1.5 space-y-1">
                {transaction.items && transaction.items.length > 0 ? (
                  transaction.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-baseline font-medium text-[10px]">
                        <span className="w-[52%] truncate font-bold text-slate-950">{item.item_name}</span>
                        <span className="w-[20%] text-center font-semibold text-slate-700">
                          {item.quantity_sold} {item.unit}
                        </span>
                        <span className="w-[28%] text-right font-black font-mono text-slate-950">
                          ₦{item.total_amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[8.5px] text-slate-500 pl-0.5">
                        {item.item_sn} • ₦{item.unit_price.toLocaleString()}/{item.unit}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between font-medium text-[10px]">
                    <span className="font-bold text-slate-950">{transaction.item_name}</span>
                    <span className="text-slate-700">{transaction.quantity_sold} KG</span>
                    <span className="font-black font-mono text-slate-950">₦{transaction.total_amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Totals & Discounts */}
            <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span className="font-bold font-mono text-slate-900">₦{transaction.total_amount.toLocaleString()}</span>
              </div>

              {transaction.discount_applied > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Discount ({transaction.discount_reason || 'Approved'}):</span>
                  <span className="font-mono">-₦{transaction.discount_applied.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-[12.5px] font-black text-slate-950 pt-1 border-t border-slate-300">
                <span>TOTAL PAID:</span>
                <span className="font-mono">₦{transaction.final_amount.toLocaleString()}</span>
              </div>

              {/* Payment Method / Split Details */}
              {transaction.payment_splits && transaction.payment_splits.length > 0 ? (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] space-y-0.5 my-1">
                  <div className="font-bold text-slate-800 flex justify-between">
                    <span>MODE:</span>
                    <span className="text-emerald-800 font-black">SPLIT PAYMENT</span>
                  </div>
                  <div className="pt-0.5 space-y-0.5 border-t border-slate-200">
                    {transaction.payment_splits.map((s, idx) => (
                      <div key={idx} className="space-y-0.2 border-b border-slate-200/50 pb-0.5 last:border-0 last:pb-0">
                        <div className="flex justify-between text-slate-700">
                          <span>• {s.method}{s.reference ? ` [${s.reference}]` : ''}</span>
                          <span className="font-bold font-mono">₦{s.amount.toLocaleString()}</span>
                        </div>
                        {(s.pos_terminal_name || s.bank_name) && (
                          <div className="text-[8px] text-slate-500 pl-2">
                            ↳ {s.pos_terminal_name || `${s.bank_name} (${s.bank_account_number})`}
                          </div>
                        )}
                      </div>
                    ))}
                    {transaction.change_due && transaction.change_due > 0 ? (
                      <div className="flex justify-between text-emerald-800 font-bold pt-0.5 border-t border-slate-200">
                        <span>Change Given:</span>
                        <span className="font-mono">₦{transaction.change_due.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 pt-0.5 text-[9px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Method:</span>
                    <span className="font-bold uppercase text-slate-800">{transaction.payment_method}</span>
                  </div>
                  {transaction.pos_terminal_name && (
                    <div className="flex justify-between text-purple-900 bg-purple-50 px-1 py-0.5 rounded font-mono">
                      <span>POS Terminal:</span>
                      <span className="font-bold">{transaction.pos_terminal_name}</span>
                    </div>
                  )}
                  {transaction.bank_name && !transaction.pos_terminal_name && (
                    <div className="flex justify-between text-blue-900 bg-blue-50 px-1 py-0.5 rounded font-mono">
                      <span>Bank Account:</span>
                      <span className="font-bold">{transaction.bank_name} ({transaction.bank_account_number})</span>
                    </div>
                  )}
                  {transaction.payment_reference && transaction.payment_reference !== 'CASH-DRAWER' && (
                    <div className="flex justify-between text-slate-600 font-mono">
                      <span>Slip ID:</span>
                      <span>{transaction.payment_reference}</span>
                    </div>
                  )}
                  {transaction.change_due && transaction.change_due > 0 ? (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Change Given:</span>
                      <span className="font-mono">₦{transaction.change_due.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Customer & Discount Note */}
            {customer && transaction.discount_applied > 0 && (
              <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[8.5px] space-y-0.2">
                <div className="flex justify-between text-slate-700">
                  <span>Authorized Discount:</span>
                  <span className="font-semibold text-emerald-800">{transaction.discount_authorized_by || 'Manager Approved'}</span>
                </div>
              </div>
            )}

            {/* Barcode & Footer Messages */}
            <div className="text-center pt-1 space-y-1">
              {receiptSettings.show_barcode && (
                <div className="space-y-0.5">
                  <div className="flex justify-center items-center h-5 space-x-0.5 px-3">
                    <div className="w-1 h-full bg-slate-900" />
                    <div className="w-0.5 h-full bg-slate-900" />
                    <div className="w-1.5 h-full bg-slate-900" />
                    <div className="w-0.5 h-full bg-slate-900" />
                    <div className="w-2 h-full bg-slate-900" />
                    <div className="w-0.5 h-full bg-slate-900" />
                    <div className="w-1 h-full bg-slate-900" />
                    <div className="w-1.5 h-full bg-slate-900" />
                    <div className="w-0.5 h-full bg-slate-900" />
                    <div className="w-1 h-full bg-slate-900" />
                    <div className="w-2 h-full bg-slate-900" />
                    <div className="w-0.5 h-full bg-slate-900" />
                    <div className="w-1.5 h-full bg-slate-900" />
                  </div>
                  <p className="text-[8px] tracking-widest text-slate-500 font-mono">
                    *{transaction.transaction_id}*
                  </p>
                </div>
              )}

              {receiptSettings.footer_thank_you && (
                <p className="text-[9.5px] font-bold text-slate-800">
                  {receiptSettings.footer_thank_you}
                </p>
              )}
              {receiptSettings.footer_policy_notice && (
                <p className="text-[8.5px] text-slate-500 leading-tight">
                  {receiptSettings.footer_policy_notice}
                </p>
              )}
              {receiptSettings.custom_notes && (
                <p className="text-[8px] text-slate-400 italic">
                  {receiptSettings.custom_notes}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Footer Action */}
        <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
