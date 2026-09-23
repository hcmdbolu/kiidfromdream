import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Product } from '../../types';
import { ArrowLeftRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: Product;
}

const STORAGE_LOCATIONS = [
  'Main Walk-in Cold Room A',
  'Display Counter Fish Tank 1',
  'Display Counter Ice Bed 2',
  'Deep Freeze Storage Unit B',
  'Secondary Wharf Holding Facility',
  'Retail Prep & Cleaning Station',
];

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  preselectedProduct,
}) => {
  const { products, performStockTransfer, activeStaff } = usePos();

  const [selectedSn, setSelectedSn] = useState<string>(
    preselectedProduct?.item_sn || products[0]?.item_sn || ''
  );
  const [quantity, setQuantity] = useState<number>(10);
  const [fromLocation, setFromLocation] = useState<string>(STORAGE_LOCATIONS[0]);
  const [toLocation, setToLocation] = useState<string>(STORAGE_LOCATIONS[1]);
  const [notes, setNotes] = useState<string>('Display counter replenishment');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentProduct = products.find(p => p.item_sn === selectedSn) || products[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentProduct) {
      setError('Please select a fish product to transfer.');
      return;
    }

    if (quantity <= 0) {
      setError('Transfer quantity must be greater than zero.');
      return;
    }

    if (fromLocation === toLocation) {
      setError('Source and destination locations cannot be identical.');
      return;
    }

    const res = performStockTransfer({
      item_sn: currentProduct.item_sn,
      quantity,
      from_location: fromLocation,
      to_location: toLocation,
      notes,
    });

    if (!res.success) {
      setError(res.error || 'Failed to execute stock transfer.');
    } else {
      setSuccess(`Transfer ${res.record?.transfer_id} authorized! Moved ${quantity} ${currentProduct.product_measure_unit} from "${fromLocation}" to "${toLocation}".`);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Internal Fish Stock Transfer</h3>
              <p className="text-xs text-slate-400">
                Manager Cold-Room & Counter Movement Authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product
            </label>
            <select
              value={selectedSn}
              onChange={(e) => setSelectedSn(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            >
              {products.map(p => (
                <option key={p.item_sn} value={p.item_sn}>
                  {p.item_sn} - {p.item_name} (Total Stock: {p.quantity} {p.product_measure_unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Quantity to Transfer ({currentProduct?.product_measure_unit})
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Locations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                From (Source)
              </label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                {STORAGE_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                To (Destination)
              </label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                {STORAGE_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Transfer Purpose / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Display replenishment for weekend retail rush"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <span>Authorizing Manager: <strong className="text-slate-800">{activeStaff.staff_name}</strong> ({activeStaff.role})</span>
            <span className="font-mono text-purple-600 font-semibold">Auto-Logged to Audit</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Authorize & Execute Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
