import React from 'react';
import { usePos } from '../../context/PosContext';
import { UserRole } from '../../types';
import { ROLE_BADGES } from '../../utils/rbac';
import { ShieldAlert, Lock, ArrowLeft, KeyRound, CheckCircle2, XCircle } from 'lucide-react';

interface RoleRestrictedCardProps {
  moduleName: string;
  minRoleRequired: UserRole | 'Manager or Admin' | 'Supervisor, Manager or Admin';
  description?: string;
  onBackToPos?: () => void;
}

export const RoleRestrictedCard: React.FC<RoleRestrictedCardProps> = ({
  moduleName,
  minRoleRequired,
  description,
  onBackToPos,
}) => {
  const { activeStaff, openLoginModal } = usePos();
  const currentBadge = ROLE_BADGES[activeStaff.role];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white p-6 sm:p-8 flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Security Gate</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Access Restricted
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {moduleName} is Restricted
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Your active staff account does not have sufficient role privileges to view or execute operations in this section.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Identity vs Requirement Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Your Logged-in Identity
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{activeStaff.staff_name}</h4>
                  <span className="text-xs text-slate-500 font-mono">{activeStaff.staff_id}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}>
                  {currentBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Scope: <span className="font-semibold">{currentBadge.desc}</span>
              </p>
            </div>

            <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                Minimum Privilege Required
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-rose-950 text-base">{minRoleRequired}</h4>
                  <span className="text-xs text-rose-700">Access Control Level</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-rose-200/70 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-rose-800 mt-2">
                {description || `Only staff members with the ${minRoleRequired} role can execute actions in this module.`}
              </p>
            </div>
          </div>

          {/* Quick Guidance on Role Permissions */}
          <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 text-xs space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              How to Proceed:
            </h5>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Switch Staff Account:</strong> If a Supervisor, Manager, or Admin is available, click <em>Authenticate as Different Role</em> below to log into an authorized account.
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Supervisor PIN Override:</strong> Individual sensitive operations (such as manual cycle counts or receiving overrides; customer refunds strictly require Manager/Admin) can also be authorized on-the-fly without switching accounts.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {onBackToPos && (
              <button
                type="button"
                onClick={onBackToPos}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to POS Terminal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openLoginModal('SWITCH')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Authenticate as Different Role (Switch Operator)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
