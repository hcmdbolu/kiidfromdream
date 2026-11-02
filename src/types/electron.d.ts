export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getDataDir: () => Promise<string>;
  openDataFolder: () => Promise<boolean>;
  printReceipt: (options?: { silent?: boolean; deviceName?: string }) => Promise<boolean>;
  getPrinters: () => Promise<Array<{ name: string; displayName?: string; isDefault?: boolean }>>;
  toggleFullscreen: () => Promise<boolean>;
  saveBackupFile?: (data: { filename: string; content: string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  openBackupFile?: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>;
  onHardwareBarcodeScan?: (callback: (data: { barcode: string; timestamp: number; source: string }) => void) => () => void;
  getConnectedScanners?: () => Promise<Array<{ name: string; vendorId?: number; productId?: number; isHid?: boolean }>>;
  isDesktop: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
