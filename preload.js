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
  indexAllDocuments: () => ipcRenderer.invoke('index-all-documents'),
  getIndexStatus: () => ipcRenderer.invoke('get-index-status'),
  searchChunks: (query) => ipcRenderer.invoke('search-chunks', query),
  getDocumentMeta: (docName) => ipcRenderer.invoke('get-document-meta', docName),
  deleteDocumentIndex: (docName) => ipcRenderer.invoke('delete-document-index', docName),
});
