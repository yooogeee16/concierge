const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  select: (rect) => ipcRenderer.send('lookup:select', rect),
  cancel: () => ipcRenderer.send('lookup:cancel'),
});
