import React, { useState, useRef, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { ReceiptBrandingConfig } from '../../types';
import { 
  Printer, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon, 
  FileText, 
  Sliders, 
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Receipt,
  Eye,
  Info
} from 'lucide-react';

export const ReceiptBrandingManager: React.FC = () => {
  const { receiptSettings, updateReceiptSettings, resetReceiptSettings, activeStaff } = usePos();

  // Local form state for draft edits
  const [form, setForm] = useState<ReceiptBrandingConfig>(receiptSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [logoFileSize, setLogoFileSize] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with context if it changes from SSE
  useEffect(() => {
    setForm(receiptSettings);
    if (receiptSettings.logo_base64) {
      const approxBytes = Math.round((receiptSettings.logo_base64.length * 3) / 4);
      setLogoFileSize(`${(approxBytes / 1024).toFixed(1)} KB`);
    } else {
      setLogoFileSize(null);
    }
  }, [receiptSettings]);

  // Handle client-side off-screen canvas compression & monochrome thresholding
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 5MB raw file before processing
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Selected image is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // High-speed thermal printers have 203 DPI and print in monochrome.
        // We constrain max width to 240px and max height to 90px to fit 58mm and 80mm rolls cleanly.
        const MAX_WIDTH = 240;
        const MAX_HEIGHT = 90;

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setErrorMessage('Could not initialize canvas for image optimization.');
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to grayscale and apply high contrast thresholding
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          // Standard luminance formula
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Slight contrast enhancement: push light grays to pure white
          const val = gray > 200 ? 255 : gray < 70 ? 0 : gray;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);

        // Export clean, compressed base64 PNG
        const base64 = canvas.toDataURL('image/png', 0.85);
        const approxBytes = Math.round((base64.length * 3) / 4);

        setForm(prev => ({
          ...prev,
          logo_base64: base64,
          show_logo: true,
        }));
        setLogoFileSize(`${(approxBytes / 1024).toFixed(1)} KB`);
        setErrorMessage(null);
      };

      img.onerror = () => {
        setErrorMessage('Failed to decode the selected image file.');
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({
      ...prev,
      logo_base64: null,
      show_logo: false,
    }));
    setLogoFileSize(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      setErrorMessage('Business name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const success = await updateReceiptSettings(form);
    setIsSaving(false);

    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      setErrorMessage('Failed to sync changes with the central database server.');
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    const success = await resetReceiptSettings();
    setIsSaving(false);
    setShowResetConfirm(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  const handlePrintTestReceipt = () => {
    window.print();
  };

  // Sample receipt data for live preview
  const sampleItems = [
    { name: 'Fresh Milk 1L', sn: 'ITEM-00045', qty: '4.00 PCS', unitPrice: 3200, total: 12800 },
    { name: 'Basmati Rice 5kg', sn: 'ITEM-00048', qty: '2.00 PACK', unitPrice: 7500, total: 15000 },
  ];
  const sampleSubtotal = 27800;
  const sampleDiscount = 1400;
  const sampleTotal = 26400;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Printer className="w-4 h-4" />
            <span>Store Hardware & Branding Terminal</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100">
            Receipt & Branding Customization
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Configure header logo, store address lines, roll width (80mm vs 58mm), tax info, and customer policies. Changes broadcast instantly to all cashier terminals.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={handlePrintTestReceipt}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-500/30 shadow-sm"
            title="Print test receipt to physical printer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Test Receipt</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Branding</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center space-x-2.5 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Receipt branding saved successfully! All cashier terminals and print previews have been updated in real-time.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center space-x-2.5 animate-fadeIn shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form Controls (7 Columns) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-5">
          
          {/* Section 1: Business Header & Contact */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Store Details & Header Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Business / Store Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={e => setForm({ ...form, business_name: e.target.value })}
                  placeholder="e.g. KIID FROM DREAM LTD"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Tagline / Business Subtitle
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={e => setForm({ ...form, tagline: e.target.value })}
                  placeholder="e.g. Retail & Wholesale Hub"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Store Address Line 1
                </label>
                <input
                  type="text"
                  value={form.address_line1}
                  onChange={e => setForm({ ...form, address_line1: e.target.value })}
                  placeholder="e.g. Suite 14, Commercial Plaza Phase 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Store Address Line 2 (City, State)
                </label>
                <input
                  type="text"
                  value={form.address_line2}
                  onChange={e => setForm({ ...form, address_line2: e.target.value })}
                  placeholder="e.g. Lekki-Epe Expressway, Lagos, Nigeria"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Customer Support Phone Numbers</span>
                </label>
                <input
                  type="text"
                  value={form.phone_numbers}
                  onChange={e => setForm({ ...form, phone_numbers: e.target.value })}
                  placeholder="e.g. +234 803 123 4567 / 0800-STORE-POS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Official Email Address</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. sales@kiidfromdream.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Tax Identification Number (TIN) / CAC Registration Number
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={form.tax_or_cac_number}
                    onChange={e => setForm({ ...form, tax_or_cac_number: e.target.value })}
                    placeholder="e.g. RC: 1984201 | TIN: 248109-0001"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={form.show_tax_details}
                      onChange={e => setForm({ ...form, show_tax_details: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Show on Receipt</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Logo & Thermal Monochromatic Processing */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Company Logo & Thermal Graphics
                </h2>
              </div>
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.show_logo}
                  onChange={e => setForm({ ...form, show_logo: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Enable Logo on Receipts</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Logo Preview Box */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] bg-slate-50/50">
                {form.logo_base64 ? (
                  <div className="space-y-2 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 inline-block shadow-xs">
                      <img
                        src={form.logo_base64}
                        alt="Store Logo"
                        className="max-h-20 max-w-[200px] object-contain filter grayscale contrast-125 mx-auto"
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Thermal B&W Processed {logoFileSize && `(${logoFileSize})`}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-500">No logo uploaded</p>
                    <p className="text-[10px] text-slate-400">Pure monochrome 203 DPI format</p>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  className="hidden"
                  id="logo-file-input"
                />

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors border border-slate-300 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>{form.logo_base64 ? 'Replace Logo Image' : 'Upload Store Logo'}</span>
                  </button>

                  {form.logo_base64 && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center space-x-1 font-semibold text-slate-700">
                    <Info className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Auto-Conversion for ESC/POS Thermal:</span>
                  </div>
                  <p className="leading-relaxed">
                    Uploaded images are automatically scaled to max 240px wide and processed into high-contrast monochrome pixels. This prevents dark blurry smears on thermal heat heads.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Paper Width & Thermal Layout */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Thermal Roll Width & Layout Elements
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Paper Roll Width Selection */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Thermal Paper Roll Width
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paper_width: '80mm' })}
                    className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                      form.paper_width === '80mm'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${form.paper_width === '80mm' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">80mm (Standard POS)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Desktop counters & cash drawers (Wide layout)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paper_width: '58mm' })}
                    className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                      form.paper_width === '58mm'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${form.paper_width === '58mm' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">58mm (Mobile POS)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Handheld, Bluetooth & OPay/Moniepoint POS</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 md:col-span-2 pt-2 border-t border-slate-100">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900">Print Cashier Name & Staff ID</span>
                    <p className="text-[10px] text-slate-500">Attributes sales to active operator on the receipt for shift accountability</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.show_cashier_name}
                    onChange={e => setForm({ ...form, show_cashier_name: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900">Print Transaction Barcode</span>
                    <p className="text-[10px] text-slate-500">Renders thermal barcode for quick scanner lookups on return and refund audits</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.show_barcode}
                    onChange={e => setForm({ ...form, show_barcode: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Footer Messages & Return Policies */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Footer Messages & Customer Policies
              </h2>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Customer Appreciation Note
                </label>
                <input
                  type="text"
                  value={form.footer_thank_you}
                  onChange={e => setForm({ ...form, footer_thank_you: e.target.value })}
                  placeholder="e.g. Thank you for choosing KIID FROM DREAM!"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Return & Guarantee Policy</span>
                  <span className="text-[10px] text-slate-400 font-normal">Printed in small font at bottom</span>
                </label>
                <textarea
                  rows={2}
                  value={form.footer_policy_notice}
                  onChange={e => setForm({ ...form, footer_policy_notice: e.target.value })}
                  placeholder="e.g. Goods sold in good condition cannot be returned. Retain receipt for warranty or exchange inquiries within 24 hours."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Custom Inquiries & Booking Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.custom_notes || ''}
                  onChange={e => setForm({ ...form, custom_notes: e.target.value })}
                  placeholder="e.g. For bulk bookings and delivery inquiries, contact our customer desk."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Bar for easy mobile accessibility */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving to SQLite Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Receipt Branding Settings</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Column: Live Thermal Paper Roll Mockup (5 Columns) */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          <div className="bg-slate-900 rounded-2xl p-4 text-white flex items-center justify-between border border-slate-800 shadow-md">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Live Thermal Preview</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span>Width:</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono font-bold">
                {form.paper_width}
              </span>
            </div>
          </div>

          {/* Outer Paper Housing */}
          <div className="flex justify-center p-3 bg-slate-200/80 rounded-2xl border border-slate-300 overflow-x-auto shadow-inner">
            
            {/* The Physical Receipt Paper Roll */}
            <div
              id="printable-receipt"
              className={`bg-white font-mono text-slate-900 shadow-xl border border-slate-300 transition-all duration-300 ${
                form.paper_width === '58mm' ? 'w-[235px] px-2.5 py-3 text-[10px] space-y-2 receipt-58mm' : 'w-[280px] px-3.5 py-3 text-[10.5px] space-y-2.5 receipt-80mm'
              }`}
              style={{
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              }}
            >
              {/* Paper Top Perforated Serration Simulation */}
              <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-dashed border-slate-300">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest mx-auto">
                  ••• THERMAL TAPE CUT •••
                </span>
              </div>

              {/* Logo & Header */}
              <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                {form.show_logo && form.logo_base64 && (
                  <div className="flex justify-center mb-1">
                    <img
                      src={form.logo_base64}
                      alt={form.business_name}
                      className="max-h-11 max-w-[150px] object-contain filter grayscale contrast-125"
                    />
                  </div>
                )}
                
                <h2 className="text-[12.5px] font-black tracking-wide text-slate-950 uppercase leading-snug">
                  {form.business_name || 'KIID FROM DREAM LTD'}
                </h2>

                {form.tagline && (
                  <p className="text-[9px] text-slate-600 uppercase font-semibold leading-tight">
                    {form.tagline}
                  </p>
                )}

                <div className="text-[8.5px] text-slate-500 leading-tight space-y-0.5 pt-0.5">
                  {form.address_line1 && <p>{form.address_line1}</p>}
                  {form.address_line2 && <p>{form.address_line2}</p>}
                  {form.phone_numbers && <p className="font-semibold text-slate-600">Tel: {form.phone_numbers}</p>}
                  {form.show_tax_details && form.tax_or_cac_number && (
                    <p className="text-slate-400 font-mono tracking-wider pt-0.5">{form.tax_or_cac_number}</p>
                  )}
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="text-[9.5px] space-y-0.5 py-1.5 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Txn:</span>
                  <span className="font-bold text-slate-950 font-mono">TXN-SAMPLE-001</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-800">{new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {form.show_cashier_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="text-slate-800">{activeStaff.staff_name} ({activeStaff.staff_id})</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">Walk-in Customer</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-1.5 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-[9px] text-slate-500 pb-1 border-b border-slate-200 uppercase tracking-wider">
                  <span className="w-[52%]">ITEM</span>
                  <span className="w-[20%] text-center">QTY</span>
                  <span className="w-[28%] text-right">TOTAL</span>
                </div>

                <div className="pt-1.5 space-y-1">
                  {sampleItems.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-baseline font-medium text-[10px]">
                        <span className="w-[52%] truncate font-bold text-slate-950">{item.name}</span>
                        <span className="w-[20%] text-center font-semibold text-slate-700">{item.qty}</span>
                        <span className="w-[28%] text-right font-black font-mono text-slate-950">
                          ₦{item.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[8.5px] text-slate-500 pl-0.5">
                        {item.sn} • ₦{item.unitPrice.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Payments */}
              <div className="space-y-1 text-[10px] py-1.5 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal:</span>
                  <span className="font-bold font-mono text-slate-900">₦{sampleSubtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>VIP Customer Discount:</span>
                  <span className="font-mono">-₦{sampleDiscount.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-[12.5px] font-black text-slate-950 pt-1 border-t border-slate-300">
                  <span>TOTAL PAID:</span>
                  <span className="font-mono">₦{sampleTotal.toLocaleString()}</span>
                </div>

                <div className="bg-slate-50 p-1.5 rounded text-[9px] space-y-0.5 mt-1 border border-slate-200">
                  <div className="flex justify-between text-slate-700">
                    <span>• Cash Payment:</span>
                    <span className="font-bold font-mono">₦15,000</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>• POS Split (Moniepoint):</span>
                    <span className="font-bold font-mono">₦13,000</span>
                  </div>
                </div>
              </div>

              {/* Barcode & Footer */}
              <div className="text-center pt-1 space-y-1">
                {form.show_barcode && (
                  <div className="space-y-0.5">
                    <div className="flex justify-center items-center h-5 space-x-0.5 px-3">
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1.5 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-2 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-1.5 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-2 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1.5 h-full bg-slate-900" />
                    </div>
                    <p className="text-[8px] tracking-widest text-slate-500 font-mono">
                      *TXN-SAMPLE-001*
                    </p>
                  </div>
                )}

                {form.footer_thank_you && (
                  <p className="text-[9.5px] font-bold text-slate-800">
                    {form.footer_thank_you}
                  </p>
                )}

                {form.footer_policy_notice && (
                  <p className="text-[8px] text-slate-500 leading-tight">
                    {form.footer_policy_notice}
                  </p>
                )}

                {form.custom_notes && (
                  <p className="text-[8px] text-slate-400 italic">
                    {form.custom_notes}
                  </p>
                )}

                <div className="pt-2 border-t border-dashed border-slate-300">
                  <span className="text-[8px] text-slate-400 uppercase tracking-widest">
                    ••• END OF RECEIPT •••
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            Click <strong className="text-slate-700">Print Test Receipt</strong> above to test physical roll output.
          </div>
        </div>

      </div>

      {/* Confirmation Modal for Reset to Defaults */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-2.5 text-amber-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Reset to Default Branding?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore the factory default receipt branding, address lines, policies, and clear any custom uploaded logo. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                Yes, Reset Defaults
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
