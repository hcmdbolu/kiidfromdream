import React, { memo, useState } from 'react';
import { Product, CartItem } from '../../types';
import { Plus, Minus, Scale, Package, Layers } from 'lucide-react';

export interface ProductCardProps {
  product: Product;
  inCart?: CartItem;
  currentTime?: Date;
  onAddToCart: (product: Product, quantity?: number, sellUnit?: 'BASE' | 'BULK') => void;
  onUpdateCartQuantity: (item_sn: string, quantity: number, sellUnit?: 'BASE' | 'BULK') => void;
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

  // Multi-Unit setup
  const hasBulk = !!product.has_bulk_unit && !!product.bulk_unit && (product.conversion_factor || 1) > 1;
  const allowLoose = product.allow_loose_sales !== false;
  const [selectedUnit, setSelectedUnit] = useState<'BASE' | 'BULK'>(
    hasBulk && !allowLoose ? 'BULK' : 'BASE'
  );

  const conversionFactor = product.conversion_factor || 1;
  const isBulkSelected = selectedUnit === 'BULK';

  // Effective price & unit
  const effectivePrice = isBulkSelected
    ? (product.bulk_selling_price || product.selling_price * conversionFactor)
    : product.selling_price;
  const effectiveUnit = isBulkSelected
    ? (product.bulk_unit || 'BULK')
    : product.product_measure_unit;

  // Dual stock calculations
  const bulkStockCount = Math.floor(product.quantity / conversionFactor);
  const looseStockCount = product.quantity % conversionFactor;

  const stockBadgeText = isOutOfStock
    ? 'OUT OF STOCK'
    : hasBulk
    ? `${bulkStockCount} ${product.bulk_unit}${looseStockCount > 0 ? ` + ${looseStockCount} ${product.product_measure_unit}` : ''}`
    : `${product.quantity} ${product.product_measure_unit} LEFT`;

  // Check if current item inCart matches the selectedUnit
  const matchingCartItem = inCart && (inCart.sell_unit || 'BASE') === selectedUnit ? inCart : undefined;

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-150 flex flex-col overflow-hidden hover:shadow-md ${
        isOutOfStock
          ? 'border-slate-200 opacity-60'
          : inCart
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Product Image & Badges */}
      <div className="relative h-32 w-full bg-slate-100 overflow-hidden shrink-0">
        <img
          src={product.item_picture || '/placeholder-product.svg'}
          alt={product.item_name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-product.svg';
          }}
        />

        {/* Serial Number & Expiry Badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-900/70 text-white backdrop-blur-xs">
            {product.item_sn}
          </span>
          {isExpired ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-xs">
              EXPIRED
            </span>
          ) : isExpiringSoon ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-xs">
              EXP SOON
            </span>
          ) : null}
        </div>

        {/* Multi-Unit conversion tag */}
        {hasBulk && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-100 backdrop-blur-xs flex items-center gap-1 shadow-xs">
              <Package className="w-2.5 h-2.5" />
              1 {product.bulk_unit} = {conversionFactor} {product.product_measure_unit}
            </span>
          </div>
        )}

        {/* Stock pill */}
        <div className="absolute bottom-2 left-2 flex items-center">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md shadow-sm ${
              isOutOfStock
                ? 'bg-rose-600 text-white'
                : isLowStock
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600/90 text-white'
            }`}
            title={hasBulk ? `Total loose inventory: ${product.quantity} ${product.product_measure_unit}` : undefined}
          >
            {stockBadgeText}
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

          {/* Unit Toggle Pill (If product has Bulk Packaging) */}
          {hasBulk && (
            <div className="mt-2 flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedUnit('BASE')}
                disabled={!allowLoose}
                className={`flex-1 text-[11px] font-semibold py-1 px-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
                  selectedUnit === 'BASE'
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : allowLoose
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 cursor-not-allowed opacity-60'
                }`}
                title={allowLoose ? `Loose unit (${product.product_measure_unit})` : 'Loose sales not allowed for this product'}
              >
                <Layers className="w-3 h-3" />
                <span>Loose ({product.product_measure_unit})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedUnit('BULK')}
                className={`flex-1 text-[11px] font-semibold py-1 px-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
                  selectedUnit === 'BULK'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Bulk pack (${product.bulk_unit} x${conversionFactor})`}
              >
                <Package className="w-3 h-3" />
                <span>Bulk ({product.bulk_unit})</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>Price</span>
              {isBulkSelected && (
                <span className="text-[9.5px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                  BULK
                </span>
              )}
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              ₦{effectivePrice.toLocaleString()}
              <span className="text-[10px] font-normal text-slate-500 font-sans">/{effectiveUnit}</span>
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
          ) : matchingCartItem ? (
            <div className="flex items-center space-x-1 bg-emerald-50 border border-emerald-300 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  const step = matchingCartItem.quantity_sold <= 2 ? 0.1 : 1;
                  onUpdateCartQuantity(product.item_sn, Math.max(0, Math.round((matchingCartItem.quantity_sold - step) * 10) / 10), selectedUnit);
                }}
                className="w-5 h-5 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-emerald-100"
                title="Decrease"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => !isBulkSelected && onOpenWeigh(product, matchingCartItem.quantity_sold)}
                className="text-xs font-bold text-emerald-950 px-1 font-mono hover:underline flex items-center space-x-0.5"
                title="Click to adjust quantity"
              >
                <span>{matchingCartItem.quantity_sold}</span>
                <span className="text-[10px] text-emerald-700 font-normal">{effectiveUnit}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const step = matchingCartItem.quantity_sold < 2 ? 0.1 : 1;
                  onUpdateCartQuantity(product.item_sn, Math.round((matchingCartItem.quantity_sold + step) * 10) / 10, selectedUnit);
                }}
                disabled={matchingCartItem.quantity_sold >= matchingCartItem.maxAvailable}
                className="w-5 h-5 rounded bg-emerald-600 text-white shadow-xs flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                title="Increase"
              >
                <Plus className="w-3 h-3" />
              </button>
              {!isBulkSelected && (
                <button
                  type="button"
                  onClick={() => onOpenWeigh(product, matchingCartItem.quantity_sold)}
                  className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center ml-0.5"
                  title="Scale measurement tool"
                >
                  <Scale className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              {!isBulkSelected && (
                <button
                  type="button"
                  onClick={() => onOpenWeigh(product, 1)}
                  className="flex items-center space-x-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer"
                  title="Weigh item with scale (e.g. 1.2 kg or 1.3 kg)"
                >
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Weigh</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onAddToCart(product, 1, selectedUnit)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer active:scale-95 ${
                  isBulkSelected ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add {isBulkSelected ? product.bulk_unit : ''}</span>
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
