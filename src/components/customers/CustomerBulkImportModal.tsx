import React, { useState, useRef, useMemo, ChangeEvent, DragEvent } from 'react';
import { usePos } from '../../context/PosContext';
import { Customer, CustomerType } from '../../types';
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
  Users,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

interface CustomerBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export interface CustomerTargetField {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

const TARGET_FIELDS: CustomerTargetField[] = [
  { key: 'full_name', label: 'Full Name', required: true, description: 'Customer or business name (e.g., Alhaji Musa Sani, Green Supermarket)' },
  { key: 'phone_number', label: 'Phone Number', required: true, description: 'Mobile phone e.g. 08031234567 or +234 803 123 4567' },
  { key: 'balance', label: 'Opening Debt Balance (₦)', required: false, description: 'Existing outstanding debt/credit balance from previous system' },
  { key: 'customer_type', label: 'Customer Tier / Type', required: false, description: 'Retail, Wholesale, Restaurant, or Supermarket' },
  { key: 'credit_limit', label: 'Credit Limit (₦)', required: false, description: 'Maximum allowable credit line (e.g. 200,000)' },
  { key: 'discount_percent', label: 'Custom Discount (%)', required: false, description: 'Negotiated discount rate (e.g., 5 for 5%)' },
  { key: 'email', label: 'Email Address', required: false, description: 'Contact email address' },
  { key: 'address', label: 'Physical Address', required: false, description: 'Delivery or billing address' },
  { key: 'total_spent', label: 'Historical Total Spent (₦)', required: false, description: 'Cumulative lifetime purchases in previous system' },
  { key: 'notes', label: 'Notes / Account Memo', required: false, description: 'Legacy remarks, references, or guarantor info' },
];

const SAMPLE_CSV = `Full Name,Phone Number,Opening Debt Balance (NGN),Customer Type,Credit Limit (NGN),Custom Discount (%),Email Address,Physical Address,Historical Total Spent (NGN),Notes
Alhaji Musa Sani,08031234567,45000,Wholesale,150000,5,musa.sani@example.com,Shop 14 Central Market Kaduna,850000,Frequent bulk buyer
Chidinma Okonkwo,08129876543,0,Supermarket,100000,3,chidinma.o@example.com,12 Admiralty Way Lekki Phase 1,420000,Preferred payment via Bank Transfer
Emeka Super Stores,07055443322,120000,Restaurant,500000,8,accounts@emekastores.ng,45 Market Road Aba,2400000,Legacy invoice #EMK-901 overdue
Ibrahim & Sons Ltd,08023344556,0,Wholesale,250000,4,,Zone 3 Wuse Abuja,1100000,Cash on Delivery preferred
Grace Folashade,09087654321,15500,Retail,50000,0,grace.folashade@gmail.com,8 Allen Avenue Ikeja Lagos,195000,Settles debt every month-end`;

// Robust CSV parser supporting quotes, CRLF/LF
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0];
  const rows = lines.slice(1);
  return { headers, rows };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return raw.trim();
}

function cleanCurrency(raw: any): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const str = String(raw).trim();
  const isNegative = str.includes('(') || str.startsWith('-');
  const cleaned = str.replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned) || 0;
  return isNegative ? -num : num;
}

export const CustomerBulkImportModal: React.FC<CustomerBulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { customers, bulkAddCustomers } = usePos();
  
  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'preview' | 'success'>('upload');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed CSV data
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});

  // Options
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ count: number; totalDebt: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'legacy_customers_import_template.csv');
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
          if (fieldKey === 'full_name' && /name|customer|client|buyer/.test(headerClean)) return true;
          if (fieldKey === 'phone_number' && /phone|mobile|tel|contact/.test(headerClean)) return true;
          if (fieldKey === 'balance' && /debt|balance|owed|arrears|opening/.test(headerClean)) return true;
          if (fieldKey === 'customer_type' && /type|tier|category|segment/.test(headerClean)) return true;
          if (fieldKey === 'credit_limit' && /limit|creditlimit/.test(headerClean)) return true;
          if (fieldKey === 'discount_percent' && /discount|rate|percent/.test(headerClean)) return true;
          if (fieldKey === 'email' && /email|mail/.test(headerClean)) return true;
          if (fieldKey === 'address' && /address|location|city/.test(headerClean)) return true;
          if (fieldKey === 'total_spent' && /spent|lifetime|totalpurchase|revenue/.test(headerClean)) return true;
          if (fieldKey === 'notes' && /notes|remarks|comment|memo/.test(headerClean)) return true;
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

  // Pre-flight data mapping & validation
  const previewData = useMemo(() => {
    if (currentStep !== 'preview' && currentStep !== 'success') return [];

    return parsedRows.map((row, index) => {
      const getVal = (key: string): string => {
        const colIdx = columnMapping[key];
        return colIdx !== undefined && row[colIdx] !== undefined ? row[colIdx].trim() : '';
      };

      const fullName = getVal('full_name');
      const rawPhone = getVal('phone_number');
      const phone = normalizePhone(rawPhone);
      const balance = Math.max(0, cleanCurrency(getVal('balance')));
      const creditLimit = Math.max(0, cleanCurrency(getVal('credit_limit')));
      const discountPercent = Math.min(100, Math.max(0, cleanCurrency(getVal('discount_percent'))));
      const totalSpent = Math.max(0, cleanCurrency(getVal('total_spent')));
      const email = getVal('email');
      const address = getVal('address');
      const notes = getVal('notes');

      let customerType: CustomerType = 'Retail';
      const rawType = getVal('customer_type').toLowerCase();
      if (rawType.includes('wholesale')) customerType = 'Wholesale';
      else if (rawType.includes('restaurant') || rawType.includes('eatery') || rawType.includes('hotel')) customerType = 'Restaurant';
      else if (rawType.includes('supermarket') || rawType.includes('store') || rawType.includes('mart') || rawType.includes('corp') || rawType.includes('vip')) customerType = 'Supermarket';

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!fullName) errors.push('Customer Name is required');
      if (!rawPhone) errors.push('Phone number is required');

      // Check duplicates against active DB
      const existingDb = customers.find(c => 
        (phone && c.phone_number.replace(/\D/g, '') === phone.replace(/\D/g, '')) ||
        (fullName && c.full_name.toLowerCase() === fullName.toLowerCase())
      );

      if (existingDb) {
        warnings.push(`Matches existing customer: ${existingDb.full_name} (${existingDb.customer_id})`);
      }

      if (balance > 0) {
        warnings.push(`Opening debt balance: ₦${balance.toLocaleString()}`);
      }

      return {
        rowNumber: index + 1,
        fullName,
        phone,
        email,
        address,
        customerType,
        balance,
        creditLimit,
        discountPercent,
        totalSpent,
        notes,
        isExisting: !!existingDb,
        existingId: existingDb?.customer_id,
        errors,
        warnings,
        isValid: errors.length === 0,
      };
    });
  }, [parsedRows, columnMapping, currentStep, customers]);

  const validRows = useMemo(() => previewData.filter(r => r.isValid), [previewData]);
  const totalDebtToImport = useMemo(() => validRows.reduce((sum, r) => sum + r.balance, 0), [validRows]);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);

    const payload: Partial<Customer>[] = validRows.map(r => ({
      customer_id: r.isExisting && updateExisting ? r.existingId : undefined,
      full_name: r.fullName,
      phone_number: r.phone,
      email: r.email,
      address: r.address,
      customer_type: r.customerType,
      balance: r.balance,
      credit_limit: r.creditLimit,
      discount_percent: r.discountPercent,
      total_spent: r.totalSpent,
      notes: r.notes ? `Legacy Migration: ${r.notes}` : 'Imported from legacy system',
    }));

    const result = await bulkAddCustomers(payload, updateExisting);
    setIsSubmitting(false);

    if (result.success) {
      setImportSummary({ count: result.count, totalDebt: totalDebtToImport });
      setCurrentStep('success');
      onSuccess?.(result.count);
    } else {
      alert(`Import error: ${result.error || 'Failed to complete bulk customer upload'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black tracking-tight">Bulk Customer & Debt Ledger Migration</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Legacy Importer
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Import customer directories, VIP tiers, contact details, and preserve initial outstanding debts.
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
            <span className={`flex items-center space-x-1.5 ${currentStep === 'upload' ? 'text-emerald-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Upload CSV</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center space-x-1.5 ${currentStep === 'map' ? 'text-emerald-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'map' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Map Columns</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`flex items-center space-x-1.5 ${currentStep === 'preview' ? 'text-emerald-700 font-extrabold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'preview' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Validate & Review</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center space-x-1 underline"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample CSV Template</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          
          {/* STEP 1: Upload / Paste */}
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <div className="flex border-b border-slate-200 text-xs font-bold space-x-4 pb-1">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`pb-2 border-b-2 transition-colors ${inputMode === 'file' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500'}`}
                >
                  Upload Spreadsheet File (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`pb-2 border-b-2 transition-colors ${inputMode === 'paste' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500'}`}
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
                    isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .tsv, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Choose a CSV file or drag and drop here</h4>
                  <p className="text-xs text-slate-500 mt-1">Exported customer files from Excel, QuickBooks, or previous POS systems</p>
                  <button
                    type="button"
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
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
                    className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => processFileContent(pastedText, 'pasted_customers.csv')}
                    disabled={!pastedText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
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

          {/* STEP 2: Column Mapping */}
          {currentStep === 'map' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Found {parsedHeaders.length} columns and {parsedRows.length} customer rows in {fileName || 'uploaded file'}.</span>
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
                      <th className="py-2.5 px-3">System Customer Field</th>
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
                              className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  disabled={columnMapping['full_name'] === undefined || columnMapping['phone_number'] === undefined}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <span>Proceed to Pre-Flight Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Validation */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Rows</span>
                  <span className="text-lg font-black text-slate-900">{previewData.length}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">Ready for Ingest</span>
                  <span className="text-lg font-black text-emerald-900">{validRows.length}</span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">Debtors Included</span>
                  <span className="text-lg font-black text-amber-950">
                    {validRows.filter(r => r.balance > 0).length} buyers
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-800 font-bold uppercase block">Total Opening Debt</span>
                  <span className="text-lg font-black text-indigo-950 font-mono">
                    ₦{totalDebtToImport.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Duplicate Handling Option */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="updateExisting"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="updateExisting" className="font-semibold text-slate-800">
                    If customer phone or name already exists in database, <strong>merge and update</strong> their profile with legacy data
                  </label>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                  Customer Pre-Flight Audit Ledger (First 15 Rows)
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">Row</th>
                        <th className="py-2 px-2.5">Full Name</th>
                        <th className="py-2 px-2.5">Phone</th>
                        <th className="py-2 px-2.5">Tier</th>
                        <th className="py-2 px-2.5 text-right">Opening Debt</th>
                        <th className="py-2 px-2.5 text-right">Credit Limit</th>
                        <th className="py-2 px-2.5">Status / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {previewData.slice(0, 15).map((row) => (
                        <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                          <td className="py-2 px-2.5 text-slate-400 font-sans">{row.rowNumber}</td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 font-sans">{row.fullName || '—'}</td>
                          <td className="py-2 px-2.5 text-slate-700">{row.phone || '—'}</td>
                          <td className="py-2 px-2.5 font-sans">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {row.customerType}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-rose-700">
                            {row.balance > 0 ? `₦${row.balance.toLocaleString()}` : '₦0'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-600">
                            {row.creditLimit > 0 ? `₦${row.creditLimit.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 px-2.5 font-sans text-[10px]">
                            {row.isValid ? (
                              row.isExisting ? (
                                <span className="text-amber-700 font-semibold flex items-center">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Existing (Merge)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> New Account
                                </span>
                              )
                            ) : (
                              <span className="text-rose-700 font-bold">{row.errors.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
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
                  disabled={isSubmitting || validRows.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Processing SQLite Transaction...</span>
                  ) : (
                    <>
                      <span>Commit {validRows.length} Customers to Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Screen */}
          {currentStep === 'success' && importSummary && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Legacy Customer Migration Complete!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Successfully imported <strong>{importSummary.count}</strong> customer profiles into your centralized SQLite database with full WAL concurrency and audit logs.
                </p>
              </div>

              {importSummary.totalDebt > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 max-w-sm mx-auto text-xs text-amber-900">
                  <span className="font-bold block">Opening Receivables Balance Recorded:</span>
                  <span className="text-base font-black font-mono text-amber-950">₦{importSummary.totalDebt.toLocaleString()}</span>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    Opening debt ledgers have been linked to each customer's account statement.
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs"
                >
                  Done & Return to Directory
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
