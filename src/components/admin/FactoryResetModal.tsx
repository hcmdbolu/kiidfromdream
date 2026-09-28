import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Lock, 
  KeyRound, 
  RefreshCw,
  Database,
  Building2,
  Check,
  ShieldCheck,
  Flame
} from 'lucide-react';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeStaff, factoryDataReset } = usePos();

  const [keywordInput, setKeywordInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const isSuperAdmin = activeStaff.role === 'Super Admin';
  const isKeywordValid = keywordInput.trim() === 'RESET';
  const isPinEntered = pinInput.trim().length >= 4;
  const canSubmit = isSuperAdmin && isKeywordValid && isPinEntered && !isProcessing;

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const result = await factoryDataReset(pinInput);
      if (result.success) {
        setIsSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(result.error || 'Failed to complete factory data reset.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during data wipe.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setKeywordInput('');
    setPinInput('');
    setErrorMessage(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn select-none">
      <div className="bg-slate-900 border border-rose-900/60 text-slate-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn transition-all">
        
        {/* Top Danger Accent Header */}
        <div className="bg-gradient-to-r from-rose-950 via-red-950 to-slate-900 px-6 py-5 border-b border-rose-800/40 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/60 shrink-0">
              <Flame className="w-6 h-6 animate-pulse text-rose-500" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Factory Data Reset (Wipe All Data)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-md uppercase tracking-wider">
                  Super Admin Only
                </span>
              </div>
              <p className="text-xs text-rose-200/70 mt-0.5">
                Prepare the system for a fresh, live production environment
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel & Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Non-Super-Admin Guard */}
        {!isSuperAdmin ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-950/80 border border-rose-700/60 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Super Administrator Access Required</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                Factory data resets are restricted strictly to the Super Administrator (Boluwatife). 
                Your current role is <strong>{activeStaff.role}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : isSuccess ? (
          /* Success Screen */
          <div className="p-8 text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/60">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                System Initialized for Production!
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                All transactional history, inventory products, customers, and audit logs have been cleanly wiped.
                Your Administrator account and POS Terminal configurations have been safely retained.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Go to POS Terminal
              </button>
            </div>
          </div>
        ) : (
          /* Main Reset Confirmation Form */
          <form onSubmit={handleExecuteReset} className="p-6 space-y-5">

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-center space-x-2.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Irreversible Destruction Warning Notice */}
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Warning: Irreversible System Action</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This action is <strong>irreversible</strong> and will purge all accumulated operational and transactional data from the system database, browser local storage, and real-time replicas.
              </p>

              {/* Data Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-900/40 space-y-1.5">
                  <div className="font-semibold text-rose-400 flex items-center space-x-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Deleted:</span>
                  </div>
                  <ul className="text-slate-400 space-y-1 pl-1 font-mono text-[10px]">
                    <li>❌ All Sales History & Receipts</li>
                    <li>❌ All Products & Cold Room Stock</li>
                    <li>❌ All Customer Records & Discounts</li>
                    <li>❌ All Purchase Orders & Deliveries</li>
                    <li>❌ All Cash Transfer & Treasury Logs</li>
                    <li>❌ All Audit Trail & Activity Records</li>
                    <li>❌ Browser LocalStorage & Cache</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40 space-y-1.5">
                  <div className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Safely Preserved:</span>
                  </div>
                  <ul className="text-slate-300 space-y-1 pl-1 font-mono text-[10px]">
                    <li>✅ Core Super Admin (Boluwatife)</li>
                    <li>✅ Administrator Account (Alex Abiri)</li>
                    <li>✅ Configured POS Terminals</li>
                    <li>✅ Settlement Bank Accounts</li>
                    <li>✅ Active Operator Session</li>
                    <li>✅ System Hardware Settings</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Confirmation Step 1: Type 'RESET' */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                1. Type <span className="font-mono text-rose-400 bg-rose-950/70 px-1.5 py-0.5 rounded border border-rose-800">RESET</span> to confirm data destruction:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  disabled={isProcessing}
                  className={`w-full px-3.5 py-2.5 text-xs font-mono tracking-widest bg-slate-950 border rounded-xl focus:outline-hidden transition-all text-white uppercase placeholder:text-slate-600 ${
                    isKeywordValid 
                      ? 'border-emerald-500/80 bg-emerald-950/20' 
                      : keywordInput.length > 0 
                        ? 'border-rose-500/80' 
                        : 'border-slate-800 focus:border-rose-500'
                  }`}
                />
                {isKeywordValid && (
                  <Check className="w-4 h-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                Must be exact uppercase letters: <strong>RESET</strong>
              </p>
            </div>

            {/* Confirmation Step 2: Super Admin Password / PIN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                2. Enter Super Administrator Password / Security PIN:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={30}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Super Admin password or PIN"
                  disabled={isProcessing}
                  className="w-full pl-9 pr-16 py-2.5 text-xs font-mono bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl focus:outline-hidden text-white placeholder:text-slate-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200 font-mono px-1 py-0.5 cursor-pointer"
                >
                  {showPin ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Authorizes system wiping under Super Admin Boluwatife credentials.
              </p>
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel & Keep Safe
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer ${
                  canSubmit
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60 active:scale-98'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Wiping System Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wipe All Data & Initialize</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
