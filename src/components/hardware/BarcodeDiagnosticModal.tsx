import React, { useState, useEffect, useRef } from 'react';
import { usePos } from '../../context/PosContext';
import { Product } from '../../types';
import { useBarcodeScanner, ScanMetadata } from '../../hooks/useBarcodeScanner';
import { playScanSuccessBeep, playScanErrorBeep } from '../../utils/soundEffects';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
  Clock,
  Keyboard,
  Cpu,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';

interface BarcodeDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScanLogEntry extends ScanMetadata {
  id: string;
  matchedProduct?: Product;
}

export const BarcodeDiagnosticModal: React.FC<BarcodeDiagnosticModalProps> = ({ isOpen, onClose }) => {
  const { products } = usePos();
  const [testInput, setTestInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [currentResult, setCurrentResult] = useState<ScanLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle scanned barcode payload
  const handleScannedBarcode = (barcode: string, meta: ScanMetadata) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    // Search catalog for matching product by item_sn or barcode
    const matched = products.find(p => 
      p.item_sn.toLowerCase() === cleanBarcode.toLowerCase() ||
      (p.barcode && p.barcode.toLowerCase() === cleanBarcode.toLowerCase())
    );

    if (soundEnabled) {
      if (matched) {
        playScanSuccessBeep();
      } else {
        playScanErrorBeep();
      }
    }

    const logEntry: ScanLogEntry = {
      ...meta,
      rawBarcode: cleanBarcode,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      matchedProduct: matched,
    };

    setCurrentResult(logEntry);
    setScanLogs(prev => [logEntry, ...prev.slice(0, 19)]); // Keep last 20
    setTestInput('');
    inputRef.current?.focus();
  };

  // Listen to scanner events while modal is open
  useBarcodeScanner({
    onScan: handleScannedBarcode,
    enabled: isOpen,
    allowInInputs: true,
    minChars: 2,
    maxIntervalMs: 55,
  });

  const handleManualEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && testInput.trim()) {
      e.preventDefault();
      handleScannedBarcode(testInput, {
        rawBarcode: testInput.trim(),
        scanDurationMs: 0,
        avgKeyIntervalMs: 120, // Estimated manual typing
        charCount: testInput.trim().length,
        terminator: 'Enter',
        timestamp: Date.now(),
        source: 'keyboard-wedge',
        intervals: [],
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black tracking-tight">Barcode Scanner Diagnostic Tool</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Hardware Ready
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Plug in any standard USB scanner or type manually to test keystroke latency, termination, and catalog resolution.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled 
                  ? 'bg-indigo-600/30 border-indigo-400/40 text-indigo-300 hover:bg-indigo-600/40' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={soundEnabled ? 'Mute scanner chime' : 'Enable scanner chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {/* Main Interactive Scan Capture Target */}
          <div 
            onClick={() => inputRef.current?.focus()}
            className={`p-5 rounded-2xl border-2 transition-all cursor-text relative overflow-hidden ${
              isFocused 
                ? 'bg-indigo-50/60 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                : 'bg-white border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live Scanner Input Field</span>
              </span>
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isFocused ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                <span className="text-[11px] font-semibold text-slate-500">
                  {isFocused ? 'Focus Active — Ready for USB Scan' : 'Click to Focus'}
                </span>
              </div>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={handleManualEnter}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Scan any barcode with your handheld scanner now..."
                className="w-full text-base sm:text-lg font-mono px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 placeholder:text-sm shadow-inner"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-600 rounded border border-slate-300 shadow-xs">
                  Enter ↵
                </kbd>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Keystrokes are automatically intercepted and timed.</span>
              <span className="font-mono">Tested: {scanLogs.length} scans</span>
            </div>
          </div>

          {/* Current Scan Analysis & Diagnostics Card */}
          {currentResult ? (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${currentResult.matchedProduct ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {currentResult.matchedProduct ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {currentResult.matchedProduct ? 'Product Recognized in Inventory' : 'Unregistered Barcode'}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      Timestamp: {new Date(currentResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Speed / Latency Badge */}
                <div className="text-right">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    currentResult.avgKeyIntervalMs <= 40
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentResult.avgKeyIntervalMs <= 70
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    <Zap className="w-3 h-3" />
                    <span>
                      {currentResult.avgKeyIntervalMs <= 50 ? '⚡ Scanner Speed' : 'Keyboard Typing'} ({currentResult.avgKeyIntervalMs}ms/key)
                    </span>
                  </span>
                </div>
              </div>

              {/* Technical Inspection Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Raw Barcode</span>
                  <span className="font-mono font-bold text-slate-900 text-sm truncate block" title={currentResult.rawBarcode}>
                    {currentResult.rawBarcode}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Length</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currentResult.charCount} chars
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Terminator</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {currentResult.terminator}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Duration</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currentResult.scanDurationMs}ms
                  </span>
                </div>
              </div>

              {/* Matched Product Details Card */}
              {currentResult.matchedProduct ? (
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-lg bg-white border border-emerald-300 flex items-center justify-center font-bold text-emerald-800 shadow-xs shrink-0">
                      <Package className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {currentResult.matchedProduct.item_name}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <span className="font-mono font-semibold">SKU: {currentResult.matchedProduct.item_sn}</span>
                        <span>•</span>
                        <span>{currentResult.matchedProduct.product_category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-mono font-black text-emerald-900">
                      ₦{currentResult.matchedProduct.selling_price.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700">
                      In Stock: {currentResult.matchedProduct.quantity} {currentResult.matchedProduct.product_measure_unit}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>This code is not currently associated with any item in your catalog.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentResult.rawBarcode, 'banner-raw')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 rounded border border-amber-300 font-semibold text-amber-800 transition-colors flex items-center space-x-1"
                  >
                    {copiedId === 'banner-raw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Code</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <ScanLine className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-bounce" />
              <h4 className="font-bold text-slate-700 text-sm">Awaiting First Barcode Scan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Aim your scanner at any UPC, EAN-13, or SKU barcode. Results and technical timing will appear here instantly.
              </p>
            </div>
          )}

          {/* Recent Scan History Log Table */}
          {scanLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Session Scan History ({scanLogs.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setScanLogs([]);
                    setCurrentResult(null);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center space-x-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Scanned Code</th>
                      <th className="py-2 px-3">Catalog Match</th>
                      <th className="py-2 px-3">Avg Latency</th>
                      <th className="py-2 px-3">Terminator</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {scanLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {log.rawBarcode}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {log.matchedProduct ? (
                            <span className="inline-flex items-center text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              {log.matchedProduct.item_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unmatched</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.avgKeyIntervalMs <= 40 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {log.avgKeyIntervalMs}ms
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {log.terminator}
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(log.rawBarcode, log.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                            title="Copy barcode string"
                          >
                            {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hardware Connection Tips Banner */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
            <div className="font-bold flex items-center space-x-1.5 text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Operator Best Practice Tips for USB Scanners</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
              <li>Ensure your USB scanner is set to <strong>Keyboard Wedge (USB HID)</strong> mode with <strong>Carriage Return (Enter)</strong> suffix enabled.</li>
              <li>In the POS terminal, you can scan products at any moment without clicking the search box first.</li>
              <li>Products are matched against both their assigned <strong>Item SKU / SN</strong> and manufacturer barcode.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            SmartSales POS Hardware Diagnostics Suite
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
};

