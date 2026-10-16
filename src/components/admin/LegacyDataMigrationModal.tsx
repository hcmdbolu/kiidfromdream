import React, { useState, useMemo, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  LegacyMigrationConfig, 
  LegacyMigrationRow, 
  LegacyMigrationBatchResult,
  PaymentMethod 
} from '../../types';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Layers, 
  Calendar, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  FileText,
  DollarSign,
  User,
  Package,
  HelpCircle
} from 'lucide-react';

interface ColumnMapping {
  date_time: string;
  item_name: string;
  quantity_sold: string;
  unit_price: string;
  total_amount: string;
  cost_price: string;
  customer_name: string;
  customer_phone: string;
  cashier_name: string;
  payment_method: string;
  invoice_number: string;
  unit: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  date_time: '',
  item_name: '',
  quantity_sold: '',
  unit_price: '',
  total_amount: '',
  cost_price: '',
  customer_name: '',
  customer_phone: '',
  cashier_name: '',
  payment_method: '',
  invoice_number: '',
  unit: '',
};

// Heuristic aliases for auto-detection
const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  date_time: ['date', 'datetime', 'date_time', 'transaction_date', 'trans_date', 'timestamp', 'time', 'created_at'],
  item_name: ['item_name', 'item', 'product_name', 'product', 'description', 'desc', 'name', 'title', 'item_description'],
  quantity_sold: ['quantity_sold', 'quantity', 'qty', 'units', 'pieces', 'count', 'sold_qty', 'qty_sold'],
  unit_price: ['unit_price', 'price', 'selling_price', 'rate', 'unit_cost', 'item_price', 'price_per_unit'],
  total_amount: ['total_amount', 'total', 'final_amount', 'line_total', 'amount', 'gross_total', 'subtotal', 'sales_amount'],
  cost_price: ['cost_price', 'cost', 'item_cost', 'buy_price', 'wholesale_price', 'cogs'],
  customer_name: ['customer_name', 'customer', 'client', 'buyer', 'buyer_name', 'client_name'],
  customer_phone: ['customer_phone', 'phone', 'telephone', 'mobile', 'phone_number', 'cust_phone'],
  cashier_name: ['cashier_name', 'cashier', 'staff_name', 'staff', 'salesperson', 'user', 'operator', 'agent'],
  payment_method: ['payment_method', 'method', 'payment_type', 'pay_type', 'pay_mode', 'tender', 'tender_type'],
  invoice_number: ['invoice_number', 'invoice', 'receipt_no', 'receipt', 'reference', 'ref', 'bill_no', 'order_id', 'transaction_id'],
  unit: ['unit', 'measure_unit', 'packaging', 'uom', 'pack_type'],
};

export const LegacyDataMigrationModal: React.FC = () => {
  const { 
    isMigrationModalOpen, 
    closeMigrationModal, 
    importHistoricalSales, 
    products, 
    customers,
    activeStaff 
  } = usePos();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Raw file & parsed data states
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [detectedDelimiter, setDetectedDelimiter] = useState<string>(',');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);

  // Migration config state
  const [config, setConfig] = useState<LegacyMigrationConfig>({
    deductInventory: false,
    creditSalesStatus: 'SETTLED',
    autoCreateMissingProducts: true,
    autoCreateMissingCustomers: true,
    batchTag: `IMPORT_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
  });

  // Processing & result states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [migrationResult, setMigrationResult] = useState<LegacyMigrationBatchResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse CSV / TSV text
  const parseDelimitedText = (text: string, customDelimiter?: string) => {
    try {
      setParseError(null);
      const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('Data must contain at least a header row and one row of data.');
      }

      // Detect delimiter from first line
      let delim = customDelimiter;
      if (!delim) {
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        if (tabCount > commaCount && tabCount > semiCount) delim = '\t';
        else if (semiCount > commaCount) delim = ';';
        else delim = ',';
      }
      setDetectedDelimiter(delim);

      // Parse CSV helper respecting quotes
      const parseLine = (line: string): string[] => {
        const values: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === delim && !inQuotes) {
            values.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        values.push(cur.trim().replace(/^["']|["']$/g, ''));
        return values;
      };

      const parsedHeaders = parseLine(lines[0]);
      const parsedDataRows = lines.slice(1).map(parseLine).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));

      setHeaders(parsedHeaders);
      setRawRows(parsedDataRows);

      // Auto-detect mappings based on header names
      const autoMap: ColumnMapping = { ...DEFAULT_MAPPING };
      (Object.keys(HEADER_ALIASES) as Array<keyof ColumnMapping>).forEach(key => {
        const aliases = HEADER_ALIASES[key];
        const match = parsedHeaders.find(h => {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          return aliases.some(a => cleanH === a.toLowerCase().replace(/[^a-z0-9]/g, ''));
        });
        if (match) {
          autoMap[key] = match;
        }
      });
      setMapping(autoMap);
      setCurrentStep(2);
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse file. Please check file formatting.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      parseDelimitedText(text);
    };
    reader.readAsText(file);
  };

  // Convert raw rows according to mapping
  const normalizedRows: LegacyMigrationRow[] = useMemo(() => {
    if (rawRows.length === 0 || !mapping.date_time || !mapping.item_name) return [];

    const dateIdx = headers.indexOf(mapping.date_time);
    const itemIdx = headers.indexOf(mapping.item_name);
    const qtyIdx = headers.indexOf(mapping.quantity_sold);
    const priceIdx = headers.indexOf(mapping.unit_price);
    const totalIdx = headers.indexOf(mapping.total_amount);
    const costIdx = headers.indexOf(mapping.cost_price);
    const custIdx = headers.indexOf(mapping.customer_name);
    const phoneIdx = headers.indexOf(mapping.customer_phone);
    const cashierIdx = headers.indexOf(mapping.cashier_name);
    const payIdx = headers.indexOf(mapping.payment_method);
    const invIdx = headers.indexOf(mapping.invoice_number);
    const unitIdx = headers.indexOf(mapping.unit);

    return rawRows.map(row => {
      const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
      let date_time = new Date().toISOString();
      if (rawDate) {
        const parsedTime = new Date(rawDate);
        if (!isNaN(parsedTime.getTime())) {
          date_time = parsedTime.toISOString();
        }
      }

      const item_name = (itemIdx >= 0 ? row[itemIdx] : '').trim() || 'Imported Item';
      const quantity_sold = qtyIdx >= 0 ? (parseFloat(row[qtyIdx]) || 1) : 1;
      const unit_price = priceIdx >= 0 ? (parseFloat(row[priceIdx]) || 0) : 0;
      const total_amount = totalIdx >= 0 ? (parseFloat(row[totalIdx]) || (quantity_sold * unit_price)) : (quantity_sold * unit_price);
      const cost_price = costIdx >= 0 ? (parseFloat(row[costIdx]) || undefined) : undefined;
      const customer_name = custIdx >= 0 ? row[custIdx]?.trim() || undefined : undefined;
      const customer_phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() || undefined : undefined;
      const cashier_name = cashierIdx >= 0 ? row[cashierIdx]?.trim() || undefined : undefined;
      const payment_method = (payIdx >= 0 ? row[payIdx]?.trim() || 'Cash' : 'Cash') as PaymentMethod;
      const invoice_number = invIdx >= 0 ? row[invIdx]?.trim() || undefined : undefined;
      const unit = unitIdx >= 0 ? row[unitIdx]?.trim() || undefined : undefined;

      return {
        invoice_number,
        date_time,
        item_name,
        quantity_sold,
        unit_price,
        total_amount,
        cost_price,
        customer_name,
        customer_phone,
        cashier_name,
        payment_method,
        unit,
      };
    });
  }, [rawRows, headers, mapping]);

  // Pre-flight metrics
  const preFlightStats = useMemo(() => {
    let totalVolume = 0;
    let earliest = '';
    let latest = '';
    const missingProductNames = new Set<string>();
    const missingCustomerNames = new Set<string>();

    const existingProductNames = new Set(products.map(p => p.item_name.toLowerCase().trim()));
    const existingCustomerNames = new Set(customers.map(c => c.full_name.toLowerCase().trim()));

    normalizedRows.forEach(row => {
      totalVolume += row.total_amount;
      if (!earliest || row.date_time < earliest) earliest = row.date_time;
      if (!latest || row.date_time > latest) latest = row.date_time;

      if (!existingProductNames.has(row.item_name.toLowerCase().trim())) {
        missingProductNames.add(row.item_name);
      }
      if (row.customer_name && !existingCustomerNames.has(row.customer_name.toLowerCase().trim()) && row.customer_name !== 'Walk-in') {
        missingCustomerNames.add(row.customer_name);
      }
    });

    return {
      rowCount: normalizedRows.length,
      totalVolume,
      earliestDate: earliest ? earliest.slice(0, 10) : 'N/A',
      latestDate: latest ? latest.slice(0, 10) : 'N/A',
      missingProductsCount: missingProductNames.size,
      missingCustomersCount: missingCustomerNames.size,
      missingProductList: Array.from(missingProductNames).slice(0, 5),
      missingCustomerList: Array.from(missingCustomerNames).slice(0, 5),
    };
  }, [normalizedRows, products, customers]);

  const handleExecuteMigration = async () => {
    if (normalizedRows.length === 0) return;
    setIsSubmitting(true);

    try {
      const batchId = config.batchTag || `BATCH_${Date.now()}`;
      const result = await importHistoricalSales({
        sales: normalizedRows,
        batchId,
      }, config);

      setMigrationResult(result);
    } catch (err: any) {
      setMigrationResult({
        success: false,
        batchId: config.batchTag || '',
        totalImported: 0,
        totalVolume: 0,
        dateRange: { start: '', end: '' },
        productsCreated: 0,
        customersCreated: 0,
        stockDeducted: false,
        error: err.message || 'Unknown error occurred while processing migration batch.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetMigration = () => {
    setCurrentStep(1);
    setRawText('');
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setMapping(DEFAULT_MAPPING);
    setParseError(null);
    setMigrationResult(null);
  };

  if (!isMigrationModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Legacy Data Migration & Third-Party Import Module</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono">
                  v2.0 WAL
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Safely integrate legacy transaction archives into SQLite and Executive P&L without inflating cash drawers
              </p>
            </div>
          </div>
          <button
            onClick={closeMigrationModal}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Wizard Bar */}
        {!migrationResult && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
            {[
              { num: 1, title: 'Upload & Parse' },
              { num: 2, title: 'Map Columns' },
              { num: 3, title: 'Settings & Safety' },
              { num: 4, title: 'Pre-flight & Commit' },
            ].map(step => (
              <div 
                key={step.num}
                className={`flex items-center space-x-2 ${
                  currentStep === step.num 
                    ? 'text-indigo-700 font-bold' 
                    : currentStep > step.num 
                    ? 'text-emerald-700' 
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === step.num 
                    ? 'bg-indigo-600 text-white font-bold' 
                    : currentStep > step.num 
                    ? 'bg-emerald-600 text-white font-bold' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {currentStep > step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">

          {/* SUCCESS RESULT SCREEN */}
          {migrationResult && (
            <div className="space-y-6 text-center py-4">
              {migrationResult.success ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">Migration Successfully Committed!</h4>
                    <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                      All historical sales have been atomically written to the permanent SQLite database and indexed into Executive P&L.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-[11px] text-slate-500 font-medium">Batch ID</div>
                      <div className="text-xs font-mono font-bold text-indigo-700 truncate">{migrationResult.batchId}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-[11px] text-slate-500 font-medium">Sales Imported</div>
                      <div className="text-base font-bold text-emerald-700">{migrationResult.totalImported.toLocaleString()}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-[11px] text-slate-500 font-medium">Products Created</div>
                      <div className="text-base font-bold text-slate-800">{migrationResult.productsCreated}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-[11px] text-slate-500 font-medium">Customers Created</div>
                      <div className="text-base font-bold text-slate-800">{migrationResult.customersCreated}</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl max-w-2xl mx-auto text-left flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-900">
                      <strong>Till Balancing Safeguard Maintained:</strong> Today's live cashier cash drawer balances, shift reconciliation, and physical till totals were strictly preserved and have NOT been altered.
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={resetMigration}
                      className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Import Another Batch
                    </button>
                    <button
                      onClick={closeMigrationModal}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      Done & Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">Migration Transaction Rolled Back</h4>
                    <p className="text-sm text-rose-600 mt-1 max-w-md mx-auto">
                      {migrationResult.error || 'An error occurred during database commit. No records were modified.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setMigrationResult(null)}
                      className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Back to Review
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 1: UPLOAD & PARSE */}
          {!migrationResult && currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Upload Legacy Sales History File</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Drag and drop your exported CSV, TSV, or spreadsheet export from your previous POS / ERP system
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select Local File</span>
                  </button>
                </div>
                {fileName && (
                  <div className="mt-3 text-xs font-mono text-indigo-700 font-semibold">
                    Selected: {fileName}
                  </div>
                )}
              </div>

              {/* Paste Text Fallback */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Or Paste Delimited Sales Text Directly:</label>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Date,Item,Quantity,Price,Total,Customer,Payment\n2024-01-15,Super Rice 50kg,2,35000,70000,Chief Emeka,Cash\n2024-01-16,Vegetable Oil 5L,5,8000,40000,Walk-in,POS / Card`}
                  className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!rawText.trim()}
                  onClick={() => parseDelimitedText(rawText)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Continue to Column Mapping</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DYNAMIC COLUMN MAPPING */}
          {!migrationResult && currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Map File Headers to KIIDFROMDREAM Fields</h4>
                  <p className="text-xs text-slate-500">
                    We automatically matched fields where possible. Confirm or adjust the column dropdowns below.
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {rawRows.length.toLocaleString()} rows detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Required Fields */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Required Fields</span>
                  </h5>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Date & Time *</label>
                    <select
                      value={mapping.date_time}
                      onChange={(e) => setMapping({ ...mapping, date_time: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Item Name *</label>
                    <select
                      value={mapping.item_name}
                      onChange={(e) => setMapping({ ...mapping, item_name: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Quantity Sold *</label>
                    <select
                      value={mapping.quantity_sold}
                      onChange={(e) => setMapping({ ...mapping, quantity_sold: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Unit Selling Price *</label>
                    <select
                      value={mapping.unit_price}
                      onChange={(e) => setMapping({ ...mapping, unit_price: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Total Sale Amount *</label>
                    <select
                      value={mapping.total_amount}
                      onChange={(e) => setMapping({ ...mapping, total_amount: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Select Column (or Auto-compute) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                {/* Optional Enrichment Fields */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>Enrichment & Audit Fields (Optional)</span>
                  </h5>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Item Cost Price (For P&L)</label>
                    <select
                      value={mapping.cost_price}
                      onChange={(e) => setMapping({ ...mapping, cost_price: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- None (Estimate 60% of price) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Name</label>
                    <select
                      value={mapping.customer_name}
                      onChange={(e) => setMapping({ ...mapping, customer_name: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- None (Default Walk-in) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Payment Method</label>
                    <select
                      value={mapping.payment_method}
                      onChange={(e) => setMapping({ ...mapping, payment_method: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- None (Default Cash) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice / Receipt #</label>
                    <select
                      value={mapping.invoice_number}
                      onChange={(e) => setMapping({ ...mapping, invoice_number: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- None (Auto-generate) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Staff / Cashier Name</label>
                    <select
                      value={mapping.cashier_name}
                      onChange={(e) => setMapping({ ...mapping, cashier_name: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
                    >
                      <option value="">-- None (Current Admin) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 5-row Sample Preview */}
              {normalizedRows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-800">Preview: First 3 Parsed Records</div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Item</th>
                          <th className="p-2">Qty</th>
                          <th className="p-2">Price</th>
                          <th className="p-2">Total</th>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {normalizedRows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 truncate max-w-[100px]">{r.date_time.slice(0, 10)}</td>
                            <td className="p-2 font-sans font-medium text-slate-900">{r.item_name}</td>
                            <td className="p-2">{r.quantity_sold}</td>
                            <td className="p-2">₦{r.unit_price.toLocaleString()}</td>
                            <td className="p-2 font-bold text-slate-900">₦{r.total_amount.toLocaleString()}</td>
                            <td className="p-2 font-sans">{r.customer_name || 'Walk-in'}</td>
                            <td className="p-2">{r.payment_method || 'Cash'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={!mapping.date_time || !mapping.item_name || !mapping.quantity_sold || !mapping.unit_price}
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Configure Migration Safety</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: MIGRATION SETTINGS & SAFETY CONTROLS */}
          {!migrationResult && currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Migration Safety & Operational Controls</h4>
                <p className="text-xs text-slate-500">
                  Configure how imported transactions interact with your active live inventory and customer balances.
                </p>
              </div>

              <div className="space-y-3">
                {/* Setting 1: Deduct from Current Stock */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">Deduct Quantities from Current Physical Stock</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Default: OFF
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Leave <strong>OFF</strong> when importing past archives or historical sales, so your current shelf stock count is not reduced. Only turn ON if you are retroactively entering sales that occurred earlier today or this week that haven't been deducted yet.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.deductInventory}
                    onChange={(e) => setConfig({ ...config, deductInventory: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* Setting 2: Credit Sales Status */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-bold text-xs text-slate-900">Credit / "Pay Later" Sales Treatment</div>
                  <p className="text-xs text-slate-500">
                    If any historical records have 'Credit' payment method, choose whether they are already settled or remain open debt:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <label className={`flex-1 p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${
                      config.creditSalesStatus === 'SETTLED' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold' : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="creditStatus"
                        checked={config.creditSalesStatus === 'SETTLED'}
                        onChange={() => setConfig({ ...config, creditSalesStatus: 'SETTLED' })}
                        className="text-indigo-600"
                      />
                      <span>Mark as Settled / Cleared in the past (No active debt)</span>
                    </label>

                    <label className={`flex-1 p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${
                      config.creditSalesStatus === 'OUTSTANDING' ? 'border-amber-600 bg-amber-50/50 text-amber-950 font-bold' : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="creditStatus"
                        checked={config.creditSalesStatus === 'OUTSTANDING'}
                        onChange={() => setConfig({ ...config, creditSalesStatus: 'OUTSTANDING' })}
                        className="text-amber-600"
                      />
                      <span>Keep as Outstanding Customer Debt (Enters debt ledger)</span>
                    </label>
                  </div>
                </div>

                {/* Setting 3: Auto-creation Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Auto-create Missing Products</div>
                      <div className="text-[11px] text-slate-500">Add unknown catalog items automatically</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoCreateMissingProducts}
                      onChange={(e) => setConfig({ ...config, autoCreateMissingProducts: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Auto-create Missing Customers</div>
                      <div className="text-[11px] text-slate-500">Register new customer profile names</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoCreateMissingCustomers}
                      onChange={(e) => setConfig({ ...config, autoCreateMissingCustomers: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Batch Tag */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Batch Identifier / Tag</div>
                    <div className="text-[11px] text-slate-500">Enables filtering and rollback tracking in sales history</div>
                  </div>
                  <input
                    type="text"
                    value={config.batchTag}
                    onChange={(e) => setConfig({ ...config, batchTag: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-48 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-indigo-800"
                    placeholder="BATCH_TAG"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Review Pre-Flight Audit</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PRE-FLIGHT AUDIT & COMMIT */}
          {!migrationResult && currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Pre-Flight Migration Summary</h4>
                <p className="text-xs text-slate-500">
                  Verify the calculated scope before executing atomic SQLite transaction commit.
                </p>
              </div>

              {/* Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <div className="text-[11px] text-indigo-700 font-medium">Total Transactions</div>
                  <div className="text-lg font-bold text-indigo-950 font-mono">{preFlightStats.rowCount.toLocaleString()}</div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] text-emerald-700 font-medium">Gross Sales Volume</div>
                  <div className="text-lg font-bold text-emerald-950 font-mono">₦{preFlightStats.totalVolume.toLocaleString()}</div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Historical Range</div>
                  <div className="text-xs font-bold text-slate-800 font-mono truncate">
                    {preFlightStats.earliestDate} to {preFlightStats.latestDate}
                  </div>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <div className="text-[11px] text-purple-700 font-medium">New Entities Auto-Created</div>
                  <div className="text-xs font-bold text-purple-900">
                    {preFlightStats.missingProductsCount} products, {preFlightStats.missingCustomersCount} customers
                  </div>
                </div>
              </div>

              {/* Integrity & Drawer Safety Notice */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-emerald-950">Architectural Drawer Safety Guarantee</h5>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    These {preFlightStats.rowCount.toLocaleString()} transactions will populate Executive P&L, customer transaction histories, and inventory audit logs. However, because they are tagged with <code className="bg-emerald-200/60 px-1 py-0.2 rounded font-mono text-[10px]">is_historical_import: true</code>, they will <strong>NEVER</strong> inflate today's physical cashier cash drawers or distort drawer balancing.
                  </p>
                </div>
              </div>

              {/* Auto-Creation Detail Accordion */}
              {(preFlightStats.missingProductsCount > 0 || preFlightStats.missingCustomersCount > 0) && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
                  <div className="font-bold text-slate-900">New Items To Be Added To Catalog:</div>
                  {preFlightStats.missingProductsCount > 0 && (
                    <div className="text-[11px] text-slate-600">
                      • <strong>{preFlightStats.missingProductsCount} Products:</strong> {preFlightStats.missingProductList.join(', ')}{preFlightStats.missingProductsCount > 5 ? '...' : ''}
                    </div>
                  )}
                  {preFlightStats.missingCustomersCount > 0 && (
                    <div className="text-[11px] text-slate-600">
                      • <strong>{preFlightStats.missingCustomersCount} Customers:</strong> {preFlightStats.missingCustomerList.join(', ')}{preFlightStats.missingCustomersCount > 5 ? '...' : ''}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteMigration}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Writing Transactional Batch to SQLite...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Commit Migration to Central Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
