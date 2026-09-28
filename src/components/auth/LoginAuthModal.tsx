import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  X, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  ShieldAlert, 
  KeyRound, 
  User, 
  Fish, 
  HelpCircle, 
  Delete,
  CheckCircle2,
  RefreshCw,
  LogOut
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
    login, 
    isAuthenticated,
    activeStaff,
    receiptSettings,
    syncStatus,
  } = usePos();

  // Mode selection: 'PIN' (Cashier Quick-PIN) or 'CREDENTIALS' (Manager/Admin Alphanumeric)
  const [activeTab, setActiveTab] = useState<'PIN' | 'CREDENTIALS'>('PIN');
  
  // Credentials Form State (Never pre-filled with hardcoded admin values!)
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Quick-PIN State (for Cashier touchscreen numpad)
  const [pinDigits, setPinDigits] = useState<string>('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Status & Feedback States
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [showHelpNotice, setShowHelpNotice] = useState<boolean>(false);
  
  // Brute-force lockout countdown state (seconds)
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Switch operator view inside Lock screen
  const [overrideLockScreen, setOverrideLockScreen] = useState<boolean>(false);

  // Sync remembered username on mount/open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setShowHelpNotice(false);
      setPinDigits('');
      setIsLoading(false);
      setOverrideLockScreen(false);

      const savedUser = localStorage.getItem('kiidfromdream_saved_username');
      if (savedUser) {
        setUsername(savedUser);
        setRememberMe(true);
      } else {
        setUsername('');
        setRememberMe(false);
      }
      setPassword('');

      // Auto-set tab based on modal mode
      if (mode === 'LOCK') {
        setActiveTab('PIN');
      }
    }
  }, [isOpen, mode]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Trigger tactile shake animation on error
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  // Format lockout timer for display (MM:SS)
  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit Handler for Alphanumeric Sign-In (Manager / Admin)
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setError(null);
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError('Please enter your username, staff ID, or email.');
      triggerShake();
      return;
    }

    if (!cleanPass) {
      setError('Please enter your security password or PIN.');
      triggerShake();
      return;
    }

    setIsLoading(true);

    if (rememberMe) {
      localStorage.setItem('kiidfromdream_saved_username', cleanUser);
    } else {
      localStorage.removeItem('kiidfromdream_saved_username');
    }

    const res = await login(cleanUser, cleanPass);
    setIsLoading(false);

    if (!res.success) {
      triggerShake();
      if (res.isLocked && res.retryAfterSeconds) {
        setLockoutSeconds(res.retryAfterSeconds);
        setError(res.error || `Too many failed attempts. Terminal locked for security.`);
      } else {
        setError(res.error || 'Invalid credentials. Please verify your username and password.');
      }
    } else {
      setError(null);
      setPassword('');
      if (onClose) onClose();
    }
  };

  // Submit Handler for Cashier Quick-PIN
  const handlePinSubmit = async (pinValue?: string) => {
    if (lockoutSeconds > 0) return;

    const targetPin = (pinValue !== undefined ? pinValue : pinDigits).trim();
    if (!targetPin) {
      setError('Please enter your 4-digit security PIN.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    // If on lock screen with existing active staff, authenticate using that staff's username/ID
    const targetUser = (mode === 'LOCK' && !overrideLockScreen && activeStaff?.username) 
      ? activeStaff.username 
      : (username.trim() || undefined);

    const res = await login(targetUser || '', targetPin);
    setIsLoading(false);

    if (!res.success) {
      triggerShake();
      setPinDigits('');
      if (res.isLocked && res.retryAfterSeconds) {
        setLockoutSeconds(res.retryAfterSeconds);
        setError(res.error || `Too many failed attempts. Terminal locked for security.`);
      } else {
        setError(res.error || 'Incorrect security PIN. Please try again.');
      }
    } else {
      setError(null);
      setPinDigits('');
      if (onClose) onClose();
    }
  };

  // Handle Touch Numpad Key Press
  const handleNumpadPress = (digit: string) => {
    if (lockoutSeconds > 0 || isLoading) return;
    setError(null);

    if (digit === 'CLEAR') {
      setPinDigits('');
    } else if (digit === 'BACK') {
      setPinDigits(prev => prev.slice(0, -1));
    } else {
      if (pinDigits.length < 6) {
        const nextDigits = pinDigits + digit;
        setPinDigits(nextDigits);
        // Auto-submit when exactly 4 digits entered in Cashier mode
        if (nextDigits.length === 4) {
          handlePinSubmit(nextDigits);
        }
      }
    }
  };

  // Keyboard navigation for Cashier Quick-PIN Mode
  useEffect(() => {
    if (!isOpen || activeTab !== 'PIN' || lockoutSeconds > 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input element
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumpadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpadPress('BACK');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleNumpadPress('CLEAR');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pinDigits.length > 0) {
          handlePinSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, pinDigits, lockoutSeconds, isLoading]);

  if (!isOpen) return null;

  const isStandalone = !isAuthenticated || mode === 'LOGIN';
  const isLockScreen = mode === 'LOCK' && !overrideLockScreen;
  const storeName = receiptSettings?.business_name || 'KIID FROM DREAM LTD';
  const storeLogo = receiptSettings?.show_logo ? receiptSettings?.logo_base64 : null;

  return (
    <div 
      className={
        isStandalone 
          ? "min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden"
          : "fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 min-h-screen selection:bg-emerald-500 selection:text-white"
      }
    >
      {/* Ambient background glow for deep emerald theme */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Modal / Card */}
      <div className={`w-full max-w-[460px] bg-slate-900/90 border border-slate-800/90 rounded-3xl shadow-2xl shadow-emerald-950/40 p-6 sm:p-8 text-center relative z-10 ${shake ? 'animate-shake' : ''}`}>
        
        {/* Dismiss button if already authenticated and merely switching / unlocking */}
        {isAuthenticated && onClose && mode !== 'LOCK' && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Return to POS workspace"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: TERMINAL LOCKED (In-Session Fast Resume) */}
        {/* ========================================================================= */}
        {isLockScreen ? (
          <div>
            {/* Lock Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-inner mb-4">
              <Lock className="w-7 h-7" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Terminal Locked
            </h2>
            
            {/* Active Operator Avatar & Info */}
            <div className="mt-3 py-2 px-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl inline-flex items-center space-x-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
                {activeStaff.staff_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">{activeStaff.staff_name}</div>
                <div className="text-[11px] text-emerald-400 font-semibold">{activeStaff.role} • {activeStaff.shift_time || 'Active Shift'}</div>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-4 mb-4">
              Enter security PIN to resume operations
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Security Lockout Timer Alert */}
            {lockoutSeconds > 0 && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center space-x-3 text-left">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <div className="font-bold text-amber-300">Terminal Security Lockout</div>
                  <div className="text-[11px] text-amber-200/90 mt-0.5">
                    Too many failed PIN attempts. Retry in <strong className="font-mono text-white text-sm">{formatLockoutTime(lockoutSeconds)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Masked PIN Display Circles */}
            <div className="flex items-center justify-center space-x-3.5 my-5">
              {[0, 1, 2, 3].map((index) => {
                const filled = pinDigits.length > index;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      filled 
                        ? 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-500/50' 
                        : 'border-2 border-slate-700 bg-slate-800/80'
                    }`}
                  />
                );
              })}
            </div>

            {/* Touchscreen Numpad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto mt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'].map((btn) => {
                if (btn === 'CLEAR') {
                  return (
                    <button
                      key={btn}
                      type="button"
                      disabled={lockoutSeconds > 0 || isLoading}
                      onClick={() => handleNumpadPress('CLEAR')}
                      className="h-13 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      Clear
                    </button>
                  );
                }
                if (btn === 'BACK') {
                  return (
                    <button
                      key={btn}
                      type="button"
                      disabled={lockoutSeconds > 0 || isLoading}
                      onClick={() => handleNumpadPress('BACK')}
                      className="h-13 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                      title="Backspace"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  );
                }
                return (
                  <button
                    key={btn}
                    type="button"
                    disabled={lockoutSeconds > 0 || isLoading}
                    onClick={() => handleNumpadPress(btn)}
                    className="h-13 rounded-2xl bg-slate-800/90 hover:bg-emerald-600 hover:text-white border border-slate-700/70 text-white font-extrabold text-xl shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    {btn}
                  </button>
                );
              })}
            </div>

            {/* Unlock Button */}
            <button
              type="button"
              disabled={lockoutSeconds > 0 || isLoading || pinDigits.length === 0}
              onClick={() => handlePinSubmit()}
              className="w-full mt-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <span>Unlock Terminal</span>
              )}
            </button>

            {/* Switch Operator Button */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setOverrideLockScreen(true)}
                className="text-slate-400 hover:text-emerald-400 font-medium transition-colors cursor-pointer"
              >
                Switch Operator
              </button>

              <button
                type="button"
                onClick={() => {
                  setOverrideLockScreen(true);
                  setActiveTab('CREDENTIALS');
                }}
                className="text-slate-400 hover:text-emerald-400 font-medium transition-colors cursor-pointer"
              >
                Manager Unlock →
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: FULL APPLICATION SIGN-IN (Initial Boot or Operator Switch) */
          /* ========================================================================= */
          <div>
            {/* Brand Logo / Monogram */}
            <div className="mx-auto flex flex-col items-center">
              {storeLogo ? (
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-1.5 flex items-center justify-center shadow-lg shadow-emerald-950/40 mb-3">
                  <img src={storeLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/25 mb-3 tracking-wider">
                  <Fish className="w-7 h-7" />
                </div>
              )}

              {/* Title & Live Status */}
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {storeName}
              </h1>
              <div className="flex items-center space-x-2 mt-1.5 text-xs text-slate-400">
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                </span>
                <span>Central POS Terminal • {syncStatus === 'synced' ? 'Online' : syncStatus === 'syncing' ? 'Syncing' : 'Offline Mode'}</span>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mt-5 p-1 bg-slate-800/80 border border-slate-700/60 rounded-2xl grid grid-cols-2 gap-1 text-xs font-bold text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('PIN');
                  setError(null);
                }}
                className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  activeTab === 'PIN' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Cashier Quick-PIN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('CREDENTIALS');
                  setError(null);
                }}
                className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  activeTab === 'CREDENTIALS' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Manager / Admin</span>
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Security Lockout Timer Alert */}
            {lockoutSeconds > 0 && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center space-x-3 text-left">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <div className="font-bold text-amber-300">Terminal Security Lockout</div>
                  <div className="text-[11px] text-amber-200/90 mt-0.5">
                    Too many failed sign-in attempts. Please retry in <strong className="font-mono text-white text-sm">{formatLockoutTime(lockoutSeconds)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Enterprise Help Dialog (NO passwords leaked!) */}
            {showHelpNotice && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs text-left space-y-1.5 animate-fadeIn">
                <div className="font-bold text-white flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    <span>Credential Assistance</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setShowHelpNotice(false)} 
                    className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  For security and compliance reasons, passwords and security PINs cannot be viewed in plain text.
                </p>
                <p className="text-[11px] text-emerald-400 font-medium">
                  Please contact your Store Manager or System Administrator to reset your operator PIN or administrative credentials.
                </p>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* TAB CONTENT: CASHIER TOUCHSCREEN QUICK-PIN */}
            {/* ----------------------------------------------------------------- */}
            {activeTab === 'PIN' && (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-3">
                  Tap or type your 4-digit security PIN to log in
                </div>

                {/* Operator handle (optional for quick-PIN when multiple cashiers share terminal) */}
                <div className="mb-3 text-left">
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Operator Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. kola or leave blank for auto-detect"
                    disabled={lockoutSeconds > 0 || isLoading}
                    className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Masked PIN Display Circles */}
                <div className="flex items-center justify-center space-x-3.5 my-4 py-2 bg-slate-800/40 rounded-2xl border border-slate-800">
                  {[0, 1, 2, 3].map((index) => {
                    const filled = pinDigits.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                          filled 
                            ? 'bg-emerald-400 scale-125 shadow-md shadow-emerald-500/50' 
                            : 'border-2 border-slate-700 bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Touchscreen Numpad Keys */}
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto mt-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'].map((btn) => {
                    if (btn === 'CLEAR') {
                      return (
                        <button
                          key={btn}
                          type="button"
                          disabled={lockoutSeconds > 0 || isLoading}
                          onClick={() => handleNumpadPress('CLEAR')}
                          className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                        >
                          Clear
                        </button>
                      );
                    }
                    if (btn === 'BACK') {
                      return (
                        <button
                          key={btn}
                          type="button"
                          disabled={lockoutSeconds > 0 || isLoading}
                          onClick={() => handleNumpadPress('BACK')}
                          className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                          title="Backspace"
                        >
                          <Delete className="w-5 h-5" />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={btn}
                        type="button"
                        disabled={lockoutSeconds > 0 || isLoading}
                        onClick={() => handleNumpadPress(btn)}
                        className="h-12 rounded-xl bg-slate-800/90 hover:bg-emerald-600 hover:text-white border border-slate-700/70 text-white font-extrabold text-lg shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                      >
                        {btn}
                      </button>
                    );
                  })}
                </div>

                {/* Sign-in Action Button */}
                <button
                  type="button"
                  disabled={lockoutSeconds > 0 || isLoading || pinDigits.length === 0}
                  onClick={() => handlePinSubmit()}
                  className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <span>Sign In to Register</span>
                  )}
                </button>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* TAB CONTENT: MANAGER / ADMIN ALPHANUMERIC SIGN-IN */}
            {/* ----------------------------------------------------------------- */}
            {activeTab === 'CREDENTIALS' && (
              <form onSubmit={handleCredentialsSubmit} className="mt-4 space-y-4 text-left">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username, Staff ID, or Email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin or staff ID"
                      autoFocus
                      disabled={lockoutSeconds > 0 || isLoading}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all disabled:opacity-50"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Password Input with Show/Hide Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Security Password or Master PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={lockoutSeconds > 0 || isLoading}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all pr-11 font-mono disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Help Prompt */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Remember operator handle</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowHelpNotice(true)}
                    className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline cursor-pointer"
                  >
                    Forgot credentials?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={lockoutSeconds > 0 || isLoading}
                  className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Sign In to System</span>
                  )}
                </button>
              </form>
            )}

            {/* Footer Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{storeName} © 2026</span>
              <button
                type="button"
                onClick={() => setShowHelpNotice(true)}
                className="hover:text-slate-400 transition-colors cursor-pointer"
              >
                Help & Security
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
