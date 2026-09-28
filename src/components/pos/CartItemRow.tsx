import React, { memo } from 'react';
import { CartItem, Product } from '../../types';
import { Minus, Plus, Scale } from 'lucide-react';

export interface CartItemRowProps {
  item: CartItem;
  product?: Product;
  onUpdateQuantity: (item_sn: string, quantity: number) => void;
  onRemove: (item_sn: string) => void;
  onOpenWeigh: (product: Product, currentQty: number) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = memo(({
  item,
  product,
  onUpdateQuantity,
  onRemove,
  onOpenWeigh,
}) => {
  return (
    <div className="pt-2 flex items-center justify-between text-xs">
      <div className="flex-1 pr-2">
        <div className="font-semibold text-slate-800 line-clamp-1">{item.item_name}</div>
        <div className="text-slate-400 text-[11px]">
          {item.item_sn} • ₦{item.unit_price.toLocaleString()} / {item.unit}
        </div>
      </div>

      {/* Qty & Weight Controls */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => {
            const step = item.quantity_sold <= 2 ? 0.1 : 1;
            onUpdateQuantity(item.item_sn, Math.max(0, Math.round((item.quantity_sold - step) * 10) / 10));
          }}
          className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200"
          title="Decrease weight/qty"
        >
          <Minus className="w-3 h-3" />
        </button>

        {/* Direct editable decimal weight input */}
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
                onUpdateQuantity(item.item_sn, val);
              }
            }}
            className="w-14 text-center font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            title="Directly enter weight or count (e.g. 1.2 or 1.3)"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const step = item.quantity_sold < 2 ? 0.1 : 1;
            onUpdateQuantity(item.item_sn, Math.round((item.quantity_sold + step) * 10) / 10);
          }}
          disabled={item.quantity_sold >= item.maxAvailable}
          className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50"
          title="Increase weight/qty"
        >
          <Plus className="w-3 h-3" />
        </button>

        {/* Open scale reading dialog */}
        {product && (
          <button
            type="button"
            onClick={() => onOpenWeigh(product, item.quantity_sold)}
            className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-colors"
            title="Open scale weight dialog"
          >
            <Scale className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="text-right pl-3 min-w-[75px]">
        <div className="font-bold text-slate-900">₦{item.total_amount.toLocaleString()}</div>
        <button
          type="button"
          onClick={() => onRemove(item.item_sn)}
          className="text-[10px] text-rose-500 hover:text-rose-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.item_sn === next.item.item_sn &&
    prev.item.quantity_sold === next.item.quantity_sold &&
    prev.item.total_amount === next.item.total_amount &&
    prev.item.maxAvailable === next.item.maxAvailable &&
    prev.product?.quantity === next.product?.quantity
  );
});

CartItemRow.displayName = 'CartItemRow';
