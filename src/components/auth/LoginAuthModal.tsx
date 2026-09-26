import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { Employee } from '../../types';
import { X, AlertCircle, Eye, EyeOff, Info, Check } from 'lucide-react';

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
    login, 
    isAuthenticated,
  } = usePos();

  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showForgotNotice, setShowForgotNotice] = useState<boolean>(false);
  const [showQuickRoles, setShowQuickRoles] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setShowForgotNotice(false);

      const savedUser = localStorage.getItem('kiidfromdream_saved_username');
      if (savedUser) {
        setUsername(savedUser);
      } else if (!username) {
        setUsername('admin');
        setPassword('admin123');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError('Please enter your username or email.');
      return;
    }

    if (!cleanPass) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    if (rememberMe) {
      localStorage.setItem('kiidfromdream_saved_username', cleanUser);
    } else {
      localStorage.removeItem('kiidfromdream_saved_username');
    }

    const res = login(cleanUser, cleanPass);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Invalid credentials. Please verify your username and password.');
    } else {
      setError(null);
      if (onClose) onClose();
    }
  };

  const handleQuickSelectRole = (emp: Employee) => {
    setUsername(emp.username || emp.staff_id);
    setPassword(emp.password || emp.pin);
    setError(null);
    setShowQuickRoles(false);
  };

  const isStandalone = !isAuthenticated || mode === 'LOGIN';

  return (
    <div 
      className={
        isStandalone 
          ? "min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white"
          : "fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 min-h-screen selection:bg-blue-500 selection:text-white"
      }
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-[440px] p-8 sm:p-10 text-center relative animate-fadeIn">
        
        {/* Dismiss button if already authenticated and just switching / unlocking */}
        {isAuthenticated && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cancel and return to system"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* KFD Royal Blue Square Logo */}
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/30 mx-auto select-none tracking-wide">
          KFD
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight mt-5">
          Welcome Back
        </h1>
        <p className="text-sm text-slate-500 font-normal mt-2 mb-6">
          Please sign in to access your POS and inventory dashboard
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Forgot Password Helper Notice */}
        {showForgotNotice && (
          <div className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs text-left animate-fadeIn space-y-1">
            <div className="font-bold flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Default Access Credentials</span>
              </span>
              <button 
                type="button" 
                onClick={() => setShowForgotNotice(false)} 
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-blue-800">
              Admin: <strong>admin</strong> | Password: <strong>admin123</strong>
            </p>
            <p className="text-[11px] text-blue-800">
              Cashier: <strong>kola</strong> | Password: <strong>1111</strong>
            </p>
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('admin123');
                setShowForgotNotice(false);
              }}
              className="text-[11px] font-bold text-blue-700 hover:underline pt-0.5 block"
            >
              Fill Admin Credentials Now →
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Username or Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-11 shadow-2xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me & Forgot password? */}
          <div className="flex items-center justify-between text-sm pt-1">
            <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-normal text-slate-600">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotNotice(true)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base rounded-xl transition-all shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 cursor-pointer disabled:opacity-70 flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
          </button>
        </form>

        {/* Footer Copyright */}
        <div className="mt-8 text-xs text-slate-400 font-normal select-none">
          Kiidfromdreams POS Terminal Access © 2026
        </div>

        {/* Quick Demo Operator Roles (Subtle Expandable for Testing) */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowQuickRoles(!showQuickRoles)}
            className="text-[11px] text-slate-400 hover:text-blue-600 font-medium transition-colors"
          >
            {showQuickRoles ? '▲ Hide Quick Demo Operators' : '▼ Quick Demo Roles (Admin, Manager, Cashier)'}
          </button>

          {showQuickRoles && (
            <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-1.5 text-left animate-fadeIn">
              {employees.slice(0, 4).map(emp => (
                <button
                  key={emp.staff_id}
                  type="button"
                  onClick={() => handleQuickSelectRole(emp)}
                  className="p-1.5 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-left transition-colors"
                >
                  <div className="font-bold text-[11px] text-slate-800 truncate">{emp.staff_name}</div>
                  <div className="text-[10px] text-blue-600 font-semibold">{emp.role}</div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
