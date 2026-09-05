const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quizAPI', {
  onShow: (callback) => {
    ipcRenderer.on('quiz:show', (_event, data) => callback(data));
  },
  reportSize: (size) => ipcRenderer.send('quiz:content-size', size),
  openLink: (uri) => ipcRenderer.send('quiz:open-link', uri),
  close: () => ipcRenderer.send('quiz:close'),
});
