const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quizAPI', {
  onShow: (callback) => {
    ipcRenderer.on('quiz:show', (_event, data) => callback(data));
  },
  onSide: (callback) => {
    ipcRenderer.on('quiz:side', (_event, side) => callback(side));
  },
  reportSize: (size) => ipcRenderer.send('quiz:content-size', size),
  openLink: (uri) => ipcRenderer.send('quiz:open-link', uri),
  close: () => ipcRenderer.send('quiz:close'),
  respond: (term, response) => ipcRenderer.send('quiz:respond', { term, response }),
});
