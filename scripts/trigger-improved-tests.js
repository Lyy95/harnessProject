// scripts/trigger-improved-tests.js
// 在 Electron 应用运行时触发 T-01~T-05 操作 + 错误（用 IPC client 模拟）
// 通过直接写入数据文件触发后续的 IPC 调用

const fs = require('fs');
const path = require('path');
const os = require('os');

const dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'harnessproject', 'kb-data');
const docsDir = path.join(dataDir, 'documents');
const testDocSrc = path.join(__dirname, '..', 'test-doc.txt');
const testDocDest = path.join(docsDir, 'test-doc.txt');

// 复制 test-doc.txt 到 documents（模拟用户导入）
fs.copyFileSync(testDocSrc, testDocDest);
console.log('test-doc.txt 已复制到 documents/');

// 添加带引用的 QA 到默认对话
const convFile = path.join(dataDir, 'conversations.json');
const convs = JSON.parse(fs.readFileSync(convFile, 'utf-8'));
const defConv = convs.find(c => c.name === '默认对话') || convs[0];

const docContent = fs.readFileSync(testDocSrc, 'utf-8');
defConv.qa.push({
  q: 'Electron 是什么？',
  a: 'Electron 是用于构建桌面应用的框架。',
  citations: [
    { docName: 'test-doc.txt', snippet: docContent.substring(0, 120) + '...', chunkId: 'manual-cit', score: 2 },
  ],
});
fs.writeFileSync(convFile, JSON.stringify(convs, null, 2));
console.log('QA 已添加到默认对话');

// 写一条 chunks/test-doc.txt 模拟分块（chunks/ 目录格式）
const chunksDir = path.join(dataDir, 'chunks');
const metadataDir = path.join(dataDir, 'metadata');
if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });
if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });

const crypto = require('crypto');
fs.writeFileSync(path.join(chunksDir, 'test-doc.txt.json'), JSON.stringify([
  { id: crypto.randomUUID(), docName: 'test-doc.txt', content: docContent, index: 0 }
], null, 2));
fs.writeFileSync(path.join(metadataDir, 'test-doc.txt.json'), JSON.stringify({
  docName: 'test-doc.txt',
  charCount: docContent.length,
  idf: 1.5,
}, null, 2));
console.log('chunks/ 和 metadata/ 已生成');
