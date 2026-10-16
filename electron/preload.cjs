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
  isDesktop: true,
});
