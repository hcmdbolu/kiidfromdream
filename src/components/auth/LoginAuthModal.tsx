import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { Employee, UserRole } from '../../types';
import { ROLE_BADGES } from '../../utils/rbac';
import { 
  Shield, 
  Lock, 
  KeyRound, 
  Check, 
  AlertCircle, 
  UserCheck, 
  Fish, 
  X, 
  Eye, 
  EyeOff, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface LoginAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  mode?: 'LOGIN' | 'SWITCH' | 'LOCK';
}

export const LoginAuthModal: React.FC<LoginAuthModalProps> = ({
  isOpen,
  onClose,
  mode = 'LOGIN',
}) => {
  const { 
    employees, 
    activeStaff, 
    login, 
    isAuthenticated,
    setIsAuthModalOpen 
  } = usePos();

  const [identifier, setIdentifier] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [activeInputMode, setActiveInputMode] = useState<'CARD' | 'MANUAL'>('CARD');

  // Initialize selected staff on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPin('');
      if (mode === 'LOCK') {
        setSelectedStaff(activeStaff);
        setIdentifier(activeStaff.staff_id);
      } else {
        const defaultStaff = activeStaff || employees[0];
        setSelectedStaff(defaultStaff);
        setIdentifier(defaultStaff.staff_id);
      }
    }
  }, [isOpen, mode, activeStaff, employees]);

  if (!isOpen) return null;

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedStaff(emp);
    setIdentifier(emp.staff_id);
    setPin('');
    setError(null);
  };

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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const targetId = identifier.trim() || selectedStaff?.staff_id || '';
    if (!targetId) {
      setError('Please select or enter your Staff ID or Username.');
      return;
    }

    if (pin.length !== 4) {
      setError('Please enter your 4-digit security PIN.');
      return;
    }

    const res = login(targetId, pin);
    if (!res.success) {
      setError(res.error || 'Invalid credentials. Please verify your PIN.');
      setPin('');
    } else {
      // Login successful!
      setPin('');
      setError(null);
      if (onClose) onClose();
    }
  };

  const handleQuickDemoLogin = (emp: Employee) => {
    setSelectedStaff(emp);
    setIdentifier(emp.staff_id);
    setPin(emp.pin);
    setError(null);
    
    // Auto-login after slight visual confirmation
    setTimeout(() => {
      login(emp.staff_id, emp.pin);
      if (onClose) onClose();
    }, 200);
  };

  const roleBadge = selectedStaff ? ROLE_BADGES[selectedStaff.role] : null;

  // Role details map for informative display
  const roleCapabilities: Record<UserRole, { allowed: string[]; restricted: string[] }> = {
    Cashier: {
      allowed: ['POS Checkout & Sales', 'Customer Registration', 'Cash / Transfer / Card Receipts'],
      restricted: ['Add Discounts to Customers (Manager/Admin Only)', 'Inventory Edits & Stock Counts', 'Goods Receiving & POs', 'Staff Admin & Audit Trail']
    },
    Supervisor: {
      allowed: ['POS Sales', 'Physical Stock Cycle Counts', 'Receive PO Goods into Stock', 'Customer Refund Processing'],
      restricted: ['Add Customer Discounts without Manager PIN', 'Create or Cancel POs', 'Executive P&L Reports', 'Staff Admin']
    },
    Manager: {
      allowed: ['Authorize Customer Discounts', 'POS Sales & Inventory', 'Create & Cancel Purchase Orders', 'Stock Transfers & Executive Reports'],
      restricted: ['Staff User Configuration & Role Assignments (Admin only)']
    },
    Admin: {
      allowed: ['Complete Root POS Access', 'Authorize Customer Discounts', 'Staff Admin & Role Management', 'Tamper-Evident Cryptographic Ledger'],
      restricted: []
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-700/40 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-bold">
                <Fish className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-lg font-black tracking-tight text-white">KIIDFROMDREAM</span>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    POS
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {mode === 'LOCK' ? 'Terminal Locked — Enter Credentials' : 'Staff Authentication & Access Control'}
                </p>
              </div>
            </div>

            {/* If authenticated and in switch mode, allow dismiss */}
            {isAuthenticated && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
                title="Cancel and return"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          
          {/* Quick 1-Click Demo Login Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Test Accounts (1-Click Demo Login)</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">Instant Auth</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {employees.slice(0, 4).map(emp => {
                const badge = ROLE_BADGES[emp.role];
                return (
                  <button
                    key={emp.staff_id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(emp)}
                    className="p-2 rounded-xl bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-400 text-left transition-all shadow-xs group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 group-hover:text-emerald-800 truncate">
                        {emp.staff_name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className={`px-1 py-0.2 rounded font-bold ${badge.bg} ${badge.text}`}>
                        {emp.role}
                      </span>
                      <span className="font-mono text-slate-400 group-hover:text-slate-600 font-bold">
                        {emp.pin}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staff Selection Method Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Operator Account
              </label>
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('CARD')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    activeInputMode === 'CARD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Select Staff
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('MANUAL')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    activeInputMode === 'MANUAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Username / ID
                </button>
              </div>
            </div>

            {activeInputMode === 'CARD' ? (
              /* Staff Cards List */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {employees.map(emp => {
                  const isSelected = selectedStaff?.staff_id === emp.staff_id;
                  const badge = ROLE_BADGES[emp.role];
                  return (
                    <button
                      key={emp.staff_id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/30'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {emp.staff_name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="text-slate-500 font-mono">{emp.staff_id}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Manual Username or Staff ID text input */
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Enter Username (e.g. kola, ibrahim, alex) or Staff ID (STAFF-001)"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    const found = employees.find(
                      emp =>
                        emp.staff_id.toLowerCase() === e.target.value.toLowerCase() ||
                        emp.username?.toLowerCase() === e.target.value.toLowerCase() ||
                        emp.staff_name.toLowerCase() === e.target.value.toLowerCase()
                    );
                    if (found) setSelectedStaff(found);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Active Selected Role Capabilities Banner */}
          {selectedStaff && (
            <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-100">{selectedStaff.staff_name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleBadge?.bg} ${roleBadge?.text} ${roleBadge?.border}`}>
                    {roleBadge?.label}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{selectedStaff.staff_id}</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[11px]">
                <div>
                  <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider block mb-1">
                    ✓ Permitted Access:
                  </span>
                  <ul className="space-y-0.5 text-slate-300">
                    {roleCapabilities[selectedStaff.role].allowed.map((item, i) => (
                      <li key={i} className="truncate flex items-center space-x-1">
                        <span className="text-emerald-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-rose-400 font-bold text-[10px] uppercase tracking-wider block mb-1">
                    ✕ Role Restrictions:
                  </span>
                  <ul className="space-y-0.5 text-slate-400">
                    {roleCapabilities[selectedStaff.role].restricted.length > 0 ? (
                      roleCapabilities[selectedStaff.role].restricted.map((item, i) => (
                        <li key={i} className="truncate flex items-center space-x-1 text-slate-400">
                          <span className="text-rose-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-emerald-300 font-medium">Full unrestricted system control</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 4-Digit PIN Input & Keypad Display */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Security PIN (4 Digits)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPin ? 'Hide PIN' : 'Reveal PIN'}</span>
              </button>
            </div>

            {/* PIN Dots Display */}
            <div className="flex justify-center items-center space-x-3 my-2">
              {[0, 1, 2, 3].map(idx => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-2xl flex items-center justify-center font-mono text-2xl font-bold border-2 transition-all ${
                      isFilled
                        ? 'border-emerald-600 bg-white text-slate-900 shadow-sm'
                        : 'border-slate-300 bg-slate-100 text-transparent'
                    }`}
                  >
                    {isFilled ? (showPin ? pin[idx] : '•') : ''}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for Physical Keyboard capture */}
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(val);
                setError(null);
              }}
              autoFocus
              className="sr-only"
              id="hidden-pin-input"
            />

            {/* Error Message */}
            {error && (
              <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center justify-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Touchscreen Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  className="h-11 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 font-mono text-lg font-bold text-slate-800 transition-colors shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-11 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-xs font-bold text-slate-600 transition-colors uppercase tracking-wider"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 font-mono text-lg font-bold text-slate-800 transition-colors shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-11 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-xs font-bold text-slate-600 transition-colors uppercase tracking-wider"
              >
                ⌫ Del
              </button>
            </div>
          </div>

          {/* Submit / Login Button */}
          <button
            type="submit"
            disabled={pin.length !== 4}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-md ${
              pin.length === 4
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-[0.99] cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Authenticate & Launch Session</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
};
