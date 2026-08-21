const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  click: () => ipcRenderer.send('lookup:click'),
  cancel: () => ipcRenderer.send('lookup:cancel'),
});
