const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codeAPI', {
  analyze: (payload) => ipcRenderer.invoke('code:analyze', payload),
});
