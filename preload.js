const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kbAPI', {
  getDocuments: () => ipcRenderer.invoke('get-documents'),
  readDocument: (filePath) => ipcRenderer.invoke('read-document', filePath),
  saveDocument: (doc) => ipcRenderer.invoke('save-document', doc),
  deleteDocument: (name) => ipcRenderer.invoke('delete-document', name),
  getQA: () => ipcRenderer.invoke('get-qa'),
  addQA: (qa) => ipcRenderer.invoke('add-qa', qa),
  importDocument: () => ipcRenderer.invoke('import-document'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
});
