const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  onUpdate: (callback) => {
    ipcRenderer.on('popup:update', (_event, data) => callback(data));
  },
  reportSize: (size) => ipcRenderer.send('popup:content-size', size),
  openLink: (uri) => ipcRenderer.send('popup:open-link', uri),
  close: () => ipcRenderer.send('popup:close'),
  retry: () => ipcRenderer.send('popup:retry'),
  removeFromDictionary: () => ipcRenderer.invoke('popup:remove-dictionary'),
});
