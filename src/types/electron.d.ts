export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getDataDir: () => Promise<string>;
  openDataFolder: () => Promise<boolean>;
  printReceipt: (options?: { silent?: boolean; deviceName?: string }) => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
  isDesktop: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
