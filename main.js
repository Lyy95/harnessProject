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

ipcMain.handle('get-document-info', (_event, filePath) => {
  const stats = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    size: stats.size,
    modified: stats.mtime.toISOString(),
  };
});

ipcMain.handle('get-imports', () => {
  const importFile = path.join(dataDir, 'imports.json');
  if (!fs.existsSync(importFile)) return [];
  return JSON.parse(fs.readFileSync(importFile, 'utf-8'));
});

ipcMain.handle('log-import', (_event, files) => {
  const importFile = path.join(dataDir, 'imports.json');
  const imports = fs.existsSync(importFile)
    ? JSON.parse(fs.readFileSync(importFile, 'utf-8'))
    : [];
  imports.push({ time: new Date().toISOString(), files: files.map((f) => f.name) });
  fs.writeFileSync(importFile, JSON.stringify(imports, null, 2));
  return imports;
});

ipcMain.handle('get-data-dir', () => dataDir);
