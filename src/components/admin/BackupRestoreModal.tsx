import React, { useState, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import { verifyPin } from '../../utils/security';
import {
  Database,
  Download,
  Upload,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  FileJson,
  FileCheck,
  Lock,
  Eye,
  EyeOff,
  FolderOpen,
  Boxes,
  ShoppingCart,
  Users,
  Building2,
  Tag,
  ShieldCheck,
  RefreshCw,
  HardDriveDownload,
  Archive
} from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'restore';
}

interface BackupPreviewInfo {
  filename: string;
  fileSize: string;
  system?: string;
  exportDate?: string;
  exportedBy?: string;
  productsCount: number;
  salesCount: number;
  customersCount: number;
  suppliersCount: number;
  categoriesCount: number;
  purchaseOrdersCount: number;
  auditLogsCount: number;
  rawPayload: any;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export',
}) => {
  const {
    activeStaff,
    products,
    sales,
    customers,
    suppliers,
    categories,
    purchaseOrders,
    auditLogs,
    exportBackupData,
    importBackupData,
  } = usePos();

  const [activeTab, setActiveTab] = useState<'export' | 'restore'>(initialTab);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ filename: string; filePath?: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Restore State
  const [backupPreview, setBackupPreview] = useState<BackupPreviewInfo | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Overwrite Safety Verification
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate live current database metrics
  const totalStockUnits = products.reduce((acc, p) => acc + (p.quantity || 0), 0);

  // -------------------------------------------------------------
  // EXPORT HANDLER
  // -------------------------------------------------------------
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const result = await exportBackupData();
      if (result.success) {
        setExportSuccess({
          filename: result.filename || `kiidfromdream_pos_backup_${new Date().toISOString().slice(0, 10)}.json`,
          filePath: result.filePath,
        });
      } else {
        if (result.error !== 'Backup canceled' && result.error !== 'Cancelled by user') {
          setExportError(result.error || 'Failed to export backup file.');
        }
      }
    } catch (err: any) {
      setExportError(err.message || 'An unexpected error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  // -------------------------------------------------------------
  // RESTORE - FILE SELECTION & PREVIEW PARSING
  // -------------------------------------------------------------
  const parseAndPreviewBackup = (content: string, filename: string, fileSizeStr: string) => {
    try {
      setIsAnalyzingFile(true);
      setRestoreError(null);
      setRestoreSuccess(null);

      let parsed = JSON.parse(content);
      if (parsed.backup && typeof parsed.backup === 'object') {
        parsed = parsed.backup;
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('File content is empty or not a valid JSON document.');
      }

      const knownKeys = ['products', 'sales', 'customers', 'suppliers', 'categories', 'purchaseOrders', 'employees'];
      const hasKnownKey = knownKeys.some(k => Array.isArray(parsed[k]));
      if (!hasKnownKey) {
        throw new Error('This file does not appear to be a valid POS backup (missing products, sales, or categories collections).');
      }

      const preview: BackupPreviewInfo = {
        filename,
        fileSize: fileSizeStr,
        system: parsed.system || 'KIIDFROMDREAM POS',
        exportDate: parsed.export_date ? new Date(parsed.export_date).toLocaleString() : undefined,
        exportedBy: parsed.exported_by?.staff_name ? `${parsed.exported_by.staff_name} (${parsed.exported_by.role || 'Staff'})` : undefined,
        productsCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
        salesCount: Array.isArray(parsed.sales) ? parsed.sales.length : 0,
        customersCount: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
        suppliersCount: Array.isArray(parsed.suppliers) ? parsed.suppliers.length : 0,
        categoriesCount: Array.isArray(parsed.categories) ? parsed.categories.length : 0,
        purchaseOrdersCount: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders.length : 0,
        auditLogsCount: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.length : 0,
        rawPayload: parsed,
      };

      setBackupPreview(preview);
    } catch (err: any) {
      setBackupPreview(null);
      setRestoreError(err.message || 'Unable to parse selected file as JSON.');
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  // 1. Native Desktop File Open (Electron)
  const handleOpenDesktopFile = async () => {
    if (window.electronAPI?.openBackupFile) {
      try {
        const result = await window.electronAPI.openBackupFile();
        if (result.canceled || !result.content) return;
        const name = result.filePath?.split(/[\\/]/).pop() || 'backup.json';
        const sizeStr = `${(result.content.length / 1024).toFixed(1)} KB`;
        parseAndPreviewBackup(result.content, name, sizeStr);
      } catch (err: any) {
        setRestoreError(err.message || 'Failed to open file via desktop dialog.');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  // 2. Web Browser File Input Change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
      parseAndPreviewBackup(content, file.name, sizeStr);
    };
    reader.onerror = () => {
      setRestoreError('Failed reading selected file from disk.');
    };
    reader.readAsText(file);
    // Reset input so same file can be picked again if desired
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // RESTORE EXECUTION & ACCIDENTAL OVERWRITE PROTECTION
  // -------------------------------------------------------------
  const isPinValid = (() => {
    if (!staffPinInput.trim()) return false;
    // Check if staff PIN matches active staff's PIN
    if (activeStaff.pin && verifyPin(staffPinInput, activeStaff.pin)) {
      return true;
    }
    // Alternatively accept master Super Admin password
    if (staffPinInput.trim() === '2030170611') {
      return true;
    }
    return false;
  })();

  const isKeywordValid = confirmKeyword.trim().toUpperCase() === 'RESTORE';
  const canExecuteRestore = backupPreview && (isPinValid || isKeywordValid) && !isRestoring;

  const handleExecuteRestore = async () => {
    if (!backupPreview || !canExecuteRestore) return;

    setRestoreError(null);
    setIsRestoring(true);

    try {
      // 1. Safety backup of current database first (if checked)
      if (createSafetyBackup) {
        try {
          await exportBackupData();
        } catch (backupErr) {
          console.warn('[RESTORE] Pre-restore safety backup skipped or failed:', backupErr);
        }
      }

      // 2. Execute database restoration
      const result = await importBackupData(backupPreview.rawPayload);
      if (result.success) {
        setRestoreSuccess(result.summary || {
          productsCount: backupPreview.productsCount,
          salesCount: backupPreview.salesCount,
          customersCount: backupPreview.customersCount,
          categoriesCount: backupPreview.categoriesCount,
        });
      } else {
        setRestoreError(result.error || 'Failed to restore database.');
      }
    } catch (err: any) {
      setRestoreError(err.message || 'An unexpected error occurred during database restoration.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetRestoreForm = () => {
    setBackupPreview(null);
    setRestoreError(null);
    setRestoreSuccess(null);
    setStaffPinInput('');
    setConfirmKeyword('');
  };

  const handleClose = () => {
    if (isRestoring || isExporting) return;
    setExportSuccess(null);
    setExportError(null);
    handleResetRestoreForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn select-none">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scaleIn transition-all flex flex-col max-h-[90vh]">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-950/40 shrink-0">
              <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Data Backup & Restore
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  All Staff Access
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Export timestamped database snapshots or migrate data to a new system
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium">{activeStaff.staff_name}</span>
              <span className="text-slate-500">({activeStaff.role})</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isRestoring || isExporting}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center space-x-2 py-3.5 px-4 font-semibold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>Export Database Backup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center space-x-2 py-3.5 px-4 font-semibold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Restore / Migrate Data</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Hidden File Input for Web Browser Fallback */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* ========================================================= */}
          {/* TAB 1: EXPORT BACKUP */}
          {/* ========================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <FileJson className="w-4 h-4 text-indigo-400" />
                  <span>Current Database Snapshot</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Exporting packages all 18 system collections into an atomic, timestamped JSON snapshot. Save it to your Desktop, Documents, or external USB drive.
                </p>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{products.length}</div>
                      <div className="text-[11px] text-slate-400">Products ({totalStockUnits} units)</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{sales.length}</div>
                      <div className="text-[11px] text-slate-400">Sales Transactions</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{categories.length}</div>
                      <div className="text-[11px] text-slate-400">Categories</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{customers.length}</div>
                      <div className="text-[11px] text-slate-400">Customer Records</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{suppliers.length}</div>
                      <div className="text-[11px] text-slate-400">Suppliers ({purchaseOrders.length} POs)</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white font-mono">{auditLogs.length}</div>
                      <div className="text-[11px] text-slate-400">Audit Trail Logs</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Success Notification */}
              {exportSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-emerald-200">Database Backup Saved Successfully!</div>
                    <div className="text-emerald-300/80">
                      File: <span className="font-mono text-white">{exportSuccess.filename}</span>
                    </div>
                    {exportSuccess.filePath && (
                      <div className="text-[11px] text-emerald-400/90 font-mono break-all">
                        Saved to: {exportSuccess.filePath}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Notification */}
              {exportError && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-rose-200">Export Failed</div>
                    <div>{exportError}</div>
                  </div>
                </div>
              )}

              {/* Action Trigger */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-400">
                  <span className="font-medium text-slate-300">File Format:</span> JSON with timestamp & SHA-256 audit verification
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Packaging & Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export & Save Backup File</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: RESTORE / MIGRATE DATA */}
          {/* ========================================================= */}
          {activeTab === 'restore' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Step 1: File Selection */}
              {!backupPreview && !restoreSuccess && (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Select Backup File to Restore</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Choose a <span className="font-mono text-slate-300">.json</span> database backup file exported from this POS system.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleOpenDesktopFile}
                        disabled={isAnalyzingFile}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center space-x-2 cursor-pointer shadow-md shadow-amber-500/20"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Browse / Select File</span>
                      </button>
                    </div>
                  </div>

                  {restoreError && (
                    <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-bold text-rose-200">Invalid Backup File</div>
                        <div>{restoreError}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Pre-Flight Inspection Preview & Confirmation */}
              {backupPreview && !restoreSuccess && (
                <div className="space-y-5 animate-fadeIn">
                  {/* File Inspection Card */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <FileCheck className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="font-bold text-white text-xs">{backupPreview.filename}</div>
                          <div className="text-[11px] text-slate-400">Size: {backupPreview.fileSize}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetRestoreForm}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        Choose Different File
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Products:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.productsCount}</div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Sales History:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.salesCount}</div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Categories:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.categoriesCount}</div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Customers:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.customersCount}</div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Suppliers:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.suppliersCount}</div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Audit Logs:</span>
                        <div className="text-sm font-bold text-white font-mono">{backupPreview.auditLogsCount}</div>
                      </div>
                    </div>

                    {backupPreview.exportDate && (
                      <div className="text-[11px] text-slate-400 pt-1">
                        Exported on: <span className="text-slate-300 font-mono">{backupPreview.exportDate}</span>
                        {backupPreview.exportedBy && <span> by {backupPreview.exportedBy}</span>}
                      </div>
                    )}
                  </div>

                  {/* Accidental Overwrite Protection Callout */}
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-xs text-amber-300">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>ACCIDENTAL OVERWRITE PROTECTION</span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Restoring this file will overwrite current inventory, sales history, and categories with the contents of this backup. Existing user accounts and Super Admin permissions are preserved.
                    </p>

                    <label className="flex items-center space-x-2 pt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createSafetyBackup}
                        onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800"
                      />
                      <span className="text-xs font-semibold text-white">
                        Create an automatic safety backup of current data before overwriting (Recommended)
                      </span>
                    </label>
                  </div>

                  {/* Confirmation Input: Staff PIN or Keyword */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">
                      Staff Verification (Enter your Staff PIN or type <span className="font-mono text-amber-400 font-bold">RESTORE</span>):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <input
                            type={showPin ? 'text' : 'password'}
                            value={staffPinInput}
                            onChange={(e) => setStaffPinInput(e.target.value)}
                            placeholder="Enter your Staff PIN"
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                          >
                            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {staffPinInput && (
                          <div className={`text-[10px] mt-1 font-medium ${isPinValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPinValid ? '✓ PIN verified' : '✕ PIN not recognized'}
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={confirmKeyword}
                          onChange={(e) => setConfirmKeyword(e.target.value)}
                          placeholder="Or type RESTORE to confirm"
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono uppercase"
                        />
                        {confirmKeyword && (
                          <div className={`text-[10px] mt-1 font-medium ${isKeywordValid ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isKeywordValid ? '✓ Keyword verified' : 'Type RESTORE exactly'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {restoreError && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                      {restoreError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetRestoreForm}
                      disabled={isRestoring}
                      className="px-4 py-2.5 rounded-xl font-medium text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Cancel Selection
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={!canExecuteRestore}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Restoring Database...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-4 h-4" />
                          <span>Confirm & Restore Database</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Success Screen */}
              {restoreSuccess && (
                <div className="bg-slate-950/80 p-6 rounded-3xl border border-emerald-500/40 text-center space-y-4 animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/60">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Database Restored Successfully!</h3>
                    <p className="text-xs text-emerald-300/90 mt-1 max-w-md mx-auto">
                      All collections have been synchronized with the SQLite database engine. The active state has been refreshed.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs max-w-lg mx-auto">
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Products</div>
                      <div className="font-bold text-white font-mono">{restoreSuccess.productsCount ?? 0}</div>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Sales</div>
                      <div className="font-bold text-white font-mono">{restoreSuccess.salesCount ?? 0}</div>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Categories</div>
                      <div className="font-bold text-white font-mono">{restoreSuccess.categoriesCount ?? 0}</div>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400">Customers</div>
                      <div className="font-bold text-white font-mono">{restoreSuccess.customersCount ?? 0}</div>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/30 cursor-pointer"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950/70 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div>
            KIID FROM DREAM POS · Centralized SQLite Engine v2
          </div>
          <div>
            Signed-in Operator: <span className="text-slate-300 font-semibold">{activeStaff.staff_name}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
