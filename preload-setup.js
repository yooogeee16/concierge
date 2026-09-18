const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  save: (data) => ipcRenderer.send('setup:save', data),
  skip: () => ipcRenderer.send('setup:skip'),
  openLink: (uri) => ipcRenderer.send('setup:open-link', uri),
  onPrefill: (callback) => {
    ipcRenderer.on('setup:prefill', (_event, data) => callback(data));
  },
});
