const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  save: (apiKey) => ipcRenderer.send('setup:save', apiKey),
  skip: () => ipcRenderer.send('setup:skip'),
  openLink: (uri) => ipcRenderer.send('setup:open-link', uri),
  onPrefill: (callback) => {
    ipcRenderer.on('setup:prefill', (_event, apiKey) => callback(apiKey));
  },
});
