import { useEffect, useRef, useState, useCallback } from 'react';

export interface ScanMetadata {
  rawBarcode: string;
  scanDurationMs: number;
  avgKeyIntervalMs: number;
  charCount: number;
  terminator: 'Enter' | 'Tab' | 'Timeout' | 'Direct';
  timestamp: number;
  source: 'keyboard-wedge' | 'hardware-hid' | 'sse';
  intervals: number[];
}

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string, meta: ScanMetadata) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
  allowInInputs?: boolean;
  listenToHardware?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxIntervalMs = 50,
  enabled = true,
  allowInInputs = false,
  listenToHardware = true,
}: UseBarcodeScannerOptions) {
  const [lastScan, setLastScan] = useState<ScanMetadata | null>(null);
  const [isCapturingBurst, setIsCapturingBurst] = useState(false);

  const bufferRef = useRef<string[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onScanRef = useRef(onScan);

  // Keep callback reference updated
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const resetBuffer = useCallback(() => {
    bufferRef.current = [];
    timestampsRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCapturingBurst(false);
  }, []);

  const dispatchScan = useCallback((terminator: 'Enter' | 'Tab' | 'Timeout' | 'Direct', source: 'keyboard-wedge' | 'hardware-hid' | 'sse' = 'keyboard-wedge') => {
    const rawBarcode = bufferRef.current.join('').trim();
    const timestamps = timestampsRef.current;

    if (rawBarcode.length >= minChars) {
      const startTime = timestamps[0] || Date.now();
      const endTime = timestamps[timestamps.length - 1] || Date.now();
      const scanDurationMs = Math.max(0, endTime - startTime);
      
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgKeyIntervalMs = intervals.length > 0
        ? Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10
        : 0;

      const meta: ScanMetadata = {
        rawBarcode,
        scanDurationMs,
        avgKeyIntervalMs,
        charCount: rawBarcode.length,
        terminator,
        timestamp: Date.now(),
        source,
        intervals,
      };

      setLastScan(meta);
      onScanRef.current(rawBarcode, meta);
    }

    resetBuffer();
  }, [minChars, resetBuffer]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
      const isContentEditable = activeElement && (activeElement as HTMLElement).isContentEditable;

      const now = Date.now();
      const timestamps = timestampsRef.current;
      const lastTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
      const interval = lastTimestamp > 0 ? now - lastTimestamp : 0;

      // Handle terminator keys (Enter, Return, Tab)
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minChars) {
          // Verify if this was indeed a high-speed scanner burst (avg interval < 60ms) or buffer accumulated quickly
          const intervals: number[] = [];
          for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
          }
          const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

          // If typed rapidly (< 65ms avg) or cashier wasn't actively typing in a standard non-search field
          if (avgInterval <= maxIntervalMs * 1.5 || !isInput) {
            e.preventDefault();
            e.stopPropagation();
            dispatchScan(e.key as 'Enter' | 'Tab');
            return;
          }
        }
        resetBuffer();
        return;
      }

      // Filter out modifier keys and non-printable characters
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // If user is actively typing in a text field, check if keystrokes arrive at superhuman scanner speed
      if ((isInput || isContentEditable) && !allowInInputs) {
        // If first character in an input, don't assume scan unless following characters arrive at < 35ms
        if (timestamps.length === 0) {
          bufferRef.current.push(e.key);
          timestampsRef.current.push(now);
          // Set a short timer to reset if no rapid follow-up
          timeoutRef.current = setTimeout(resetBuffer, maxIntervalMs * 1.8);
          return;
        }

        // If subsequent character arrives at scanner speed
        if (interval > 0 && interval <= maxIntervalMs) {
          // This is a rapid scanner burst into an input field!
          setIsCapturingBurst(true);
          bufferRef.current.push(e.key);
          timestampsRef.current.push(now);

          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            // Suffix-less scanner fallback
            if (bufferRef.current.length >= minChars) {
              dispatchScan('Timeout');
            } else {
              resetBuffer();
            }
          }, maxIntervalMs * 2.2);
          return;
        } else {
          // Human typing speed detected in input; clear any scanner buffer
          resetBuffer();
          return;
        }
      }

      // Global capture (when focus is outside inputs, or allowInInputs is true)
      if (timestamps.length > 0 && interval > maxIntervalMs * 2.5) {
        // Too slow between keys to be a single barcode scan; restart buffer
        bufferRef.current = [e.key];
        timestampsRef.current = [now];
      } else {
        bufferRef.current.push(e.key);
        timestampsRef.current.push(now);
      }

      setIsCapturingBurst(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Check if a scanner sent data without an Enter terminator
        if (bufferRef.current.length >= minChars) {
          const tList = timestampsRef.current;
          const intervals: number[] = [];
          for (let i = 1; i < tList.length; i++) {
            intervals.push(tList[i] - tList[i - 1]);
          }
          const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 999;
          if (avg <= maxIntervalMs * 1.2) {
            dispatchScan('Timeout');
            return;
          }
        }
        resetBuffer();
      }, maxIntervalMs * 2.5);

    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, allowInInputs, maxIntervalMs, minChars, dispatchScan, resetBuffer]);

  // Custom event listener for SSE or external hardware scans
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const handleCustomHardwareScan = (e: Event) => {
      const customEvt = e as CustomEvent<{ barcode: string; timestamp?: number; source?: string }>;
      if (customEvt.detail && customEvt.detail.barcode) {
        const meta: ScanMetadata = {
          rawBarcode: customEvt.detail.barcode,
          scanDurationMs: 0,
          avgKeyIntervalMs: 0,
          charCount: customEvt.detail.barcode.length,
          terminator: 'Direct',
          timestamp: customEvt.detail.timestamp || Date.now(),
          source: (customEvt.detail.source as any) || 'sse',
          intervals: [],
        };
        setLastScan(meta);
        onScanRef.current(customEvt.detail.barcode, meta);
      }
    };
    window.addEventListener('pos_hardware_barcode_scan', handleCustomHardwareScan);
    return () => {
      window.removeEventListener('pos_hardware_barcode_scan', handleCustomHardwareScan);
    };
  }, [enabled]);

  // Direct Electron hardware scan listener integration (if desktop electron API is present)
  useEffect(() => {
    if (!enabled || !listenToHardware || typeof window === 'undefined') return;

    if (window.electronAPI?.onHardwareBarcodeScan) {
      const unsubscribe = window.electronAPI.onHardwareBarcodeScan((data) => {
        if (data && data.barcode) {
          const meta: ScanMetadata = {
            rawBarcode: data.barcode,
            scanDurationMs: 0,
            avgKeyIntervalMs: 0,
            charCount: data.barcode.length,
            terminator: 'Direct',
            timestamp: data.timestamp || Date.now(),
            source: 'hardware-hid',
            intervals: [],
          };
          setLastScan(meta);
          onScanRef.current(data.barcode, meta);
        }
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [enabled, listenToHardware]);

  return {
    lastScan,
    isCapturingBurst,
    resetBuffer,
  };
}
