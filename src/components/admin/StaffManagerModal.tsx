import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Employee, UserRole } from '../../types';
import { ROLE_BADGES } from '../../utils/rbac';
import { Users, UserPlus, Key, Shield, X, AlertCircle, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

interface StaffManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffManagerModal: React.FC<StaffManagerModalProps> = ({ isOpen, onClose }) => {
  const { employees, addStaff, updateStaff, deleteStaff, activeStaff } = usePos();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form fields
  const [staffName, setStaffName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRole>('Cashier');
  const [pin, setPin] = useState('');
  const [shiftTime, setShiftTime] = useState<'Morning' | 'Afternoon' | 'Full Day'>('Morning');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Enforce Admin role restriction
  if (activeStaff.role !== 'Admin') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden text-center p-6 space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Administrator Access Required</h3>
            <p className="text-xs text-slate-600 mt-1">
              Staff and security role management is strictly restricted to System Administrators (Alex Abiri). Your current role is <strong>{activeStaff.role}</strong>.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setIsEditing(false);
    setEditingStaffId(null);
    setStaffName('');
    setPhoneNumber('');
    setRole('Cashier');
    setPin('');
    setShiftTime('Morning');
    setError(null);
  };

  const handleStartEdit = (emp: Employee) => {
    setIsEditing(true);
    setEditingStaffId(emp.staff_id);
    setStaffName(emp.staff_name);
    setPhoneNumber(emp.phone_number);
    setRole(emp.role);
    setPin(emp.pin);
    setShiftTime(emp.shift_time);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!staffName.trim()) {
      setError('Staff full name is required.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('Security PIN must be exactly 4 numeric digits (e.g. 1234).');
      return;
    }

    if (isEditing && editingStaffId) {
      updateStaff(editingStaffId, {
        staff_name: staffName.trim(),
        phone_number: phoneNumber.trim(),
        role,
        pin,
        shift_time: shiftTime,
      });
      setSuccess(`Staff ${staffName} updated successfully.`);
      setTimeout(() => resetForm(), 1200);
    } else {
      addStaff({
        staff_name: staffName.trim(),
        phone_number: phoneNumber.trim() || '+234 800 000 0000',
        role,
        pin,
        shift_time: shiftTime,
        date_hired: new Date().toISOString().split('T')[0],
        status: 'Active',
      });
      setSuccess(`New staff member ${staffName} created.`);
      setTimeout(() => resetForm(), 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Staff & Role Security Administration</h3>
              <p className="text-xs text-slate-400">
                Admin Control: Manage Accounts, Security PINs & Role Access
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

        <div className="p-6 space-y-6">
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>{isEditing ? `Edit Staff Member (${editingStaffId})` : 'Register New Staff Member'}</span>
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Samuel Ade"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +234 801 234 5678"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assign Security Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="Cashier">Cashier (POS sales only)</option>
                  <option value="Supervisor">Supervisor (Goods receiving, cycle counts, refunds)</option>
                  <option value="Manager">Manager (Purchase orders, transfers, reports)</option>
                  <option value="Admin">Admin (Complete control)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                  <span>Security PIN</span>
                  <span className="text-[10px] text-slate-400 font-mono">4 Digits</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="e.g. 5555"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold tracking-widest text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned Shift</label>
                <select
                  value={shiftTime}
                  onChange={(e) => setShiftTime(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="Morning">Morning Shift (8AM - 2PM)</option>
                  <option value="Afternoon">Afternoon Shift (2PM - 8PM)</option>
                  <option value="Full Day">Full Day</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                >
                  {isEditing ? 'Save Changes' : 'Register Staff Account'}
                </button>
              </div>
            </div>
          </form>

          {/* Staff Directory Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Active Staff Accounts ({employees.length})
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Role & Permissions</th>
                    <th className="py-2.5 px-4">Phone / Shift</th>
                    <th className="py-2.5 px-4">PIN Code</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => {
                    const badge = ROLE_BADGES[emp.role] || ROLE_BADGES.Cashier;
                    const isSelf = emp.staff_id === activeStaff.staff_id;
                    return (
                      <tr key={emp.staff_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{emp.staff_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{emp.staff_id} {isSelf && '(Active Session)'}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.bg} ${badge.text} border ${badge.border}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{badge.desc}</span>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <div>{emp.phone_number}</div>
                          <div className="text-[10px] text-slate-400">{emp.shift_time}</div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          •••• <span className="text-[10px] text-slate-400 font-normal">({emp.pin})</span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(emp)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Role or PIN"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to deactivate ${emp.staff_name}?`)) {
                                  deleteStaff(emp.staff_id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete staff member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
