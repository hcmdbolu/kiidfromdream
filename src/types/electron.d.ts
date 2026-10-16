export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getDataDir: () => Promise<string>;
  openDataFolder: () => Promise<boolean>;
  printReceipt: (options?: { silent?: boolean; deviceName?: string }) => Promise<boolean>;
  getPrinters: () => Promise<Array<{ name: string; displayName?: string; isDefault?: boolean }>>;
  toggleFullscreen: () => Promise<boolean>;
  saveBackupFile?: (data: { filename: string; content: string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  openBackupFile?: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>;
  isDesktop: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
