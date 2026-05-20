const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createLogger } = require('./services/logger');

let dataDir = path.join(app.getPath('userData'), 'kb-data');
let logger;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const docsDir = path.join(dataDir, 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'welcome.txt'), 'Welcome to your knowledge base!\nThis is a sample document.');
    fs.writeFileSync(path.join(docsDir, 'notes.txt'), 'Electron is a framework for building desktop apps.\nIt uses JavaScript, HTML, and CSS.');
  }
  const qaFile = path.join(dataDir, 'qa.json');
  if (!fs.existsSync(qaFile)) {
    fs.writeFileSync(qaFile, JSON.stringify([], null, 2));
  }
  ensureConversationsMigration();
  return dataDir;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureDataDir();
  logger = createLogger(dataDir);
  logger.info('app_start', { dataDir, electronVersion: process.versions.electron });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-documents', () => {
  const docsDir = path.join(dataDir, 'documents');
  const files = fs.readdirSync(docsDir).map((f) => ({ name: f, path: path.join(docsDir, f) }));
  return files;
});

ipcMain.handle('read-document', (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('save-document', (_event, { name, content }) => {
  const docsDir = path.join(dataDir, 'documents');
  fs.writeFileSync(path.join(docsDir, name), content);
  return { success: true };
});

ipcMain.handle('delete-document', (_event, name) => {
  const docsDir = path.join(dataDir, 'documents');
  fs.unlinkSync(path.join(docsDir, name));
  return { success: true };
});

ipcMain.handle('get-qa', () => {
  const qaFile = path.join(dataDir, 'qa.json');
  return JSON.parse(fs.readFileSync(qaFile, 'utf-8'));
});

ipcMain.handle('add-qa', (_event, qa) => {
  const convs = readConversations();
  let defaultConv = convs.find(c => c.name === '默认对话');
  if (!defaultConv) {
    defaultConv = { id: crypto.randomUUID(), name: '默认对话', createdAt: new Date().toISOString(), messages: [] };
    convs.unshift(defaultConv);
  }
  defaultConv.messages.push(qa);
  writeConversations(convs);
  return defaultConv.messages;
});

// --- 多轮对话历史 (kb-015) ---

const CONVERSATIONS_FILE = 'conversations.json';

function readConversations() {
  const file = path.join(dataDir, CONVERSATIONS_FILE);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeConversations(convs) {
  const file = path.join(dataDir, CONVERSATIONS_FILE);
  fs.writeFileSync(file, JSON.stringify(convs, null, 2));
}

function ensureConversationsMigration() {
  const convFile = path.join(dataDir, CONVERSATIONS_FILE);
  const qaFile = path.join(dataDir, 'qa.json');
  if (fs.existsSync(convFile)) return;
  if (!fs.existsSync(qaFile)) return;
  const qaItems = JSON.parse(fs.readFileSync(qaFile, 'utf-8'));
  if (!Array.isArray(qaItems) || qaItems.length === 0) return;
  const defaultConv = {
    id: crypto.randomUUID(),
    name: '默认对话',
    createdAt: new Date().toISOString(),
    messages: qaItems,
  };
  writeConversations([defaultConv]);
  logger.info('conversations_migration', { migratedCount: qaItems.length });
}

ipcMain.handle('get-conversations', () => {
  const convs = readConversations();
  return convs.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
});

ipcMain.handle('create-conversation', (_event, name) => {
  const convs = readConversations();
  const conv = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    messages: [],
  };
  convs.push(conv);
  writeConversations(convs);
  return conv;
});

ipcMain.handle('delete-conversation', (_event, id) => {
  let convs = readConversations();
  convs = convs.filter(c => c.id !== id);
  writeConversations(convs);
  return { success: true };
});

ipcMain.handle('get-conversation', (_event, id) => {
  const convs = readConversations();
  const conv = convs.find(c => c.id === id);
  if (!conv) throw new Error(`Conversation not found: ${id}`);
  return conv;
});

ipcMain.handle('add-message', (_event, { convId, message }) => {
  const convs = readConversations();
  const conv = convs.find(c => c.id === convId);
  if (!conv) throw new Error(`Conversation not found: ${convId}`);
  conv.messages.push(message);
  writeConversations(convs);
  return conv.messages;
});

ipcMain.handle('import-document', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入文档',
    filters: [{ name: '文档文件', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', '*'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const docsDir = path.join(dataDir, 'documents');
  const imported = [];
  for (const filePath of result.filePaths) {
    const name = path.basename(filePath);
    const destPath = path.join(docsDir, name);
    const srcSize = fs.statSync(filePath).size;
    fs.copyFileSync(filePath, destPath);
    imported.push({ name, path: destPath });
    logger.info('import_document', { name, size: srcSize });
  }
  return imported;
});

ipcMain.handle('get-data-dir', () => dataDir);

ipcMain.handle('get-document-info', (_event, filePath) => {
  const stats = fs.statSync(filePath);
  return {
    size: stats.size,
    mtime: stats.mtime.toISOString(),
  };
});

ipcMain.handle('log-import', (_event, files) => {
  const importsFile = path.join(dataDir, 'imports.json');
  const record = {
    time: new Date().toISOString(),
    files: files.map((f) => f.name),
  };
  let imports = [];
  if (fs.existsSync(importsFile)) {
    imports = JSON.parse(fs.readFileSync(importsFile, 'utf-8'));
  }
  imports.push(record);
  fs.writeFileSync(importsFile, JSON.stringify(imports, null, 2));
  logger.info('log_import', { fileCount: files.length, names: record.files });
  return imports;
});

ipcMain.handle('get-imports', () => {
  const importsFile = path.join(dataDir, 'imports.json');
  if (!fs.existsSync(importsFile)) return [];
  return JSON.parse(fs.readFileSync(importsFile, 'utf-8'));
});

// --- 文档分块 (kb-008) ---

const CHUNK_MAX = 1000;

function chunkText(text, docName) {
  // Step 1: 按双换行拆分为段落
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  // Step 2: 进一步拆分超大段落（按单换行，再按固定大小）
  const segments = [];
  for (const p of paragraphs) {
    if (p.length <= CHUNK_MAX) {
      segments.push(p.trim());
    } else {
      const lines = p.split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (line.length <= CHUNK_MAX) {
          segments.push(line.trim());
        } else {
          for (let i = 0; i < line.length; i += CHUNK_MAX) {
            segments.push(line.substring(i, i + CHUNK_MAX).trim());
          }
        }
      }
    }
  }

  // Step 3: 将段落组合为 500-1000 字符的块
  const chunks = [];
  let current = '';
  for (const seg of segments) {
    const candidate = current ? current + '\n\n' + seg : seg;
    if (candidate.length > CHUNK_MAX && current.length > 0) {
      chunks.push(current);
      current = seg;
    } else {
      current = candidate;
    }
    if (current.length >= CHUNK_MAX) {
      chunks.push(current);
      current = '';
    }
  }
  if (current) chunks.push(current);

  return chunks.map((content, i) => ({
    id: crypto.randomUUID(),
    docName,
    content,
    index: i,
  }));
}

function readChunks() {
  const chunksFile = path.join(dataDir, 'chunks.json');
  if (!fs.existsSync(chunksFile)) return [];
  return JSON.parse(fs.readFileSync(chunksFile, 'utf-8'));
}

function writeChunks(chunks) {
  const chunksFile = path.join(dataDir, 'chunks.json');
  fs.writeFileSync(chunksFile, JSON.stringify(chunks, null, 2));
}

ipcMain.handle('chunk-document', (_event, { name, content }) => {
  const allChunks = readChunks();
  const filtered = allChunks.filter(c => c.docName !== name);
  const newChunks = chunkText(content, name);
  writeChunks([...filtered, ...newChunks]);
  logger.info('chunk_document', { docName: name, charCount: content.length, chunks: newChunks.length });
  return newChunks;
});

ipcMain.handle('get-document-chunks', (_event, docName) => {
  return readChunks().filter(c => c.docName === docName);
});

// --- 元数据提取 (kb-009) ---

function readMeta() {
  const metaFile = path.join(dataDir, 'document-meta.json');
  if (!fs.existsSync(metaFile)) return [];
  return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
}

function writeMeta(meta) {
  const metaFile = path.join(dataDir, 'document-meta.json');
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
}

ipcMain.handle('extract-metadata', (_event, { name, content }) => {
  const docsDir = path.join(dataDir, 'documents');
  const filePath = path.join(docsDir, name);
  let fileSize = 0;
  let createdAt = null;
  let modifiedAt = null;
  try {
    const stats = fs.statSync(filePath);
    fileSize = stats.size;
    createdAt = stats.birthtime.toISOString();
    modifiedAt = stats.mtime.toISOString();
  } catch (_) { /* 文件可能尚未写入 */ }

  const entry = {
    docName: name,
    charCount: content.length,
    wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    paragraphCount: content.trim() ? content.split(/\n\n+/).filter(p => p.trim()).length : 0,
    fileSize,
    createdAt,
    modifiedAt,
  };

  const allMeta = readMeta();
  const filtered = allMeta.filter(m => m.docName !== name);
  writeMeta([...filtered, entry]);
  logger.info('extract_metadata', { docName: name, wordCount: entry.wordCount, paragraphCount: entry.paragraphCount });
  return entry;
});

ipcMain.handle('get-document-metadata', (_event, docName) => {
  return readMeta().find(m => m.docName === docName) || null;
});

// --- 索引进度 (kb-010) ---

ipcMain.handle('get-index-stats', () => {
  const docsDir = path.join(dataDir, 'documents');
  const docFiles = fs.existsSync(docsDir) ? fs.readdirSync(docsDir).filter(f => f.endsWith('.txt')) : [];
  const totalDocs = docFiles.length;
  const chunks = readChunks();
  const meta = readMeta();
  // 已索引文档：在 document-meta.json 中有记录的文档数
  const indexedDocs = meta.filter(m => docFiles.includes(m.docName)).length;
  // 已分块文档：在 chunks.json 中有块的文档数（去重）
  const chunkedDocNames = new Set(chunks.map(c => c.docName));
  const chunkedDocs = [...chunkedDocNames].filter(n => docFiles.includes(n)).length;
  const totalChunks = chunks.length;
  return { totalDocs, indexedDocs, chunkedDocs, totalChunks };
});

// --- 带引用的问答 (kb-011) ---

ipcMain.handle('search-chunks', (_event, query) => {
  const chunks = readChunks();
  if (chunks.length === 0) {
    logger.warn('search_chunks_no_data', { query, totalChunks: 0 });
    return [];
  }

  // 拆分关键词：按空白字符 + 中文逐字双字符组合
  const keywords = [];
  const parts = query.toLowerCase().split(/\s+/).filter(s => s.length > 0);
  for (const p of parts) {
    keywords.push(p);
    // 对中文部分，额外生成双字符组合以提升匹配精度
    const hanRegex = /[\u4e00-\u9fff]+/g;
    let m;
    while ((m = hanRegex.exec(p)) !== null) {
      const han = m[0];
      for (let i = 0; i + 1 < han.length; i++) {
        keywords.push(han.substring(i, i + 2));
      }
    }
  }

  const scored = chunks.map(chunk => {
    const lower = chunk.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    return { chunk, score };
  });

  // 取 score > 0 的前 5 条，按分数降序
  const matches = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (matches.length === 0) {
    logger.warn('search_chunks_no_match', { query, keywords, totalChunks: chunks.length });
  } else {
    logger.info('search_chunks_ok', { query, results: matches.length });
  }

  // 生成引用：取每块前 120 字符作为片段
  return matches.map(({ chunk, score }) => ({
    docName: chunk.docName,
    snippet: chunk.content.length > 120 ? chunk.content.substring(0, 120) + '...' : chunk.content,
    chunkId: chunk.id,
    score,
  }));
});
