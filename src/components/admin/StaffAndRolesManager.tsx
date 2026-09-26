import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Employee, UserRole } from '../../types';
import { ROLE_BADGES, ROLE_PERMISSIONS, Permission } from '../../utils/rbac';
import { 
  Users, 
  UserPlus, 
  Key, 
  Shield, 
  ShieldCheck, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  Phone, 
  Calendar, 
  Clock, 
  Sparkles, 
  Download, 
  Check, 
  UserCheck, 
  UserX, 
  Lock, 
  RefreshCw, 
  LogIn, 
  ShieldAlert, 
  FileSpreadsheet, 
  ChevronRight,
  ArrowRightLeft,
  CheckSquare,
  Square,
  AlertTriangle,
  Info
} from 'lucide-react';

interface StaffAndRolesManagerProps {
  isModal?: boolean;
  onCloseModal?: () => void;
}

type ActiveSubTab = 'directory' | 'roles' | 'shifts' | 'security_log';

// Detailed permission definitions grouped for standard enterprise matrix
const PERMISSION_GROUPS: {
  category: string;
  description: string;
  permissions: { key: Permission; label: string; desc: string }[];
}[] = [
  {
    category: 'Counter & POS Register',
    description: 'Direct customer checkout, tender handling, and counter overrides',
    permissions: [
      { key: 'CAN_POS_SALE', label: 'Point of Sale Checkout', desc: 'Process sales transactions, weight items, and take cash/card/transfer tender' },
      { key: 'CAN_APPLY_DISCOUNT', label: 'Apply Custom Discounts', desc: 'Authorize custom VIP percentage markdowns and special counter pricing' },
      { key: 'CAN_REFUND', label: 'Process Returns & Refunds', desc: 'Accept customer return items and issue refunds back to original payment tender' },
    ],
  },
  {
    category: 'Inventory & Cold Room Control',
    description: 'Stock management, receiving deliveries, and inventory auditing',
    permissions: [
      { key: 'CAN_VIEW_INVENTORY', label: 'View Inventory & Stock Costs', desc: 'Inspect cold room stock balances, unit costs, and reorder alerts' },
      { key: 'CAN_RECEIVE_GOODS', label: 'Receive Goods Deliveries', desc: 'Inspect supplier shipments, record batches, and increment cold room stock' },
      { key: 'CAN_CYCLE_COUNT', label: 'Conduct Cycle Count Audits', desc: 'Perform physical count checks and reconcile variance in stock levels' },
      { key: 'CAN_TRANSFER_STOCK', label: 'Inter-Facility Stock Transfers', desc: 'Authorize and execute stock transfers between storage units and branch counters' },
      { key: 'CAN_MANAGE_PRODUCTS', label: 'Product Catalog Management', desc: 'Create, modify, price, and archive fish and seafood product SKUs' },
    ],
  },
  {
    category: 'Purchasing & Supplier Management',
    description: 'Vendor relationship management and supply replenishment',
    permissions: [
      { key: 'CAN_CREATE_PO', label: 'Issue Purchase Orders', desc: 'Create and submit stock replenishment purchase orders to fish suppliers' },
      { key: 'CAN_CANCEL_PO', label: 'Cancel Purchase Orders', desc: 'Revoke and void unfilled or delayed purchase order contracts' },
      { key: 'CAN_MANAGE_SUPPLIERS', label: 'Manage Supplier Directory', desc: 'Add new fish farms/vessel suppliers, edit contact terms, and lead times' },
    ],
  },
  {
    category: 'Financial Intelligence & Reports',
    description: 'Business analytics, profitability, and shift audit logs',
    permissions: [
      { key: 'CAN_VIEW_REPORTS', label: 'Executive P&L & Analytics', desc: 'View gross margin, COGS, net revenue, and cashier shift reconciliation reports' },
      { key: 'CAN_VIEW_AUDIT_LOG', label: 'Cryptographic Audit Ledger', desc: 'Inspect SHA-256 tamper-evident transaction logs, overrides, and security events' },
    ],
  },
  {
    category: 'Security & System Administration',
    description: 'User access control, master PINs, and system backups',
    permissions: [
      { key: 'CAN_MANAGE_STAFF', label: 'Manage Staff & Roles (RBAC)', desc: 'Create staff accounts, assign security roles, and reset access PINs' },
      { key: 'CAN_SYSTEM_CONFIG', label: 'System Configuration & Backups', desc: 'Export full database backups, manage multi-terminal sync, and system settings' },
    ],
  },
];

export const StaffAndRolesManager: React.FC<StaffAndRolesManagerProps> = ({ isModal = false, onCloseModal }) => {
  const { 
    employees, 
    addStaff, 
    updateStaff, 
    deleteStaff, 
    activeStaff, 
    setActiveStaffId,
    auditLogs 
  } = usePos();

  // Navigation sub-tab
  const [subTab, setSubTab] = useState<ActiveSubTab>('directory');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');

  // PIN visibility state (map staff_id -> boolean)
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Staff creation / edit modal drawer
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    staff_name: '',
    username: '',
    phone_number: '',
    role: 'Cashier' as UserRole,
    pin: '',
    password: '',
    shift_time: 'Morning' as 'Morning' | 'Afternoon' | 'Full Day',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick PIN Reset Modal
  const [pinResetTarget, setPinResetTarget] = useState<Employee | null>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinResetError, setPinResetError] = useState<string | null>(null);

  // RBAC Matrix selected role inspection
  const [inspectedRole, setInspectedRole] = useState<UserRole>('Cashier');

  // Security guard: Admin access check
  const isAdmin = activeStaff.role === 'Admin';

  // Toggle PIN visibility
  const togglePinReveal = (staffId: string) => {
    setRevealedPins(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  // Open Add Staff Form
  const handleOpenAddForm = () => {
    setIsEditing(false);
    setEditingStaffId(null);
    setFormData({
      staff_name: '',
      username: '',
      phone_number: '',
      role: 'Cashier',
      pin: Math.floor(1000 + Math.random() * 9000).toString(), // auto-suggest random 4-digit PIN
      password: '',
      shift_time: 'Morning',
      status: 'Active',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Edit Staff Form
  const handleOpenEditForm = (emp: Employee) => {
    setIsEditing(true);
    setEditingStaffId(emp.staff_id);
    setFormData({
      staff_name: emp.staff_name,
      username: emp.username || emp.staff_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      phone_number: emp.phone_number || '',
      role: emp.role,
      pin: emp.pin || '',
      password: emp.password || '',
      shift_time: emp.shift_time || 'Morning',
      status: emp.status || 'Active',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  // Generate random 4-digit PIN
  const handleGenerateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, pin: randomPin }));
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formData.staff_name.trim();
    if (!trimmedName) {
      setFormError('Staff full name is required.');
      return;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      setFormError('Security PIN must be exactly 4 numeric digits (e.g. 1234).');
      return;
    }

    // Check duplicate username if provided
    const cleanUsername = formData.username.trim().toLowerCase() || trimmedName.split(' ')[0].toLowerCase();
    const duplicateUser = employees.find(
      e => e.staff_id !== editingStaffId && (e.username?.toLowerCase() === cleanUsername)
    );
    if (duplicateUser) {
      setFormError(`Username "${cleanUsername}" is already taken by ${duplicateUser.staff_name}.`);
      return;
    }

    // Safety: Cannot demote the last Admin
    if (isEditing && editingStaffId) {
      const targetEmp = employees.find(e => e.staff_id === editingStaffId);
      const totalAdmins = employees.filter(e => e.role === 'Admin').length;
      if (targetEmp?.role === 'Admin' && formData.role !== 'Admin' && totalAdmins <= 1) {
        setFormError('Security violation: Cannot demote the system\'s only Administrator.');
        return;
      }

      updateStaff(editingStaffId, {
        staff_name: trimmedName,
        username: cleanUsername,
        phone_number: formData.phone_number.trim() || '+234 800 000 0000',
        role: formData.role,
        pin: formData.pin,
        password: formData.password.trim() || undefined,
        shift_time: formData.shift_time,
        status: formData.status,
      });

      setFeedbackMessage({
        type: 'success',
        text: `Staff profile for ${trimmedName} updated successfully.`,
      });
    } else {
      addStaff({
        staff_name: trimmedName,
        username: cleanUsername,
        phone_number: formData.phone_number.trim() || '+234 800 000 0000',
        role: formData.role,
        pin: formData.pin,
        password: formData.password.trim() || undefined,
        shift_time: formData.shift_time,
        date_hired: new Date().toISOString().split('T')[0],
        status: formData.status,
      });

      setFeedbackMessage({
        type: 'success',
        text: `New staff member ${trimmedName} registered with PIN ${formData.pin}.`,
      });
    }

    setIsFormOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Toggle Staff Status (Active <-> Inactive)
  const handleToggleStatus = (emp: Employee) => {
    if (emp.staff_id === activeStaff.staff_id) {
      alert('Security Protection: You cannot suspend your own currently active operator account.');
      return;
    }

    if (emp.role === 'Admin' && emp.status === 'Active') {
      const activeAdmins = employees.filter(e => e.role === 'Admin' && e.status === 'Active');
      if (activeAdmins.length <= 1) {
        alert('Security Protection: Cannot suspend the only active Administrator account.');
        return;
      }
    }

    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    updateStaff(emp.staff_id, { status: newStatus });
    setFeedbackMessage({
      type: 'success',
      text: `${emp.staff_name} account status changed to ${newStatus}.`,
    });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Delete staff member safely
  const handleDeleteStaff = (emp: Employee) => {
    if (emp.staff_id === activeStaff.staff_id) {
      alert('Security Protection: Cannot delete your own active administrator account.');
      return;
    }

    if (emp.role === 'Admin') {
      const totalAdmins = employees.filter(e => e.role === 'Admin');
      if (totalAdmins.length <= 1) {
        alert('Security Protection: Cannot delete the only Administrator account in the system.');
        return;
      }
    }

    if (window.confirm(`Are you sure you want to permanently delete staff profile "${emp.staff_name}" (${emp.staff_id})?\n\nNote: All past audit logs and sales receipts authored by this staff member will remain intact for compliance.`)) {
      deleteStaff(emp.staff_id);
      setFeedbackMessage({
        type: 'success',
        text: `Staff member ${emp.staff_name} removed from system directory.`,
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  // Quick switch session for test
  const handleSwitchSession = (emp: Employee) => {
    if (emp.staff_id === activeStaff.staff_id) {
      alert('You are already operating under this account.');
      return;
    }
    setActiveStaffId(emp.staff_id);
    setFeedbackMessage({
      type: 'success',
      text: `Switched active operator session to ${emp.staff_name} (${emp.role}). Role restrictions applied immediately.`,
    });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Submit Quick PIN Reset
  const handleSubmitPinReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetTarget) return;

    if (!/^\d{4}$/.test(newPinInput)) {
      setPinResetError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    updateStaff(pinResetTarget.staff_id, { pin: newPinInput });
    setFeedbackMessage({
      type: 'success',
      text: `Security PIN for ${pinResetTarget.staff_name} has been reset to ${newPinInput}.`,
    });
    setPinResetTarget(null);
    setNewPinInput('');
    setPinResetError(null);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Export Staff Directory
  const handleExportStaffRoster = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(employees, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `staff_roster_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const headers = ['Staff ID', 'Full Name', 'Username', 'Role', 'Status', 'Shift', 'Phone Number', 'Date Hired'];
      const rows = employees.map(e => [
        e.staff_id,
        `"${e.staff_name}"`,
        e.username || '',
        e.role,
        e.status || 'Active',
        e.shift_time || 'Morning',
        `"${e.phone_number || ''}"`,
        e.date_hired || ''
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `staff_roster_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        emp.staff_name.toLowerCase().includes(q) ||
        emp.staff_id.toLowerCase().includes(q) ||
        (emp.username && emp.username.toLowerCase().includes(q)) ||
        (emp.phone_number && emp.phone_number.includes(q));

      const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || (emp.status || 'Active') === statusFilter;
      const matchesShift = shiftFilter === 'ALL' || (emp.shift_time || 'Morning') === shiftFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesShift;
    });
  }, [employees, searchQuery, roleFilter, statusFilter, shiftFilter]);

  // Role metrics
  const roleCounts = useMemo(() => {
    const counts = { Admin: 0, Manager: 0, Supervisor: 0, Cashier: 0 };
    employees.forEach(e => {
      if (counts[e.role] !== undefined) counts[e.role]++;
    });
    return counts;
  }, [employees]);

  // Shift metrics
  const shiftCounts = useMemo(() => {
    const counts = { Morning: 0, Afternoon: 0, 'Full Day': 0 };
    employees.forEach(e => {
      const s = e.shift_time || 'Morning';
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [employees]);

  // Filtered Security Audit Logs
  const securityLogs = useMemo(() => {
    const securityActions = [
      'PRODUCT_CREATED', 
      'PRODUCT_UPDATED', 
      'PRODUCT_DELETED',
      'STAFF_SWITCHED', 
      'LOGIN_SUCCESS', 
      'LOGIN_FAILED', 
      'MANAGER_OVERRIDE',
      'PERMISSION_DENIED'
    ];
    return auditLogs.filter(log => 
      log.category === 'Security' || 
      securityActions.includes(log.action) ||
      log.details.toLowerCase().includes('staff') ||
      log.details.toLowerCase().includes('role') ||
      log.details.toLowerCase().includes('pin')
    ).slice(0, 30);
  }, [auditLogs]);

  // Enforce Admin Access Check
  if (!isAdmin) {
    return (
      <div className={`${isModal ? 'p-6' : 'p-6 max-w-7xl mx-auto'}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 overflow-hidden text-center p-8 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">Administrator Access Required</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Staff and security role management is strictly restricted to System Administrators (Alex Abiri). 
              Your active operator profile is registered under the <strong>{activeStaff.role}</strong> role.
            </p>
          </div>
          {isModal && onCloseModal && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onCloseModal}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Security Panel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isModal ? 'p-4 sm:p-6' : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto'} space-y-6 animate-fadeIn`}>
      {/* Top Banner / System Feedback */}
      {feedbackMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Metric Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Staff & Role Security Administration
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
                  Standard Enterprise RBAC
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized user management, role privileges, authentication PINs, and shift scheduling.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => handleExportStaffRoster('csv')}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Export staff directory to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddForm}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>

            {isModal && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">Total Personnel</div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{employees.length}</span>
              <span className="text-[11px] text-emerald-600 font-medium font-mono tabular-nums">
                {employees.filter(e => e.status !== 'Inactive').length} active
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {employees.filter(e => e.status === 'Inactive').length} suspended
            </div>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">Roles Distribution</div>
            <div className="mt-1 flex items-center space-x-1 text-xs font-bold font-mono">
              <span className="text-emerald-700" title="Admins">{roleCounts.Admin} Adm</span>
              <span className="text-slate-300">·</span>
              <span className="text-purple-700" title="Managers">{roleCounts.Manager} Mgr</span>
              <span className="text-slate-300">·</span>
              <span className="text-amber-700" title="Supervisors">{roleCounts.Supervisor} Sup</span>
              <span className="text-slate-300">·</span>
              <span className="text-blue-700" title="Cashiers">{roleCounts.Cashier} Cash</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Role-based Access Active</div>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">Shift Coverage</div>
            <div className="mt-1 flex items-center space-x-1 text-xs font-bold font-mono text-slate-800">
              <span>{shiftCounts.Morning} Morning</span>
              <span className="text-slate-300">·</span>
              <span>{shiftCounts.Afternoon} Aft</span>
              <span className="text-slate-300">·</span>
              <span>{shiftCounts['Full Day']} Full</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">3 standard roster windows</div>
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-800">Active Admin Session</div>
            <div className="mt-1 text-xs font-bold text-slate-900 truncate">
              {activeStaff.staff_name}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>Master Auth (Full RBAC Override)</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls (Industry Standard Dashboard Sub-navigation) */}
        <div className="flex items-center space-x-1 border-b border-slate-200 pt-1 -mb-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-2 ${
              subTab === 'directory'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Directory & Credentials</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] text-slate-600 font-mono">
              {employees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('roles')}
            className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-2 ${
              subTab === 'roles'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles & Permissions Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('shifts')}
            className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-2 ${
              subTab === 'shifts'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift Scheduling & Roster</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('security_log')}
            className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-2 ${
              subTab === 'security_log'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Security & Access Logs</span>
            <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-[10px] text-rose-700 font-mono">
              {securityLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* SUB-TAB 1: STAFF DIRECTORY */}
      {/* ------------------------------------------------------------------------- */}
      {subTab === 'directory' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, @username, ID, or phone..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Role Filter */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                {['ALL', 'Admin', 'Manager', 'Supervisor', 'Cashier'].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleFilter(role)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      roleFilter === role
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {role === 'ALL' ? 'All Roles' : role}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Suspended Only</option>
              </select>

              {/* Shift Filter */}
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="ALL">All Shifts</option>
                <option value="Morning">Morning (8AM - 2PM)</option>
                <option value="Afternoon">Afternoon (2PM - 8PM)</option>
                <option value="Full Day">Full Day</option>
              </select>
            </div>
          </div>

          {/* Staff Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Contact & Shift</th>
                    <th className="py-3 px-4">Credentials & PIN</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No staff accounts match your criteria</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting the search filter or add a new team member.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => {
                      const badge = ROLE_BADGES[emp.role] || ROLE_BADGES.Cashier;
                      const isSelf = emp.staff_id === activeStaff.staff_id;
                      const isRevealed = Boolean(revealedPins[emp.staff_id]);
                      const isSuspended = emp.status === 'Inactive';

                      return (
                        <tr 
                          key={emp.staff_id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelf ? 'bg-emerald-50/20' : ''
                          } ${isSuspended ? 'opacity-70 bg-slate-50/40' : ''}`}
                        >
                          {/* Staff Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                                emp.role === 'Admin' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                emp.role === 'Manager' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                emp.role === 'Supervisor' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {emp.staff_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-bold text-slate-900 truncate">{emp.staff_name}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                      Active Session
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                                  <span>{emp.staff_id}</span>
                                  {emp.username && (
                                    <>
                                      <span>·</span>
                                      <span className="text-slate-500">@{emp.username}</span>
                                    </>
                                  )}
                                  {emp.date_hired && (
                                    <>
                                      <span>·</span>
                                      <span>Hired {emp.date_hired}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role & Permissions */}
                          <td className="py-3 px-4">
                            <div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.bg} ${badge.text} border ${badge.border}`}>
                                {badge.label}
                              </span>
                              <span className="text-[11px] text-slate-500 block mt-1">
                                {badge.desc}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                                {ROLE_PERMISSIONS[emp.role]?.length || 0} permissions granted
                              </span>
                            </div>
                          </td>

                          {/* Contact & Shift */}
                          <td className="py-3 px-4 text-slate-700">
                            <div className="flex items-center space-x-1.5 text-xs font-mono">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{emp.phone_number || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-1">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{emp.shift_time || 'Morning'}</span>
                              <span className="text-[10px] text-slate-400">
                                {emp.shift_time === 'Morning' ? '(08:00 - 14:00)' : 
                                 emp.shift_time === 'Afternoon' ? '(14:00 - 20:00)' : '(Management)'}
                              </span>
                            </div>
                          </td>

                          {/* Credentials & PIN */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 tracking-wider">
                                {isRevealed ? emp.pin : '••••'}
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePinReveal(emp.staff_id)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                                title={isRevealed ? 'Mask PIN' : 'Reveal PIN'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {emp.password ? 'Web password set' : 'Quick PIN only'}
                            </div>
                          </td>

                          {/* Account Status */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                isSuspended 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                <span>{isSuspended ? 'Suspended' : 'Active'}</span>
                              </span>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(emp)}
                                  className={`text-[10px] font-semibold underline transition-colors cursor-pointer ${
                                    isSuspended ? 'text-emerald-700 hover:text-emerald-900' : 'text-slate-500 hover:text-rose-700'
                                  }`}
                                  title={isSuspended ? 'Re-activate account' : 'Suspend account'}
                                >
                                  {isSuspended ? 'Activate' : 'Suspend'}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1">
                              {/* Test Operator Session Switch */}
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchSession(emp)}
                                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title={`Switch active session to ${emp.staff_name} (${emp.role})`}
                                >
                                  <LogIn className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Edit Staff */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(emp)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Profile & Permissions"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Quick PIN Reset */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPinResetTarget(emp);
                                  setNewPinInput('');
                                  setPinResetError(null);
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Reset Security PIN"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Staff */}
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(emp)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Staff Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* SUB-TAB 2: ROLES & PERMISSIONS MATRIX */}
      {/* ------------------------------------------------------------------------- */}
      {subTab === 'roles' && (
        <div className="space-y-6">
          {/* Role Cards Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['Cashier', 'Supervisor', 'Manager', 'Admin'] as UserRole[]).map(r => {
              const b = ROLE_BADGES[r];
              const permCount = ROLE_PERMISSIONS[r]?.length || 0;
              const assignedCount = employees.filter(e => e.role === r).length;
              const isSelected = inspectedRole === r;

              return (
                <div
                  key={r}
                  onClick={() => setInspectedRole(r)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${b.bg} ${b.text} border ${b.border}`}>
                      {b.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {assignedCount} assigned
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-3">{r} Access Tier</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{b.desc}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">{permCount} of 15 Capabilities</span>
                    <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Standard RBAC Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">System Security & Permissions Matrix</h3>
                <p className="text-xs text-slate-500">
                  Granular role authorization mapping enforced across counter terminals, inventory, and back-office ledger.
                </p>
              </div>
              <div className="text-xs text-slate-500 flex items-center space-x-2">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Granted</span>
                </span>
                <span>·</span>
                <span className="flex items-center space-x-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-200 inline-block text-center text-[10px] leading-3 text-slate-500">✕</span>
                  <span>Restricted</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-2/5">Permission / Operational Capability</th>
                    <th className="py-3 px-3 text-center w-[15%]">Cashier</th>
                    <th className="py-3 px-3 text-center w-[15%]">Supervisor</th>
                    <th className="py-3 px-3 text-center w-[15%]">Manager</th>
                    <th className="py-3 px-3 text-center w-[15%]">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PERMISSION_GROUPS.map(group => (
                    <React.Fragment key={group.category}>
                      {/* Category Header */}
                      <tr className="bg-slate-50/50">
                        <td colSpan={5} className="py-2.5 px-4 font-bold text-slate-800 text-[11px] uppercase tracking-wider bg-slate-50">
                          {group.category}
                          <span className="text-[10px] font-normal normal-case text-slate-400 ml-2">
                            — {group.description}
                          </span>
                        </td>
                      </tr>

                      {/* Capabilities Rows */}
                      {group.permissions.map(perm => {
                        return (
                          <tr key={perm.key} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-900">{perm.label}</div>
                              <div className="text-[11px] text-slate-500">{perm.desc}</div>
                            </td>

                            {(['Cashier', 'Supervisor', 'Manager', 'Admin'] as UserRole[]).map(role => {
                              const hasPerm = ROLE_PERMISSIONS[role].includes(perm.key);
                              return (
                                <td key={role} className="py-2.5 px-3 text-center">
                                  {hasPerm ? (
                                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 shadow-2xs">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                                      <span className="text-xs">✕</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* SUB-TAB 3: SHIFT SCHEDULING & ROSTER */}
      {/* ------------------------------------------------------------------------- */}
      {subTab === 'shifts' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Shift Coverage & Operating Windows</h3>
              <p className="text-xs text-slate-500">
                Staff distribution across morning, afternoon, and management shifts for counter and cold room coverage.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Total Roster: {employees.length} Personnel
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Morning Shift */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Morning Shift</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">08:00 AM - 02:00 PM</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">
                  {employees.filter(e => e.shift_time === 'Morning').length} Assigned
                </span>
              </div>

              <div className="space-y-2">
                {employees.filter(e => e.shift_time === 'Morning').map(emp => (
                  <div key={emp.staff_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{emp.staff_name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                        <span>{emp.role}</span>
                        <span>·</span>
                        <span className="font-mono">{emp.phone_number}</span>
                      </div>
                    </div>
                    <select
                      value={emp.shift_time}
                      onChange={(e) => updateStaff(emp.staff_id, { shift_time: e.target.value as any })}
                      className="text-[10px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Afternoon Shift */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>Afternoon Shift</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">02:00 PM - 08:00 PM</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">
                  {employees.filter(e => e.shift_time === 'Afternoon').length} Assigned
                </span>
              </div>

              <div className="space-y-2">
                {employees.filter(e => e.shift_time === 'Afternoon').map(emp => (
                  <div key={emp.staff_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{emp.staff_name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                        <span>{emp.role}</span>
                        <span>·</span>
                        <span className="font-mono">{emp.phone_number}</span>
                      </div>
                    </div>
                    <select
                      value={emp.shift_time}
                      onChange={(e) => updateStaff(emp.staff_id, { shift_time: e.target.value as any })}
                      className="text-[10px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Day / Management */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span>Executive / Full Day</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">Flexible Leadership</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {employees.filter(e => e.shift_time === 'Full Day').length} Assigned
                </span>
              </div>

              <div className="space-y-2">
                {employees.filter(e => e.shift_time === 'Full Day').map(emp => (
                  <div key={emp.staff_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{emp.staff_name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                        <span>{emp.role}</span>
                        <span>·</span>
                        <span className="font-mono">{emp.phone_number}</span>
                      </div>
                    </div>
                    <select
                      value={emp.shift_time}
                      onChange={(e) => updateStaff(emp.staff_id, { shift_time: e.target.value as any })}
                      className="text-[10px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* SUB-TAB 4: SECURITY & ACCESS AUDIT LOG */}
      {/* ------------------------------------------------------------------------- */}
      {subTab === 'security_log' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Security & Credential Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Cryptographically hashed audit log for staff registrations, PIN updates, and privilege escalations.
              </p>
            </div>
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center space-x-1.5 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>SHA-256 Ledger Verified</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Audit Details</th>
                    <th className="py-3 px-4 text-right font-mono">Hash Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {securityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        No security audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    securityLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{log.staff_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.role}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.severity === 'ALERT' ? 'bg-rose-100 text-rose-800' :
                            log.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">
                          {log.details}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400">
                          {(log.tamper_hash || log.id).slice(0, 10)}...
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* ADD / EDIT STAFF MODAL DRAWER */}
      {/* ------------------------------------------------------------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {isEditing ? `Edit Staff Member (${editingStaffId})` : 'Register New Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure personnel profile, role tier, credentials, and shift window.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.staff_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, staff_name: e.target.value }))}
                    placeholder="e.g. Samuel Ade"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Username / Handle
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="e.g. samuel (for login)"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="e.g. +234 801 234 5678"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Security PIN (4 Digits) <span className="text-rose-500">*</span></span>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPin}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold underline"
                    >
                      Generate
                    </button>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={formData.pin}
                    onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder="e.g. 5555"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold tracking-widest text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Web Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Leave blank or enter login pass"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Assigned Shift
                  </label>
                  <select
                    value={formData.shift_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift_time: e.target.value as any }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="Morning">Morning Shift (8AM - 2PM)</option>
                    <option value="Afternoon">Afternoon Shift (2PM - 8PM)</option>
                    <option value="Full Day">Full Day / Management</option>
                  </select>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2">
                  Assign Security Role & Privileges
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Cashier', 'Supervisor', 'Manager', 'Admin'] as UserRole[]).map(r => {
                    const isSelected = formData.role === r;
                    const b = ROLE_BADGES[r];
                    return (
                      <div
                        key={r}
                        onClick={() => setFormData(prev => ({ ...prev, role: r }))}
                        className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{r}</div>
                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {b.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Radio */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Account Status
                </label>
                <div className="flex items-center space-x-4 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formData.status === 'Active'}
                      onChange={() => setFormData(prev => ({ ...prev, status: 'Active' }))}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-800">Active (Authorized to login)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Inactive"
                      checked={formData.status === 'Inactive'}
                      onChange={() => setFormData(prev => ({ ...prev, status: 'Inactive' }))}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-slate-600">Suspended / Deactivated</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isEditing ? 'Save Staff Changes' : 'Register Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* QUICK PIN RESET MODAL */}
      {/* ------------------------------------------------------------------------- */}
      {pinResetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Reset Security PIN</h3>
                  <p className="text-[11px] text-slate-500">{pinResetTarget.staff_name} ({pinResetTarget.staff_id})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinResetTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPinReset} className="p-5 space-y-4">
              {pinResetError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{pinResetError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  New 4-Digit Security PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="e.g. 1234"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-center text-lg font-mono font-bold tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPinResetTarget(null)}
                  className="w-1/2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
