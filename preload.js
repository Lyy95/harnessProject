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
  getDocumentInfo: (filePath) => ipcRenderer.invoke('get-document-info', filePath),
  logImport: (files) => ipcRenderer.invoke('log-import', files),
  getImports: () => ipcRenderer.invoke('get-imports'),
  chunkDocument: (doc) => ipcRenderer.invoke('chunk-document', doc),
  getDocumentChunks: (docName) => ipcRenderer.invoke('get-document-chunks', docName),
  extractMetadata: (doc) => ipcRenderer.invoke('extract-metadata', doc),
  getDocumentMetadata: (docName) => ipcRenderer.invoke('get-document-metadata', docName),
  getIndexStats: () => ipcRenderer.invoke('get-index-stats'),
  searchChunks: (query) => ipcRenderer.invoke('search-chunks', query),
});
