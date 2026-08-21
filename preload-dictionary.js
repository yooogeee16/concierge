const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dictionaryAPI', {
  list: () => ipcRenderer.invoke('dictionary:list'),
  remove: (term) => ipcRenderer.invoke('dictionary:delete', term),
  openLink: (uri) => ipcRenderer.send('dictionary:open-link', uri),
});
