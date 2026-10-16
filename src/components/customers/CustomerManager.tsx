import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Customer, CustomerType, Employee, CustomerDebtRepayment } from '../../types';
import { 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  X, 
  Check, 
  Sparkles,
  ArrowUpRight,
  Percent,
  Lock,
  Tag,
  ShieldCheck,
  Award,
  CreditCard,
  DollarSign,
  Wallet,
  FileText,
  Printer,
  AlertTriangle,
  CheckCircle2,
  History,
  Banknote,
  Receipt,
  Building2,
  Copy
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';

interface CustomerManagerProps {
  onSelectCustomerForSale?: (customerId: string) => void;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({ onSelectCustomerForSale }) => {
  const { 
    customers, 
    sales, 
    customerDebtRepayments,
    posTerminals,
    addCustomer, 
    updateCustomerDiscount, 
    settleCustomerDebt,
    getNextCustomerId,
    activeStaff,
    hasPermission,
    receiptSettings
  } = usePos();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'sales' | 'debt_history'>('overview');

  // Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    address: '',
    customer_type: 'Retail' as CustomerType,
    notes: '',
    discount_percent: 0,
    discount_notes: '',
  });

  // Discount Edit Modal (Manager & Admin only)
  const [editingDiscountCustomer, setEditingDiscountCustomer] = useState<Customer | null>(null);
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(0);
  const [discountNotesInput, setDiscountNotesInput] = useState<string>('');
  const [discountModalError, setDiscountModalError] = useState<string | null>(null);

  // Settle Debt Modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [repaymentAmountInput, setRepaymentAmountInput] = useState<number>(0);
  const [repaymentMethod, setRepaymentMethod] = useState<'Cash' | 'POS' | 'Bank Transfer'>('Cash');
  const [repaymentNotes, setRepaymentNotes] = useState<string>('');
  const [repaymentReference, setRepaymentReference] = useState<string>('');
  const [selectedPosTerminalId, setSelectedPosTerminalId] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [isSubmittingRepayment, setIsSubmittingRepayment] = useState(false);
  const [completedRepayment, setCompletedRepayment] = useState<CustomerDebtRepayment | null>(null);

  const activePosDevices = useMemo(() => {
    return (posTerminals || []).filter(t => t.type === 'POS_TERMINAL' && t.status === 'Active');
  }, [posTerminals]);

  const activeBankAccounts = useMemo(() => {
    return (posTerminals || []).filter(t => t.type === 'BANK_TRANSFER_ACCOUNT' && t.status === 'Active');
  }, [posTerminals]);

  // Printing Repayment Slip
  const [slipToPrint, setSlipToPrint] = useState<CustomerDebtRepayment | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // PIN Auth for restricted operations
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingCustomerForDiscount, setPendingCustomerForDiscount] = useState<Customer | null>(null);
  const [pinOverrideStaff, setPinOverrideStaff] = useState<Employee | null>(null);

  const canManageDiscounts = hasPermission('CAN_APPLY_DISCOUNT');

  // KPI Calculations
  const debtorCustomers = useMemo(() => {
    return customers.filter(c => (Number(c.balance) || 0) > 0);
  }, [customers]);

  const totalOutstandingDebt = useMemo(() => {
    return debtorCustomers.reduce((sum, c) => sum + (Number(c.balance) || 0), 0);
  }, [debtorCustomers]);

  const totalDebtRecovered = useMemo(() => {
    return customerDebtRepayments.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
  }, [customerDebtRepayments]);

  const handleOpenAdd = () => {
    setFormError(null);
    setFormData({
      full_name: '',
      phone_number: '+234 ',
      email: '',
      address: '',
      customer_type: 'Retail',
      notes: '',
      discount_percent: 0,
      discount_notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate phone uniqueness
    const trimmedPhone = formData.phone_number.trim();
    if (!trimmedPhone || trimmedPhone === '+234') {
      setFormError('Please enter a valid phone number.');
      return;
    }

    const duplicate = customers.find(c => c.phone_number.trim() === trimmedPhone);
    if (duplicate) {
      setFormError(`Phone number is already registered to ${duplicate.full_name} (${duplicate.customer_id}).`);
      return;
    }

    const created = addCustomer({
      ...formData,
      discount_percent: canManageDiscounts ? Number(formData.discount_percent) || 0 : 0,
      discount_notes: canManageDiscounts && formData.discount_percent > 0 
        ? (formData.discount_notes || `Approved by ${activeStaff.staff_name} (${activeStaff.role})`) 
        : '',
    });

    setIsAddModalOpen(false);
    if (onSelectCustomerForSale) {
      onSelectCustomerForSale(created.customer_id);
    }
  };

  const handleInitiateEditDiscount = (customer: Customer) => {
    setDiscountModalError(null);
    if (canManageDiscounts) {
      setPinOverrideStaff(null);
      setEditingDiscountCustomer(customer);
      setDiscountPercentInput(customer.discount_percent || 0);
      setDiscountNotesInput(customer.discount_notes || '');
    } else {
      // Require Manager or Admin PIN
      setPendingCustomerForDiscount(customer);
      setIsPinModalOpen(true);
    }
  };

  const handlePinSuccess = (authorizedStaff: Employee) => {
    setIsPinModalOpen(false);
    setPinOverrideStaff(authorizedStaff);
    if (pendingCustomerForDiscount) {
      setEditingDiscountCustomer(pendingCustomerForDiscount);
      setDiscountPercentInput(pendingCustomerForDiscount.discount_percent || 0);
      setDiscountNotesInput(pendingCustomerForDiscount.discount_notes || '');
      setPendingCustomerForDiscount(null);
    }
  };

  const handleSaveCustomerDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscountCustomer) return;

    if (discountPercentInput < 0 || discountPercentInput > 100) {
      setDiscountModalError('Discount percentage must be between 0% and 100%.');
      return;
    }

    const authName = pinOverrideStaff 
      ? `${pinOverrideStaff.staff_name} (${pinOverrideStaff.role})` 
      : `${activeStaff.staff_name} (${activeStaff.role})`;

    const note = discountNotesInput.trim() 
      ? `${discountNotesInput.trim()} (Approved by ${authName})`
      : `Approved by ${authName}`;

    const res = updateCustomerDiscount(
      editingDiscountCustomer.customer_id,
      discountPercentInput,
      discountPercentInput > 0 ? note : '',
      authName
    );

    if (!res.success) {
      setDiscountModalError(res.error || 'Failed to update customer discount.');
      return;
    }

    // Update drawer if opened on same customer
    if (selectedCustomerForDrawer && selectedCustomerForDrawer.customer_id === editingDiscountCustomer.customer_id) {
      setSelectedCustomerForDrawer({
        ...selectedCustomerForDrawer,
        discount_percent: discountPercentInput,
        discount_notes: discountPercentInput > 0 ? note : '',
      });
    }

    setEditingDiscountCustomer(null);
    setPinOverrideStaff(null);
  };

  // Settle Debt Handlers
  const handleOpenSettleDebt = (customer: Customer) => {
    setSettlingCustomer(customer);
    const balance = Number(customer.balance) || 0;
    setRepaymentAmountInput(balance);
    setRepaymentMethod('Cash');
    setRepaymentNotes('');
    setRepaymentReference('');
    setRepaymentError(null);
    setCompletedRepayment(null);
    const defaultPos = activePosDevices.find(p => p.is_default) || activePosDevices[0];
    if (defaultPos) setSelectedPosTerminalId(defaultPos.id);
    const defaultBank = activeBankAccounts.find(b => b.is_default) || activeBankAccounts[0];
    if (defaultBank) setSelectedBankAccountId(defaultBank.id);
  };

  const handleExecuteSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer || isSubmittingRepayment) return;

    const currentBal = Number(settlingCustomer.balance) || 0;
    if (repaymentAmountInput <= 0) {
      setRepaymentError('Repayment amount must be greater than ₦0.');
      return;
    }

    if (repaymentAmountInput > currentBal) {
      setRepaymentError(`Repayment amount cannot exceed current outstanding debt of ₦${currentBal.toLocaleString()}.`);
      return;
    }

    let pos_terminal_id: string | undefined;
    let pos_terminal_name: string | undefined;
    let bank_account_id: string | undefined;
    let bank_name: string | undefined;
    let bank_account_number: string | undefined;

    if (repaymentMethod === 'POS') {
      const selectedPos = activePosDevices.find(t => t.id === selectedPosTerminalId) || activePosDevices[0];
      if (selectedPos) {
        pos_terminal_id = selectedPos.id;
        pos_terminal_name = `${selectedPos.name} (${selectedPos.provider})`;
        bank_name = selectedPos.bank_name;
        bank_account_number = selectedPos.account_number;
      }
    } else if (repaymentMethod === 'Bank Transfer') {
      const selectedBank = activeBankAccounts.find(b => b.id === selectedBankAccountId) || activeBankAccounts[0];
      if (selectedBank) {
        bank_account_id = selectedBank.id;
        bank_name = selectedBank.bank_name;
        bank_account_number = selectedBank.account_number;
      }
    }

    setIsSubmittingRepayment(true);
    setRepaymentError(null);

    try {
      const res = await settleCustomerDebt({
        customer_id: settlingCustomer.customer_id,
        amount: repaymentAmountInput,
        payment_method: repaymentMethod,
        notes: repaymentNotes.trim() || undefined,
        reference_number: repaymentReference.trim() || undefined,
        pos_terminal_id,
        pos_terminal_name,
        bank_account_id,
        bank_name,
        bank_account_number,
        staff_id: activeStaff.staff_id,
        staff_name: activeStaff.staff_name,
      });

      if (!res.success) {
        setRepaymentError(res.error || 'Failed to record customer debt repayment.');
        return;
      }

      // Update the drawer customer if open
      if (selectedCustomerForDrawer && selectedCustomerForDrawer.customer_id === settlingCustomer.customer_id) {
        setSelectedCustomerForDrawer({
          ...selectedCustomerForDrawer,
          balance: Math.max(0, currentBal - repaymentAmountInput)
        });
      }

      if (res.repayment) {
        setCompletedRepayment(res.repayment);
      } else {
        setSettlingCustomer(null);
      }
    } catch (err: any) {
      setRepaymentError(err.message || 'Error occurred while processing debt settlement.');
    } finally {
      setIsSubmittingRepayment(false);
    }
  };

  const handlePrintSlip = async (repayment: CustomerDebtRepayment) => {
    setSlipToPrint(repayment);
    setIsPrinting(true);
    try {
      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt({ silent: false });
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Native print error, falling back to window.print:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search) ||
        c.customer_id.toLowerCase().includes(search.toLowerCase());
      
      let matchType = true;
      if (selectedType === 'Debtors') {
        matchType = (Number(c.balance) || 0) > 0;
      } else if (selectedType !== 'All') {
        matchType = c.customer_type === selectedType;
      }

      return matchSearch && matchType;
    });
  }, [customers, search, selectedType]);

  // Customer purchase history
  const customerSales = useMemo(() => {
    if (!selectedCustomerForDrawer) return [];
    return sales.filter(s => s.customer_id === selectedCustomerForDrawer.customer_id);
  }, [sales, selectedCustomerForDrawer]);

  // Customer credit sales
  const customerCreditSales = useMemo(() => {
    return customerSales.filter(s => s.payment_method === 'Credit / Pay Later');
  }, [customerSales]);

  // Customer repayment history
  const customerRepayments = useMemo(() => {
    if (!selectedCustomerForDrawer) return [];
    return customerDebtRepayments.filter(r => r.customer_id === selectedCustomerForDrawer.customer_id);
  }, [customerDebtRepayments, selectedCustomerForDrawer]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Customer Directory & Credit Accounts</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
              {customers.length} Registered Buyers
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage buyer profiles, custom negotiated discount rates, credit sales, and debt settlements. All transactions are permanently audited and committed to SQLite WAL.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Customers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Registered Buyers</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{customers.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active retail & commercial patrons</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        {/* Active Debtors Count */}
        <div 
          onClick={() => setSelectedType('Debtors')}
          className={`bg-white p-4 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            selectedType === 'Debtors' 
              ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/20' 
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1">
              <span>Active Debtors</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-0.5">{debtorCustomers.length}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Click to filter outstanding accounts</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Outstanding Debt Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Total Outstanding Debt</div>
            <div className="text-2xl font-black text-rose-700 font-mono mt-0.5">
              ₦{totalOutstandingDebt.toLocaleString()}
            </div>
            <div className="text-[10px] text-rose-500 mt-0.5">Receivable from credit orders</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Total Debt Recovered */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Debt Recovered</div>
            <div className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
              ₦{totalDebtRecovered.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              {customerDebtRepayments.length} cumulative repayments
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone number, or ID..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'All', label: 'All Buyers', count: customers.length },
              { id: 'Debtors', label: 'Debtors Only', count: debtorCustomers.length, isWarning: true },
              { id: 'Retail', label: 'Retail', count: customers.filter(c => c.customer_type === 'Retail').length },
              { id: 'Wholesale', label: 'Wholesale', count: customers.filter(c => c.customer_type === 'Wholesale').length },
              { id: 'Restaurant', label: 'Restaurant', count: customers.filter(c => c.customer_type === 'Restaurant').length },
              { id: 'Supermarket', label: 'Supermarket', count: customers.filter(c => c.customer_type === 'Supermarket').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  selectedType === tab.id
                    ? tab.isWarning 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'bg-emerald-600 text-white shadow-xs'
                    : tab.isWarning && tab.count > 0
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  selectedType === tab.id 
                    ? 'bg-white/20 text-white' 
                    : tab.isWarning ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Customer List Grid/Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer ID & Name</th>
                <th className="py-3 px-4">Phone / Contact</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Agreed Discount</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4">Debt Balance</th>
                <th className="py-3 px-4">Purchases</th>
                <th className="py-3 px-4">Last Visit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customers found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  const debtBalance = Number(customer.balance) || 0;
                  const hasDebt = debtBalance > 0;

                  return (
                    <tr key={customer.customer_id} className={`hover:bg-slate-50 transition-colors ${hasDebt ? 'bg-amber-50/15' : ''}`}>
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{customer.full_name}</span>
                          {hasDebt && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              DEBTOR
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-emerald-600 font-semibold">{customer.customer_id}</div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-800">{customer.phone_number}</div>
                        {customer.email && <div className="text-[10px] text-slate-400">{customer.email}</div>}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          customer.customer_type === 'Wholesale'
                            ? 'bg-purple-100 text-purple-800'
                            : customer.customer_type === 'Restaurant'
                            ? 'bg-blue-100 text-blue-800'
                            : customer.customer_type === 'Supermarket'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {customer.customer_type}
                        </span>
                      </td>

                      {/* Agreed Discount Rate */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {customer.discount_percent && customer.discount_percent > 0 ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Percent className="w-3 h-3 text-emerald-600" />
                              <span>{customer.discount_percent}% VIP Rate</span>
                            </span>
                            {customer.discount_notes && (
                              <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={customer.discount_notes}>
                                {customer.discount_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Standard (0%)</span>
                        )}
                      </td>

                      {/* Total Spent */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 font-mono">
                        ₦{customer.total_spent.toLocaleString()}
                      </td>

                      {/* Debt Balance */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {hasDebt ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded text-xs font-black font-mono bg-rose-100 text-rose-800 border border-rose-300">
                              ₦{debtBalance.toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleOpenSettleDebt(customer)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              title="Record debt repayment"
                            >
                              Settle
                            </button>
                          </div>
                        ) : (
                          <span className="text-emerald-700 text-xs font-medium flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>₦0 (Cleared)</span>
                          </span>
                        )}
                      </td>

                      {/* Purchase Count */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <span className="font-semibold">{customer.purchase_count}</span> orders
                      </td>

                      {/* Last Purchase */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {customer.last_purchase_date || 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Settle Debt Quick Action */}
                          {hasDebt && (
                            <button
                              onClick={() => handleOpenSettleDebt(customer)}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold flex items-center space-x-1 shadow-xs"
                              title="Settle debt balance"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>Pay Debt</span>
                            </button>
                          )}

                          {/* Discount Rate Button */}
                          <button
                            onClick={() => handleInitiateEditDiscount(customer)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 border transition-colors ${
                              customer.discount_percent && customer.discount_percent > 0
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                            title={canManageDiscounts ? 'Set or modify discount rate' : 'Manager or Admin PIN required to set discount'}
                          >
                            {canManageDiscounts ? (
                              <Percent className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Lock className="w-3 h-3 text-amber-600" />
                            )}
                            <span>Rate</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedCustomerForDrawer(customer);
                              setDrawerTab('overview');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                          >
                            Details
                          </button>

                          {onSelectCustomerForSale && (
                            <button
                              onClick={() => onSelectCustomerForSale(customer.customer_id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center space-x-1"
                              title="Begin sales checkout for this customer"
                            >
                              <span>POS</span>
                              <ArrowUpRight className="w-3 h-3" />
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

      {/* Settle Customer Debt Modal */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-bold">
                  <Wallet className="w-4 h-4" />
                  <span>Customer Debt Settlement</span>
                </div>
                <h3 className="font-bold text-sm text-white mt-0.5">
                  Record Repayment: {settlingCustomer.full_name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSettlingCustomer(null);
                  setCompletedRepayment(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {completedRepayment ? (
              // Repayment Success View with Print Option
              <div className="p-5 space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-emerald-900">Debt Repayment Recorded Successfully</h4>
                  <p className="text-emerald-700 text-[11px]">
                    The payment was permanently committed to SQLite WAL and customer balance updated.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-slate-700 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Repayment ID:</span>
                    <span className="font-bold">{completedRepayment.repayment_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Customer:</span>
                    <span className="font-bold">{completedRepayment.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Amount Received:</span>
                    <span className="font-bold text-emerald-700">₦{completedRepayment.amount_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Payment Method:</span>
                    <span className="font-bold flex items-center space-x-1">
                      <span>{completedRepayment.payment_method}</span>
                      {completedRepayment.pos_terminal_name && (
                        <span className="text-[10px] text-purple-700 font-medium">({completedRepayment.pos_terminal_name})</span>
                      )}
                      {completedRepayment.bank_name && !completedRepayment.pos_terminal_name && (
                        <span className="text-[10px] text-blue-700 font-medium">({completedRepayment.bank_name})</span>
                      )}
                    </span>
                  </div>
                  {completedRepayment.reference_number && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">RRN / Reference:</span>
                      <span className="font-mono font-bold text-slate-700">{completedRepayment.reference_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Previous Debt:</span>
                    <span className="text-rose-600">₦{completedRepayment.previous_balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-800 font-bold font-sans">Remaining Balance:</span>
                    <span className={`font-black ${completedRepayment.remaining_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      ₦{completedRepayment.remaining_balance.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSlip(completedRepayment)}
                    disabled={isPrinting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isPrinting ? 'Printing Slip...' : 'Print Repayment Slip'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettlingCustomer(null);
                      setCompletedRepayment(null);
                    }}
                    className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // Form to enter debt settlement
              <form onSubmit={handleExecuteSettleDebt} className="p-5 space-y-4 text-xs">
                {repaymentError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                    {repaymentError}
                  </div>
                )}

                {/* Customer Outstanding Balance Card */}
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-rose-700 font-bold uppercase block">Current Outstanding Debt</span>
                    <span className="text-xl font-black text-rose-800 font-mono">
                      ₦{(Number(settlingCustomer.balance) || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded text-[10px] font-bold">
                    UNPAID
                  </span>
                </div>

                {/* Repayment Amount & Quick Chips */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Repayment Amount (₦) *
                  </label>
                  <div className="flex space-x-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => setRepaymentAmountInput(Number(settlingCustomer.balance) || 0)}
                      className="flex-1 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-200 text-[10px] font-bold"
                    >
                      Full (₦{(Number(settlingCustomer.balance) || 0).toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentAmountInput(Math.round((Number(settlingCustomer.balance) || 0) * 0.5))}
                      className="flex-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10px] font-bold"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentAmountInput(5000)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10px] font-bold"
                    >
                      ₦5k
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentAmountInput(10000)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10px] font-bold"
                    >
                      ₦10k
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentAmountInput(20000)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10px] font-bold"
                    >
                      ₦20k
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={Number(settlingCustomer.balance) || 0}
                    value={repaymentAmountInput}
                    onChange={(e) => setRepaymentAmountInput(Number(e.target.value))}
                    required
                    placeholder="Enter amount customer is paying now..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>Balance after payment:</span>
                    <span className="font-bold font-mono text-slate-800">
                      ₦{Math.max(0, (Number(settlingCustomer.balance) || 0) - repaymentAmountInput).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Receiving Payment Method *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cash', label: 'Cash Drawer', icon: Banknote },
                      { id: 'POS', label: 'Card / POS', icon: CreditCard },
                      { id: 'Bank Transfer', label: 'Bank Transfer', icon: ArrowUpRight },
                    ].map(pm => {
                      const Icon = pm.icon;
                      const isSelected = repaymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => {
                            setRepaymentMethod(pm.id as any);
                            if (pm.id === 'POS' && !selectedPosTerminalId && activePosDevices.length > 0) {
                              const def = activePosDevices.find(p => p.is_default) || activePosDevices[0];
                              setSelectedPosTerminalId(def.id);
                            }
                            if (pm.id === 'Bank Transfer' && !selectedBankAccountId && activeBankAccounts.length > 0) {
                              const def = activeBankAccounts.find(b => b.is_default) || activeBankAccounts[0];
                              setSelectedBankAccountId(def.id);
                            }
                          }}
                          className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center space-y-1 transition-all ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="text-[10px] leading-tight">{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {repaymentMethod === 'Cash' && (
                    <p className="text-[10px] text-emerald-700 mt-1 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                      ✓ Cash payment will immediately credit the active Cash Drawer in SQLite WAL.
                    </p>
                  )}
                </div>

                {/* Dynamic POS Terminal Selector */}
                {repaymentMethod === 'POS' && (
                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-purple-950 flex items-center space-x-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                        <span>Select Receiving POS Terminal *</span>
                      </label>
                      <span className="text-[10px] text-purple-700 font-semibold">
                        {activePosDevices.length} Terminal{activePosDevices.length === 1 ? '' : 's'} Active
                      </span>
                    </div>

                    {activePosDevices.length > 0 ? (
                      <>
                        <select
                          value={selectedPosTerminalId}
                          onChange={(e) => setSelectedPosTerminalId(e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-purple-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          {activePosDevices.map(term => (
                            <option key={term.id} value={term.id}>
                              {term.name} ({term.provider} - {term.terminal_id || term.account_number}) {term.is_default ? '★ Default' : ''}
                            </option>
                          ))}
                        </select>

                        {/* Active Terminal Info Pill */}
                        {(() => {
                          const t = activePosDevices.find(dev => dev.id === selectedPosTerminalId) || activePosDevices[0];
                          if (!t) return null;
                          return (
                            <div className="p-2 bg-purple-100/70 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-center justify-between">
                              <div>
                                <div className="font-bold flex items-center space-x-1">
                                  <span>{t.name}</span>
                                  {t.terminal_id && <span className="font-mono text-[10px] text-purple-700">({t.terminal_id})</span>}
                                </div>
                                <div className="text-[10px] text-purple-700">
                                  Settles into: {t.bank_name} ({t.account_number})
                                </div>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 font-bold text-[9px] uppercase font-mono">
                                {t.provider}
                              </span>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        ⚠️ No active POS terminals found. Please configure a POS device under POS & Bank Setup.
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        POS Terminal RRN / Slip Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={repaymentReference}
                        onChange={(e) => setRepaymentReference(e.target.value)}
                        placeholder="e.g. MONIEPOINT-RRN-9921 or POS Reference"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Commercial Bank Account Selector */}
                {repaymentMethod === 'Bank Transfer' && (
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-950 flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Select Receiving Bank Account *</span>
                      </label>
                      <span className="text-[10px] text-blue-700 font-semibold">
                        {activeBankAccounts.length} Account{activeBankAccounts.length === 1 ? '' : 's'} Active
                      </span>
                    </div>

                    {activeBankAccounts.length > 0 ? (
                      <>
                        <select
                          value={selectedBankAccountId}
                          onChange={(e) => setSelectedBankAccountId(e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {activeBankAccounts.map(bank => (
                            <option key={bank.id} value={bank.id}>
                              {bank.name} — {bank.bank_name} ({bank.account_number}) {bank.is_default ? '★ Default' : ''}
                            </option>
                          ))}
                        </select>

                        {/* Customer Account Details Card with Instant Copy */}
                        {(() => {
                          const bank = activeBankAccounts.find(b => b.id === selectedBankAccountId) || activeBankAccounts[0];
                          if (!bank) return null;
                          return (
                            <div className="p-2.5 bg-white rounded-lg border border-blue-200 shadow-xs space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold">
                                <span>{bank.bank_name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(bank.account_number);
                                    setCopiedBankAcc(true);
                                    setTimeout(() => setCopiedBankAcc(false), 2500);
                                  }}
                                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{copiedBankAcc ? 'Copied!' : 'Copy A/C'}</span>
                                </button>
                              </div>
                              <div className="font-mono text-base font-black text-slate-900 tracking-wider">
                                {bank.account_number}
                              </div>
                              <div className="text-[10px] text-slate-600 font-medium">
                                Account Name: <span className="font-bold text-slate-800">{bank.account_name}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        ⚠️ No active bank accounts found. Please configure a bank account under POS & Bank Setup.
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Bank Transfer Session ID / Transaction Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={repaymentReference}
                        onChange={(e) => setRepaymentReference(e.target.value)}
                        placeholder="e.g. 100004260927891283921 / GTB-NIP-998"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Notes / Reference */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Repayment Notes / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={repaymentNotes}
                    onChange={(e) => setRepaymentNotes(e.target.value)}
                    placeholder="e.g. Received at store counter / partial payment on invoice"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setSettlingCustomer(null)}
                    disabled={isSubmittingRepayment}
                    className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRepayment}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm flex items-center space-x-1 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingRepayment ? 'Processing...' : 'Confirm Repayment'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Customer Details & History Modal */}
      {selectedCustomerForDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {selectedCustomerForDrawer.customer_id}
                </span>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>{selectedCustomerForDrawer.full_name}</span>
                  {(Number(selectedCustomerForDrawer.balance) || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                      OWES ₦{(Number(selectedCustomerForDrawer.balance) || 0).toLocaleString()}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedCustomerForDrawer.customer_type} Buyer • Registered {selectedCustomerForDrawer.registration_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForDrawer(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 px-5 pt-3 bg-slate-50 gap-4 text-xs font-semibold">
              <button
                onClick={() => setDrawerTab('overview')}
                className={`pb-2.5 transition-all border-b-2 ${
                  drawerTab === 'overview'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Account Overview
              </button>
              <button
                onClick={() => setDrawerTab('sales')}
                className={`pb-2.5 transition-all border-b-2 flex items-center space-x-1 ${
                  drawerTab === 'sales'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>All Orders</span>
                <span className="text-[10px] px-1.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                  {customerSales.length}
                </span>
              </button>
              <button
                onClick={() => setDrawerTab('debt_history')}
                className={`pb-2.5 transition-all border-b-2 flex items-center space-x-1.5 ${
                  drawerTab === 'debt_history'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Credit & Repayment Ledger</span>
                {(Number(selectedCustomerForDrawer.balance) || 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                )}
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              
              {drawerTab === 'overview' && (
                <>
                  {/* Quick stats banner */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] text-emerald-800 uppercase font-bold block">Approved Discount</span>
                      <span className="text-lg font-black text-emerald-900 font-mono">
                        {selectedCustomerForDrawer.discount_percent || 0}%
                      </span>
                      <span className="text-[9px] text-emerald-700 block truncate">
                        {selectedCustomerForDrawer.discount_notes || 'Standard Pricing'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Spent Ever</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        ₦{selectedCustomerForDrawer.total_spent.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {selectedCustomerForDrawer.purchase_count} Completed Sales
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${
                      (Number(selectedCustomerForDrawer.balance) || 0) > 0 
                        ? 'bg-rose-50 border-rose-200' 
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <span className={`text-[10px] uppercase font-bold block ${
                        (Number(selectedCustomerForDrawer.balance) || 0) > 0 ? 'text-rose-800' : 'text-emerald-800'
                      }`}>
                        Current Balance Due
                      </span>
                      <span className={`text-base font-black font-mono block ${
                        (Number(selectedCustomerForDrawer.balance) || 0) > 0 ? 'text-rose-900' : 'text-emerald-900'
                      }`}>
                        ₦{(Number(selectedCustomerForDrawer.balance) || 0).toLocaleString()}
                      </span>
                      <span className="text-[9px] block text-slate-500">
                        {(Number(selectedCustomerForDrawer.balance) || 0) > 0 ? 'Outstanding Debt' : 'Fully Cleared'}
                      </span>
                    </div>
                  </div>

                  {/* Contact info & notes */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-slate-600">
                    <div><strong>Phone:</strong> {selectedCustomerForDrawer.phone_number}</div>
                    {selectedCustomerForDrawer.email && <div><strong>Email:</strong> {selectedCustomerForDrawer.email}</div>}
                    {selectedCustomerForDrawer.address && <div><strong>Address:</strong> {selectedCustomerForDrawer.address}</div>}
                    {selectedCustomerForDrawer.notes && (
                      <div className="pt-1 text-slate-700 italic">
                        <strong>Notes:</strong> &quot;{selectedCustomerForDrawer.notes}&quot;
                      </div>
                    )}
                    {selectedCustomerForDrawer.discount_percent && selectedCustomerForDrawer.discount_percent > 0 && (
                      <div className="pt-1 text-emerald-800">
                        <strong>Agreed Discount:</strong> {selectedCustomerForDrawer.discount_percent}% — {selectedCustomerForDrawer.discount_notes || 'Authorized Rate'}
                      </div>
                    )}
                  </div>
                </>
              )}

              {drawerTab === 'sales' && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Purchase History ({customerSales.length} orders)</h4>
                  <div className="space-y-2 divide-y divide-slate-100">
                    {customerSales.length === 0 ? (
                      <p className="text-slate-400 py-6 text-center">No recorded transactions yet.</p>
                    ) : (
                      customerSales.map(tx => (
                        <div key={tx.transaction_id} className="pt-2 flex justify-between items-center">
                          <div>
                            <div className="font-mono font-bold text-slate-800">{tx.transaction_id}</div>
                            <div className="text-[11px] text-slate-400">{tx.date_time} • {tx.payment_method}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 font-mono">₦{tx.final_amount.toLocaleString()}</div>
                            {tx.discount_applied > 0 ? (
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                Saved ₦{tx.discount_applied.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Regular Price</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'debt_history' && (
                <div className="space-y-4">
                  {/* Balance Action Header */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Current Outstanding Debt</div>
                      <div className="text-xl font-black text-rose-700 font-mono">
                        ₦{(Number(selectedCustomerForDrawer.balance) || 0).toLocaleString()}
                      </div>
                    </div>
                    {(Number(selectedCustomerForDrawer.balance) || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettleDebt(selectedCustomerForDrawer)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1 shadow-xs"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Settle Debt Now</span>
                      </button>
                    )}
                  </div>

                  {/* Repayment History Records */}
                  <div>
                    <h5 className="font-bold text-slate-900 mb-2 flex items-center space-x-1.5">
                      <History className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Debt Repayments Recorded ({customerRepayments.length})</span>
                    </h5>
                    {customerRepayments.length === 0 ? (
                      <p className="text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No debt repayments recorded for this customer yet.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Amount</th>
                              <th className="py-2 px-3">Channel</th>
                              <th className="py-2 px-3">Balance After</th>
                              <th className="py-2 px-3 text-right">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {customerRepayments.map(rep => (
                              <tr key={rep.repayment_id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-600">{rep.date_time}</td>
                                <td className="py-2 px-3 font-bold text-emerald-700">₦{rep.amount_paid.toLocaleString()}</td>
                                <td className="py-2 px-3 text-slate-700">
                                  <div className="font-semibold">{rep.payment_method}</div>
                                  {rep.pos_terminal_name && <div className="text-[9px] text-purple-700 font-sans font-medium">{rep.pos_terminal_name}</div>}
                                  {rep.bank_name && !rep.pos_terminal_name && <div className="text-[9px] text-blue-700 font-sans font-medium">{rep.bank_name}</div>}
                                  {rep.reference_number && <div className="text-[9px] text-slate-500 font-mono">Ref: {rep.reference_number}</div>}
                                </td>
                                <td className="py-2 px-3 text-slate-900 font-bold">₦{rep.remaining_balance.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handlePrintSlip(rep)}
                                    className="p-1 text-slate-500 hover:text-emerald-700"
                                    title="Print repayment slip"
                                  >
                                    <Printer className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Credit Purchases Record */}
                  <div>
                    <h5 className="font-bold text-slate-900 mb-2 flex items-center space-x-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>Credit Purchases (Pay Later) ({customerCreditSales.length})</span>
                    </h5>
                    {customerCreditSales.length === 0 ? (
                      <p className="text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No credit purchases made by this customer.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerCreditSales.map(cs => (
                          <div key={cs.transaction_id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold font-mono text-slate-800">{cs.transaction_id}</div>
                              <div className="text-[11px] text-slate-500">
                                {cs.date_time} • Due: {cs.payment_due_date || 'Prompt'}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-bold text-slate-900">Total: ₦{cs.final_amount.toLocaleString()}</div>
                              <div className="text-[10px] text-rose-600 font-semibold">
                                Debt: ₦{(cs.balance_due ?? (cs.final_amount - (cs.deposit_amount || 0))).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    handleInitiateEditDiscount(selectedCustomerForDrawer);
                  }}
                  className="px-3 py-1.5 border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-semibold text-xs flex items-center space-x-1"
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Configure Discount Rate</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForDrawer(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {onSelectCustomerForSale && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = selectedCustomerForDrawer.customer_id;
                        setSelectedCustomerForDrawer(null);
                        onSelectCustomerForSale(id);
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                    >
                      Start POS Sale
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Discount Rate Modal */}
      {editingDiscountCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Manager Discount Authorization</span>
                </div>
                <h3 className="font-bold text-sm text-white mt-0.5">
                  Set Discount for {editingDiscountCustomer.full_name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingDiscountCustomer(null);
                  setPinOverrideStaff(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerDiscount} className="p-5 space-y-3.5 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{editingDiscountCustomer.full_name}</div>
                  <div className="text-[11px] text-slate-500">{editingDiscountCustomer.customer_id} • {editingDiscountCustomer.customer_type}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-mono font-semibold">
                  {pinOverrideStaff 
                    ? `Auth: ${pinOverrideStaff.staff_name} (${pinOverrideStaff.role})`
                    : `Auth: ${activeStaff.staff_name} (${activeStaff.role})`}
                </span>
              </div>

              {discountModalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {discountModalError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Agreed Customer Discount Rate (%) *
                </label>
                <div className="flex space-x-1.5 mb-2">
                  {[0, 3, 5, 8, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercentInput(pct)}
                      className={`flex-1 py-1.5 rounded border text-xs font-semibold ${
                        discountPercentInput === pct
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercentInput}
                  onChange={(e) => setDiscountPercentInput(Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Set to 0% to remove discount and revert to standard counter pricing.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authorization Reason / Contract Reference
                </label>
                <input
                  type="text"
                  value={discountNotesInput}
                  onChange={(e) => setDiscountNotesInput(e.target.value)}
                  placeholder="e.g., Weekly wholesale agreement, VIP patron"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDiscountCustomer(null);
                    setPinOverrideStaff(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Discount Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Register New Customer</h3>
                <p className="text-[11px] text-slate-400">
                  Auto-assigns Customer ID: <span className="font-mono text-emerald-400">{getNextCustomerId()}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Mrs. Bola Adeyemi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number (Unique Identifier) *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+234 801 234 5678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Customer Type *
                </label>
                <select
                  value={formData.customer_type}
                  onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as CustomerType })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Supermarket">Supermarket</option>
                </select>
              </div>

              {/* Discount Assignment */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer Agreed Discount Rate (%)</span>
                  </label>
                  {!canManageDiscounts && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Manager / Admin Only</span>
                    </span>
                  )}
                </div>

                {canManageDiscounts ? (
                  <div className="space-y-2">
                    <div className="flex space-x-1">
                      {[0, 5, 8, 10].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setFormData({ ...formData, discount_percent: pct })}
                          className={`flex-1 py-1 text-[11px] rounded border ${
                            formData.discount_percent === pct
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.discount_percent}
                      onChange={(e) => setFormData({ ...formData, discount_percent: Number(e.target.value) })}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono"
                    />
                    <input
                      type="text"
                      value={formData.discount_notes}
                      onChange={(e) => setFormData({ ...formData, discount_notes: e.target.value })}
                      placeholder="Reason for rate (e.g. Wholesale agreement)"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Standard 0% pricing assigned. Managers or Administrators can authorize custom rates after registration.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@email.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Delivery / Residential Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Lagos, Ikeja / Lekki"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Special Notes / Preferences
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Regular weekly orders, preferred delivery times"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security PIN Authorization Modal for Discounts */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingCustomerForDiscount(null);
        }}
        title="Manager / Admin Discount Authorization"
        subtitle="Enter 4-digit PIN of a Manager or Admin to authorize customer discount rate"
        requiredRole={['Manager', 'Admin']}
        mode="OVERRIDE"
        actionDescription="Configure customer discount rate"
        onSuccess={handlePinSuccess}
      />

      {/* Hidden Printable Debt Repayment Slip for Native / Browser Print */}
      {slipToPrint && (
        <div id="printable-repayment-slip" className="hidden print:block fixed inset-0 bg-white text-black p-6 font-mono text-xs">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-repayment-slip, #printable-repayment-slip * {
                visibility: visible !important;
              }
              #printable-repayment-slip {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                display: block !important;
              }
            }
          `}</style>
          <div className="max-w-[320px] mx-auto text-center space-y-2 pb-4 border-b border-black">
            <h1 className="font-bold text-base uppercase">{receiptSettings.business_name || 'KIID FROM DREAM'}</h1>
            <p className="text-[10px]">{receiptSettings.address_line1}</p>
            <p className="text-[10px]">Tel: {receiptSettings.phone_numbers}</p>
            <div className="border-t border-b border-dashed border-black py-1 my-2 font-bold text-xs uppercase">
              DEBT REPAYMENT OFFICIAL RECEIPT
            </div>
          </div>

          <div className="max-w-[320px] mx-auto py-3 space-y-1.5 text-[11px] border-b border-black">
            <div className="flex justify-between">
              <span>Receipt No:</span>
              <span className="font-bold">{slipToPrint.repayment_id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span>{slipToPrint.date_time}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer Name:</span>
              <span className="font-bold">{slipToPrint.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer ID:</span>
              <span>{slipToPrint.customer_id}</span>
            </div>
            <div className="flex justify-between">
              <span>Recorded By:</span>
              <span>{slipToPrint.staff_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold">{slipToPrint.payment_method}</span>
            </div>
            {slipToPrint.pos_terminal_name && (
              <div className="flex justify-between">
                <span>POS Terminal:</span>
                <span className="font-bold">{slipToPrint.pos_terminal_name}</span>
              </div>
            )}
            {slipToPrint.bank_name && (
              <div className="flex justify-between">
                <span>Bank Account:</span>
                <span>{slipToPrint.bank_name} {slipToPrint.bank_account_number ? `(${slipToPrint.bank_account_number})` : ''}</span>
              </div>
            )}
            {slipToPrint.reference_number && (
              <div className="flex justify-between">
                <span>RRN / Ref No:</span>
                <span className="font-mono">{slipToPrint.reference_number}</span>
              </div>
            )}
          </div>

          <div className="max-w-[320px] mx-auto py-3 space-y-2 text-xs border-b border-black">
            <div className="flex justify-between">
              <span>Previous Debt Balance:</span>
              <span>₦{slipToPrint.previous_balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>AMOUNT PAID:</span>
              <span>₦{slipToPrint.amount_paid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-dashed border-black">
              <span>Remaining Balance Due:</span>
              <span>₦{slipToPrint.remaining_balance.toLocaleString()}</span>
            </div>
            {slipToPrint.notes && (
              <div className="text-[10px] text-slate-700 italic pt-1">
                Ref / Notes: {slipToPrint.notes}
              </div>
            )}
          </div>

          <div className="max-w-[320px] mx-auto pt-6 text-center space-y-4 text-[10px]">
            <div className="border-t border-dotted border-black pt-1 w-3/4 mx-auto">
              Cashier Signature & Stamp
            </div>
            <p className="italic">Thank you for your business & prompt settlement!</p>
          </div>
        </div>
      )}

    </div>
  );
};
