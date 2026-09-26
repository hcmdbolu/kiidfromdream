import React, { useState, useRef, useMemo, ChangeEvent, DragEvent } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, ProductCategory, ProductUnit, ProductStatus } from '../../types';
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
  Trash2, 
  RotateCcw,
  CheckCheck
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

// Available standard target fields for mapping
export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  description: string;
  defaultFallback?: any;
}

const TARGET_FIELDS: TargetField[] = [
  { key: 'item_name', label: 'Product Name', required: true, description: 'Fish species or product title (e.g., Atlantic Salmon Fillet)' },
  { key: 'product_category', label: 'Category', required: true, description: 'Freshwater Fish, Saltwater Fish, Frozen Fish, or Dried Fish' },
  { key: 'selling_price', label: 'Unit Price (Selling)', required: true, description: 'Retail counter selling price in ₦ per unit' },
  { key: 'quantity', label: 'Initial Stock (Float / Decimal)', required: true, description: 'Current available stock — supports float numbers (e.g., 60.5 kg, 45.75 kg, 120 pieces)' },
  { key: 'product_measure_unit', label: 'Measurement Type', required: true, description: 'Unit of measure: KG, PIECES, LITERS, or TONS' },
  { key: 'item_cost', label: 'Wholesale Cost', required: false, description: 'Acquisition / landing cost in ₦ (defaults to 70% of price)' },
  { key: 'reorder_level', label: 'Reorder Level', required: false, description: 'Low stock threshold — supports float decimals (e.g. 15.5 kg, 20 pieces)' },
  { key: 'expiry_date', label: 'Expiry Date', required: false, description: 'Date format YYYY-MM-DD (defaults to 30 days ahead)' },
  { key: 'supplier_id', label: 'Supplier ID', required: false, description: 'Vendor code e.g. SUP-00012 (defaults to primary supplier)' },
];

const SAMPLE_CSV_DATA = `Product Name,Category,Unit Price (NGN),Initial Stock,Measurement Type,Wholesale Cost (NGN),Reorder Level,Expiry Date,Supplier ID
Atlantic Salmon Fillet,Frozen Fish,8500,60.5,KG,6200,15.5,2026-11-30,SUP-00012
Live African Catfish (Jumbo),Freshwater Fish,4500,120,PIECES,3100,25,2026-10-25,SUP-00012
Yellowfin Tuna Steaks,Saltwater Fish,7800,45.75,KG,5600,10.5,2026-11-15,SUP-00013
Smoked Mangrove Snapper,Dried Fish,5200,80,PIECES,3800,20,2026-12-20,SUP-00014
Tiger Prawns (Headless),Frozen Fish,11000,35.25,KG,8500,10.0,2026-12-05,SUP-00013
Fresh Nile Perch Steaks,Freshwater Fish,6000,50.8,KG,4200,15.0,2026-10-31,SUP-00012
Atlantic Mackerel (Titus),Frozen Fish,3500,150.5,KG,2400,30.0,2026-11-20,SUP-00013
Dried Stockfish Flakes,Dried Fish,9500,40.25,KG,7000,10.0,2027-02-15,SUP-00014`;

// Category default fallback images
const CATEGORY_IMAGES: Record<ProductCategory, string> = {
  'Freshwater Fish': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80',
  'Saltwater Fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80',
  'Frozen Fish': 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?w=600&auto=format&fit=crop&q=80',
  'Dried Fish': 'https://images.unsplash.com/photo-1579613832125-5d34a13ffe0a?w=600&auto=format&fit=crop&q=80',
};

// Robust CSV parser supporting quotes, commas within quotes, CRLF/LF
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  const lines: string[] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        lines.push(currentRow as any);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Push last field & row if pending
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      lines.push(currentRow as any);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = (lines[0] as unknown as string[]).map(h => h.trim());
  const rows = (lines.slice(1) as unknown as string[][]).filter(r => r.some(col => col.trim().length > 0));

  return { headers, rows };
}

// Normalizer for Product Category
function normalizeCategory(raw: string): ProductCategory {
  const s = raw.toLowerCase().trim();
  if (s.includes('freshwater') || s.includes('catfish') || s.includes('tilapia') || s.includes('nile') || s.includes('carp')) {
    return 'Freshwater Fish';
  }
  if (s.includes('saltwater') || s.includes('sea') || s.includes('tuna') || s.includes('snapper') || s.includes('croaker') || s.includes('barracuda')) {
    return 'Saltwater Fish';
  }
  if (s.includes('dried') || s.includes('smoked') || s.includes('dry') || s.includes('stockfish')) {
    return 'Dried Fish';
  }
  return 'Frozen Fish'; // Default fallback
}

// Normalizer for Measurement Unit
function normalizeMeasureUnit(raw: string): ProductUnit {
  const s = raw.toUpperCase().trim();
  if (s === 'KG' || s === 'KGS' || s === 'KILOGRAM' || s === 'KILOGRAMS') return 'KG';
  if (s === 'PIECES' || s === 'PIECE' || s === 'PCS' || s === 'PC' || s === 'UNIT' || s === 'UNITS') return 'PIECES';
  if (s === 'LITERS' || s === 'LITER' || s === 'LTR' || s === 'L') return 'LITERS';
  if (s === 'TONS' || s === 'TON' || s === 'TONNES') return 'TONS';
  return 'KG'; // Standard default for fish markets
}

// Clean numeric strings (removes ₦, $, commas)
function parseNumeric(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { suppliers, bulkAddProducts, products } = usePos();
  
  // Wizard steps: 'upload' -> 'map' -> 'preview' -> 'success'
  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'preview' | 'success'>('upload');

  // Input states
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed raw CSV
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);

  // Field Mapping: Maps targetFieldKey -> selected CSV Header Name (or '__none__')
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  // Final parsed items ready for import
  const [parsedItems, setParsedItems] = useState<{
    item: Omit<Product, 'item_sn'>;
    isValid: boolean;
    errors: string[];
    rowNumber: number;
    rawValues: Record<string, string>;
  }[]>([]);

  // Final summary after success
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default supplier ID
  const defaultSupplierId = suppliers[0]?.supplier_id || 'SUP-00012';

  // Trigger browser download for CSV template
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_DATA], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kiidfromdream_fish_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load sample demo data directly
  const handleLoadSampleData = () => {
    processRawCSV(SAMPLE_CSV_DATA, 'demo_sample_fish_products.csv');
  };

  // Process raw CSV string
  const processRawCSV = (text: string, sourceName: string) => {
    setUploadError(null);
    try {
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        setUploadError('The CSV file appears to be empty or could not be parsed.');
        return;
      }
      if (rows.length === 0) {
        setUploadError('The CSV file contains header columns but no product data rows.');
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setFileName(sourceName);

      // Auto-detect and suggest initial field mappings
      const initialMappings: Record<string, string> = {};
      TARGET_FIELDS.forEach(tf => {
        const matchingHeader = autoDetectHeader(tf.key, headers);
        if (matchingHeader) {
          initialMappings[tf.key] = matchingHeader;
        } else {
          initialMappings[tf.key] = '__none__';
        }
      });

      setFieldMappings(initialMappings);
      setCurrentStep('map');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process CSV file.');
    }
  };

  // Smart auto-detection of column headers
  const autoDetectHeader = (targetKey: string, availableHeaders: string[]): string | null => {
    const lowerHeaders = availableHeaders.map(h => ({ raw: h, norm: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

    const searchPatterns: Record<string, string[]> = {
      item_name: ['productname', 'itemname', 'name', 'product', 'fishname', 'fishtype', 'title', 'item'],
      product_category: ['category', 'productcategory', 'fishcategory', 'type', 'group'],
      selling_price: ['unitprice', 'sellingprice', 'price', 'rate', 'unitpricengn', 'retailprice', 'counterprice', 'costperunit'],
      quantity: ['initialstock', 'stock', 'quantity', 'qty', 'units', 'balance', 'startingstock', 'stocklevel'],
      product_measure_unit: ['measurementtype', 'measureunit', 'unit', 'uom', 'measuringunit', 'unittype'],
      item_cost: ['wholesalecost', 'itemcost', 'cost', 'costprice', 'costpricengn', 'buyingprice', 'landingcost'],
      reorder_level: ['reorderlevel', 'reorder', 'minlevel', 'threshold', 'lowstockthreshold', 'minstock'],
      expiry_date: ['expirydate', 'expiry', 'expdate', 'expirationdate', 'bestbefore'],
      supplier_id: ['supplierid', 'supplier', 'vendorid', 'vendor', 'suppliercode'],
    };

    const patterns = searchPatterns[targetKey] || [];
    for (const p of patterns) {
      const match = lowerHeaders.find(h => h.norm === p || h.norm.includes(p));
      if (match) return match.raw;
    }

    return null;
  };

  // File drag & drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setUploadError('Please select a valid CSV file (.csv format).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processRawCSV(content, file.name);
    };
    reader.onerror = () => {
      setUploadError('Failed to read selected file.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Update field mapping
  const handleMappingChange = (targetKey: string, csvHeader: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [targetKey]: csvHeader
    }));
  };

  // Move from Mapping step to Preview step with validation
  const handleProceedToPreview = () => {
    // Check required fields
    const missingRequired = TARGET_FIELDS.filter(tf => tf.required && (!fieldMappings[tf.key] || fieldMappings[tf.key] === '__none__'));
    if (missingRequired.length > 0) {
      setUploadError(`Please map all required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }
    setUploadError(null);

    // Build parsed items and validate each row
    const defaultFutureDate = new Date();
    defaultFutureDate.setDate(defaultFutureDate.getDate() + 30);
    const fallbackExpiry = defaultFutureDate.toISOString().split('T')[0];

    const parsed = csvRows.map((row, index) => {
      const rowNum = index + 2; // +1 for 0-index, +1 for header row
      const errors: string[] = [];

      // Helper to get mapped value
      const getVal = (targetKey: string): string => {
        const header = fieldMappings[targetKey];
        if (!header || header === '__none__') return '';
        const colIdx = csvHeaders.indexOf(header);
        if (colIdx === -1) return '';
        return (row[colIdx] || '').trim();
      };

      const rawValues = {
        name: getVal('item_name'),
        category: getVal('product_category'),
        price: getVal('selling_price'),
        stock: getVal('quantity'),
        unit: getVal('product_measure_unit'),
        cost: getVal('item_cost'),
        reorder: getVal('reorder_level'),
        expiry: getVal('expiry_date'),
        supplier: getVal('supplier_id'),
      };

      // 1. Validate Product Name
      if (!rawValues.name) {
        errors.push('Product name is required');
      }

      // 2. Validate Selling Price
      const sellingPrice = parseNumeric(rawValues.price, 0);
      if (sellingPrice <= 0) {
        errors.push('Unit Price must be greater than ₦0');
      }

      // 3. Validate Initial Stock (Supports float numbers e.g. 60.5 kg, 45.75 kg)
      const rawStockNum = parseNumeric(rawValues.stock, -1);
      if (rawStockNum < 0) {
        errors.push('Initial stock cannot be negative');
      }
      // Preserve float numbers up to 3 decimal places
      const quantity = Math.round(rawStockNum * 1000) / 1000;

      // 4. Normalize Category
      const productCategory = normalizeCategory(rawValues.category);

      // 5. Normalize Unit
      const measureUnit = normalizeMeasureUnit(rawValues.unit);

      // 6. Cost (defaults to 70% of price if empty or 0)
      let itemCost = parseNumeric(rawValues.cost, 0);
      if (itemCost <= 0) {
        itemCost = Math.round(sellingPrice * 0.7);
      }

      // 7. Reorder Level (supports float decimal numbers)
      let reorderLevel = parseNumeric(rawValues.reorder, 0);
      if (reorderLevel <= 0) {
        reorderLevel = Math.max(5, Math.round(quantity * 0.2 * 10) / 10);
      } else {
        reorderLevel = Math.round(reorderLevel * 1000) / 1000;
      }

      // 8. Expiry Date (defaults to 30 days ahead)
      let expiryDate = rawValues.expiry;
      if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        expiryDate = fallbackExpiry;
      }

      // 9. Supplier ID
      let supplierId = rawValues.supplier;
      if (!supplierId || !suppliers.some(s => s.supplier_id === supplierId)) {
        supplierId = defaultSupplierId;
      }

      // 10. Picture
      const itemPicture = CATEGORY_IMAGES[productCategory] || CATEGORY_IMAGES['Frozen Fish'];

      const item: Omit<Product, 'item_sn'> = {
        item_name: rawValues.name || 'Unnamed Fish SKU',
        item_picture: itemPicture,
        quantity: Math.max(0, quantity),
        expiry_date: expiryDate,
        item_cost: itemCost,
        product_measure_unit: measureUnit,
        quantity_per_unit: measureUnit === 'KG' ? 20 : 1,
        selling_price: sellingPrice,
        product_category: productCategory,
        reorder_level: reorderLevel,
        supplier_id: supplierId,
        status: 'Active' as ProductStatus,
      };

      return {
        item,
        isValid: errors.length === 0,
        errors,
        rowNumber: rowNum,
        rawValues,
      };
    });

    setParsedItems(parsed);
    setCurrentStep('preview');
  };

  // Calculate totals and metrics for preview
  const validItems = useMemo(() => parsedItems.filter(p => p.isValid), [parsedItems]);
  const invalidItems = useMemo(() => parsedItems.filter(p => !p.isValid), [parsedItems]);

  const totalUnits = useMemo(() => {
    const sum = validItems.reduce((acc, p) => acc + p.item.quantity, 0);
    return Math.round(sum * 1000) / 1000;
  }, [validItems]);
  const totalStockValue = useMemo(() => validItems.reduce((sum, p) => sum + (p.item.quantity * p.item.selling_price), 0), [validItems]);

  // Execute the bulk import
  const handleCommitImport = () => {
    if (validItems.length === 0) {
      alert('There are no valid items to import.');
      return;
    }

    const itemsToImport = validItems.map(v => v.item);
    bulkAddProducts(itemsToImport);
    setImportedCount(itemsToImport.length);
    setCurrentStep('success');

    if (onSuccess) {
      onSuccess(itemsToImport.length);
    }
  };

  // Reset modal state
  const handleReset = () => {
    setCurrentStep('upload');
    setInputMode('file');
    setPastedText('');
    setFileName(null);
    setUploadError(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setFieldMappings({});
    setParsedItems([]);
    setImportedCount(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white tracking-tight">Bulk Import Fish & Seafood SKUs</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  CSV Batch Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mass-upload products into cold-room inventory with automatic column mapping and validation.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Download standardized CSV import template"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download CSV Template</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className={`flex items-center space-x-1.5 font-semibold ${
              currentStep === 'upload' ? 'text-emerald-700' : 'text-slate-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>1</span>
              <span>Upload CSV</span>
            </div>

            <span className="text-slate-300">/</span>

            <div className={`flex items-center space-x-1.5 font-semibold ${
              currentStep === 'map' ? 'text-emerald-700' : 'text-slate-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'map' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>2</span>
              <span>Map Columns</span>
            </div>

            <span className="text-slate-300">/</span>

            <div className={`flex items-center space-x-1.5 font-semibold ${
              currentStep === 'preview' ? 'text-emerald-700' : 'text-slate-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'preview' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>3</span>
              <span>Validate & Review</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="sm:hidden text-xs text-emerald-600 font-semibold flex items-center space-x-1 underline"
          >
            <Download className="w-3 h-3" />
            <span>Template</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Global Upload Error Alert */}
          {uploadError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Import issue: </span>
                <span>{uploadError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setUploadError(null)}
                className="text-rose-400 hover:text-rose-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: UPLOAD FILE OR PASTE CSV */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 'upload' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Mode switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      inputMode === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload CSV File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      inputMode === 'paste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Paste Raw CSV Text</span>
                  </button>
                </div>

                {/* Instant Sample Data Loader */}
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="Test bulk import immediately with pre-loaded fresh & frozen fish records"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Load Sample Batch</span>
                </button>
              </div>

              {/* Mode: File Upload Drag & Drop Area */}
              {inputMode === 'file' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
                      : 'border-slate-300 hover:border-emerald-500/70 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept=".csv, text/csv, text/plain"
                    className="hidden"
                  />

                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                    isDragging ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    <Upload className="w-7 h-7" />
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      Drag & drop your fish inventory CSV file here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      or <span className="text-emerald-600 font-semibold underline">browse from your computer</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">Format: .CSV</span>
                    <span>·</span>
                    <span>UTF-8 encoded</span>
                    <span>·</span>
                    <span>Headers in first row</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Supports Float / Decimal Stock (e.g. 60.5 kg)</span>
                  </div>
                </div>
              )}

              {/* Mode: Paste Text */}
              {inputMode === 'paste' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Paste comma-separated rows including header row (decimals supported):</span>
                    <button
                      type="button"
                      onClick={() => setPastedText(SAMPLE_CSV_DATA)}
                      className="text-emerald-600 font-semibold hover:underline"
                    >
                      Paste sample template
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Product Name,Category,Unit Price (NGN),Initial Stock,Measurement Type&#10;Atlantic Salmon Fillet,Frozen Fish,8500,60.5,KG&#10;Live African Catfish,Freshwater Fish,4500,120,PIECES"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 font-mono text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!pastedText.trim()}
                      onClick={() => processRawCSV(pastedText, 'pasted_data.csv')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Parse CSV Text & Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Download CSV Template Information Banner */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 text-emerald-600 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Need the exact CSV format?</h4>
                    <p className="text-slate-500 mt-0.5">
                      Download the official template with pre-filled sample rows for Freshwater, Saltwater, Frozen, and Dried fish.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold transition-colors shrink-0 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Download CSV Template</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: FIELD MAPPING */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 'map' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Detected <strong>{csvHeaders.length} columns</strong> and <strong>{csvRows.length} data rows</strong> from <span className="font-mono">{fileName}</span>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm">Match CSV Columns to Inventory Fields</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm which column in your CSV maps to each product attribute. All marked <span className="text-rose-500 font-bold">*</span> are required.
                </p>
              </div>

              {/* Mapping Grid */}
              <div className="space-y-3">
                {TARGET_FIELDS.map(tf => {
                  const selectedHeader = fieldMappings[tf.key] || '__none__';
                  const isMapped = selectedHeader !== '__none__';
                  const previewVal = isMapped && csvRows[0] ? csvRows[0][csvHeaders.indexOf(selectedHeader)] : null;

                  return (
                    <div 
                      key={tf.key}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isMapped 
                          ? 'bg-white border-slate-200 shadow-2xs' 
                          : tf.required 
                            ? 'bg-rose-50/40 border-rose-200' 
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-slate-900">{tf.label}</span>
                          {tf.required ? (
                            <span className="text-rose-500 font-bold text-xs">*</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Optional</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{tf.description}</div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {previewVal !== null && previewVal !== undefined && (
                          <div className="hidden md:block max-w-[140px] truncate text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded font-mono">
                            Sample: "{previewVal}"
                          </div>
                        )}

                        <select
                          value={selectedHeader}
                          onChange={(e) => handleMappingChange(tf.key, e.target.value)}
                          className={`text-xs rounded-xl px-3 py-2 border font-medium transition-colors ${
                            isMapped 
                              ? 'bg-white border-emerald-500 text-slate-900 ring-1 ring-emerald-500/20' 
                              : tf.required 
                                ? 'bg-white border-rose-300 text-rose-800' 
                                : 'bg-slate-50 border-slate-300 text-slate-600'
                          }`}
                        >
                          <option value="__none__">-- Do not import --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('upload')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Upload</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToPreview}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Preview & Validate Rows</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: PREVIEW & VALIDATION */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 'preview' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Total Rows</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{parsedItems.length}</div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <div className="text-[11px] font-medium text-emerald-800">Valid & Ready</div>
                  <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5 flex items-center space-x-1.5">
                    <span>{validItems.length}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Total New Units</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {totalUnits.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Total Stock Value</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    ₦{totalStockValue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Error banner if any invalid rows */}
              {invalidItems.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{invalidItems.length} row(s)</strong> have validation errors and will be skipped. {validItems.length} row(s) will be imported.
                    </span>
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3">Initial Stock</th>
                        <th className="py-2.5 px-3">Measurement</th>
                        <th className="py-2.5 px-3">Unit Cost</th>
                        <th className="py-2.5 px-3">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedItems.map((p, idx) => (
                        <tr 
                          key={idx}
                          className={`hover:bg-slate-50 transition-colors ${
                            !p.isValid ? 'bg-rose-50/40 text-rose-900' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                            {p.rowNumber}
                          </td>

                          <td className="py-2.5 px-3">
                            {p.isValid ? (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" />
                                <span>Valid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800" title={p.errors.join(', ')}>
                                <X className="w-3 h-3" />
                                <span>Error</span>
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {p.item.item_name}
                            {!p.isValid && (
                              <div className="text-[10px] text-rose-600 font-normal">
                                {p.errors.join('; ')}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {p.item.product_category}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            ₦{p.item.selling_price.toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {p.item.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {p.item.product_measure_unit}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            ₦{p.item.item_cost.toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {p.item.expiry_date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('map')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Column Mapping</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={validItems.length === 0}
                    onClick={handleCommitImport}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Confirm & Import {validItems.length} Products</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 4: SUCCESS SUMMARY */}
          {/* ------------------------------------------------------------- */}
          {currentStep === 'success' && (
            <div className="text-center py-8 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Successfully Imported {importedCount} Fish Products!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  All items have been assigned automatic SKU serial numbers (Item SN) and registered into your cold-room inventory and POS terminal.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center space-x-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Import Another File</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Return to Inventory
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer info note */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Real-time multi-terminal broadcast and cryptographic audit trail enabled for imports.</span>
          </div>
          <span className="font-mono text-slate-400">Total SKUs in DB: {products.length}</span>
        </div>

      </div>
    </div>
  );
};
