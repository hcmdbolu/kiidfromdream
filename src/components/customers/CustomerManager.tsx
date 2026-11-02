import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Customer, CustomerType, Employee, CustomerDebtRepayment, SaleTransaction } from '../../types';
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
  Copy,
  ChevronRight,
  ExternalLink,
  Download
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';

export interface DebtAgingInfo {
  category: 'Current' | '31-60 Days' | '61-90 Days' | '90+ Days';
  days: number;
  label: string;
  badgeClass: string;
  dotColor: string;
  riskLevel: 'Normal' | 'Overdue' | 'Delinquent' | 'High Risk';
  earliestUnpaidDate?: string;
  earliestUnpaidTxnId?: string;
}

export interface UnifiedCustomerLedgerEntry {
  id: string;
  date_time: string;
  timestamp: number;
  type: 'OPENING_BALANCE' | 'CREDIT_INVOICE' | 'DOWN_PAYMENT' | 'DEBT_REPAYMENT';
  ref_number: string;
  description: string;
  channel: string;
  channel_details?: string;
  staff_name?: string;
  debit: number;
  credit: number;
  running_balance: number;
  sale_raw?: SaleTransaction;
  repayment_raw?: CustomerDebtRepayment;
}

export const getCustomerDebtAging = (
  customer: Customer,
  allSales: SaleTransaction[],
  allRepayments: CustomerDebtRepayment[]
): DebtAgingInfo | null => {
  const balance = Number(customer.balance) || 0;
  if (balance <= 0) return null;

  // Credit sales for this customer, sorted chronologically ascending
  const creditSales = allSales
    .filter(s => s.customer_id === customer.customer_id && s.payment_method === 'Credit / Pay Later')
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

  // Repayments for this customer
  const repayments = allRepayments
    .filter(r => r.customer_id === customer.customer_id);

  let totalRepaid = repayments.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);

  // FIFO matching of credit invoices against repayments
  let earliestUnpaidDate: string | undefined;
  let earliestUnpaidTxnId: string | undefined;

  for (const sale of creditSales) {
    const netDebtIncurred = Math.max(0, (Number(sale.final_amount) || 0) - (Number(sale.deposit_amount) || 0));
    if (netDebtIncurred <= 0) continue;

    if (totalRepaid >= netDebtIncurred) {
      totalRepaid -= netDebtIncurred;
    } else {
      earliestUnpaidDate = sale.date_time;
      earliestUnpaidTxnId = sale.transaction_id;
      break;
    }
  }

  let diffDays = 0;
  if (earliestUnpaidDate) {
    const invoiceTime = new Date(earliestUnpaidDate).getTime();
    if (!isNaN(invoiceTime)) {
      diffDays = Math.max(0, Math.floor((Date.now() - invoiceTime) / (1000 * 60 * 60 * 24)));
    }
  } else if (customer.last_purchase_date) {
    const lastTime = new Date(customer.last_purchase_date).getTime();
    if (!isNaN(lastTime)) {
      diffDays = Math.max(0, Math.floor((Date.now() - lastTime) / (1000 * 60 * 60 * 24)));
    }
  }

  if (diffDays > 90) {
    return {
      category: '90+ Days',
      days: diffDays,
      label: `${diffDays}d Overdue (90d+)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold',
      dotColor: 'bg-rose-600 animate-pulse',
      riskLevel: 'High Risk',
      earliestUnpaidDate,
      earliestUnpaidTxnId,
    };
  } else if (diffDays > 60) {
    return {
      category: '61-90 Days',
      days: diffDays,
      label: `${diffDays}d Delinquent (61-90d)`,
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      dotColor: 'bg-orange-500',
      riskLevel: 'Delinquent',
      earliestUnpaidDate,
      earliestUnpaidTxnId,
    };
  } else if (diffDays > 30) {
    return {
      category: '31-60 Days',
      days: diffDays,
      label: `${diffDays}d Overdue (31-60d)`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotColor: 'bg-amber-500',
      riskLevel: 'Overdue',
      earliestUnpaidDate,
      earliestUnpaidTxnId,
    };
  } else {
    return {
      category: 'Current',
      days: diffDays,
      label: `${diffDays}d (Current <30d)`,
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      dotColor: 'bg-blue-600',
      riskLevel: 'Normal',
      earliestUnpaidDate,
      earliestUnpaidTxnId,
    };
  }
};

export const buildCustomerUnifiedLedger = (
  customer: Customer,
  allSales: SaleTransaction[],
  allRepayments: CustomerDebtRepayment[]
): UnifiedCustomerLedgerEntry[] => {
  const creditSales = allSales.filter(s => s.customer_id === customer.customer_id && s.payment_method === 'Credit / Pay Later');
  const repayments = allRepayments.filter(r => r.customer_id === customer.customer_id);

  interface RawEvent {
    id: string;
    date_time: string;
    timestamp: number;
    type: 'OPENING_BALANCE' | 'CREDIT_INVOICE' | 'DOWN_PAYMENT' | 'DEBT_REPAYMENT';
    ref_number: string;
    description: string;
    channel: string;
    channel_details?: string;
    staff_name?: string;
    debit: number;
    credit: number;
    sale_raw?: SaleTransaction;
    repayment_raw?: CustomerDebtRepayment;
  }

  const events: RawEvent[] = [];

  creditSales.forEach(s => {
    const baseTime = new Date(s.date_time).getTime() || 0;

    // Invoice Gross Entry
    events.push({
      id: `INV-${s.transaction_id}`,
      date_time: s.date_time,
      timestamp: baseTime,
      type: 'CREDIT_INVOICE',
      ref_number: s.transaction_id,
      description: `Credit Sale: ${s.items?.length || 1} item(s) purchased`,
      channel: 'Credit / Pay Later',
      channel_details: `Agreed Due: ${s.payment_due_date || 'Prompt'}`,
      staff_name: s.staff_id,
      debit: Number(s.final_amount) || 0,
      credit: 0,
      sale_raw: s,
    });

    // Down payment entry if deposited at checkout
    const depAmt = Number(s.deposit_amount) || 0;
    if (depAmt > 0) {
      let channelDetails = 'Cash Drawer';
      if (s.deposit_payment_method === 'POS') {
        channelDetails = s.pos_terminal_name ? `POS: ${s.pos_terminal_name}` : 'POS Terminal';
        if (s.payment_reference) channelDetails += ` (RRN: ${s.payment_reference})`;
      } else if (s.deposit_payment_method === 'Bank Transfer') {
        channelDetails = s.bank_name ? `Bank: ${s.bank_name}` : 'Bank Transfer';
        if (s.bank_account_number) channelDetails += ` (${s.bank_account_number})`;
        if (s.payment_reference) channelDetails += ` (Ref: ${s.payment_reference})`;
      }

      events.push({
        id: `DEP-${s.transaction_id}`,
        date_time: s.date_time,
        timestamp: baseTime + 1,
        type: 'DOWN_PAYMENT',
        ref_number: s.payment_reference || `DEP-${s.transaction_id}`,
        description: `Counter Down Payment on ${s.transaction_id}`,
        channel: s.deposit_payment_method || 'Cash',
        channel_details: channelDetails,
        staff_name: s.staff_id,
        debit: 0,
        credit: depAmt,
        sale_raw: s,
      });
    }
  });

  repayments.forEach(r => {
    const repTime = new Date(r.date_time).getTime() || 0;
    let channelDetails = 'Cash Drawer';
    if (r.payment_method === 'POS') {
      channelDetails = r.pos_terminal_name ? `POS: ${r.pos_terminal_name}` : 'POS Terminal';
      if (r.reference_number) channelDetails += ` (RRN: ${r.reference_number})`;
    } else if (r.payment_method === 'Bank Transfer') {
      channelDetails = r.bank_name ? `Bank: ${r.bank_name}` : 'Bank Transfer';
      if (r.bank_account_number) channelDetails += ` (${r.bank_account_number})`;
      if (r.reference_number) channelDetails += ` (Ref: ${r.reference_number})`;
    }

    events.push({
      id: `REP-${r.repayment_id}`,
      date_time: r.date_time,
      timestamp: repTime,
      type: 'DEBT_REPAYMENT',
      ref_number: r.reference_number || r.repayment_id,
      description: `Debt Settlement Receipt ${r.repayment_id}${r.notes ? ` (${r.notes})` : ''}`,
      channel: r.payment_method,
      channel_details: channelDetails,
      staff_name: r.staff_name,
      debit: 0,
      credit: Number(r.amount_paid) || 0,
      repayment_raw: r,
    });
  });

  // Sort chronologically ascending
  events.sort((a, b) => a.timestamp - b.timestamp);

  // Compute running balance
  let running = 0;
  const ledger: UnifiedCustomerLedgerEntry[] = events.map(entry => {
    running += (entry.debit - entry.credit);
    return {
      ...entry,
      running_balance: running
    };
  });

  // Handle case of legacy balance before system sales
  const currentCustomerBalance = Number(customer.balance) || 0;
  if (currentCustomerBalance > 0 && ledger.length === 0) {
    ledger.push({
      id: `INIT-${customer.customer_id}`,
      date_time: customer.registration_date || 'Initial',
      timestamp: 0,
      type: 'OPENING_BALANCE',
      ref_number: 'OPENING-BAL',
      description: 'Opening / Historical Debt Balance',
      channel: 'System Migration',
      channel_details: 'Migrated Account Balance',
      staff_name: 'System Admin',
      debit: currentCustomerBalance,
      credit: 0,
      running_balance: currentCustomerBalance,
    });
  }

  return ledger;
};

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

  // Statement of Account Modal
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [customerForStatement, setCustomerForStatement] = useState<Customer | null>(null);
  const [statementToPrint, setStatementToPrint] = useState<Customer | null>(null);

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

  const handlePrintStatement = async (cust: Customer) => {
    setStatementToPrint(cust);
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

  // Debtor Aging Portfolio Summary
  const agingPortfolio = useMemo(() => {
    const buckets = {
      current: { count: 0, total: 0 },
      days30to60: { count: 0, total: 0 },
      days61to90: { count: 0, total: 0 },
      days90plus: { count: 0, total: 0 },
    };

    debtorCustomers.forEach(c => {
      const bal = Number(c.balance) || 0;
      const aging = getCustomerDebtAging(c, sales, customerDebtRepayments);
      if (!aging || aging.category === 'Current') {
        buckets.current.count++;
        buckets.current.total += bal;
      } else if (aging.category === '31-60 Days') {
        buckets.days30to60.count++;
        buckets.days30to60.total += bal;
      } else if (aging.category === '61-90 Days') {
        buckets.days61to90.count++;
        buckets.days61to90.total += bal;
      } else {
        buckets.days90plus.count++;
        buckets.days90plus.total += bal;
      }
    });

    return buckets;
  }, [debtorCustomers, sales, customerDebtRepayments]);

  // Filter customers with Search, CustomerType, and Debtor Aging criteria
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch =
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search) ||
        c.customer_id.toLowerCase().includes(search.toLowerCase());

      let matchType = true;
      const debtBal = Number(c.balance) || 0;

      if (selectedType === 'Debtors') {
        matchType = debtBal > 0;
      } else if (selectedType === 'Aging_Current') {
        if (debtBal <= 0) return false;
        const aging = getCustomerDebtAging(c, sales, customerDebtRepayments);
        matchType = aging?.category === 'Current';
      } else if (selectedType === 'Aging_31_60') {
        if (debtBal <= 0) return false;
        const aging = getCustomerDebtAging(c, sales, customerDebtRepayments);
        matchType = aging?.category === '31-60 Days';
      } else if (selectedType === 'Aging_61_90') {
        if (debtBal <= 0) return false;
        const aging = getCustomerDebtAging(c, sales, customerDebtRepayments);
        matchType = aging?.category === '61-90 Days';
      } else if (selectedType === 'Aging_90_Plus') {
        if (debtBal <= 0) return false;
        const aging = getCustomerDebtAging(c, sales, customerDebtRepayments);
        matchType = aging?.category === '90+ Days';
      } else if (selectedType !== 'All') {
        matchType = c.customer_type === selectedType;
      }

      return matchSearch && matchType;
    });
  }, [customers, search, selectedType, sales, customerDebtRepayments]);

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

  // Customer Unified Financial Ledger (combining credit invoices, deposits, repayments with running balance)
  const customerUnifiedLedger = useMemo(() => {
    if (!selectedCustomerForDrawer) return [];
    return buildCustomerUnifiedLedger(selectedCustomerForDrawer, sales, customerDebtRepayments);
  }, [selectedCustomerForDrawer, sales, customerDebtRepayments]);

  // Customer Aging Details for drawer header
  const selectedCustomerDrawerAging = useMemo(() => {
    if (!selectedCustomerForDrawer) return null;
    return getCustomerDebtAging(selectedCustomerForDrawer, sales, customerDebtRepayments);
  }, [selectedCustomerForDrawer, sales, customerDebtRepayments]);

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
          className={`bg-white p-4 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${selectedType === 'Debtors'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${selectedType === tab.id
                    ? tab.isWarning
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : tab.isWarning && tab.count > 0
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${selectedType === tab.id
                    ? 'bg-white/20 text-white'
                    : tab.isWarning ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

        </div>

        {/* Debtor Aging Portfolio Filter Strip */}
        {debtorCustomers.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-600 font-semibold text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Debtor Aging Analysis:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: 'Aging_Current',
                  label: 'Current (< 30d)',
                  count: agingPortfolio.current.count,
                  total: agingPortfolio.current.total,
                  colorClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                  activeClass: 'bg-blue-600 text-white border-blue-600 shadow-xs'
                },
                {
                  id: 'Aging_31_60',
                  label: '31-60d Overdue',
                  count: agingPortfolio.days30to60.count,
                  total: agingPortfolio.days30to60.total,
                  colorClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
                  activeClass: 'bg-amber-600 text-white border-amber-600 shadow-xs'
                },
                {
                  id: 'Aging_61_90',
                  label: '61-90d Delinquent',
                  count: agingPortfolio.days61to90.count,
                  total: agingPortfolio.days61to90.total,
                  colorClass: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
                  activeClass: 'bg-orange-600 text-white border-orange-600 shadow-xs'
                },
                {
                  id: 'Aging_90_Plus',
                  label: '90d+ High Risk',
                  count: agingPortfolio.days90plus.count,
                  total: agingPortfolio.days90plus.total,
                  colorClass: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
                  activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs'
                },
              ].map(pill => {
                const isActive = selectedType === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setSelectedType(isActive ? 'All' : pill.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-all ${isActive ? pill.activeClass : pill.colorClass
                      }`}
                  >
                    <span>{pill.label}:</span>
                    <span className="font-mono font-bold">{pill.count}</span>
                    <span className="font-mono text-[10px] opacity-80">(₦{pill.total.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                <th className="py-3 px-4">Debt Balance & Aging</th>
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
                  const aging = hasDebt ? getCustomerDebtAging(customer, sales, customerDebtRepayments) : null;

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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${customer.customer_type === 'Wholesale'
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

                      {/* Debt Balance & Aging */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {hasDebt ? (
                          <div className="space-y-1">
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
                            {aging && (
                              <div>
                                <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${aging.badgeClass}`} title={aging.earliestUnpaidDate ? `Earliest unsettled invoice: ${aging.earliestUnpaidDate} (${aging.earliestUnpaidTxnId})` : undefined}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${aging.dotColor}`}></span>
                                  <span>{aging.label}</span>
                                </span>
                              </div>
                            )}
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
                              <span>Pay</span>
                            </button>
                          )}

                          {/* Statement of Account Action */}
                          <button
                            onClick={() => {
                              setCustomerForStatement(customer);
                              setIsStatementModalOpen(true);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold flex items-center space-x-1"
                            title="Generate and print Statement of Account"
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Statement</span>
                          </button>

                          {/* Discount Rate Button */}
                          <button
                            onClick={() => handleInitiateEditDiscount(customer)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 border transition-colors ${customer.discount_percent && customer.discount_percent > 0
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
                          className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center space-y-1 transition-all ${isSelected
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
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {selectedCustomerForDrawer.customer_id}
                  </span>
                  {selectedCustomerDrawerAging && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${selectedCustomerDrawerAging.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedCustomerDrawerAging.dotColor}`}></span>
                      <span>{selectedCustomerDrawerAging.label}</span>
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2 mt-0.5">
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
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerForStatement(selectedCustomerForDrawer);
                    setIsStatementModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
                  title="Generate and print official Statement of Account"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Statement</span>
                </button>
                <button
                  onClick={() => setSelectedCustomerForDrawer(null)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 px-5 pt-3 bg-slate-50 gap-4 text-xs font-semibold">
              <button
                onClick={() => setDrawerTab('overview')}
                className={`pb-2.5 transition-all border-b-2 ${drawerTab === 'overview'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                Account Overview
              </button>
              <button
                onClick={() => setDrawerTab('sales')}
                className={`pb-2.5 transition-all border-b-2 flex items-center space-x-1 ${drawerTab === 'sales'
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
                className={`pb-2.5 transition-all border-b-2 flex items-center space-x-1.5 ${drawerTab === 'debt_history'
                    ? 'border-emerald-600 text-emerald-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <span>Unified Financial Ledger</span>
                <span className="text-[10px] px-1.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                  {customerUnifiedLedger.length}
                </span>
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

                    <div className={`p-3 rounded-xl border text-center ${(Number(selectedCustomerForDrawer.balance) || 0) > 0
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-emerald-50 border-emerald-200'
                      }`}>
                      <span className={`text-[10px] uppercase font-bold block ${(Number(selectedCustomerForDrawer.balance) || 0) > 0 ? 'text-rose-800' : 'text-emerald-800'
                        }`}>
                        Current Balance Due
                      </span>
                      <span className={`text-base font-black font-mono block ${(Number(selectedCustomerForDrawer.balance) || 0) > 0 ? 'text-rose-900' : 'text-emerald-900'
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
                  {/* Balance & Financial Position Summary */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Current Outstanding Debt</div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-2xl font-black text-rose-700 font-mono">
                            ₦{(Number(selectedCustomerForDrawer.balance) || 0).toLocaleString()}
                          </span>
                          {selectedCustomerDrawerAging && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${selectedCustomerDrawerAging.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${selectedCustomerDrawerAging.dotColor}`}></span>
                              <span>{selectedCustomerDrawerAging.label}</span>
                            </span>
                          )}
                        </div>
                        {selectedCustomerDrawerAging?.earliestUnpaidDate && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Oldest unsettled invoice: {selectedCustomerDrawerAging.earliestUnpaidDate} ({selectedCustomerDrawerAging.earliestUnpaidTxnId})
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerForStatement(selectedCustomerForDrawer);
                            setIsStatementModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Print Statement</span>
                        </button>

                        {(Number(selectedCustomerForDrawer.balance) || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenSettleDebt(selectedCustomerForDrawer)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Settle Debt Now</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick KPI stats strip */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center font-mono">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[9px] text-slate-500 font-sans block uppercase font-bold">Total Invoiced</span>
                        <span className="text-xs font-bold text-slate-800">
                          ₦{customerUnifiedLedger.reduce((sum, i) => sum + i.debit, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[9px] text-emerald-700 font-sans block uppercase font-bold">Total Settled / Paid</span>
                        <span className="text-xs font-bold text-emerald-700">
                          ₦{customerUnifiedLedger.reduce((sum, i) => sum + i.credit, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-[9px] text-rose-700 font-sans block uppercase font-bold">Balance Remaining</span>
                        <span className="text-xs font-black text-rose-700">
                          ₦{(Number(selectedCustomerForDrawer.balance) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Unified Chronological Ledger Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <History className="w-4 h-4 text-emerald-600" />
                        <span>Unified Financial Ledger & Timeline ({customerUnifiedLedger.length} events)</span>
                      </h5>
                      <span className="text-[10px] text-slate-500">
                        Chronological sequence with real-time running balance
                      </span>
                    </div>

                    {customerUnifiedLedger.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        No credit purchases or debt repayments recorded for this customer yet.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Date & Time</th>
                                <th className="py-2.5 px-3">Type & Ref</th>
                                <th className="py-2.5 px-3">Particulars & Channel</th>
                                <th className="py-2.5 px-3 text-right">Debit (+)</th>
                                <th className="py-2.5 px-3 text-right">Credit (-)</th>
                                <th className="py-2.5 px-3 text-right">Balance Due</th>
                                <th className="py-2.5 px-3 text-center">Receipt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {customerUnifiedLedger.map((entry) => {
                                return (
                                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {entry.date_time}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <div className="flex items-center space-x-1">
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${entry.type === 'CREDIT_INVOICE'
                                            ? 'bg-blue-100 text-blue-800'
                                            : entry.type === 'DOWN_PAYMENT'
                                              ? 'bg-purple-100 text-purple-800'
                                              : entry.type === 'DEBT_REPAYMENT'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-slate-200 text-slate-800'
                                          }`}>
                                          {entry.type === 'CREDIT_INVOICE' ? 'Invoice' : entry.type === 'DOWN_PAYMENT' ? 'Deposit' : entry.type === 'DEBT_REPAYMENT' ? 'Repayment' : 'Opening'}
                                        </span>
                                        <span className="font-bold text-slate-800">{entry.ref_number}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 font-sans text-slate-700">
                                      <div className="font-medium text-slate-900">{entry.description}</div>
                                      {entry.channel_details && (
                                        <div className="text-[10px] text-slate-500 font-mono">{entry.channel_details}</div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-rose-700 whitespace-nowrap">
                                      {entry.debit > 0 ? `₦${entry.debit.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                      {entry.credit > 0 ? `₦${entry.credit.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                      ₦{entry.running_balance.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      {entry.repayment_raw ? (
                                        <button
                                          type="button"
                                          onClick={() => handlePrintSlip(entry.repayment_raw!)}
                                          className="p-1 text-slate-500 hover:text-emerald-700 transition-colors"
                                          title="Print repayment receipt slip"
                                        >
                                          <Printer className="w-3.5 h-3.5 inline" />
                                        </button>
                                      ) : (
                                        <span className="text-slate-300 text-[10px]">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
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
                      className={`flex-1 py-1.5 rounded border text-xs font-semibold ${discountPercentInput === pct
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
                          className={`flex-1 py-1 text-[11px] rounded border ${formData.discount_percent === pct
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

      {/* Official Customer Statement of Account Modal */}
      {isStatementModalOpen && customerForStatement && (() => {
        const statementLedger = buildCustomerUnifiedLedger(customerForStatement, sales, customerDebtRepayments);
        const statementAging = getCustomerDebtAging(customerForStatement, sales, customerDebtRepayments);
        const totalInvoiced = statementLedger.reduce((sum, e) => sum + e.debit, 0);
        const totalSettled = statementLedger.reduce((sum, e) => sum + e.credit, 0);
        const currentBalance = Number(customerForStatement.balance) || 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">

              {/* Modal Top Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-sm">Customer Statement of Account</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {customerForStatement.full_name} ({customerForStatement.customer_id})
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handlePrintStatement(customerForStatement)}
                    disabled={isPrinting}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isPrinting ? 'Printing...' : 'Print Statement'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsStatementModalOpen(false);
                      setCustomerForStatement(null);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Document Body */}
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs text-slate-700 font-sans">

                {/* Corporate Header */}
                <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      {receiptSettings.business_name || 'KIID FROM DREAM LTD'}
                    </h2>
                    {receiptSettings.tagline && (
                      <p className="text-xs text-slate-500 italic">{receiptSettings.tagline}</p>
                    )}
                    {receiptSettings.address_line1 && (
                      <p className="text-xs text-slate-600 mt-0.5">{receiptSettings.address_line1}</p>
                    )}
                    {receiptSettings.phone_numbers && (
                      <p className="text-xs text-slate-600">Tel: {receiptSettings.phone_numbers}</p>
                    )}
                    {receiptSettings.tax_or_cac_number && (
                      <p className="text-[11px] text-slate-400 font-mono">CAC / RC: {receiptSettings.tax_or_cac_number}</p>
                    )}
                  </div>

                  <div className="sm:text-right font-mono text-xs">
                    <span className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded text-[10px] tracking-wider uppercase inline-block">
                      OFFICIAL STATEMENT OF ACCOUNT
                    </span>
                    <div className="mt-2 text-slate-500 text-[11px]">
                      <div>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div>Ref: SOA-{customerForStatement.customer_id}</div>
                    </div>
                  </div>
                </div>

                {/* Customer Particulars & Aging Rating */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Account Particulars</span>
                    <div className="text-sm font-bold text-slate-900">{customerForStatement.full_name}</div>
                    <div className="text-slate-600 font-mono text-[11px]">ID: {customerForStatement.customer_id}</div>
                    <div className="text-slate-600">Phone: {customerForStatement.phone_number}</div>
                    {customerForStatement.email && <div className="text-slate-600">Email: {customerForStatement.email}</div>}
                    {customerForStatement.address && <div className="text-slate-600">Address: {customerForStatement.address}</div>}
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Account Credit Status</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">
                        {currentBalance > 0 ? 'Active Account (Debt Outstanding)' : 'Account Fully Settled (No Debt)'}
                      </span>
                    </div>
                    {statementAging ? (
                      <div className="pt-1">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border ${statementAging.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statementAging.dotColor}`}></span>
                          <span>{statementAging.label}</span>
                        </span>
                        {statementAging.earliestUnpaidDate && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Oldest Unsettled Invoice: {statementAging.earliestUnpaidDate}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-emerald-700 font-semibold text-xs pt-1 flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All debts settled in full</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-center font-mono">
                    <span className="text-[10px] uppercase font-bold text-blue-900 font-sans block">Total Credit Invoiced</span>
                    <span className="text-base font-bold text-blue-950">₦{totalInvoiced.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-center font-mono">
                    <span className="text-[10px] uppercase font-bold text-emerald-900 font-sans block">Total Settlements Received</span>
                    <span className="text-base font-bold text-emerald-950">₦{totalSettled.toLocaleString()}</span>
                  </div>
                  <div className={`p-3 rounded-xl border text-center font-mono ${currentBalance > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] uppercase font-bold font-sans block ${currentBalance > 0 ? 'text-rose-900' : 'text-slate-600'}`}>
                      Current Outstanding Balance Due
                    </span>
                    <span className={`text-base font-black ${currentBalance > 0 ? 'text-rose-950' : 'text-emerald-700'}`}>
                      ₦{currentBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Transaction Ledger Table */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-slate-600" />
                    <span>Statement Transaction Ledger ({statementLedger.length} items)</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Type & Ref</th>
                          <th className="py-2.5 px-3">Particulars / Details</th>
                          <th className="py-2.5 px-3 text-right">Debit (+)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-)</th>
                          <th className="py-2.5 px-3 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {statementLedger.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                              No credit activity recorded for this customer.
                            </td>
                          </tr>
                        ) : (
                          statementLedger.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{item.date_time}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="font-bold text-slate-800">{item.ref_number}</span>
                                <span className="text-[10px] text-slate-400 block font-sans">{item.type.replace('_', ' ')}</span>
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-700">
                                <div>{item.description}</div>
                                {item.channel_details && (
                                  <div className="text-[10px] text-slate-400 font-mono">{item.channel_details}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-rose-700 font-bold whitespace-nowrap">
                                {item.debit > 0 ? `₦${item.debit.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-700 font-bold whitespace-nowrap">
                                {item.credit > 0 ? `₦${item.credit.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                ₦{item.running_balance.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Remittance Bank Account Details */}
                {activeBankAccounts.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Payment Remittance Accounts (For Electronic Wire Transfers)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {activeBankAccounts.map((b) => (
                        <div key={b.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{b.bank_name}</div>
                            <div className="font-mono text-emerald-700 font-semibold">{b.account_number}</div>
                            {b.account_name && <div className="text-[10px] text-slate-500">{b.account_name}</div>}
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                            {b.provider}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures & Certification */}
                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                  <div className="text-center space-y-3">
                    <div className="border-b border-slate-300 pb-1 w-3/4 mx-auto text-[11px] text-slate-500">
                      Authorized Signatory & Stamp
                    </div>
                    <div className="font-bold text-xs text-slate-800">{receiptSettings.business_name || 'KIID FROM DREAM'}</div>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="border-b border-slate-300 pb-1 w-3/4 mx-auto text-[11px] text-slate-500">
                      Customer Acknowledgement
                    </div>
                    <div className="font-bold text-xs text-slate-800">{customerForStatement.full_name}</div>
                  </div>
                </div>

              </div>

              {/* Modal Actions Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">
                  Audited financial record generated from SQLite WAL transaction ledger.
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStatementModalOpen(false);
                      setCustomerForStatement(null);
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintStatement(customerForStatement)}
                    disabled={isPrinting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isPrinting ? 'Printing...' : 'Print Official Statement'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Hidden Printable Statement of Account for Native / Browser Print */}
      {statementToPrint && (() => {
        const statementLedger = buildCustomerUnifiedLedger(statementToPrint, sales, customerDebtRepayments);
        const statementAging = getCustomerDebtAging(statementToPrint, sales, customerDebtRepayments);
        const totalInvoiced = statementLedger.reduce((sum, e) => sum + e.debit, 0);
        const totalSettled = statementLedger.reduce((sum, e) => sum + e.credit, 0);
        const currentBalance = Number(statementToPrint.balance) || 0;

        return (
          <div id="printable-statement-of-account" className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans text-xs">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-statement-of-account, #printable-statement-of-account * {
                  visibility: visible !important;
                }
                #printable-statement-of-account {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  display: block !important;
                  background: white !important;
                  color: black !important;
                }
              }
            `}</style>

            {/* Header */}
            <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold uppercase">{receiptSettings.business_name || 'KIID FROM DREAM LTD'}</h1>
                {receiptSettings.tagline && <p className="text-xs italic">{receiptSettings.tagline}</p>}
                {receiptSettings.address_line1 && <p className="text-xs">{receiptSettings.address_line1}</p>}
                {receiptSettings.phone_numbers && <p className="text-xs">Tel: {receiptSettings.phone_numbers}</p>}
                {receiptSettings.tax_or_cac_number && <p className="text-xs font-mono">RC / CAC: {receiptSettings.tax_or_cac_number}</p>}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold uppercase border border-black px-2 py-1 inline-block">
                  STATEMENT OF ACCOUNT
                </div>
                <div className="text-[11px] mt-1 font-mono">Date: {new Date().toLocaleDateString('en-GB')}</div>
                <div className="text-[11px] font-mono">Ref: SOA-{statementToPrint.customer_id}</div>
              </div>
            </div>

            {/* Customer & Account Details */}
            <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-black">
              <div>
                <div className="font-bold text-xs uppercase mb-1">Customer Particulars:</div>
                <div className="font-bold text-sm">{statementToPrint.full_name}</div>
                <div>Customer ID: <span className="font-mono">{statementToPrint.customer_id}</span></div>
                <div>Phone: {statementToPrint.phone_number}</div>
                {statementToPrint.address && <div>Address: {statementToPrint.address}</div>}
              </div>
              <div>
                <div className="font-bold text-xs uppercase mb-1">Financial Standing:</div>
                <div>Total Credit Invoiced: <span className="font-bold font-mono">₦{totalInvoiced.toLocaleString()}</span></div>
                <div>Total Settlements: <span className="font-bold font-mono">₦{totalSettled.toLocaleString()}</span></div>
                <div className="font-bold text-sm mt-1">
                  CURRENT BALANCE DUE: <span className="font-mono">₦{currentBalance.toLocaleString()}</span>
                </div>
                {statementAging && (
                  <div className="text-[11px] mt-1 font-semibold">
                    Debt Aging Status: {statementAging.label}
                  </div>
                )}
              </div>
            </div>

            {/* Transaction Ledger Table */}
            <div className="mb-4">
              <div className="font-bold uppercase text-xs mb-2">Transaction Ledger History</div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black text-[10px] uppercase font-bold">
                    <th className="py-1 px-1">Date</th>
                    <th className="py-1 px-1">Ref</th>
                    <th className="py-1 px-1">Particulars</th>
                    <th className="py-1 px-1 text-right">Debit (+)</th>
                    <th className="py-1 px-1 text-right">Credit (-)</th>
                    <th className="py-1 px-1 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono text-[11px]">
                  {statementLedger.map((row) => (
                    <tr key={row.id}>
                      <td className="py-1 px-1">{row.date_time}</td>
                      <td className="py-1 px-1 font-bold">{row.ref_number}</td>
                      <td className="py-1 px-1 font-sans">{row.description} {row.channel_details ? `(${row.channel_details})` : ''}</td>
                      <td className="py-1 px-1 text-right">{row.debit > 0 ? `₦${row.debit.toLocaleString()}` : '—'}</td>
                      <td className="py-1 px-1 text-right">{row.credit > 0 ? `₦${row.credit.toLocaleString()}` : '—'}</td>
                      <td className="py-1 px-1 text-right font-bold">₦{row.running_balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bank details for payment */}
            {activeBankAccounts.length > 0 && (
              <div className="border border-black p-3 mb-6 text-xs">
                <div className="font-bold uppercase mb-1">Direct Bank Transfer Remittance Accounts:</div>
                <div className="grid grid-cols-2 gap-2">
                  {activeBankAccounts.map(b => (
                    <div key={b.id}>
                      <span className="font-bold">{b.bank_name}:</span> <span className="font-mono">{b.account_number}</span> ({b.account_name || 'Corporate Account'})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 mt-6 border-t border-black">
              <div className="text-center space-y-2">
                <div className="border-b border-black pb-1 w-3/4 mx-auto text-[10px]">Authorized Signature & Stamp</div>
                <div className="font-bold">{receiptSettings.business_name || 'KIID FROM DREAM'}</div>
              </div>
              <div className="text-center space-y-2">
                <div className="border-b border-black pb-1 w-3/4 mx-auto text-[10px]">Customer Signature & Date</div>
                <div className="font-bold">{statementToPrint.full_name}</div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
