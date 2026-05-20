const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let dataDir = path.join(app.getPath('userData'), 'kb-data');

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
  const indexDir = path.join(dataDir, 'index');
  if (!fs.existsSync(indexDir)) {
    fs.mkdirSync(indexDir, { recursive: true });
  }
  return dataDir;
}

// --- Indexing Engine ---

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '些', '所', '为', '所以', '因为',
  '但是', '然而', '而且', '或', '或者', '并', '并且', '虽然', '如果', '之', '的',
  '可以', '这个', '那个', '什么', '怎么', '如何', '哪', '吗', '呢', '吧', '啊',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'it', 'its', 'and', 'but', 'or', 'if', 'while',
]);

function chunkDocument(text, docName) {
  const chunks = [];
  // Step 1: split by double newline (paragraphs)
  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (!para.trim()) {
      charOffset += para.length + 2;
      continue;
    }
    // Step 2: if paragraph > 1000 chars, split by sentence boundaries
    if (para.length > 1000) {
      const sentences = para.split(/(?<=[。！？\n])/);
      let buffer = '';
      let bufferStart = charOffset;
      for (const sent of sentences) {
        if (buffer.length + sent.length > 1000 && buffer.trim()) {
          chunks.push({
            id: `${docName}#${chunkIndex}`,
            docName,
            content: buffer,
            charStart: bufferStart,
            charEnd: bufferStart + buffer.length,
            chunkIndex,
          });
          chunkIndex++;
          buffer = sent;
          bufferStart = charOffset + para.indexOf(sent);
        } else {
          buffer += sent;
        }
      }
      if (buffer.trim()) {
        chunks.push({
          id: `${docName}#${chunkIndex}`,
          docName,
          content: buffer,
          charStart: bufferStart,
          charEnd: bufferStart + buffer.length,
          chunkIndex,
        });
        chunkIndex++;
      }
    } else {
      chunks.push({
        id: `${docName}#${chunkIndex}`,
        docName,
        content: para,
        charStart: charOffset,
        charEnd: charOffset + para.length,
        chunkIndex,
      });
      chunkIndex++;
    }
    charOffset += para.length + 2;
  }
  return chunks;
}

function tokenize(text) {
  const tokens = [];
  const lower = text.toLowerCase();
  // English words
  const wordMatches = lower.match(/[a-z]+/g);
  if (wordMatches) {
    for (const w of wordMatches) {
      if (!STOP_WORDS.has(w) && w.length >= 1) tokens.push(w);
    }
  }
  // Chinese 2-gram
  const cjkChars = lower.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  if (cjkChars) {
    for (let i = 0; i < cjkChars.length; i++) {
      const ch = cjkChars[i];
      if (!STOP_WORDS.has(ch)) tokens.push(ch);
      if (i + 1 < cjkChars.length) {
        tokens.push(ch + cjkChars[i + 1]);
      }
    }
  }
  // Remove punctuation and empty
  return tokens.filter(t => t.length >= 1);
}

function rankChunks(query, chunks) {
  if (!query.trim() || chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const N = chunks.length;

  // Compute document frequency for each term
  const docFreq = {};
  for (const t of new Set(queryTokens)) {
    let count = 0;
    for (const ch of chunks) {
      const lowerContent = ch.content.toLowerCase();
      if (lowerContent.includes(t)) count++;
    }
    docFreq[t] = count;
  }

  // Score each chunk
  const scored = chunks.map((ch) => {
    const lowerContent = ch.content.toLowerCase();
    const chunkTokens = tokenize(ch.content);
    const totalTerms = chunkTokens.length || 1;

    let score = 0;
    for (const t of new Set(queryTokens)) {
      const tf = (chunkTokens.filter(ct => ct === t).length) / totalTerms;
      const df = docFreq[t] || 1;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      // Boost for exact phrase match
      const phraseBoost = lowerContent.includes(query.toLowerCase()) ? 1.5 : 1.0;
      score += tf * idf * phraseBoost;
    }
    return { chunk: ch, score };
  });

  // Sort descending by score, return top 5
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).filter(s => s.score > 0);
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
  const qaFile = path.join(dataDir, 'qa.json');
  const items = JSON.parse(fs.readFileSync(qaFile, 'utf-8'));
  items.push(qa);
  fs.writeFileSync(qaFile, JSON.stringify(items, null, 2));
  return items;
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
    fs.copyFileSync(filePath, destPath);
    imported.push({ name, path: destPath });
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
  return imports;
});

ipcMain.handle('get-imports', () => {
  const importsFile = path.join(dataDir, 'imports.json');
  if (!fs.existsSync(importsFile)) return [];
  return JSON.parse(fs.readFileSync(importsFile, 'utf-8'));
});

// --- Index IPC handlers ---

function getIndexPaths() {
  const indexDir = path.join(dataDir, 'index');
  return {
    chunksFile: path.join(indexDir, 'chunks.json'),
    metaFile: path.join(indexDir, 'meta.json'),
  };
}

function readIndexFiles() {
  const { chunksFile, metaFile } = getIndexPaths();
  const chunks = fs.existsSync(chunksFile) ? JSON.parse(fs.readFileSync(chunksFile, 'utf-8')) : [];
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf-8')) : {};
  return { chunks, meta };
}

ipcMain.handle('index-all-documents', () => {
  const docsDir = path.join(dataDir, 'documents');
  const { chunksFile, metaFile } = getIndexPaths();
  const allChunks = [];
  const meta = {};
  const files = fs.readdirSync(docsDir);

  for (const f of files) {
    const filePath = path.join(docsDir, f);
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const docChunks = chunkDocument(content, f);
    allChunks.push(...docChunks);
    meta[f] = {
      wordCount: content.length,
      paragraphCount: content.split(/\n\n+/).filter(p => p.trim()).length,
      chunkCount: docChunks.length,
      indexedAt: new Date().toISOString(),
    };
  }

  fs.writeFileSync(chunksFile, JSON.stringify(allChunks, null, 2));
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  return { docCount: files.length, chunkCount: allChunks.length };
});

ipcMain.handle('get-index-status', () => {
  const { chunks, meta } = readIndexFiles();
  const chunkCount = chunks.length;
  const docCount = Object.keys(meta).length;
  const lastIndexed = docCount > 0
    ? Object.values(meta).map(m => m.indexedAt).sort().reverse()[0]
    : null;
  return { docCount, chunkCount, lastIndexed };
});

ipcMain.handle('search-chunks', (_event, query) => {
  const { chunks } = readIndexFiles();
  return rankChunks(query, chunks);
});

ipcMain.handle('get-document-meta', (_event, docName) => {
  const { meta } = readIndexFiles();
  return meta[docName] || null;
});

ipcMain.handle('delete-document-index', (_event, docName) => {
  const { chunks, meta } = readIndexFiles();
  const filtered = chunks.filter(c => c.docName !== docName);
  delete meta[docName];
  const { chunksFile, metaFile } = getIndexPaths();
  fs.writeFileSync(chunksFile, JSON.stringify(filtered, null, 2));
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  return { success: true };
});
