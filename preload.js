const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kbAPI', {
  getDocuments: () => ipcRenderer.invoke('get-documents'),
  readDocument: (filePath) => ipcRenderer.invoke('read-document', filePath),
  saveDocument: (doc) => ipcRenderer.invoke('save-document', doc),
  deleteDocument: (name) => ipcRenderer.invoke('delete-document', name),
  getQA: () => ipcRenderer.invoke('get-qa'),
  addQA: (qa) => ipcRenderer.invoke('add-qa', qa),
  importDocument: () => ipcRenderer.invoke('import-document'),
  getDocumentInfo: (filePath) => ipcRenderer.invoke('get-document-info', filePath),
  getImports: () => ipcRenderer.invoke('get-imports'),
  logImport: (files) => ipcRenderer.invoke('log-import', files),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
});
