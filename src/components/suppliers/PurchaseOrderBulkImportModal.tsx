import React, { useState, useRef, useMemo, ChangeEvent, DragEvent } from 'react';
import { usePos } from '../../context/PosContext';
import { PurchaseOrder, PurchaseOrderItem, POStatus } from '../../types';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  Sparkles, 
  Layers, 
  Info, 
  RotateCcw,
  FileCheck2,
  Package,
  Calendar,
  AlertTriangle,
  Database
} from 'lucide-react';
import { parseCSV } from '../customers/CustomerBulkImportModal';

interface PurchaseOrderBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export interface POTargetField {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

const TARGET_FIELDS: POTargetField[] = [
  { key: 'po_number', label: 'PO Number / Order Ref', required: true, description: 'Unique PO identifier (e.g., PO-2026-001 or LEGACY-PO-882)' },
  { key: 'supplier', label: 'Supplier Name or Code', required: true, description: 'Vendor name (e.g. Atlantic Seafoods) or code (SUP-00001)' },
  { key: 'order_date', label: 'Order Date', required: false, description: 'Date order was issued (YYYY-MM-DD)' },
  { key: 'delivery_date', label: 'Expected Delivery Date', required: false, description: 'Target delivery date (YYYY-MM-DD)' },
  { key: 'actual_delivery_date', label: 'Actual Received Date', required: false, description: 'Date goods arrived at warehouse' },
  { key: 'item_name', label: 'Item Name / SKU', required: true, description: 'Line item product name or SKU serial number' },
  { key: 'quantity_ordered', label: 'Quantity Ordered', required: true, description: 'Total units ordered from supplier' },
  { key: 'quantity_received', label: 'Quantity Received', required: false, description: 'Delivered units (defaults to quantity ordered if status is RECEIVED)' },
  { key: 'unit_cost', label: 'Wholesale Unit Cost (₦)', required: false, description: 'Cost price per unit paid to vendor' },
  { key: 'status', label: 'PO Status', required: false, description: 'RECEIVED, PENDING, PARTIALLY_RECEIVED, or CANCELLED' },
  { key: 'notes', label: 'Notes / Delivery Reference', required: false, description: 'Waybill number, driver notes, or legacy audit memo' },
];

const SAMPLE_CSV = `PO Number,Supplier,Order Date,Expected Delivery,Actual Delivery,Item Name,Quantity Ordered,Quantity Received,Unit Cost (NGN),Status,Notes
PO-2026-081,Atlantic Seafoods Ltd,2026-09-01,2026-09-03,2026-09-03,Atlantic Salmon Fillet,100,100,6200,RECEIVED,Waybill #WB-99210
PO-2026-081,Atlantic Seafoods Ltd,2026-09-01,2026-09-03,2026-09-03,Frozen Chicken Wings,50,50,4800,RECEIVED,Waybill #WB-99210
PO-2026-094,Grand Cereals Flour Mills,2026-09-15,2026-09-20,2026-09-20,Basmati Rice (5kg),200,200,9500,RECEIVED,Full container delivered
PO-2026-102,Prime Poultry & Cold Chain,2026-10-05,2026-10-08,2026-10-08,Full Cream Milk (1L),150,150,1700,RECEIVED,Cold room batch #04
PO-2026-115,Golden Oil Refineries,2026-10-25,2026-11-01,,Instant Noodles Carton (40pk),80,0,7800,PENDING,Awaiting factory dispatch`;

function cleanNumber(val: any, fallback = 0): number {
  if (typeof val === 'number') return val;
  if (!val) return fallback;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(num) ? fallback : num;
}

export const PurchaseOrderBulkImportModal: React.FC<PurchaseOrderBulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { suppliers, products, bulkAddPurchaseOrders } = usePos();

  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'preview' | 'success'>('upload');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed CSV
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});

  // Options
  const [updateInventory, setUpdateInventory] = useState(false); // Default: Historical archive only
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ count: number; totalCost: number; itemCount: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'historical_purchase_orders_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFileContent = (content: string, name?: string) => {
    setUploadError(null);
    try {
      const { headers, rows } = parseCSV(content);
      if (headers.length === 0 || rows.length === 0) {
        setUploadError('CSV file appears empty or missing data rows.');
        return;
      }
      setParsedHeaders(headers);
      setParsedRows(rows);
      if (name) setFileName(name);

      // Auto-map headers heuristically
      const initialMap: Record<string, number> = {};
      TARGET_FIELDS.forEach(field => {
        const fieldKey = field.key.toLowerCase();
        const foundIdx = headers.findIndex(h => {
          const headerClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (fieldKey === 'po_number' && /po|order|ponumber|orderid|ref/.test(headerClean)) return true;
          if (fieldKey === 'supplier' && /supplier|vendor/.test(headerClean)) return true;
          if (fieldKey === 'order_date' && /orderdate|date|created/.test(headerClean)) return true;
          if (fieldKey === 'delivery_date' && /expected|delivery|duedate/.test(headerClean)) return true;
          if (fieldKey === 'actual_delivery_date' && /actual|receiveddate|arrived/.test(headerClean)) return true;
          if (fieldKey === 'item_name' && /item|product|sku|desc/.test(headerClean)) return true;
          if (fieldKey === 'quantity_ordered' && /ordered|qtyordered|quantity/.test(headerClean)) return true;
          if (fieldKey === 'quantity_received' && /received|qtyreceived/.test(headerClean)) return true;
          if (fieldKey === 'unit_cost' && /cost|price|unitcost|rate/.test(headerClean)) return true;
          if (fieldKey === 'status' && /status|state/.test(headerClean)) return true;
          if (fieldKey === 'notes' && /notes|waybill|remarks|memo/.test(headerClean)) return true;
          return headerClean.includes(fieldKey);
        });
        if (foundIdx !== -1) {
          initialMap[field.key] = foundIdx;
        }
      });

      setColumnMapping(initialMap);
      setCurrentStep('map');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse CSV file.');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processFileContent(text, file.name);
    };
    reader.onerror = () => setUploadError('Error reading uploaded file.');
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processFileContent(text, file.name);
    };
    reader.readAsText(file);
  };

  // Group raw rows into distinct Purchase Orders
  const groupedOrders = useMemo(() => {
    if (currentStep !== 'preview' && currentStep !== 'success') return [];

    const poMap = new Map<string, {
      poNumber: string;
      supplierIdentifier: string;
      resolvedSupplierId: string;
      supplierName: string;
      orderDate: string;
      expectedDate: string;
      actualDate?: string;
      status: POStatus;
      notes: string;
      items: PurchaseOrderItem[];
      errors: string[];
    }>();

    const today = new Date().toISOString().split('T')[0];

    parsedRows.forEach((row, idx) => {
      const getVal = (key: string): string => {
        const colIdx = columnMapping[key];
        return colIdx !== undefined && row[colIdx] !== undefined ? row[colIdx].trim() : '';
      };

      const poNum = getVal('po_number') || `PO-LEGACY-${idx + 1}`;
      const supplierInput = getVal('supplier');
      const orderDate = getVal('order_date') || today;
      const expectedDate = getVal('delivery_date') || orderDate;
      const actualDate = getVal('actual_delivery_date') || undefined;
      const itemName = getVal('item_name');
      const qtyOrdered = Math.max(0, cleanNumber(getVal('quantity_ordered'), 1));
      
      let rawStatus = getVal('status').toUpperCase();
      let status: POStatus = 'RECEIVED';
      if (rawStatus.includes('PEND')) status = 'PENDING';
      else if (rawStatus.includes('PART')) status = 'PARTIALLY_RECEIVED';
      else if (rawStatus.includes('CANC')) status = 'CANCELLED';

      const qtyReceived = status === 'RECEIVED' 
        ? Math.max(0, cleanNumber(getVal('quantity_received'), qtyOrdered))
        : Math.max(0, cleanNumber(getVal('quantity_received'), 0));

      const unitCost = Math.max(0, cleanNumber(getVal('unit_cost'), 0));
      const totalCost = Math.round(qtyOrdered * unitCost * 100) / 100;
      const notes = getVal('notes');

      // Resolve supplier ID
      let resolvedSupplierId = 'SUP-00001';
      let supplierName = supplierInput || 'Legacy Vendor';

      const foundSup = suppliers.find(s => 
        s.supplier_id.toLowerCase() === supplierInput.toLowerCase() ||
        s.supplier_name.toLowerCase() === supplierInput.toLowerCase()
      );
      if (foundSup) {
        resolvedSupplierId = foundSup.supplier_id;
        supplierName = foundSup.supplier_name;
      }

      // Check if product exists in catalog
      const foundProd = products.find(p => 
        p.item_name.toLowerCase() === itemName.toLowerCase() ||
        p.item_sn.toLowerCase() === itemName.toLowerCase()
      );

      const lineItem: PurchaseOrderItem = {
        item_sn: foundProd ? foundProd.item_sn : `ITEM-${itemName.replace(/\s+/g, '-').toUpperCase().slice(0, 10)}`,
        item_name: foundProd ? foundProd.item_name : (itemName || 'Stock Item'),
        quantity_ordered: qtyOrdered,
        quantity_received: qtyReceived,
        quantity_pending: Math.max(0, Math.round((qtyOrdered - qtyReceived) * 1000) / 1000),
        unit_cost: unitCost,
        total_cost: totalCost,
      };

      if (!poMap.has(poNum)) {
        const errors: string[] = [];
        if (!supplierInput) errors.push('Supplier is required');

        poMap.set(poNum, {
          poNumber: poNum,
          supplierIdentifier: supplierInput,
          resolvedSupplierId,
          supplierName,
          orderDate,
          expectedDate,
          actualDate: actualDate || (status === 'RECEIVED' ? orderDate : undefined),
          status,
          notes,
          items: [lineItem],
          errors,
        });
      } else {
        const existing = poMap.get(poNum)!;
        existing.items.push(lineItem);
        if (notes && !existing.notes.includes(notes)) {
          existing.notes += ` | ${notes}`;
        }
      }
    });

    return Array.from(poMap.values());
  }, [parsedRows, columnMapping, currentStep, suppliers, products]);

  const totalCostAllOrders = useMemo(() => {
    return groupedOrders.reduce((sum, po) => sum + po.items.reduce((iSum, it) => iSum + it.total_cost, 0), 0);
  }, [groupedOrders]);

  const totalLineItems = useMemo(() => {
    return groupedOrders.reduce((sum, po) => sum + po.items.length, 0);
  }, [groupedOrders]);

  const handleConfirmImport = async () => {
    if (groupedOrders.length === 0) return;
    setIsSubmitting(true);

    const payload: Partial<PurchaseOrder>[] = groupedOrders.map(po => ({
      po_id: po.poNumber,
      supplier_id: po.resolvedSupplierId,
      items: po.items,
      order_date: po.orderDate,
      expected_delivery_date: po.expectedDate,
      actual_delivery_date: po.actualDate,
      status: po.status,
      notes: po.notes ? `Legacy Migration: ${po.notes}` : 'Historical PO Migration',
      total_cost: po.items.reduce((s, it) => s + it.total_cost, 0),
    }));

    const result = await bulkAddPurchaseOrders(payload, true, updateInventory);
    setIsSubmitting(false);

    if (result.success) {
      setImportSummary({ count: result.count, totalCost: totalCostAllOrders, itemCount: totalLineItems });
      setCurrentStep('success');
      onSuccess?.(result.count);
    } else {
      alert(`Import error: ${result.error || 'Failed to complete historical PO upload'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black tracking-tight">Bulk Historical Purchase Order Migration</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PO Ledger
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Import past vendor invoices, purchasing histories, and multi-item orders with atomic SQLite safety.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Navigation Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600">
          <div className="flex items-center space-x-4">
            <span className={`flex items-center space-x-1.5 ${currentStep === 'upload' ? 'text-indigo-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Upload CSV</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center space-x-1.5 ${currentStep === 'map' ? 'text-indigo-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'map' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Map Columns</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center space-x-1.5 ${currentStep === 'preview' ? 'text-indigo-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'preview' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Group & Review</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center space-x-1 underline"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample CSV Template</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          
          {/* STEP 1: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <div className="flex border-b border-slate-200 text-xs font-bold space-x-4 pb-1">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`pb-2 border-b-2 transition-colors ${inputMode === 'file' ? 'border-indigo-600 text-indigo-800' : 'border-transparent text-slate-500'}`}
                >
                  Upload Spreadsheet File (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`pb-2 border-b-2 transition-colors ${inputMode === 'paste' ? 'border-indigo-600 text-indigo-800' : 'border-transparent text-slate-500'}`}
                >
                  Paste Raw CSV / Text
                </button>
              </div>

              {inputMode === 'file' ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .tsv, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Choose a CSV file or drag and drop here</h4>
                  <p className="text-xs text-slate-500 mt-1">Exported purchase ledger rows with multiple items per PO</p>
                  <button
                    type="button"
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Browse Files
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste CSV rows here (including header row)..."
                    className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => processFileContent(pastedText, 'pasted_po.csv')}
                    disabled={!pastedText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
                  >
                    Parse Pasted Text
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {currentStep === 'map' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Found {parsedHeaders.length} columns and {parsedRows.length} item rows. Rows with identical PO Numbers will be grouped automatically!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="text-blue-700 hover:underline font-bold text-[11px]"
                >
                  Change File
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Purchase Order Field</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">CSV Header In Your File</th>
                      <th className="py-2.5 px-3">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {TARGET_FIELDS.map((field) => {
                      const mappedIdx = columnMapping[field.key];
                      const sampleVal = mappedIdx !== undefined && parsedRows[0] ? parsedRows[0][mappedIdx] : '—';

                      return (
                        <tr key={field.key} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900">{field.label}</span>
                            <span className="block text-[10px] text-slate-500">{field.description}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {field.required ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Required</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Optional</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={mappedIdx !== undefined ? mappedIdx : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                setColumnMapping(prev => ({ ...prev, [field.key]: val as any }));
                              }}
                              className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">— Unmapped —</option>
                              {parsedHeaders.map((hdr, idx) => (
                                <option key={idx} value={idx}>{hdr}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                            {sampleVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('preview')}
                  disabled={columnMapping['po_number'] === undefined || columnMapping['supplier'] === undefined || columnMapping['item_name'] === undefined}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <span>Proceed to Grouping & Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Grouped POs</span>
                  <span className="text-lg font-black text-slate-900">{groupedOrders.length}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">Total Line Items</span>
                  <span className="text-lg font-black text-emerald-900">{totalLineItems}</span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-800 font-bold uppercase block">Total Purchasing Cost</span>
                  <span className="text-lg font-black text-indigo-950 font-mono">
                    ₦{totalCostAllOrders.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">Ingestion Mode</span>
                  <span className="text-xs font-black text-amber-950 block mt-1">
                    {updateInventory ? '⚠️ Increment Inventory Stock' : '✅ Historical Ledger Only'}
                  </span>
                </div>
              </div>

              {/* Mode Selection Guard */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="font-bold text-amber-950">Inventory Stock Protection Safeguard</span>
                </div>
                <p className="text-[11px] text-slate-700">
                  Are these historical purchase orders from the past whose items were already sold or counted during physical stocktake?
                </p>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="invMode"
                      checked={!updateInventory}
                      onChange={() => setUpdateInventory(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-bold text-slate-900">Historical Ledger Only (Recommended)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="invMode"
                      checked={updateInventory}
                      onChange={() => setUpdateInventory(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-bold text-amber-900">Also Increment Live Inventory Stock</span>
                  </label>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                  Grouped Purchase Orders Preview (First 10 Orders)
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">PO Ref</th>
                        <th className="py-2 px-2.5">Supplier</th>
                        <th className="py-2 px-2.5">Order Date</th>
                        <th className="py-2 px-2.5">Line Items</th>
                        <th className="py-2 px-2.5 text-right">Order Cost</th>
                        <th className="py-2 px-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {groupedOrders.slice(0, 10).map((po) => {
                        const poCost = po.items.reduce((s, it) => s + it.total_cost, 0);
                        return (
                          <tr key={po.poNumber} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 font-bold text-slate-900">{po.poNumber}</td>
                            <td className="py-2 px-2.5 font-sans">{po.supplierName}</td>
                            <td className="py-2 px-2.5 text-slate-500">{po.orderDate}</td>
                            <td className="py-2 px-2.5 font-sans">
                              <span className="font-semibold text-slate-800">{po.items.length} items</span>
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                {po.items.map(it => `${it.quantity_ordered}x ${it.item_name}`).join(', ')}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                              ₦{poCost.toLocaleString()}
                            </td>
                            <td className="py-2 px-2.5 font-sans">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('map')}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  Back to Mapping
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isSubmitting || groupedOrders.length === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Processing SQLite Transaction...</span>
                  ) : (
                    <>
                      <span>Commit {groupedOrders.length} Purchase Orders to Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {currentStep === 'success' && importSummary && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Historical Purchase Orders Migrated!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Successfully imported <strong>{importSummary.count}</strong> purchase orders ({importSummary.itemCount} line items) totaling <strong>₦{importSummary.totalCost.toLocaleString()}</strong> into your central SQLite database.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs"
                >
                  Done & Return to Orders
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

