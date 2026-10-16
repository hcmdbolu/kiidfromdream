import React, { useState } from 'react';
import { KeyRound, ShieldCheck, X, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { usePos } from '../../context/PosContext';

interface ConfigureDiscountPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigureDiscountPinModal: React.FC<ConfigureDiscountPinModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { updateDiscountPin, activeStaff, discountSecurityConfig } = usePos();
  const [managerLoginPin, setManagerLoginPin] = useState('');
  const [newDiscountPin, setNewDiscountPin] = useState('');
  const [confirmDiscountPin, setConfirmDiscountPin] = useState('');
  const [stackingPolicy, setStackingPolicy] = useState<'BEST_DISCOUNT' | 'CONTROLLED_STACKING'>(
    discountSecurityConfig.stacking_policy || 'BEST_DISCOUNT'
  );
  const [maxCap, setMaxCap] = useState<number>(discountSecurityConfig.max_discount_percent_cap ?? 25);
  const [enforceCostFloor, setEnforceCostFloor] = useState<boolean>(
    discountSecurityConfig.enforce_cost_floor !== false
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (managerLoginPin.length !== 4) {
      setError('Please enter your 4-digit personal login PIN.');
      return;
    }

    if (newDiscountPin) {
      if (newDiscountPin.length !== 4 || !/^\d{4}$/.test(newDiscountPin)) {
        setError('New Discount PIN must be exactly 4 numeric digits.');
        return;
      }
      if (newDiscountPin !== confirmDiscountPin) {
        setError('New Discount PIN and confirmation do not match.');
        return;
      }
    }

    const res = await updateDiscountPin(
      activeStaff.staff_id, 
      managerLoginPin, 
      newDiscountPin || undefined,
      {
        stacking_policy: stackingPolicy,
        max_discount_percent_cap: Number(maxCap) || 25,
        enforce_cost_floor: enforceCostFloor,
      }
    );

    if (!res.success) {
      setError(res.error || 'Failed to update discount settings. Verify your login PIN.');
    } else {
      setSuccess('Store Discount PIN & Management Policies successfully updated!');
      setTimeout(() => {
        setManagerLoginPin('');
        setNewDiscountPin('');
        setConfirmDiscountPin('');
        setSuccess(null);
        onClose();
      }, 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Discount Security & Anti-Stacking Controls</h3>
              <p className="text-xs text-slate-400">Manage cashier authorization PIN and profit margin protections</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setSuccess(null);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Security & Profit Protection</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              The Store Discount PIN enables cashiers to apply approved discounts without sharing your personal manager password. Policies below prevent revenue loss from compounding discount stacking.
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Stacking Policy Selection */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Multi-Discount Stacking Rule
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStackingPolicy('BEST_DISCOUNT')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  stackingPolicy === 'BEST_DISCOUNT'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-[12px] flex items-center justify-between">
                  <span>Best Discount Only</span>
                  {stackingPolicy === 'BEST_DISCOUNT' && <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">Active</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  System applies only the single highest savings. Prevents compounding losses.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStackingPolicy('CONTROLLED_STACKING')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  stackingPolicy === 'CONTROLLED_STACKING'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-[12px] flex items-center justify-between">
                  <span>Controlled Stacking</span>
                  {stackingPolicy === 'CONTROLLED_STACKING' && <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">Active</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Stacks rules up to the configured basket percentage ceiling.
                </p>
              </button>
            </div>
          </div>

          {/* Caps & Floor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Total Discount Cap (%)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={maxCap}
                onChange={e => setMaxCap(Math.max(1, Math.min(90, Number(e.target.value) || 25)))}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Total discount cannot exceed this % of cart.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">
                  Cost Floor Protection
                </label>
                <p className="text-[10px] text-slate-500 mb-2">
                  Block sales where discount pushes price below wholesale cost.
                </p>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enforceCostFloor}
                  onChange={e => setEnforceCostFloor(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-800">Enforce Cost Floor</span>
              </label>
            </div>
          </div>

          {/* Manager Login PIN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Personal Manager PIN ({activeStaff.staff_name})
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={4}
                value={managerLoginPin}
                onChange={e => setManagerLoginPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter your 4-digit personal login PIN to authorize"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-mono tracking-widest"
                required
              />
            </div>
          </div>

          {/* New Discount PIN (Optional change) */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rotate Store Discount PIN <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                maxLength={4}
                value={newDiscountPin}
                onChange={e => setNewDiscountPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Leave blank to keep"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-mono tracking-widest text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={confirmDiscountPin}
                onChange={e => setConfirmDiscountPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirm 4 digits"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-mono tracking-widest text-center"
              />
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
            >
              Save Policy & PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
