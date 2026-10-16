import React, { memo } from 'react';
import { CartItem, Product } from '../../types';
import { Minus, Plus, Scale } from 'lucide-react';

export interface CartItemRowProps {
  item: CartItem;
  product?: Product;
  onUpdateQuantity: (item_sn: string, quantity: number, sellUnit?: 'BASE' | 'BULK') => void;
  onRemove: (item_sn: string, sellUnit?: 'BASE' | 'BULK') => void;
  onOpenWeigh: (product: Product, currentQty: number) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = memo(({
  item,
  product,
  onUpdateQuantity,
  onRemove,
  onOpenWeigh,
}) => {
  const isBulk = item.sell_unit === 'BULK';
  const costPrice = isBulk
    ? (product?.bulk_item_cost ?? (product?.item_cost ? product.item_cost * (item.conversion_factor || 1) : item.cost_price ?? (item.unit_price * 0.6)))
    : (product?.item_cost ?? item.cost_price ?? (item.unit_price * 0.6));

  const lineProfit = Math.round(item.total_amount - (costPrice * item.quantity_sold));
  const marginPct = item.unit_price > 0 
    ? Math.round(((item.unit_price - costPrice) / item.unit_price) * 1000) / 10 
    : 0;

  return (
    <div className="py-2.5 border-b border-slate-100 text-xs hover:bg-slate-50/70 rounded-lg px-1.5 transition-colors">
      {/* Row 1: Item Name, Price & Subtotal */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-900 truncate" title={item.item_name}>
              {item.item_name}
            </span>
            {isBulk ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200" title={`Bulk pack: 1 ${item.unit} = ${item.conversion_factor || 1} loose units`}>
                📦 {item.unit} (x{item.conversion_factor || 1})
              </span>
            ) : product?.has_bulk_unit ? (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Loose {item.unit}
              </span>
            ) : null}
          </div>
          <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-mono">
              {item.item_sn} • ₦{item.unit_price.toLocaleString()}/{item.unit}
            </span>
            <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              marginPct >= 20 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : marginPct >= 5 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`} title={`Line Cost: ₦${Math.round(costPrice * item.quantity_sold).toLocaleString()} | Profit: ₦${lineProfit.toLocaleString()}`}>
              {marginPct}% margin
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-slate-900 font-mono">
            ₦{item.total_amount.toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.item_sn, item.sell_unit)}
            className="text-[10px] text-rose-500 hover:text-rose-700 font-medium hover:underline transition-colors cursor-pointer"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Row 2: Weight & Stepper Controls (Responsive 2-tier, never clipped) */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 p-1 rounded-lg shrink-0">
          {/* Decrement Button */}
          <button
            type="button"
            onClick={() => {
              const step = item.quantity_sold <= 2 ? 0.1 : 1;
              onUpdateQuantity(item.item_sn, Math.max(0, Math.round((item.quantity_sold - step) * 10) / 10), item.sell_unit);
            }}
            className="w-6 h-6 rounded bg-white text-slate-700 shadow-xs flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
            title="Decrease weight/qty"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Direct Decimal Weight / Quantity Input */}
          <div className="relative">
            <input
              type="number"
              step="0.05"
              min="0.05"
              max={item.maxAvailable}
              value={item.quantity_sold}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  onUpdateQuantity(item.item_sn, val, item.sell_unit);
                }
              }}
              className="w-16 text-center font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              title="Directly enter weight or quantity (e.g. 1.2 or 1.5)"
            />
          </div>

          {/* Increment Button (+) Always visible and clickable */}
          <button
            type="button"
            onClick={() => {
              const step = item.quantity_sold < 2 ? 0.1 : 1;
              onUpdateQuantity(item.item_sn, Math.round((item.quantity_sold + step) * 10) / 10, item.sell_unit);
            }}
            disabled={item.quantity_sold >= item.maxAvailable}
            className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 transition-all"
            title="Increase weight/qty"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Scale Weight Measurement Tool (only for loose base units) */}
          {product && !isBulk && (
            <button
              type="button"
              onClick={() => onOpenWeigh(product, item.quantity_sold)}
              className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-medium flex items-center space-x-1 transition-colors text-[11px]"
              title="Open scale weight measurement dialog"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Scale</span>
            </button>
          )}
        </div>

        {/* Max Stock Available Indicator */}
        <span className="text-[10px] text-slate-500 font-medium truncate">
          Max: {item.maxAvailable} {item.unit}
        </span>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.item_sn === next.item.item_sn &&
    prev.item.sell_unit === next.item.sell_unit &&
    prev.item.quantity_sold === next.item.quantity_sold &&
    prev.item.total_amount === next.item.total_amount &&
    prev.item.maxAvailable === next.item.maxAvailable &&
    prev.product?.quantity === next.product?.quantity
  );
});

CartItemRow.displayName = 'CartItemRow';
