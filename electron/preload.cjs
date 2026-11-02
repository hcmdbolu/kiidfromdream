const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  saveBackupFile: (data) => ipcRenderer.invoke('save-backup-file', data),
  openBackupFile: () => ipcRenderer.invoke('open-backup-file'),
  onHardwareBarcodeScan: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('hardware-barcode-scan', handler);
    return () => ipcRenderer.removeListener('hardware-barcode-scan', handler);
  },
  getConnectedScanners: () => ipcRenderer.invoke('get-connected-scanners'),
  getAuditLogs: (options) => ipcRenderer.invoke('get-audit-logs', options),
  isDesktop: true,
});
