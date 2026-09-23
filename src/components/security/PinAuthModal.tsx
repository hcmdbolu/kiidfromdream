import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Employee, UserRole } from '../../types';
import { ROLE_BADGES } from '../../utils/rbac';
import { Shield, KeyRound, Check, X, AlertCircle, UserCheck } from 'lucide-react';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  requiredRole?: UserRole | UserRole[];
  mode?: 'SWITCH_USER' | 'OVERRIDE';
  actionDescription?: string;
  onSuccess: (authorizedStaff: Employee) => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onClose,
  title = 'Security PIN Authorization',
  subtitle = 'Please verify your 4-digit PIN to proceed',
  requiredRole,
  mode = 'SWITCH_USER',
  actionDescription,
  onSuccess,
}) => {
  const { employees, activeStaff, verifyStaffPin, requestOverride } = usePos();
  
  const [selectedStaffId, setSelectedStaffId] = useState<string>(activeStaff.staff_id);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter eligible staff if a requiredRole is specified
  const eligibleStaff = employees.filter(e => {
    if (!requiredRole) return true;
    if (Array.isArray(requiredRole)) return requiredRole.includes(e.role);
    return e.role === requiredRole;
  });

  const targetStaff = employees.find(e => e.staff_id === selectedStaffId) || eligibleStaff[0] || employees[0];

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError(null);
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

  const handleQuickFill = (targetPin: string, staffId: string) => {
    setSelectedStaffId(staffId);
    setPin(targetPin);
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setError('Please enter a complete 4-digit PIN.');
      return;
    }

    if (mode === 'OVERRIDE') {
      const res = requestOverride(pin, actionDescription || 'Privileged action');
      if (res.success && res.authorizedBy) {
        onSuccess(res.authorizedBy);
        onClose();
      } else {
        setError(res.error || 'Invalid supervisor or manager authorization PIN.');
        setPin('');
      }
    } else {
      const res = verifyStaffPin(targetStaff.staff_id, pin);
      if (res.success && res.staff) {
        onSuccess(res.staff);
        onClose();
      } else {
        setError(res.error || 'Invalid PIN entered.');
        setPin('');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Action context if override */}
          {actionDescription && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Privileged Action:</span> {actionDescription}
                <div className="text-[11px] text-amber-700 mt-0.5">
                  Requires Supervisor, Manager, or Admin approval.
                </div>
              </div>
            </div>
          )}

          {/* User selector if switching or targetting */}
          {mode === 'SWITCH_USER' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Staff Account
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {employees.map(emp => {
                  const isSelected = emp.staff_id === selectedStaffId;
                  const badge = ROLE_BADGES[emp.role];
                  return (
                    <button
                      key={emp.staff_id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(emp.staff_id);
                        setPin('');
                        setError(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {emp.staff_name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500 font-mono">{emp.staff_id}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} border ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PIN Display */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <div className="text-xs text-slate-500 font-medium mb-2 flex items-center justify-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {mode === 'OVERRIDE'
                  ? 'Enter Authorizing Supervisor / Manager PIN'
                  : `Enter PIN for ${targetStaff?.staff_name || 'Staff'}`}
              </span>
            </div>
            
            <div className="flex justify-center items-center space-x-3 my-2">
              {[0, 1, 2, 3].map(idx => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-12 rounded-xl flex items-center justify-center font-mono text-xl font-bold border-2 transition-all ${
                      filled
                        ? 'border-emerald-600 bg-emerald-50 text-slate-900 shadow-xs'
                        : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center justify-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick Demo PIN Chips for Tester Convenience */}
          <div className="p-2.5 bg-slate-100/80 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Quick Test Access (Pre-set PINs)</span>
              <span className="text-[9px] text-emerald-600 font-medium">Click to fill</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {employees.slice(0, 4).map(emp => (
                <button
                  key={emp.staff_id}
                  type="button"
                  onClick={() => handleQuickFill(emp.pin, emp.staff_id)}
                  className="px-2 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded text-left flex items-center justify-between transition-colors"
                >
                  <span className="truncate text-slate-700 font-medium">
                    {emp.staff_name} ({emp.role}):
                  </span>
                  <span className="font-mono font-bold text-emerald-700 ml-1">
                    {emp.pin}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-mono text-lg font-bold text-slate-800 transition-colors shadow-xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition-colors uppercase tracking-wider"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-mono text-lg font-bold text-slate-800 transition-colors shadow-xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition-colors uppercase tracking-wider"
            >
              ⌫ Del
            </button>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length !== 4}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
              pin.length === 4
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Confirm & Authenticate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
