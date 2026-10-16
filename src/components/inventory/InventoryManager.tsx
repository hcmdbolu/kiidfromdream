import React, { useState, useMemo, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, ProductCategory, ProductUnit, ProductStatus } from '../../types';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  Truck, 
  X, 
  Calendar, 
  Tag, 
  Check, 
  Layers,
  ClipboardCheck,
  Lock,
  Shield,
  Upload,
  FileSpreadsheet,
  Image as ImageIcon
} from 'lucide-react';
import { PinAuthModal } from '../security/PinAuthModal';
import { CycleCountModal } from './CycleCountModal';
import { BulkImportModal } from './BulkImportModal';
import { CategoryManagementModal } from './CategoryManagementModal';

const RETAIL_CATEGORIES: ProductCategory[] = [
  'General',
  'Groceries',
  'Beverages',
  'Food & Snacks',
  'Perishables',
  'Frozen Goods',
  'Electronics',
  'Apparel & Clothing',
  'Health & Beauty',
  'Home & Living',
  'Freshwater Fish',
  'Saltwater Fish',
  'Frozen Fish',
  'Dried Fish',
];

const MEASURE_UNITS: ProductUnit[] = [
  'PCS',
  'PIECES',
  'SACHET',
  'KG',
  'PACK',
  'BOX',
  'CARTON',
  'CRATE',
  'ROLL',
  'BUNDLE',
  'BOTTLE',
  'CAN',
  'BAG',
  'LITERS',
  'TONS',
];

interface InventoryManagerProps {
  onQuickOrderPO?: (supplierId: string, itemSn: string) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ onQuickOrderPO }) => {
  const { 
    products, 
    suppliers, 
    categories,
    addProduct, 
    updateProduct, 
    deleteProduct, 
    getNextItemSn,
    hasPermission,
    activeStaff
  } = usePos();

  const canManageProducts = hasPermission('CAN_MANAGE_PRODUCTS');
  const canCycleCount = hasPermission('CAN_CYCLE_COUNT');
  const canManageCategories = hasPermission('CAN_MANAGE_CATEGORIES') || ['Supervisor', 'Manager', 'Admin', 'Super Admin'].includes(activeStaff.role);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [stockAlertFilter, setStockAlertFilter] = useState<string>('All'); // 'All' | 'LowStock' | 'Expiring'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingItemSn, setEditingItemSn] = useState<string | null>(null);
  const [isCycleCountOpen, setIsCycleCountOpen] = useState(false);

  // Dynamic available categories list
  const availableCategories = useMemo(() => {
    const fromDb = categories.map(c => c.name);
    const fromProducts = products.map(p => p.product_category).filter(Boolean);
    const defaultList = ['General', 'Groceries', 'Beverages', 'Food & Snacks', 'Perishables', 'Frozen Goods', 'Freshwater Fish', 'Frozen Fish'];
    return Array.from(new Set([...fromDb, ...fromProducts, ...defaultList]));
  }, [categories, products]);

  // Local image upload states
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleRequestBulkImport = () => {
    if (canManageProducts) {
      setIsBulkImportOpen(true);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Bulk import products from CSV into inventory',
        onAuthorized: () => setIsBulkImportOpen(true),
      });
    }
  };

  // Form states
  const [formData, setFormData] = useState({
    item_name: '',
    item_picture: '',
    quantity: 50,
    expiry_date: '',
    item_cost: 2500,
    product_measure_unit: 'PCS' as ProductUnit,
    quantity_per_unit: 1,
    selling_price: 3500,
    product_category: 'General' as ProductCategory,
    reorder_level: 10,
    supplier_id: suppliers[0]?.supplier_id || 'SUP-00001',
    status: 'Active' as ProductStatus,
    has_bulk_unit: false,
    bulk_unit: 'CARTON' as ProductUnit,
    conversion_factor: 24,
    bulk_selling_price: 0,
    bulk_item_cost: 0,
    allow_loose_sales: true,
  });

  const now = new Date();

  // Calculated profit margin for form
  const formProfitMargin = formData.item_cost > 0
    ? Math.round(((formData.selling_price - formData.item_cost) / formData.item_cost) * 100)
    : 0;

  const processImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Selected file must be an image (PNG, JPG, WebP, etc.)');
      return;
    }
    setIsUploadingImage(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data, filename: file.name }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setFormData(prev => ({ ...prev, item_picture: data.url }));
            } else {
              setFormData(prev => ({ ...prev, item_picture: base64Data }));
            }
          } else {
            setFormData(prev => ({ ...prev, item_picture: base64Data }));
          }
        } catch {
          setFormData(prev => ({ ...prev, item_picture: base64Data }));
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read image file');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process image');
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageUpload(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processImageUpload(e.dataTransfer.files[0]);
    }
  };

  const openAddModal = () => {
    setEditingItemSn(null);
    setUploadError(null);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setFormData({
      item_name: '',
      item_picture: '',
      quantity: 50,
      expiry_date: futureDate.toISOString().split('T')[0],
      item_cost: 2500,
      product_measure_unit: 'PCS',
      quantity_per_unit: 1,
      selling_price: 3500,
      product_category: 'General',
      reorder_level: 10,
      supplier_id: suppliers[0]?.supplier_id || 'SUP-00001',
      status: 'Active',
      has_bulk_unit: false,
      bulk_unit: 'CARTON',
      conversion_factor: 24,
      bulk_selling_price: 0,
      bulk_item_cost: 0,
      allow_loose_sales: true,
    });
    setIsModalOpen(true);
  };

  const handleRequestAdd = () => {
    if (canManageProducts) {
      openAddModal();
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: 'Add new product to catalog (Manager or Admin required)',
        onAuthorized: () => openAddModal(),
      });
    }
  };

  const openEditModal = (product: Product) => {
    setEditingItemSn(product.item_sn);
    setFormData({
      item_name: product.item_name,
      item_picture: product.item_picture,
      quantity: product.quantity,
      expiry_date: product.expiry_date,
      item_cost: product.item_cost,
      product_measure_unit: product.product_measure_unit,
      quantity_per_unit: product.quantity_per_unit,
      selling_price: product.selling_price,
      product_category: product.product_category,
      reorder_level: product.reorder_level,
      supplier_id: product.supplier_id,
      status: product.status,
      has_bulk_unit: product.has_bulk_unit ?? false,
      bulk_unit: product.bulk_unit ?? 'CARTON',
      conversion_factor: product.conversion_factor ?? 24,
      bulk_selling_price: product.bulk_selling_price ?? (product.selling_price * (product.conversion_factor || 24)),
      bulk_item_cost: product.bulk_item_cost ?? (product.item_cost * (product.conversion_factor || 24)),
      allow_loose_sales: product.allow_loose_sales !== false,
    });
    setIsModalOpen(true);
  };

  const handleRequestEdit = (product: Product) => {
    if (canManageProducts) {
      openEditModal(product);
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Edit catalog pricing/details for ${product.item_name} (${product.item_sn})`,
        onAuthorized: () => openEditModal(product),
      });
    }
  };

  const handleRequestDelete = (product: Product) => {
    if (canManageProducts) {
      if (confirm(`Are you sure you want to delete ${product.item_name} (${product.item_sn})?`)) {
        deleteProduct(product.item_sn);
      }
    } else {
      setOverrideContext({
        isOpen: true,
        actionDescription: `Delete product ${product.item_name} (${product.item_sn}) from database`,
        onAuthorized: () => {
          if (confirm(`Authorized! Are you sure you want to delete ${product.item_name} (${product.item_sn})?`)) {
            deleteProduct(product.item_sn);
          }
        },
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name.trim()) return;

    const payload = {
      ...formData,
      has_bulk_unit: !!formData.has_bulk_unit,
      conversion_factor: formData.has_bulk_unit ? Math.max(1, Number(formData.conversion_factor) || 1) : 1,
      bulk_selling_price: formData.has_bulk_unit ? (Number(formData.bulk_selling_price) || (formData.selling_price * (Number(formData.conversion_factor) || 1))) : undefined,
      bulk_item_cost: formData.has_bulk_unit ? (Number(formData.bulk_item_cost) || (formData.item_cost * (Number(formData.conversion_factor) || 1))) : undefined,
      allow_loose_sales: formData.has_bulk_unit ? formData.allow_loose_sales !== false : true,
    };

    if (editingItemSn) {
      updateProduct(editingItemSn, payload);
    } else {
      addProduct(payload);
    }
    setIsModalOpen(false);
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = 
        p.item_name.toLowerCase().includes(search.toLowerCase()) ||
        p.item_sn.toLowerCase().includes(search.toLowerCase());
      
      const matchCat = selectedCategory === 'All' || p.product_category === selectedCategory;
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;

      let matchAlert = true;
      if (stockAlertFilter === 'LowStock') {
        matchAlert = p.quantity <= p.reorder_level;
      } else if (stockAlertFilter === 'Expiring') {
        const expiry = new Date(p.expiry_date);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        matchAlert = diffDays <= 3;
      }

      return matchSearch && matchCat && matchStatus && matchAlert;
    });
  }, [products, search, selectedCategory, statusFilter, stockAlertFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Inventory Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {products.length} Item SKUs
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock levels, automated SKU generator, expiry alerts, and supplier reorders.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canCycleCount && (
            <button
              onClick={() => setIsCycleCountOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer"
              title="Conduct physical stock cycle count and variance audit"
            >
              <ClipboardCheck className="w-4 h-4 text-amber-600" />
              <span>Cycle Count Audit</span>
            </button>
          )}

          {canManageCategories && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer"
              title="Add, rename, or manage product categories (Supervisor, Manager, Admin)"
            >
              <Tag className="w-4 h-4 text-indigo-600" />
              <span>Manage Categories</span>
            </button>
          )}

          <button
            onClick={handleRequestBulkImport}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer"
            title={canManageProducts ? 'Bulk Import Items via CSV Spreadsheet' : 'Requires Manager/Admin PIN'}
          >
            {canManageProducts ? <Upload className="w-4 h-4 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
            <span>Bulk Import Items</span>
            {!canManageProducts && (
              <span className="text-[10px] bg-amber-400/20 text-amber-700 px-1 rounded font-mono">PIN</span>
            )}
          </button>

          <button
            onClick={handleRequestAdd}
            className={`flex items-center space-x-1.5 px-4 py-2 text-white rounded-lg font-semibold text-xs shadow-sm transition-all cursor-pointer ${
              canManageProducts ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title={canManageProducts ? 'Add New Item' : 'Requires Manager/Admin PIN'}
          >
            {canManageProducts ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
            <span>Add New Item</span>
            {!canManageProducts && (
              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded font-mono">PIN</span>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
            >
              <option value="All">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Alert Filter Dropdown */}
          <div>
            <select
              value={stockAlertFilter}
              onChange={(e) => setStockAlertFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium"
            >
              <option value="All">All Stock Levels</option>
              <option value="LowStock">⚠️ Low Stock (Below Reorder Level)</option>
              <option value="Expiring">🚨 Expiring Soon (Within 3 Days)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3 px-4">Item SN & Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Stock Qty</th>
                <th className="py-3 px-4">Wholesale Cost</th>
                <th className="py-3 px-4">Selling Price</th>
                <th className="py-3 px-4">Margin</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No products found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const isLowStock = product.quantity <= product.reorder_level;
                  const expiry = new Date(product.expiry_date);
                  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpiringSoon = diffDays >= 0 && diffDays <= 3;
                  const isExpired = diffDays < 0;

                  const margin = product.item_cost > 0
                    ? Math.round(((product.selling_price - product.item_cost) / product.item_cost) * 100)
                    : 0;

                  const supplier = suppliers.find(s => s.supplier_id === product.supplier_id);

                  return (
                    <tr key={product.item_sn} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={product.item_picture || '/placeholder-product.svg'}
                            alt={product.item_name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                            }}
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{product.item_name}</span>
                              {product.has_bulk_unit && product.bulk_unit && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200" title={`1 ${product.bulk_unit} = ${product.conversion_factor || 1} ${product.product_measure_unit}`}>
                                  📦 1 {product.bulk_unit} = {product.conversion_factor || 1} {product.product_measure_unit}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 font-semibold">{product.item_sn}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {product.product_category}
                        </span>
                      </td>

                      {/* Quantity & Reorder Alert */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div>
                          {product.has_bulk_unit && product.bulk_unit && (product.conversion_factor || 1) > 1 ? (
                            <div>
                              <div className="font-bold text-sm text-slate-900 flex items-center gap-1">
                                <span>
                                  {Math.floor(product.quantity / (product.conversion_factor || 1))} {product.bulk_unit}
                                  {product.quantity % (product.conversion_factor || 1) > 0 && ` + ${product.quantity % (product.conversion_factor || 1)} ${product.product_measure_unit}`}
                                </span>
                              </div>
                              <div className="text-[10.5px] font-mono text-purple-700">
                                ({product.quantity.toLocaleString()} loose {product.product_measure_unit} total)
                              </div>
                            </div>
                          ) : (
                            <span className={`font-bold text-sm ${
                              product.quantity === 0
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            }`}>
                              {product.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {product.product_measure_unit}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400">
                            Reorder @ {product.reorder_level.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {product.product_measure_unit}
                          </div>
                          {isLowStock && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-100 text-amber-800">
                              LOW STOCK
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Wholesale Cost */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        ₦{product.item_cost.toLocaleString()}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 font-mono">
                        ₦{product.selling_price.toLocaleString()}
                      </td>

                      {/* Margin % */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center space-x-0.5 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <TrendingUp className="w-3 h-3 text-emerald-600 mr-0.5" />
                          <span>{margin}%</span>
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs">{product.expiry_date}</div>
                        {isExpired ? (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-rose-600 text-white">
                            EXPIRED
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500 text-white animate-pulse">
                            EXP IN {diffDays} DAYS
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Good</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium line-clamp-1">
                          {supplier ? supplier.supplier_name : product.supplier_id}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{product.supplier_id}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          product.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {product.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Reorder Button */}
                          {isLowStock && onQuickOrderPO && (
                            <button
                              onClick={() => onQuickOrderPO(product.supplier_id, product.item_sn)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-semibold flex items-center space-x-1"
                              title="Create Purchase Order for low stock"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Order</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRequestEdit(product)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded relative group"
                            title={canManageProducts ? "Edit product" : "Requires Manager/Admin PIN"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {!canManageProducts && (
                              <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-0.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleRequestDelete(product)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded relative group"
                            title={canManageProducts ? "Delete product" : "Requires Manager/Admin PIN"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {!canManageProducts && (
                              <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-0.5" />
                            )}
                          </button>
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editingItemSn ? `Edit Item (${editingItemSn})` : 'Add New Item to Inventory'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {editingItemSn ? 'Update product details, pricing, and stock levels.' : `System will auto-generate Item SN: ${getNextItemSn()}`}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {/* Item SN Auto Tag */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Item SN (Auto-Generated)</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {editingItemSn || getNextItemSn()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Profit Margin</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formProfitMargin}% Profit
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Item Name */}
                {/* Item Name */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g. Basmati Rice, Canned Milk, Sneakers, Coffee Beans..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800"
                  />
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Category</label>
                    {canManageCategories && (
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-0.5 cursor-pointer"
                        title="Add or edit product categories"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Category</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={formData.product_category}
                    onChange={(e) => setFormData({ ...formData, product_category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Measure Unit */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Measure Unit</label>
                  <select
                    value={formData.product_measure_unit}
                    onChange={(e) => setFormData({ ...formData, product_measure_unit: e.target.value as ProductUnit })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    {MEASURE_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                {/* Wholesale Cost (₦) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Wholesale Item Cost (₦) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.item_cost}
                    onChange={(e) => setFormData({ ...formData, item_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>

                {/* Selling Price (₦) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Selling Price (₦) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono font-bold"
                  />
                </div>

                {/* Multi-Unit & Packaging Setup Section */}
                <div className="sm:col-span-2 p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-purple-950">Multi-Unit & Bulk Packaging Setup</h4>
                        <p className="text-xs text-purple-700">
                          Configure bulk packs (e.g., Carton, Crate, Roll) alongside loose base units ({formData.product_measure_unit})
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.has_bulk_unit}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            has_bulk_unit: enabled,
                            bulk_selling_price: enabled && prev.bulk_selling_price <= 0 ? prev.selling_price * (prev.conversion_factor || 24) : prev.bulk_selling_price,
                            bulk_item_cost: enabled && prev.bulk_item_cost <= 0 ? prev.item_cost * (prev.conversion_factor || 24) : prev.bulk_item_cost,
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      <span className="ml-2 text-xs font-bold text-purple-900">
                        {formData.has_bulk_unit ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {formData.has_bulk_unit && (
                    <div className="pt-3 border-t border-purple-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Bulk Unit Type */}
                        <div>
                          <label className="block text-xs font-bold text-purple-900 mb-1">
                            Bulk / Parent Unit Type
                          </label>
                          <select
                            value={formData.bulk_unit}
                            onChange={(e) => setFormData({ ...formData, bulk_unit: e.target.value as ProductUnit })}
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-800 text-xs font-semibold focus:ring-1 focus:ring-purple-500"
                          >
                            {MEASURE_UNITS.filter(u => u !== formData.product_measure_unit).map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>

                        {/* Conversion Factor */}
                        <div>
                          <label className="block text-xs font-bold text-purple-900 mb-1">
                            Conversion Factor (Loose Units per Bulk Pack) *
                          </label>
                          <input
                            type="number"
                            min="2"
                            step="1"
                            required={formData.has_bulk_unit}
                            value={formData.conversion_factor}
                            onChange={(e) => {
                              const factor = parseInt(e.target.value) || 1;
                              setFormData(prev => ({
                                ...prev,
                                conversion_factor: factor,
                                bulk_selling_price: prev.bulk_selling_price || prev.selling_price * factor,
                                bulk_item_cost: prev.bulk_item_cost || prev.item_cost * factor,
                              }));
                            }}
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-900 text-xs font-bold font-mono focus:ring-1 focus:ring-purple-500"
                            placeholder="e.g. 24 or 12"
                          />
                          <p className="text-[10px] text-purple-700 mt-1">
                            Formula: 1 {formData.bulk_unit} = <strong>{formData.conversion_factor || 1} {formData.product_measure_unit}</strong>
                          </p>
                        </div>

                        {/* Bulk Selling Price */}
                        <div>
                          <label className="block text-xs font-bold text-purple-900 mb-1">
                            Bulk Selling Price (₦ per {formData.bulk_unit}) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required={formData.has_bulk_unit}
                            value={formData.bulk_selling_price}
                            onChange={(e) => setFormData({ ...formData, bulk_selling_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-900 text-xs font-bold font-mono focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        {/* Bulk Cost Price */}
                        <div>
                          <label className="block text-xs font-bold text-purple-900 mb-1">
                            Bulk Item Cost (₦ per {formData.bulk_unit})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={formData.bulk_item_cost}
                            onChange={(e) => setFormData({ ...formData, bulk_item_cost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-slate-900 text-xs font-mono focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* Loose Sales Permission Toggle */}
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-purple-100">
                        <div>
                          <span className="text-xs font-bold text-slate-800">Allow Loose Sales at POS Terminal</span>
                          <p className="text-[11px] text-slate-500">
                            Cashiers can break open bulk packs and sell individual {formData.product_measure_unit}s.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.allow_loose_sales}
                          onChange={(e) => setFormData({ ...formData, allow_loose_sales: e.target.checked })}
                          className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                        />
                      </div>

                      {/* Informative Note */}
                      <div className="text-[11px] text-purple-800 bg-purple-100/60 p-2 rounded-lg flex items-center gap-1.5">
                        <span className="font-bold">Note:</span>
                        <span>Inventory stock below is entered in <strong>Loose {formData.product_measure_unit}s</strong>. For example, 10 {formData.bulk_unit}s of {formData.conversion_factor} {formData.product_measure_unit}s = <strong>{(10 * (formData.conversion_factor || 1)).toLocaleString()} {formData.product_measure_unit}s</strong> on hand.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Initial / Current Stock Quantity */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current Quantity on Hand * (Float / Decimal)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="e.g. 60.5 or 120"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold font-mono"
                  />
                </div>

                {/* Reorder Level */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reorder Alert Level * (Float / Decimal)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    placeholder="e.g. 15.5 or 20"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>

                {/* Supplier Link */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    {suppliers.map(sup => (
                      <option key={sup.supplier_id} value={sup.supplier_id}>
                        {sup.supplier_name} ({sup.supplier_id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Picture Upload / URL */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Product Photo</label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    {/* Preview Thumbnail */}
                    <div className="relative w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 group">
                      {formData.item_picture ? (
                        <>
                          <img
                            src={formData.item_picture}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, item_picture: '' })}
                            className="absolute top-1 right-1 bg-rose-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2">
                          <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-0.5" />
                          <span className="text-[9px] text-slate-400 font-medium">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Upload Drop Zone & Controls */}
                    <div className="flex-1 w-full space-y-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                          isDraggingOver 
                            ? 'border-emerald-500 bg-emerald-50/50' 
                            : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                        }`}
                      >
                        {isUploadingImage ? (
                          <div className="flex items-center justify-center space-x-2 text-emerald-600 text-xs py-1">
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full"></span>
                            <span>Uploading photo...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2 text-slate-600 text-xs py-1">
                            <Upload className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-emerald-700">Choose local image</span>
                            <span className="text-slate-400">or drag & drop</span>
                          </div>
                        )}
                      </div>

                      {uploadError && (
                        <p className="text-[11px] text-rose-600 font-medium">{uploadError}</p>
                      )}

                      {/* Optional URL input fallback */}
                      <input
                        type="text"
                        value={formData.item_picture}
                        onChange={(e) => setFormData({ ...formData, item_picture: e.target.value })}
                        placeholder="Or paste image URL / relative path (e.g. /uploads/...)"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {editingItemSn ? 'Update Product' : 'Save & Store in Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cycle Count Modal for Supervisors & Managers */}
      <CycleCountModal
        isOpen={isCycleCountOpen}
        onClose={() => setIsCycleCountOpen(false)}
      />

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />

      {/* Category Management Modal */}
      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryCreated={(newCat) => {
          setFormData(prev => ({ ...prev, product_category: newCat as ProductCategory }));
          setSelectedCategory(newCat);
        }}
      />

      {/* Security PIN Override Modal for Catalog Modifications */}
      <PinAuthModal
        isOpen={overrideContext.isOpen}
        onClose={() => setOverrideContext(prev => ({ ...prev, isOpen: false }))}
        mode="OVERRIDE"
        requiredRole={['Manager', 'Admin']}
        title="Manager Authorization Required"
        subtitle="Catalog modifications require Manager (Chidinma: 4444) or Admin (Alex: 9999) authorization."
        actionDescription={overrideContext.actionDescription}
        onSuccess={() => {
          const actionToRun = overrideContext.onAuthorized;
          setOverrideContext(prev => ({ ...prev, isOpen: false }));
          actionToRun();
        }}
      />
    </div>
  );
};
