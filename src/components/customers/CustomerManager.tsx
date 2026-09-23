import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Customer, CustomerType, Employee } from '../../types';
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
  Award
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';

interface CustomerManagerProps {
  onSelectCustomerForSale?: (customerId: string) => void;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({ onSelectCustomerForSale }) => {
  const { 
    customers, 
    sales, 
    addCustomer, 
    updateCustomerDiscount, 
    getNextCustomerId,
    activeStaff,
    hasPermission 
  } = usePos();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);

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

  // PIN Auth for restricted operations
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingCustomerForDiscount, setPendingCustomerForDiscount] = useState<Customer | null>(null);
  const [pinOverrideStaff, setPinOverrideStaff] = useState<Employee | null>(null);

  const canManageDiscounts = hasPermission('CAN_APPLY_DISCOUNT');

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

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search) ||
        c.customer_id.toLowerCase().includes(search.toLowerCase());
      
      const matchType = selectedType === 'All' || c.customer_type === selectedType;
      return matchSearch && matchType;
    });
  }, [customers, search, selectedType]);

  // Customer purchase history
  const customerSales = useMemo(() => {
    if (!selectedCustomerForDrawer) return [];
    return sales.filter(s => s.customer_id === selectedCustomerForDrawer.customer_id);
  }, [sales, selectedCustomerForDrawer]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Customer Directory & Discount Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
              {customers.length} Registered Buyers
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer profiles and assign negotiated discount rates. Discount privileges are restricted strictly to Administrators and Managers.
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone number, or ID..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
            >
              <option value="All">All Customer Types</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Supermarket">Supermarket</option>
            </select>
          </div>

        </div>
      </div>

      {/* Customer List Grid/Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer ID & Name</th>
                <th className="py-3 px-4">Phone / Contact</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Agreed Discount Rate</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4">Purchases</th>
                <th className="py-3 px-4">Preferred Fish</th>
                <th className="py-3 px-4">Last Visit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  return (
                    <tr key={customer.customer_id} className="hover:bg-slate-50 transition-colors">
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{customer.full_name}</div>
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

                      {/* Agreed Discount Rate (Manager & Admin Controlled) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {customer.discount_percent && customer.discount_percent > 0 ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Percent className="w-3 h-3 text-emerald-600" />
                              <span>{customer.discount_percent}% VIP Discount</span>
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

                      {/* Purchase Count */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <span className="font-semibold">{customer.purchase_count}</span> orders
                      </td>

                      {/* Preferred Fish */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium text-[11px]">
                          {customer.preferred_product || 'Catfish'}
                        </span>
                      </td>

                      {/* Last Purchase */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {customer.last_purchase_date || 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Discount Rate Button (Manager/Admin direct or PIN prompt) */}
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
                            <span>Discount</span>
                          </button>

                          <button
                            onClick={() => setSelectedCustomerForDrawer(customer)}
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

      {/* Customer Details & History Modal */}
      {selectedCustomerForDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {selectedCustomerForDrawer.customer_id}
                </span>
                <h3 className="text-base font-bold text-white">
                  {selectedCustomerForDrawer.full_name}
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

            <div className="p-5 space-y-4 text-xs">
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

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] text-blue-800 uppercase font-bold block">Favorite Fish</span>
                  <span className="text-sm font-black text-blue-900 truncate block">
                    {selectedCustomerForDrawer.preferred_product || 'Tilapia'}
                  </span>
                  <span className="text-[9px] text-blue-700 block">Top Frequency</span>
                </div>
              </div>

              {/* Contact info & notes */}
              <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-slate-600">
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

              {/* Transactions History */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Purchase History ({customerSales.length} records)</h4>
                <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-slate-100">
                  {customerSales.length === 0 ? (
                    <p className="text-slate-400 py-3 text-center">No recorded transactions yet.</p>
                  ) : (
                    customerSales.map(tx => (
                      <div key={tx.transaction_id} className="pt-2 flex justify-between items-center">
                        <div>
                          <div className="font-mono font-bold text-slate-800">{tx.transaction_id}</div>
                          <div className="text-[11px] text-slate-400">{tx.date_time} • {tx.payment_method}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">₦{tx.final_amount.toLocaleString()}</div>
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

      {/* Edit Customer Discount Rate Modal (Manager or Admin Authorized) */}
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="e.g., Weekly 50kg wholesale agreement, VIP patron, Hotel supplier agreement"
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
                  <option value="Wholesale">Wholesale (Eligible for 10% on 50kg+)</option>
                  <option value="Restaurant">Restaurant (Bulk orders)</option>
                  <option value="Supermarket">Supermarket</option>
                </select>
              </div>

              {/* Discount Assignment (Manager / Admin Role Only) */}
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
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                    />
                    <input
                      type="text"
                      value={formData.discount_notes}
                      onChange={(e) => setFormData({ ...formData, discount_notes: e.target.value })}
                      placeholder="Reason for rate (e.g. Wholesale contract, Approved VIP)"
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
                  placeholder="e.g. Buys 20kg every Friday, prefers live catfish"
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

    </div>
  );
};
