const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('detailAPI', {
  onUpdate: (callback) => {
    ipcRenderer.on('detail:update', (_event, data) => callback(data));
  },
});
