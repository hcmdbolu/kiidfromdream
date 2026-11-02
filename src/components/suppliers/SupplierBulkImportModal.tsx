import React, { useState, useRef, useMemo, ChangeEvent, DragEvent } from 'react';
import { usePos } from '../../context/PosContext';
import { Supplier, PaymentTerms } from '../../types';
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
  Truck,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { parseCSV } from '../customers/CustomerBulkImportModal';

interface SupplierBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export interface SupplierTargetField {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

const TARGET_FIELDS: SupplierTargetField[] = [
  { key: 'supplier_name', label: 'Supplier / Vendor Name', required: true, description: 'Business or vendor entity name (e.g. Dangote Agro Allied, Mackerel Imports Ltd)' },
  { key: 'contact_person', label: 'Contact Person / Rep', required: false, description: 'Sales rep or account manager name' },
  { key: 'phone_number', label: 'Phone Number', required: false, description: 'Vendor direct line e.g. 08021112233' },
  { key: 'email', label: 'Email Address', required: false, description: 'Invoicing or order dispatch email' },
  { key: 'address', label: 'Warehouse / Depot Address', required: false, description: 'Physical dispatch or distribution warehouse location' },
  { key: 'payment_terms', label: 'Payment Terms', required: false, description: 'Cash on Delivery, Net 7 Days, or Net 30 Days' },
  { key: 'lead_time_days', label: 'Lead Time (Days)', required: false, description: 'Average fulfillment turnaround in days (e.g. 3)' },
  { key: 'products_supplied', label: 'Products Supplied / Catalog', required: false, description: 'Comma-separated items supplied (e.g., Frozen Fish, Cooking Oil)' },
  { key: 'status', label: 'Status', required: false, description: 'Active or Inactive (defaults to Active)' },
];

const SAMPLE_CSV = `Supplier Name,Contact Person,Phone Number,Email Address,Warehouse Address,Payment Terms,Lead Time (Days),Products Supplied,Status
Atlantic Seafoods Ltd,Captain Johnson,08031112233,sales@atlanticseafoods.ng,Tin Can Island Port Apapa Lagos,Net 7 Days,2,"Frozen Fish, Mackerel, Croaker",Active
Grand Cereals Flour Mills,Mallam Garba,08149998877,orders@grandcereals.com,Plot 14 Industrial Layout Jos,Net 30 Days,5,"Flour, Semovita, Feed",Active
Prime Poultry & Cold Chain,Dr. Mrs. Adeleke,07038887766,adeleke@primepoultry.ng,Ikorodu Express Farm Complex Lagos,Cash on Delivery,1,"Chicken Wings, Whole Chicken",Active
Golden Oil Refineries,Mr. Obi,08097776655,obi@goldenoil.com,Aba Road Port Harcourt,Net 7 Days,3,"Vegetable Oil, Palm Olein",Active`;

export const SupplierBulkImportModal: React.FC<SupplierBulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { suppliers, bulkAddSuppliers } = usePos();

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
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'legacy_suppliers_import_template.csv');
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
          if (fieldKey === 'supplier_name' && /supplier|vendor|company|entity/.test(headerClean)) return true;
          if (fieldKey === 'contact_person' && /contact|person|rep|manager/.test(headerClean)) return true;
          if (fieldKey === 'phone_number' && /phone|mobile|tel|contactnumber/.test(headerClean)) return true;
          if (fieldKey === 'email' && /email|mail/.test(headerClean)) return true;
          if (fieldKey === 'address' && /address|location|depot|warehouse|city/.test(headerClean)) return true;
          if (fieldKey === 'payment_terms' && /terms|payment/.test(headerClean)) return true;
          if (fieldKey === 'lead_time_days' && /lead|days|turnaround/.test(headerClean)) return true;
          if (fieldKey === 'products_supplied' && /product|catalog|item|supplied/.test(headerClean)) return true;
          if (fieldKey === 'status' && /status|active/.test(headerClean)) return true;
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

      const supplierName = getVal('supplier_name');
      const contactPerson = getVal('contact_person') || 'Sales Representative';
      const phoneNumber = getVal('phone_number');
      const email = getVal('email');
      const address = getVal('address');
      
      let paymentTerms: PaymentTerms = 'Cash on Delivery';
      const rawTerms = getVal('payment_terms').toLowerCase();
      if (rawTerms.includes('7')) paymentTerms = 'Net 7 Days';
      else if (rawTerms.includes('30')) paymentTerms = 'Net 30 Days';

      const leadTimeDays = Math.max(1, parseInt(getVal('lead_time_days'), 10) || 3);
      const rawProducts = getVal('products_supplied');
      const productsSupplied = rawProducts ? rawProducts.split(',').map(s => s.trim()).filter(Boolean) : [];
      const status: 'Active' | 'Inactive' = getVal('status').toLowerCase().includes('inactive') ? 'Inactive' : 'Active';

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!supplierName) errors.push('Supplier Name is required');

      // Check duplicates against active DB
      const existingDb = suppliers.find(s => 
        s.supplier_name.toLowerCase() === supplierName.toLowerCase() ||
        (phoneNumber && s.phone_number.replace(/\D/g, '') === phoneNumber.replace(/\D/g, ''))
      );

      if (existingDb) {
        warnings.push(`Matches existing supplier: ${existingDb.supplier_name} (${existingDb.supplier_id})`);
      }

      return {
        rowNumber: index + 1,
        supplierName,
        contactPerson,
        phoneNumber,
        email,
        address,
        paymentTerms,
        leadTimeDays,
        productsSupplied,
        status,
        isExisting: !!existingDb,
        existingId: existingDb?.supplier_id,
        errors,
        warnings,
        isValid: errors.length === 0,
      };
    });
  }, [parsedRows, columnMapping, currentStep, suppliers]);

  const validRows = useMemo(() => previewData.filter(r => r.isValid), [previewData]);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);

    const payload: Partial<Supplier>[] = validRows.map(r => ({
      supplier_id: r.isExisting && updateExisting ? r.existingId : undefined,
      supplier_name: r.supplierName,
      contact_person: r.contactPerson,
      phone_number: r.phoneNumber,
      email: r.email,
      address: r.address,
      payment_terms: r.paymentTerms,
      lead_time_days: r.leadTimeDays,
      products_supplied: r.productsSupplied,
      status: r.status,
    }));

    const result = await bulkAddSuppliers(payload, updateExisting);
    setIsSubmitting(false);

    if (result.success) {
      setImportCount(result.count);
      setCurrentStep('success');
      onSuccess?.(result.count);
    } else {
      alert(`Import error: ${result.error || 'Failed to complete bulk supplier upload'}`);
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
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black tracking-tight">Bulk Supplier Directory Migration</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Vendor Importer
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Batch import vendors, distributor catalogs, credit payment terms, and delivery contacts.
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
              <span>Validate & Review</span>
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
                  <p className="text-xs text-slate-500 mt-1">Exported supplier contact books or purchasing sheets</p>
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
                    onClick={() => processFileContent(pastedText, 'pasted_suppliers.csv')}
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
                  <span>Found {parsedHeaders.length} columns and {parsedRows.length} supplier rows.</span>
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
                      <th className="py-2.5 px-3">Supplier Field</th>
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
                  disabled={columnMapping['supplier_name'] === undefined}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <span>Proceed to Pre-Flight Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Rows</span>
                  <span className="text-lg font-black text-slate-900">{previewData.length}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">Ready for Ingest</span>
                  <span className="text-lg font-black text-emerald-900">{validRows.length}</span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-800 font-bold uppercase block">Existing (Merge)</span>
                  <span className="text-lg font-black text-indigo-950 font-mono">
                    {validRows.filter(r => r.isExisting).length}
                  </span>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                  Supplier Pre-Flight Audit Ledger (First 15 Rows)
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">Row</th>
                        <th className="py-2 px-2.5">Supplier Name</th>
                        <th className="py-2 px-2.5">Contact Rep</th>
                        <th className="py-2 px-2.5">Phone</th>
                        <th className="py-2 px-2.5">Payment Terms</th>
                        <th className="py-2 px-2.5">Lead Time</th>
                        <th className="py-2 px-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {previewData.slice(0, 15).map((row) => (
                        <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                          <td className="py-2 px-2.5 text-slate-400 font-sans">{row.rowNumber}</td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 font-sans">{row.supplierName || '—'}</td>
                          <td className="py-2 px-2.5 text-slate-700 font-sans">{row.contactPerson || '—'}</td>
                          <td className="py-2 px-2.5 text-slate-700">{row.phoneNumber || '—'}</td>
                          <td className="py-2 px-2.5 font-sans">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {row.paymentTerms}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-sans text-slate-600">{row.leadTimeDays} days</td>
                          <td className="py-2 px-2.5 font-sans text-[10px]">
                            {row.isValid ? (
                              row.isExisting ? (
                                <span className="text-amber-700 font-semibold flex items-center">
                                  <AlertTriangle className="w-3 h-3 mr-1" /> Existing (Merge)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> New Supplier
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Processing SQLite Transaction...</span>
                  ) : (
                    <>
                      <span>Commit {validRows.length} Suppliers to Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {currentStep === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Supplier Directory Migration Complete!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Successfully imported <strong>{importCount}</strong> vendor profiles into your central database with verified contact details and purchasing terms.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs"
                >
                  Done & Return to Suppliers
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

