const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mascotAPI', {
  onState: (callback) => {
    ipcRenderer.on('mascot:state', (_event, data) => callback(data));
  },
  onWalk: (callback) => {
    ipcRenderer.on('mascot:walk', (_event, data) => callback(data));
  },
  toggleLookup: () => ipcRenderer.send('mascot:toggle-lookup'),
  requestContextMenu: () => ipcRenderer.send('mascot:context-menu'),
});
