const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codedexAPI', {
  list: () => ipcRenderer.invoke('codedex:list'),
});
