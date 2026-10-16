import React, { useState } from 'react';
import { ShieldCheck, Lock, X, AlertCircle, Check, KeyRound } from 'lucide-react';
import { usePos } from '../../context/PosContext';

interface DiscountPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  discountSummary: {
    title: string;
    amountNaira: number;
    description: string;
  };
  onSuccess: (pin: string) => void;
}

export const DiscountPinModal: React.FC<DiscountPinModalProps> = ({
  isOpen,
  onClose,
  discountSummary,
  onSuccess,
}) => {
  const { verifyDiscountAuthorizationPin } = usePos();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        validateAndSubmit(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const validateAndSubmit = (codeToVerify: string) => {
    if (codeToVerify.length !== 4) {
      setError('Please enter a complete 4-digit PIN.');
      return;
    }

    const isValid = verifyDiscountAuthorizationPin(codeToVerify);
    if (isValid) {
      onSuccess(codeToVerify);
      setPin('');
      setError(null);
    } else {
      setError('Incorrect Store Discount PIN. Please check with your Manager.');
      setPin('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    validateAndSubmit(pin);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Lock className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Discount Authorization</h3>
              <p className="text-xs text-amber-100">Enter Store Discount PIN</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPin('');
              setError(null);
              onClose();
            }}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Summary Box */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-amber-950">{discountSummary.title}</span>
              <span className="font-mono font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                -₦{discountSummary.amountNaira.toLocaleString()}
              </span>
            </div>
            <p className="text-amber-800 text-[11px]">{discountSummary.description}</p>
          </div>

          <div className="text-center text-xs text-slate-500">
            This is the dedicated <strong className="text-slate-800">Store Discount PIN</strong> set by Management (separate from personal login credentials).
          </div>

          {/* PIN Dots Display */}
          <div className="flex justify-center space-x-3 py-1">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pin.length > i
                    ? 'bg-amber-600 border-amber-600 scale-110 shadow-xs'
                    : 'border-slate-300 bg-slate-50'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="py-3 text-lg font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-amber-100 active:text-amber-800 rounded-xl transition-all shadow-2xs"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-3 text-xs font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="py-3 text-lg font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-amber-100 active:text-amber-800 rounded-xl transition-all shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 text-xs font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
            >
              ⌫
            </button>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(null);
                onClose();
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pin.length !== 4}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-sm"
            >
              Authorize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
