import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Supplier, PurchaseOrder, PaymentTerms, POStatus, PurchaseOrderItem, ProductUnit } from '../../types';
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
  Shield,
  Trash2,
  History,
  Info,
  ListOrdered,
  Printer,
  Edit3,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';

interface SupplierAndPOManagerProps {
  initialTab?: 'suppliers' | 'orders';
  prefilledSupplierId?: string;
  prefilledItemSn?: string;
}

interface DraftPoItem {
  item_sn: string;
  item_name: string;
  product_measure_unit: ProductUnit;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  expiry_date?: string;
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
    deleteSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    deletePurchaseOrder,
    getNextSupplierId,
    hasPermission,
    activeStaff
  } = usePos();

  const canCreatePo = hasPermission('CAN_CREATE_PO');
  const canCancelPo = hasPermission('CAN_CANCEL_PO');
  const canReceiveGoods = hasPermission('CAN_RECEIVE_GOODS');
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

  // Multi-Item PO Creation State
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState(prefilledSupplierId || suppliers[0]?.supplier_id || 'SUP-00001');
  const [poExpectedDeliveryDate, setPoExpectedDeliveryDate] = useState('');
  const [poNotes, setPoNotes] = useState('Restock purchase order');
  const [draftItems, setDraftItems] = useState<DraftPoItem[]>([]);

  // Draft Item Adder inputs
  const [selectedProductSn, setSelectedProductSn] = useState(prefilledItemSn || products[0]?.item_sn || '');
  const [currentQty, setCurrentQty] = useState<number>(50);
  const [currentUnitCost, setCurrentUnitCost] = useState<number>(2500);

  // Partial / Full Receiving Modal State
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receivingItemsMap, setReceivingItemsMap] = useState<Record<string, { qty: number; expiry: string }>>({});
  const [deliveryRef, setDeliveryRef] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [isReceivingSubmitting, setIsReceivingSubmitting] = useState(false);

  // View PO Details & Receiving History Drawer
  const [viewHistoryPo, setViewHistoryPo] = useState<PurchaseOrder | null>(null);

  // Goods Received Note (GRN) Print View Modal State
  const [grnPrintPo, setGrnPrintPo] = useState<PurchaseOrder | null>(null);

  // Add / Edit Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    products_supplied: ['Groceries', 'General Goods'],
    lead_time_days: 2,
    payment_terms: 'Cash on Delivery' as PaymentTerms,
    average_unit_cost: 2500,
    reliability_rating: 4.8,
    status: 'Active' as 'Active' | 'Inactive',
  });

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupplierForm, setEditSupplierForm] = useState({
    supplier_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    lead_time_days: 2,
    payment_terms: 'Cash on Delivery' as PaymentTerms,
    status: 'Active' as 'Active' | 'Inactive',
  });

  // When opening Create PO modal, initialize default draft item
  const openCreatePoModal = (supplierId?: string) => {
    const targetSupplierId = supplierId || prefilledSupplierId || suppliers[0]?.supplier_id || '';
    setPoSupplierId(targetSupplierId);
    
    const supplier = suppliers.find(s => s.supplier_id === targetSupplierId);
    const leadTime = supplier?.lead_time_days || 2;
    const defaultDelivery = new Date();
    defaultDelivery.setDate(defaultDelivery.getDate() + leadTime);
    setPoExpectedDeliveryDate(defaultDelivery.toISOString().split('T')[0]);

    const initialProduct = products.find(p => p.item_sn === prefilledItemSn) || products[0];
    if (initialProduct) {
      setSelectedProductSn(initialProduct.item_sn);
      setCurrentUnitCost(initialProduct.item_cost || 2500);
      setCurrentQty(50);
      setDraftItems([{
        item_sn: initialProduct.item_sn,
        item_name: initialProduct.item_name,
        product_measure_unit: initialProduct.product_measure_unit || 'KG',
        quantity_ordered: 50,
        unit_cost: initialProduct.item_cost || 2500,
        total_cost: Math.round(50 * (initialProduct.item_cost || 2500)),
      }]);
    } else {
      setDraftItems([]);
    }
    setIsPoModalOpen(true);
  };

  const handleAddDraftItem = () => {
    if (!selectedProductSn || currentQty <= 0) return;
    const prod = products.find(p => p.item_sn === selectedProductSn);
    if (!prod) return;

    // Check if already in draft items
    const existingIndex = draftItems.findIndex(i => i.item_sn === selectedProductSn);
    if (existingIndex >= 0) {
      setDraftItems(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          const updatedQty = item.quantity_ordered + currentQty;
          return {
            ...item,
            quantity_ordered: updatedQty,
            unit_cost: currentUnitCost,
            total_cost: Math.round(updatedQty * currentUnitCost),
          };
        }
        return item;
      }));
    } else {
      setDraftItems(prev => [
        ...prev,
        {
          item_sn: prod.item_sn,
          item_name: prod.item_name,
          product_measure_unit: prod.product_measure_unit || 'KG',
          quantity_ordered: currentQty,
          unit_cost: currentUnitCost,
          total_cost: Math.round(currentQty * currentUnitCost),
        },
      ]);
    }
  };

  const handleRemoveDraftItem = (item_sn: string) => {
    setDraftItems(prev => prev.filter(i => i.item_sn !== item_sn));
  };

  const handleDraftItemQtyChange = (item_sn: string, qty: number) => {
    if (qty <= 0) return;
    setDraftItems(prev => prev.map(item => {
      if (item.item_sn === item_sn) {
        return {
          ...item,
          quantity_ordered: qty,
          total_cost: Math.round(qty * item.unit_cost),
        };
      }
      return item;
    }));
  };

  const handleDraftItemCostChange = (item_sn: string, cost: number) => {
    if (cost < 0) return;
    setDraftItems(prev => prev.map(item => {
      if (item.item_sn === item_sn) {
        return {
          ...item,
          unit_cost: cost,
          total_cost: Math.round(item.quantity_ordered * cost),
        };
      }
      return item;
    }));
  };

  const totalDraftOrderCost = draftItems.reduce((acc, it) => acc + it.total_cost, 0);
  const totalDraftOrderQty = draftItems.reduce((acc, it) => acc + it.quantity_ordered, 0);

  const handleRequestCreatePo = () => {
    if (canCreatePo) {
      openCreatePoModal();
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Create New Purchase Order (Manager or Admin PIN Required)',
        onAuthorized: () => openCreatePoModal(),
      });
    }
  };

  const handleRequestAddSupplier = () => {
    if (canManageSuppliers) {
      setIsSupplierModalOpen(true);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Register New Supplier (Manager or Admin PIN Required)',
        onAuthorized: () => setIsSupplierModalOpen(true),
      });
    }
  };

  const handleRequestCancelPo = (poId: string) => {
    if (canCancelPo) {
      if (confirm(`Are you sure you want to cancel Purchase Order ${poId}?`)) {
        cancelPurchaseOrder(poId);
      }
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Cancel Purchase Order ${poId} (Manager or Admin PIN Required)`,
        onAuthorized: () => cancelPurchaseOrder(poId),
      });
    }
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) {
      alert('Please add at least one product item to the purchase order.');
      return;
    }

    try {
      await createPurchaseOrder({
        supplier_id: poSupplierId,
        items: draftItems.map(it => ({
          item_sn: it.item_sn,
          quantity_ordered: it.quantity_ordered,
          unit_cost: it.unit_cost,
        })),
        expected_delivery_date: poExpectedDeliveryDate || undefined,
        notes: poNotes,
      });
      setIsPoModalOpen(false);
      setDraftItems([]);
    } catch (err: any) {
      alert(err.message || 'Failed to create purchase order.');
    }
  };

  // Helper to format expiry date clearly for humans (e.g. 02 Nov 2026) and avoid MM/DD vs DD/MM confusion
  const formatHumanExpiry = (dateStr?: string) => {
    if (!dateStr) return 'No expiry set';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) {
          const formatted = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dt.setHours(0, 0, 0, 0);
          const diffDays = Math.round((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const diffText = diffDays > 0 ? `in ${diffDays}d` : diffDays === 0 ? 'Today' : `${Math.abs(diffDays)}d ago`;
          return `${formatted} (${diffText})`;
        }
      }
    } catch {}
    return dateStr;
  };

  // Adjust expiry date by exact number of days (+1 day, -1 day, etc.)
  const handleAdjustExpiryDays = (itemSn: string, deltaDays: number) => {
    setReceivingItemsMap(prev => {
      const current = prev[itemSn] || { qty: 0, expiry: new Date().toISOString().split('T')[0] };
      let dt: Date;
      if (current.expiry && current.expiry.includes('-')) {
        const [y, m, d] = current.expiry.split('-').map(Number);
        dt = new Date(y, m - 1, d);
      } else {
        dt = new Date();
      }
      if (isNaN(dt.getTime())) dt = new Date();
      dt.setDate(dt.getDate() + deltaDays);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return {
        ...prev,
        [itemSn]: {
          ...current,
          expiry: `${y}-${m}-${d}`,
        },
      };
    });
  };

  // Quick preset helper (+30d, +60d, +90d, +180d, +1yr)
  const handleSetPresetExpiry = (itemSn: string, daysFromNow: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + daysFromNow);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    setReceivingItemsMap(prev => ({
      ...prev,
      [itemSn]: {
        ...(prev[itemSn] || { qty: 0, expiry: '' }),
        expiry: `${y}-${m}-${d}`,
      },
    }));
  };

  // Quick-fill backorder helpers for receiving modal
  const handleFillAllBackorders = (po: PurchaseOrder) => {
    const items = po.items && po.items.length > 0 ? po.items : [{
      item_sn: po.item_sn || '',
      quantity_ordered: po.quantity_ordered || 0,
      quantity_received: po.quantity_received || 0,
    }];
    setReceivingItemsMap(prev => {
      const nextMap = { ...prev };
      items.forEach(it => {
        const ord = it.quantity_ordered || 0;
        const rec = it.quantity_received || 0;
        const pending = Math.max(0, Math.round((ord - rec) * 1000) / 1000);
        nextMap[it.item_sn] = {
          ...(nextMap[it.item_sn] || { expiry: '' }),
          qty: pending,
        };
      });
      return nextMap;
    });
  };

  const handleClearAllReceiving = () => {
    setReceivingItemsMap(prev => {
      const nextMap = { ...prev };
      Object.keys(nextMap).forEach(k => {
        nextMap[k] = { ...nextMap[k], qty: 0 };
      });
      return nextMap;
    });
  };

  // Open Receiving Goods Modal
  const openReceiveModal = (po: PurchaseOrder) => {
    if (!canReceiveGoods) {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Receive Delivery for PO ${po.po_id} (Supervisor, Manager, or Admin PIN Required)`,
        onAuthorized: () => openReceiveModal(po),
      });
      return;
    }

    const defaultExp = new Date();
    defaultExp.setDate(defaultExp.getDate() + 30);
    const defaultExpStr = defaultExp.toISOString().split('T')[0];

    const initialMap: Record<string, { qty: number; expiry: string }> = {};

    // Get normalized items
    const items = po.items && po.items.length > 0
      ? po.items
      : [{
          item_sn: po.item_sn || '',
          item_name: po.item_sn || '',
          quantity_ordered: po.quantity_ordered || 0,
          quantity_received: po.quantity_received || 0,
          quantity_pending: Math.max(0, (po.quantity_ordered || 0) - (po.quantity_received || 0)),
          unit_cost: po.unit_cost || 0,
          total_cost: po.total_cost,
        }];

    items.forEach(it => {
      const ord = it.quantity_ordered || 0;
      const rec = it.quantity_received || 0;
      const pending = Math.max(0, Math.round((ord - rec) * 1000) / 1000);
      const existingProd = products.find(p => p.item_sn === it.item_sn);
      const existingExpiry = it.expiry_date || (existingProd?.expiry_date && existingProd.expiry_date.length >= 8 ? existingProd.expiry_date : defaultExpStr);

      initialMap[it.item_sn] = {
        qty: pending,
        expiry: existingExpiry || defaultExpStr,
      };
    });

    setReceivingItemsMap(initialMap);
    setDeliveryRef('');
    setReceiptNotes('');
    setReceivingPo(po);
  };

  const handleConfirmReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPo) return;

    // Validate that received quantities do not exceed remaining pending backorder
    const items = receivingPo.items && receivingPo.items.length > 0
      ? receivingPo.items
      : [{
          item_sn: receivingPo.item_sn || '',
          item_name: receivingPo.item_sn || '',
          quantity_ordered: receivingPo.quantity_ordered || 0,
          quantity_received: receivingPo.quantity_received || 0,
        }];

    for (const it of items) {
      const ord = it.quantity_ordered || 0;
      const already = it.quantity_received || 0;
      const pending = Math.max(0, Math.round((ord - already) * 1000) / 1000);
      const receivingNow = receivingItemsMap[it.item_sn]?.qty || 0;
      if (receivingNow > pending) {
        alert(`Cannot receive ${receivingNow} units of "${it.item_name || it.item_sn}". The maximum remaining pending quantity is ${pending}.`);
        return;
      }
    }

    const payloadItems = Object.entries(receivingItemsMap)
      .filter(([_, data]) => data.qty > 0)
      .map(([item_sn, data]) => ({
        item_sn,
        quantity_received: data.qty,
        expiry_date: data.expiry || undefined,
      }));

    if (payloadItems.length === 0) {
      alert('Please enter a received quantity greater than 0 for at least one item.');
      return;
    }

    setIsReceivingSubmitting(true);
    try {
      const res = await receivePurchaseOrder(receivingPo.po_id, {
        delivery_reference: deliveryRef.trim() || undefined,
        receipt_notes: receiptNotes.trim() || undefined,
        items: payloadItems,
      });

      if (res && !res.success) {
        alert(res.error || 'Failed to record goods receipt.');
      } else {
        setReceivingPo(null);
      }
    } catch (err: any) {
      alert(err.message || 'Error recording goods receipt.');
    } finally {
      setIsReceivingSubmitting(false);
    }
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    addSupplier(supplierForm);
    setIsSupplierModalOpen(false);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setEditSupplierForm({
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person,
      phone_number: supplier.phone_number,
      email: supplier.email || '',
      address: supplier.address || '',
      lead_time_days: supplier.lead_time_days || 2,
      payment_terms: supplier.payment_terms || 'Cash on Delivery',
      status: supplier.status || 'Active',
    });
  };

  const handleUpdateSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    updateSupplier(editingSupplier.supplier_id, editSupplierForm);
    setEditingSupplier(null);
  };

  const handleDeleteSupplierClick = (supplier: Supplier) => {
    // Check if there are active purchase orders for this supplier
    const activeOrders = purchaseOrders.filter(
      po => po.supplier_id === supplier.supplier_id && (po.status === 'PENDING' || po.status === 'PARTIALLY_RECEIVED')
    );
    if (activeOrders.length > 0) {
      alert(`Cannot delete supplier ${supplier.supplier_name}: There are ${activeOrders.length} active purchase order(s) awaiting delivery from this vendor. Please fulfill or cancel them first.`);
      return;
    }

    const performDelete = () => {
      if (confirm(`Are you sure you want to permanently delete supplier "${supplier.supplier_name}" (${supplier.supplier_id})?`)) {
        deleteSupplier(supplier.supplier_id);
      }
    };

    if (canManageSuppliers) {
      performDelete();
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Delete Supplier ${supplier.supplier_name} (Admin or Manager PIN Required)`,
        onAuthorized: performDelete,
      });
    }
  };

  const handleDeletePoClick = async (poId: string) => {
    const performDelete = async () => {
      if (confirm(`Are you sure you want to permanently delete purchase order record ${poId}?`)) {
        const res = await deletePurchaseOrder(poId);
        if (res && !res.success) {
          alert(res.error || 'Failed to delete purchase order.');
        }
      }
    };

    if (canCancelPo) {
      await performDelete();
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Delete Purchase Order ${poId} (Manager or Admin PIN Required)`,
        onAuthorized: performDelete,
      });
    }
  };

  // Helper to get total ordered, received, and pending across PO items
  const getPoMetrics = (po: PurchaseOrder) => {
    const items = po.items && po.items.length > 0
      ? po.items
      : [{
          item_sn: po.item_sn || '',
          item_name: po.item_sn || '',
          quantity_ordered: po.quantity_ordered || 0,
          quantity_received: po.status === 'RECEIVED' ? (po.quantity_ordered || 0) : (po.quantity_received || 0),
          quantity_pending: po.status === 'RECEIVED' ? 0 : Math.max(0, (po.quantity_ordered || 0) - (po.quantity_received || 0)),
          unit_cost: po.unit_cost || 0,
          total_cost: po.total_cost,
        }];

    const totalOrdered = items.reduce((sum, i) => sum + (i.quantity_ordered || 0), 0);
    const totalReceived = items.reduce((sum, i) => sum + (i.quantity_received || 0), 0);
    const totalPending = items.reduce((sum, i) => {
      const ord = i.quantity_ordered || 0;
      const rec = i.quantity_received || 0;
      return sum + Math.max(0, Math.round((ord - rec) * 1000) / 1000);
    }, 0);
    const percentComplete = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

    return {
      items,
      totalOrdered,
      totalReceived,
      totalPending,
      percentComplete,
    };
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
            Multi-item purchase orders, partial shipment tracking, atomic stock receiving, and supplier directory.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2">
          {activeSubTab === 'orders' ? (
            <button
              onClick={handleRequestCreatePo}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
              {!canCreatePo && <Lock className="w-3 h-3 ml-1 text-emerald-200" />}
            </button>
          ) : (
            <button
              onClick={handleRequestAddSupplier}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Supplier</span>
              {!canManageSuppliers && <Lock className="w-3 h-3 ml-1 text-emerald-200" />}
            </button>
          )}
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex border-b border-slate-200 text-sm">
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

      {/* View 1: Purchase Orders Table */}
      {activeSubTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Total Cost (₦)</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No purchase orders recorded yet. Click "Create Purchase Order" above to generate your first order.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map(po => {
                    const supplier = suppliers.find(s => s.supplier_id === po.supplier_id);
                    const { items, totalOrdered, totalReceived, totalPending, percentComplete } = getPoMetrics(po);
                    const isMultiItem = items.length > 1;

                    return (
                      <tr key={po.po_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <div>{po.po_id}</div>
                          {po.receiving_history && po.receiving_history.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
                              <History className="w-3 h-3" />
                              {po.receiving_history.length} receipt{po.receiving_history.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{supplier?.supplier_name || po.supplier_id}</div>
                          <div className="text-[10px] text-slate-400">{po.supplier_id}</div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[240px]">
                          {isMultiItem ? (
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1">
                                <span>{items.length} Products</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                                  {totalOrdered} units
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate" title={items.map(i => `${i.item_name} (${i.quantity_ordered})`).join(', ')}>
                                {items.slice(0, 2).map(i => i.item_name).join(', ')}{items.length > 2 ? ` +${items.length - 2} more` : ''}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-900">
                                {items[0]?.item_name || po.item_sn || 'Product'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {items[0]?.quantity_ordered || po.quantity_ordered} {items[0]?.product_measure_unit || 'KG'} @ ₦{(items[0]?.unit_cost || po.unit_cost || 0).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Progress column */}
                        <td className="py-3.5 px-4 min-w-[130px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                              <span>{totalReceived}/{totalOrdered} rec'd</span>
                              <span className="font-bold">{percentComplete}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  po.status === 'RECEIVED'
                                    ? 'bg-emerald-500'
                                    : po.status === 'PARTIALLY_RECEIVED'
                                    ? 'bg-blue-500'
                                    : 'bg-amber-400'
                                }`}
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                            {totalPending > 0 && po.status !== 'CANCELLED' && (
                              <div className="text-[9px] text-amber-700 font-medium">
                                {totalPending} units remaining
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-950">
                          ₦{po.total_cost.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="text-slate-500">Ordered: {po.order_date}</div>
                          <div className={po.status === 'PENDING' ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                            Due: {po.expected_delivery_date || 'N/A'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {po.status === 'RECEIVED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center w-fit gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Fulfilled
                            </span>
                          )}
                          {po.status === 'PARTIALLY_RECEIVED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center w-fit gap-1">
                              <Clock className="w-3 h-3" />
                              Partial ({percentComplete}%)
                            </span>
                          )}
                          {po.status === 'PENDING' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center w-fit gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                          {po.status === 'CANCELLED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 flex items-center w-fit gap-1">
                              <X className="w-3 h-3" />
                              Cancelled
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Receive goods button (active for PENDING and PARTIALLY_RECEIVED) */}
                            {(po.status === 'PENDING' || po.status === 'PARTIALLY_RECEIVED') && (
                              <button
                                onClick={() => openReceiveModal(po)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs flex items-center space-x-1 transition-all"
                                title="Receive full or partial delivery"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Receive Goods</span>
                              </button>
                            )}

                            {/* View details & history drawer button */}
                            <button
                              onClick={() => setViewHistoryPo(po)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center space-x-1"
                              title="View items and receiving history"
                            >
                              <Info className="w-3.5 h-3.5 text-slate-500" />
                              <span>Details</span>
                            </button>

                            {/* Cancel PO button */}
                            {(po.status === 'PENDING' || po.status === 'PARTIALLY_RECEIVED') && (
                              <button
                                onClick={() => handleRequestCancelPo(po.po_id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded text-[10px] relative transition-colors"
                                title={canCancelPo ? "Cancel order" : "Requires Manager/Admin PIN"}
                              >
                                <X className="w-3.5 h-3.5" />
                                {!canCancelPo && (
                                  <Lock className="w-2 h-2 text-amber-500 absolute -top-0.5 -right-0.5" />
                                )}
                              </button>
                            )}

                            {/* Delete PO button (for Cancelled or Completed records) */}
                            {po.status === 'CANCELLED' && (
                              <button
                                onClick={() => handleDeletePoClick(po.po_id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded text-[10px] transition-colors"
                                title="Delete cancelled purchase order"
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
      )}

      {/* View 2: Suppliers Directory */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suppliers.map(supplier => {
            return (
              <div
                key={supplier.supplier_id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-emerald-600 font-bold">
                          {supplier.supplier_id}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          supplier.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {supplier.status || 'Active'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{supplier.supplier_name}</h4>
                      <p className="text-xs text-slate-500">Contact: {supplier.contact_person}</p>
                    </div>
                    
                    {/* Actions & Rating */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center text-amber-500 text-xs font-bold mr-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                        <span>{supplier.reliability_rating}</span>
                      </div>
                      <button
                        onClick={() => handleOpenEditSupplier(supplier)}
                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-emerald-700 rounded transition-colors"
                        title="Edit Supplier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplierClick(supplier)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                    onClick={() => openCreatePoModal(supplier.supplier_id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Order For This Supplier</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Create Multi-Item Purchase Order */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>Create Multi-Item Purchase Order</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Bundle multiple inventory products from a supplier into a single tracked purchase order.
                </p>
              </div>
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="p-5 space-y-4 text-xs">
              {/* Supplier & Delivery Date Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Supplier *
                  </label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => {
                      const newSuppId = e.target.value;
                      setPoSupplierId(newSuppId);
                      const supp = suppliers.find(s => s.supplier_id === newSuppId);
                      const lead = supp?.lead_time_days || 2;
                      const date = new Date();
                      date.setDate(date.getDate() + lead);
                      setPoExpectedDeliveryDate(date.toISOString().split('T')[0]);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name} (Lead Time: {s.lead_time_days} days)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Expected Delivery Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={poExpectedDeliveryDate}
                    onChange={(e) => setPoExpectedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Multi-Item Builder Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Order Items ({draftItems.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Add all items needed from this vendor
                  </span>
                </div>

                {/* Item Adder Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Select Product</label>
                    <select
                      value={selectedProductSn}
                      onChange={(e) => {
                        const sn = e.target.value;
                        setSelectedProductSn(sn);
                        const prod = products.find(p => p.item_sn === sn);
                        if (prod) {
                          setCurrentUnitCost(prod.item_cost || 2500);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-800 text-xs"
                    >
                      {products.map(p => (
                        <option key={p.item_sn} value={p.item_sn}>
                          {p.item_name} ({p.item_sn}) - Stock: {p.quantity} {p.product_measure_unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={currentQty}
                      onChange={(e) => setCurrentQty(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-800 text-xs font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Cost (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={currentUnitCost}
                      onChange={(e) => setCurrentUnitCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-800 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddDraftItem}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Items List Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Qty</th>
                        <th className="py-2 px-3">Unit Cost (₦)</th>
                        <th className="py-2 px-3">Subtotal (₦)</th>
                        <th className="py-2 px-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            No products added yet. Select a product above and click "Add".
                          </td>
                        </tr>
                      ) : (
                        draftItems.map((item) => (
                          <tr key={item.item_sn} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900">{item.item_name}</div>
                              <div className="text-[10px] font-mono text-emerald-600">{item.item_sn}</div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity_ordered}
                                onChange={(e) => handleDraftItemQtyChange(item.item_sn, parseFloat(e.target.value) || 1)}
                                className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-bold text-center"
                              />
                              <span className="ml-1 text-[10px] text-slate-500">{item.product_measure_unit}</span>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                value={item.unit_cost}
                                onChange={(e) => handleDraftItemCostChange(item.item_sn, parseFloat(e.target.value) || 0)}
                                className="w-20 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-right"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              ₦{item.total_cost.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(item.item_sn)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Live Order Summary Footer */}
                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Items</span>
                      <strong className="text-sm font-bold">{draftItems.length} Products</strong>
                    </div>
                    <div className="border-l border-slate-700 pl-4">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Quantity</span>
                      <strong className="text-sm font-bold">{totalDraftOrderQty} Units</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Total Order Value</span>
                    <strong className="text-base font-extrabold font-mono text-emerald-300">
                      ₦{totalDraftOrderCost.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Order Notes & Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver before noon; refrigeration required for fresh catch"
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
                  disabled={draftItems.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Generate Purchase Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Partial & Full Goods Receiving */}
      {receivingPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Receive Shipment for {receivingPo.po_id}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Support for multi-item and partial deliveries. Inventory updates atomically.
                </p>
              </div>
              <button
                onClick={() => setReceivingPo(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceiveSubmit} className="p-5 space-y-4 text-xs">
              {/* Delivery Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Waybill / Delivery Docket Ref
                  </label>
                  <input
                    type="text"
                    value={deliveryRef}
                    onChange={(e) => setDeliveryRef(e.target.value)}
                    placeholder="e.g. WB-89021 or Invoice #45"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Receiving Notes
                  </label>
                  <input
                    type="text"
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="e.g. First partial batch arrived in cold van"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              {/* Items Breakdown Table with Inputs */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                      Verify Received Quantities & Fresh Batch Expiries
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Inventory stock will accurately increment by the exact batch quantities recorded below.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFillAllBackorders(receivingPo)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors"
                      title="Quickly fill remaining pending quantities for all items"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fill Remaining Backorders</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllReceiving}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors"
                      title="Reset all receiving quantities to 0"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>
                
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Item & Current Inventory</th>
                        <th className="py-2.5 px-3">Ordered</th>
                        <th className="py-2.5 px-3">Already Rec'd</th>
                        <th className="py-2.5 px-3">Remaining Backorder</th>
                        <th className="py-2.5 px-3">Receiving Now</th>
                        <th className="py-2.5 px-3 min-w-[240px]">Batch Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const items = receivingPo.items && receivingPo.items.length > 0
                          ? receivingPo.items
                          : [{
                              item_sn: receivingPo.item_sn || '',
                              item_name: receivingPo.item_sn || '',
                              quantity_ordered: receivingPo.quantity_ordered || 0,
                              quantity_received: receivingPo.quantity_received || 0,
                              quantity_pending: Math.max(0, (receivingPo.quantity_ordered || 0) - (receivingPo.quantity_received || 0)),
                              unit_cost: receivingPo.unit_cost || 0,
                              total_cost: receivingPo.total_cost,
                            }];

                        return items.map((item) => {
                          const ord = item.quantity_ordered || 0;
                          const already = item.quantity_received || 0;
                          const pending = Math.max(0, Math.round((ord - already) * 1000) / 1000);
                          const itemData = receivingItemsMap[item.item_sn] || { qty: 0, expiry: '' };
                          const prod = products.find(p => p.item_sn === item.item_sn);
                          const currentStock = prod?.quantity || 0;
                          const afterStock = Math.round((currentStock + (itemData.qty || 0)) * 1000) / 1000;

                          return (
                            <tr key={item.item_sn} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{item.item_name}</div>
                                <div className="text-[10px] font-mono text-slate-500">{item.item_sn}</div>
                                <div className="mt-0.5 text-[10px] text-slate-500 flex items-center gap-1">
                                  <span>On Hand: <strong>{currentStock}</strong></span>
                                  {itemData.qty > 0 && (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                                      → After: {afterStock}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-medium text-slate-700">
                                {ord}
                              </td>

                              <td className="py-2.5 px-3 text-slate-500 font-medium">
                                {already}
                              </td>

                              <td className="py-2.5 px-3 font-bold text-amber-700 font-mono">
                                {pending}
                              </td>

                              <td className="py-2.5 px-3">
                                {pending === 0 ? (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Fulfilled
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max={pending}
                                      step="any"
                                      value={itemData.qty}
                                      onChange={(e) => {
                                        const parsed = parseFloat(e.target.value) || 0;
                                        const clamped = Math.max(0, Math.min(pending, parsed));
                                        setReceivingItemsMap(prev => ({
                                          ...prev,
                                          [item.item_sn]: {
                                            ...prev[item.item_sn],
                                            qty: clamped,
                                          },
                                        }));
                                      }}
                                      className="w-20 px-2 py-1 bg-white border border-emerald-400 rounded-md font-bold text-emerald-800 text-center focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReceivingItemsMap(prev => ({
                                          ...prev,
                                          [item.item_sn]: {
                                            ...prev[item.item_sn],
                                            qty: pending,
                                          },
                                        }));
                                      }}
                                      className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10px] font-bold text-slate-700"
                                      title={`Receive maximum pending (${pending})`}
                                    >
                                      Max
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="space-y-1.5 min-w-[220px]">
                                  {/* Day Steppers + Native Date Input */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustExpiryDays(item.item_sn, -1)}
                                      title="Subtract 1 day from expiry"
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 rounded font-bold text-slate-700 text-xs transition-colors shrink-0"
                                    >
                                      -1d
                                    </button>
                                    <input
                                      type="date"
                                      value={itemData.expiry || ''}
                                      onChange={(e) => {
                                        const dateVal = e.target.value;
                                        if (!dateVal) return;
                                        setReceivingItemsMap(prev => ({
                                          ...prev,
                                          [item.item_sn]: {
                                            ...(prev[item.item_sn] || { qty: 0 }),
                                            expiry: dateVal,
                                          },
                                        }));
                                      }}
                                      className="flex-1 min-w-[130px] px-2 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustExpiryDays(item.item_sn, 1)}
                                      title="Add 1 day to expiry"
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 rounded font-bold text-slate-700 text-xs transition-colors shrink-0"
                                    >
                                      +1d
                                    </button>
                                  </div>

                                  {/* Explicit Human-Readable Date (Day Month Year) */}
                                  <div className="text-[11px]">
                                    <span className="inline-block font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      📅 {formatHumanExpiry(itemData.expiry)}
                                    </span>
                                  </div>

                                  {/* Quick Shelf-Life Presets */}
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {[
                                      { label: '+30d', days: 30 },
                                      { label: '+60d', days: 60 },
                                      { label: '+90d', days: 90 },
                                      { label: '+6mo', days: 180 },
                                      { label: '+1yr', days: 365 },
                                    ].map(preset => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => handleSetPresetExpiry(item.item_sn, preset.days)}
                                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 border border-slate-200 rounded text-[10px] font-medium text-slate-600 transition-colors"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Outcome Banner */}
              {(() => {
                const items = receivingPo.items && receivingPo.items.length > 0
                  ? receivingPo.items
                  : [{
                      item_sn: receivingPo.item_sn || '',
                      quantity_ordered: receivingPo.quantity_ordered || 0,
                      quantity_received: 0,
                      quantity_pending: receivingPo.quantity_ordered || 0,
                    }];

                const willBeFullyReceived = items.every(item => {
                  const nowRec = receivingItemsMap[item.item_sn]?.qty || 0;
                  const already = item.quantity_received || 0;
                  return (already + nowRec) >= item.quantity_ordered;
                });

                return willBeFullyReceived ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Full Fulfillment:</strong> All items will be completely fulfilled. This PO will be marked as <strong className="text-emerald-700">RECEIVED</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <strong>Partial Shipment:</strong> Unfulfilled quantities will remain pending. This PO will be marked as <strong className="text-blue-700">PARTIALLY_RECEIVED</strong> so you can receive the remainder later.
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReceivingPo(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReceivingSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isReceivingSubmitting ? 'Recording Receipt...' : 'Confirm Delivery & Update Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: View PO Details & Receiving History */}
      {viewHistoryPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-emerald-400" />
                  <span>PO Details & Receiving Log: {viewHistoryPo.po_id}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Full item specifications and historical batch receipts ledger.
                </p>
              </div>
              <button
                onClick={() => setViewHistoryPo(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Order Meta Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                  <span className="font-bold text-slate-900">{viewHistoryPo.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Supplier</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {suppliers.find(s => s.supplier_id === viewHistoryPo.supplier_id)?.supplier_name || viewHistoryPo.supplier_id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Order Date</span>
                  <span className="font-mono text-slate-900">{viewHistoryPo.order_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Total Value</span>
                  <span className="font-mono font-bold text-emerald-700">₦{viewHistoryPo.total_cost.toLocaleString()}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block mb-2">
                  Ordered Products Breakdown
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Ordered</th>
                        <th className="py-2.5 px-3">Received</th>
                        <th className="py-2.5 px-3">Pending</th>
                        <th className="py-2.5 px-3">Unit Cost</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const items = viewHistoryPo.items && viewHistoryPo.items.length > 0
                          ? viewHistoryPo.items
                          : [{
                              item_sn: viewHistoryPo.item_sn || '',
                              item_name: viewHistoryPo.item_sn || '',
                              quantity_ordered: viewHistoryPo.quantity_ordered || 0,
                              quantity_received: viewHistoryPo.status === 'RECEIVED' ? (viewHistoryPo.quantity_ordered || 0) : 0,
                              quantity_pending: viewHistoryPo.status === 'RECEIVED' ? 0 : (viewHistoryPo.quantity_ordered || 0),
                              unit_cost: viewHistoryPo.unit_cost || 0,
                              total_cost: viewHistoryPo.total_cost,
                            }];

                        return items.map(item => {
                          const ord = item.quantity_ordered || 0;
                          const rec = item.quantity_received || 0;
                          const pending = Math.max(0, Math.round((ord - rec) * 1000) / 1000);

                          return (
                            <tr key={item.item_sn}>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {item.item_name}
                                <span className="block font-mono text-[10px] text-slate-400">{item.item_sn}</span>
                              </td>
                              <td className="py-2 px-3">{ord}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{rec}</td>
                              <td className="py-2 px-3 font-bold text-amber-700">{pending}</td>
                              <td className="py-2 px-3 font-mono">₦{(item.unit_cost || 0).toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono font-bold">₦{item.total_cost.toLocaleString()}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Receiving Batches Timeline */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block mb-2">
                  Receiving History Timeline
                </span>
                
                {viewHistoryPo.receiving_history && viewHistoryPo.receiving_history.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {viewHistoryPo.receiving_history.map((batch, idx) => (
                      <div key={batch.receipt_id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-700 font-bold text-[11px]">
                            {batch.receipt_id}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {new Date(batch.received_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          Received by: <strong>{batch.received_by_staff_name}</strong> ({batch.received_by_role})
                          {batch.delivery_note_ref && (
                            <span className="ml-2 font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                              Ref: {batch.delivery_note_ref}
                            </span>
                          )}
                        </div>
                        {batch.notes && (
                          <div className="text-[10px] text-slate-500 italic">
                            Notes: "{batch.notes}"
                          </div>
                        )}
                        <div className="pt-1 border-t border-slate-200 flex flex-wrap gap-2">
                          {batch.items.map((it, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium text-[10px]">
                              +{it.quantity_received} of {it.item_name || it.item_sn} {it.expiry_date ? `(Exp: ${it.expiry_date})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 italic">
                    No shipments received yet for this purchase order.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {viewHistoryPo.receiving_history && viewHistoryPo.receiving_history.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGrnPrintPo(viewHistoryPo);
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Goods Received Note (GRN)</span>
                  </button>
                ) : <div />}
                <button
                  type="button"
                  onClick={() => setViewHistoryPo(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add New Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Register Supplier</h3>
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
                  placeholder="e.g. Metro Wholesale Distributors Ltd"
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
                  placeholder="supplier@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="e.g. 12 Commercial Avenue, Lagos"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Supplier */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Edit Supplier</h3>
                <p className="text-[11px] text-slate-400">
                  Update vendor details for <span className="font-mono text-emerald-400">{editingSupplier.supplier_id}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingSupplier(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplierSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={editSupplierForm.supplier_name}
                  onChange={(e) => setEditSupplierForm({ ...editSupplierForm, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
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
                    value={editSupplierForm.contact_person}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, contact_person: e.target.value })}
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
                    value={editSupplierForm.phone_number}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, phone_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editSupplierForm.email}
                  onChange={(e) => setEditSupplierForm({ ...editSupplierForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  value={editSupplierForm.address}
                  onChange={(e) => setEditSupplierForm({ ...editSupplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={editSupplierForm.lead_time_days}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, lead_time_days: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={editSupplierForm.payment_terms}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, payment_terms: e.target.value as PaymentTerms })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Net 7 Days">Net 7 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editSupplierForm.status}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Update Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Goods Received Note (GRN) Printable Voucher */}
      {grnPrintPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">Goods Received Note (GRN)</h3>
                  <p className="text-[11px] text-slate-400">
                    Official warehouse receiving docket for {grnPrintPo.po_id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Voucher</span>
                </button>
                <button
                  onClick={() => setGrnPrintPo(null)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 space-y-6 text-slate-800 bg-white" id="printable-grn-document">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                    Goods Received Note (GRN)
                  </h1>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Warehouse Receiving & Inventory Audit Document
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-indigo-700">
                    PO REF: {grnPrintPo.po_id}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Status: <strong className="text-slate-900 uppercase">{grnPrintPo.status}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Printed: {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Vendor & Order Details Grid */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Supplier / Vendor Details
                  </span>
                  {(() => {
                    const supp = suppliers.find(s => s.supplier_id === grnPrintPo.supplier_id);
                    return (
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-sm">{supp?.supplier_name || grnPrintPo.supplier_id}</div>
                        <div className="text-slate-600">Contact: {supp?.contact_person || 'N/A'}</div>
                        <div className="text-slate-600 font-mono">{supp?.phone_number}</div>
                        <div className="text-slate-600">{supp?.address}</div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Order Specifications
                  </span>
                  <div className="space-y-0.5">
                    <div>Order Date: <strong className="font-mono">{grnPrintPo.order_date}</strong></div>
                    <div>Due Date: <strong className="font-mono">{grnPrintPo.expected_delivery_date || 'N/A'}</strong></div>
                    <div>Total PO Value: <strong className="font-mono text-emerald-700">₦{grnPrintPo.total_cost.toLocaleString()}</strong></div>
                    {grnPrintPo.notes && <div className="text-slate-500 italic mt-1">"{grnPrintPo.notes}"</div>}
                  </div>
                </div>
              </div>

              {/* Cumulative Items Summary Table */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2">
                  Inventory Items & Delivery Fulfillment
                </h4>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3 text-center">Ordered</th>
                      <th className="py-2 px-3 text-center">Total Rec'd</th>
                      <th className="py-2 px-3 text-center">Pending Backorder</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Total (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const items = grnPrintPo.items && grnPrintPo.items.length > 0
                        ? grnPrintPo.items
                        : [{
                            item_sn: grnPrintPo.item_sn || '',
                            item_name: grnPrintPo.item_sn || '',
                            quantity_ordered: grnPrintPo.quantity_ordered || 0,
                            quantity_received: grnPrintPo.quantity_received || 0,
                            unit_cost: grnPrintPo.unit_cost || 0,
                            total_cost: grnPrintPo.total_cost,
                          }];

                      return items.map((it) => {
                        const ord = it.quantity_ordered || 0;
                        const rec = it.quantity_received || 0;
                        const pending = Math.max(0, Math.round((ord - rec) * 1000) / 1000);
                        return (
                          <tr key={it.item_sn}>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 block">{it.item_name}</span>
                              <span className="text-[10px] font-mono text-slate-500">{it.item_sn}</span>
                            </td>
                            <td className="py-2 px-3 text-center font-medium">{ord}</td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700">{rec}</td>
                            <td className="py-2 px-3 text-center font-bold text-amber-700">{pending}</td>
                            <td className="py-2 px-3 text-right font-mono">₦{(it.unit_cost || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">₦{(it.total_cost || 0).toLocaleString()}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Historical Receiving Batches Breakdown */}
              {grnPrintPo.receiving_history && grnPrintPo.receiving_history.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2">
                    Goods Receiving Log (Recorded Shipments)
                  </h4>
                  <div className="space-y-2">
                    {grnPrintPo.receiving_history.map((batch, idx) => (
                      <div key={batch.receipt_id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between font-mono font-bold text-[11px]">
                          <span className="text-indigo-700">{batch.receipt_id}</span>
                          <span className="text-slate-500">{new Date(batch.received_at).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600">
                          Received By: <strong>{batch.received_by_staff_name}</strong> ({batch.received_by_role})
                          {batch.delivery_note_ref && <span className="ml-2 font-mono">Docket: {batch.delivery_note_ref}</span>}
                          {batch.notes && <span className="ml-2 italic text-slate-500">"{batch.notes}"</span>}
                        </div>
                        <div className="pt-1 flex flex-wrap gap-2">
                          {batch.items.map((it, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium text-[10px]">
                              +{it.quantity_received} {it.item_name || it.item_sn} {it.expiry_date ? `(Exp: ${it.expiry_date})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formal Sign-off Section */}
              <div className="grid grid-cols-2 gap-12 pt-6 border-t border-slate-300 text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-6">
                    Delivered By (Supplier / Driver):
                  </p>
                  <div className="border-b border-slate-400 mb-1" />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Driver Name & Signature</span>
                    <span>Date: _______________</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-6">
                    Received & Inspected By (Warehouse Staff):
                  </p>
                  <div className="border-b border-slate-400 mb-1" />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Staff Name & Signature</span>
                    <span>Date: _______________</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setGrnPrintPo(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager / Admin PIN Authorization Modal for PO & Supplier Actions */}
      <PinAuthModal
        isOpen={overrideContext.isOpen}
        onClose={() => setOverrideContext(prev => ({ ...prev, isOpen: false }))}
        mode="OVERRIDE"
        requiredRole={['Manager', 'Admin', 'Supervisor']}
        title="Staff Authorization Required"
        subtitle="Creating or cancelling POs requires Manager/Admin authorization. Receiving goods requires Supervisor, Manager, or Admin authorization."
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
