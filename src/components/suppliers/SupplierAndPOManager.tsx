import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Supplier, PurchaseOrder, PaymentTerms, POStatus } from '../../types';
import { 
  Truck, 
  FileCheck2, 
  Plus, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  X, 
  AlertCircle,
  Package,
  ExternalLink,
  Lock,
  Shield
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';

interface SupplierAndPOManagerProps {
  initialTab?: 'suppliers' | 'orders';
  prefilledSupplierId?: string;
  prefilledItemSn?: string;
}

export const SupplierAndPOManager: React.FC<SupplierAndPOManagerProps> = ({
  initialTab = 'orders',
  prefilledSupplierId,
  prefilledItemSn,
}) => {
  const {
    suppliers,
    products,
    purchaseOrders,
    addSupplier,
    updateSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    getNextSupplierId,
    hasPermission,
    activeStaff
  } = usePos();

  const canCreatePo = hasPermission('CAN_CREATE_PO');
  const canCancelPo = hasPermission('CAN_CANCEL_PO');
  const canManageSuppliers = hasPermission('CAN_MANAGE_SUPPLIERS');

  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'suppliers'>(initialTab);

  // Security PIN override modal state
  const [overrideContext, setOverrideContext] = useState<{
    isOpen: boolean;
    actionDescription: string;
    onAuthorized: () => void;
  }>({
    isOpen: false,
    actionDescription: '',
    onAuthorized: () => {},
  });

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    supplier_id: prefilledSupplierId || suppliers[0]?.supplier_id || 'SUP-00012',
    item_sn: prefilledItemSn || products[0]?.item_sn || 'FISH-00045',
    quantity_ordered: 50,
    unit_cost: 2500,
    notes: 'Restock order',
  });

  const handleRequestCreatePo = () => {
    if (canCreatePo) {
      setIsPoModalOpen(true);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Create New Purchase Order (Manager or Admin PIN Required)',
        onAuthorized: () => setIsPoModalOpen(true),
      });
    }
  };

  const handleRequestAddSupplier = () => {
    if (canManageSuppliers) {
      setIsSupplierModalOpen(true);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Register New Fish Supplier (Manager or Admin PIN Required)',
        onAuthorized: () => setIsSupplierModalOpen(true),
      });
    }
  };

  const handleRequestCancelPo = (poId: string) => {
    if (canCancelPo) {
      cancelPurchaseOrder(poId);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Cancel Purchase Order ${poId} (Manager or Admin PIN Required)`,
        onAuthorized: () => cancelPurchaseOrder(poId),
      });
    }
  };

  // Receive PO Modal
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');

  // Add Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    products_supplied: ['Catfish', 'Tilapia'],
    lead_time_days: 2,
    payment_terms: 'Cash on Delivery' as PaymentTerms,
    average_unit_cost: 2500,
    reliability_rating: 4.8,
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Handle PO product select change to sync default cost
  const handlePoItemChange = (item_sn: string) => {
    const prod = products.find(p => p.item_sn === item_sn);
    setPoForm(prev => ({
      ...prev,
      item_sn,
      supplier_id: prod?.supplier_id || prev.supplier_id,
      unit_cost: prod?.item_cost || 2500,
    }));
  };

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    createPurchaseOrder({
      supplier_id: poForm.supplier_id,
      item_sn: poForm.item_sn,
      quantity_ordered: poForm.quantity_ordered,
      unit_cost: poForm.unit_cost,
      notes: poForm.notes,
    });
    setIsPoModalOpen(false);
  };

  const handleConfirmReceive = () => {
    if (!receivingPo) return;
    receivePurchaseOrder(receivingPo.po_id, newExpiryDate || undefined);
    setReceivingPo(null);
    setNewExpiryDate('');
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    addSupplier(supplierForm);
    setIsSupplierModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Title & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Supplier & Purchase Order System</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage wholesale fish suppliers, automated lead times, delivery schedules, and 1-click stock receiving.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeSubTab === 'orders' ? (
            <button
              onClick={handleRequestCreatePo}
              className={`flex items-center space-x-1.5 px-4 py-2 text-white rounded-lg font-semibold text-xs shadow-sm transition-all cursor-pointer ${
                canCreatePo ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title={canCreatePo ? "Create Purchase Order" : "Requires Manager/Admin PIN"}
            >
              {canCreatePo ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>Create Purchase Order</span>
              {!canCreatePo && (
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded font-mono">PIN</span>
              )}
            </button>
          ) : (
            <button
              onClick={handleRequestAddSupplier}
              className={`flex items-center space-x-1.5 px-4 py-2 text-white rounded-lg font-semibold text-xs shadow-sm transition-all cursor-pointer ${
                canManageSuppliers ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title={canManageSuppliers ? "Add New Supplier" : "Requires Manager/Admin PIN"}
            >
              {canManageSuppliers ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>Add New Supplier</span>
              {!canManageSuppliers && (
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded font-mono">PIN</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Supervisor Mode Banner */}
      {activeStaff.role === 'Supervisor' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Supervisor Privileges:</span> Authorized to inspect and <strong>Receive Goods</strong> into stock. Creating or cancelling POs requires Manager or Admin authorization.
            </div>
          </div>
          <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-mono uppercase">
            Supervisor
          </span>
        </div>
      )}

      {/* Sub tabs: Purchase Orders vs Suppliers */}
      <div className="flex space-x-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`pb-3 px-3 font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeSubTab === 'orders'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Purchase Orders ({purchaseOrders.length})</span>
          {purchaseOrders.filter(p => p.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {purchaseOrders.filter(p => p.status === 'PENDING').length} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`pb-3 px-3 font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeSubTab === 'suppliers'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Registered Suppliers ({suppliers.length})</span>
        </button>
      </div>

      {/* View 1: Purchase Orders */}
      {activeSubTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">PO ID</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Product Item</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Total Cost (₦)</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map(po => {
                    const supplier = suppliers.find(s => s.supplier_id === po.supplier_id);
                    const product = products.find(p => p.item_sn === po.item_sn);

                    return (
                      <tr key={po.po_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {po.po_id}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{supplier?.supplier_name || po.supplier_id}</div>
                          <div className="text-[10px] text-slate-400">{po.supplier_id}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{product?.item_name || po.item_sn}</div>
                          <div className="font-mono text-[10px] text-emerald-600">{po.item_sn}</div>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          {po.quantity_ordered} {product?.product_measure_unit || 'KG'}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          ₦{po.unit_cost.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-950">
                          ₦{po.total_cost.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {po.order_date}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <span className={po.status === 'PENDING' ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            {po.expected_delivery_date}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : po.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {po.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {po.status === 'PENDING' ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  const defaultExp = new Date();
                                  defaultExp.setDate(defaultExp.getDate() + 30);
                                  setNewExpiryDate(defaultExp.toISOString().split('T')[0]);
                                  setReceivingPo(po);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs flex items-center space-x-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Receive Goods</span>
                              </button>
                              <button
                                onClick={() => handleRequestCancelPo(po.po_id)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded text-[10px] relative"
                                title={canCancelPo ? "Cancel order" : "Requires Manager/Admin PIN"}
                              >
                                <X className="w-3.5 h-3.5" />
                                {!canCancelPo && (
                                  <Lock className="w-2 h-2 text-amber-500 absolute -top-0.5 -right-0.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Received {po.actual_delivery_date || po.order_date}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Suppliers Directory */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suppliers.map(supplier => {
            return (
              <div
                key={supplier.supplier_id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-emerald-600 font-bold">
                        {supplier.supplier_id}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{supplier.supplier_name}</h4>
                      <p className="text-xs text-slate-500">Contact: {supplier.contact_person}</p>
                    </div>
                    {/* Stars */}
                    <div className="flex items-center text-amber-500 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                      <span>{supplier.reliability_rating}</span>
                    </div>
                  </div>

                  {/* Supplier Attributes */}
                  <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{supplier.phone_number}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supplier.address}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span>Lead Time:</span>
                      <strong className="text-slate-800">{supplier.lead_time_days} Days</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Payment Terms:</span>
                      <strong className="text-slate-800">{supplier.payment_terms}</strong>
                    </div>
                  </div>

                  {/* Products Supplied */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Products Supplied</span>
                    <div className="flex flex-wrap gap-1">
                      {supplier.products_supplied.map((prod, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {prod}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setPoForm(prev => ({
                        ...prev,
                        supplier_id: supplier.supplier_id,
                      }));
                      setIsPoModalOpen(true);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Order From This Supplier</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Purchase Order */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Create New Purchase Order</h3>
                <p className="text-[11px] text-slate-400">
                  Calculates expected delivery based on supplier lead time.
                </p>
              </div>
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Fish Product *
                </label>
                <select
                  value={poForm.item_sn}
                  onChange={(e) => handlePoItemChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  {products.map(p => (
                    <option key={p.item_sn} value={p.item_sn}>
                      {p.item_name} ({p.item_sn}) - Current Stock: {p.quantity} {p.product_measure_unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Supplier *
                </label>
                <select
                  value={poForm.supplier_id}
                  onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name} (Lead Time: {s.lead_time_days} days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantity to Order *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={poForm.quantity_ordered}
                    onChange={(e) => setPoForm({ ...poForm, quantity_ordered: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit Cost (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={poForm.unit_cost}
                    onChange={(e) => setPoForm({ ...poForm, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Total Order Cost Preview */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-medium">Total Order Cost:</span>
                <span className="font-extrabold text-slate-900 font-mono text-sm">
                  ₦{(poForm.quantity_ordered * poForm.unit_cost).toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Order Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  placeholder="e.g. Urgent morning delivery requested"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Generate Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Goods Receipt */}
      {receivingPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Confirm Goods Delivery</h3>
                <p className="text-[11px] text-slate-400">
                  PO: <span className="font-mono text-emerald-400">{receivingPo.po_id}</span>
                </p>
              </div>
              <button
                onClick={() => setReceivingPo(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 space-y-1">
                <div className="font-bold text-sm">
                  Receiving {receivingPo.quantity_ordered} KG of {products.find(p => p.item_sn === receivingPo.item_sn)?.item_name || receivingPo.item_sn}
                </div>
                <div className="text-xs text-emerald-700">
                  Stock will automatically increase from{' '}
                  <strong>{products.find(p => p.item_sn === receivingPo.item_sn)?.quantity || 0} KG</strong> to{' '}
                  <strong>
                    {(products.find(p => p.item_sn === receivingPo.item_sn)?.quantity || 0) + receivingPo.quantity_ordered} KG
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Update Product Expiry Date (Fresh Batch) *
                </label>
                <input
                  type="date"
                  required
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Ensure the new expiry date matches the physical delivery docket or inspection tag.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReceivingPo(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Confirm & Update Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Register Fish Supplier</h3>
                <p className="text-[11px] text-slate-400">
                  Assigns Supplier ID: <span className="font-mono text-emerald-400">{getNextSupplierId()}</span>
                </p>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierForm.supplier_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, supplier_name: e.target.value })}
                  placeholder="e.g. Lagos Fish Wholesale Ltd"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierForm.contact_person}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                    placeholder="e.g. Mr. Okafor"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={supplierForm.phone_number}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone_number: e.target.value })}
                    placeholder="+234 803 456 7890"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder="supplier@fish.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="e.g. Lekki Fish Market, Lagos"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={supplierForm.lead_time_days}
                    onChange={(e) => setSupplierForm({ ...supplierForm, lead_time_days: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={supplierForm.payment_terms}
                    onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value as PaymentTerms })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Net 7 Days">Net 7 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager / Admin PIN Authorization Modal for PO & Supplier Actions */}
      <PinAuthModal
        isOpen={overrideContext.isOpen}
        onClose={() => setOverrideContext(prev => ({ ...prev, isOpen: false }))}
        mode="OVERRIDE"
        requiredRole={['Manager', 'Admin']}
        title="Manager Authorization Required"
        subtitle="Creating or cancelling POs requires Manager (Chidinma: 4444) or Admin (Alex: 9999) authorization."
        actionDescription={overrideContext.actionDescription}
        onSuccess={() => {
          const action = overrideContext.onAuthorized;
          setOverrideContext(prev => ({ ...prev, isOpen: false }));
          action();
        }}
      />
    </div>
  );
};
