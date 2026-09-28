const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isDesktop: true,
});
