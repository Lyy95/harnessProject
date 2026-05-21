const { contextBridge, ipcRenderer } = require('electron');

// kb-018: 渲染进程错误转发到主进程
window.addEventListener('error', (e) => {
  ipcRenderer.invoke('report-renderer-error', { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, type: 'window_error' });
});
window.addEventListener('unhandledrejection', (e) => {
  ipcRenderer.invoke('report-renderer-error', { reason: String(e.reason), type: 'unhandled_rejection' });
});

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
  createConversation: (name) => ipcRenderer.invoke('create-conversation', { name }),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  getConversation: (id) => ipcRenderer.invoke('get-conversation', { id }),
  addQAToConversation: (conversationId, qa) => ipcRenderer.invoke('add-qa-to-conversation', { conversationId, qa }),
  deleteConversation: (id) => ipcRenderer.invoke('delete-conversation', { id }),
  getRuntimeMetrics: () => ipcRenderer.invoke('get-runtime-metrics'),
});
