import React, { memo } from 'react';
import { Product, CartItem } from '../../types';
import { Plus, Minus, Scale } from 'lucide-react';

export interface ProductCardProps {
  product: Product;
  inCart?: CartItem;
  currentTime?: Date;
  onAddToCart: (product: Product, quantity: number) => void;
  onUpdateCartQuantity: (item_sn: string, quantity: number) => void;
  onOpenWeigh: (product: Product, currentQty: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  inCart,
  currentTime,
  onAddToCart,
  onUpdateCartQuantity,
  onOpenWeigh,
}) => {
  const isOutOfStock = product.quantity <= 0;
  const isLowStock = product.quantity > 0 && product.quantity <= product.reorder_level;

  const now = currentTime || new Date();
  const expiryDate = new Date(product.expiry_date);
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = diffDays >= 0 && diffDays <= 3;
  const isExpired = diffDays < 0;

  const profitMargin = product.item_cost > 0
    ? Math.round(((product.selling_price - product.item_cost) / product.item_cost) * 100)
    : 0;

  return (
    <div
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
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80';
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
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded backdrop-blur-md shadow-sm ${
              isOutOfStock
                ? 'bg-rose-600 text-white'
                : isLowStock
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600/90 text-white'
            }`}
          >
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
            <div className="flex items-center space-x-1 bg-emerald-50 border border-emerald-300 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  const step = inCart.quantity_sold <= 2 ? 0.1 : 1;
                  onUpdateCartQuantity(product.item_sn, Math.max(0, Math.round((inCart.quantity_sold - step) * 10) / 10));
                }}
                className="w-5 h-5 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-emerald-100"
                title="Decrease"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onOpenWeigh(product, inCart.quantity_sold)}
                className="text-xs font-bold text-emerald-950 px-1 font-mono hover:underline flex items-center space-x-0.5"
                title="Click to adjust exact scale weight"
              >
                <span>{inCart.quantity_sold}</span>
                <span className="text-[10px] text-emerald-700 font-normal">{product.product_measure_unit}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const step = inCart.quantity_sold < 2 ? 0.1 : 1;
                  onUpdateCartQuantity(product.item_sn, Math.round((inCart.quantity_sold + step) * 10) / 10);
                }}
                disabled={inCart.quantity_sold >= product.quantity}
                className="w-5 h-5 rounded bg-emerald-600 text-white shadow-xs flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                title="Increase"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onOpenWeigh(product, inCart.quantity_sold)}
                className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center ml-0.5"
                title="Scale measurement tool"
              >
                <Scale className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => onOpenWeigh(product, 1)}
                className="flex items-center space-x-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all"
                title="Weigh item with scale (e.g. 1.2 kg or 1.3 kg)"
              >
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>Weigh</span>
              </button>
              <button
                type="button"
                onClick={() => onAddToCart(product, 1)}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.product.item_sn === next.product.item_sn &&
    prev.product.quantity === next.product.quantity &&
    prev.product.selling_price === next.product.selling_price &&
    prev.inCart?.quantity_sold === next.inCart?.quantity_sold &&
    prev.inCart?.total_amount === next.inCart?.total_amount
  );
});

ProductCard.displayName = 'ProductCard';
