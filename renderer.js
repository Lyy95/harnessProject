const docList = document.getElementById('doc-list');
const docViewer = document.getElementById('doc-viewer');
const docTitle = document.getElementById('doc-title');
const docContent = document.getElementById('doc-content');
const docMeta = document.getElementById('doc-meta');
const docViewContent = document.getElementById('doc-view-content');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const qaPanel = document.getElementById('qa-panel');
const qaList = document.getElementById('qa-list');
const qaQuestion = document.getElementById('qa-question');
const qaAnswer = document.getElementById('qa-answer');
const indexStatusText = document.getElementById('index-status-text');
const indexStatus = document.getElementById('index-status');
const btnRebuildIndex = document.getElementById('btn-rebuild-index');
const tabManualQA = document.getElementById('tab-manual-qa');
const tabSmartQA = document.getElementById('tab-smart-qa');
const qaManual = document.getElementById('qa-manual');
const qaSmart = document.getElementById('qa-smart');
const smartQuery = document.getElementById('smart-query');
const smartQAResults = document.getElementById('smart-qa-results');

let currentDoc = null;
let isEditMode = false;
let currentQATab = 'manual';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatMtime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN');
}

async function loadIndexStatus() {
  try {
    const status = await window.kbAPI.getIndexStatus();
    if (status.docCount > 0) {
      indexStatusText.textContent = `已索引 ${status.docCount} 篇文档 / ${status.chunkCount} 个块`;
      indexStatus.className = 'indexed';
    } else {
      indexStatusText.textContent = '未索引';
      indexStatus.className = '';
    }
  } catch (e) {
    indexStatusText.textContent = '索引状态未知';
    indexStatus.className = '';
  }
}

function highlightText(text, query) {
  if (!query || !query.trim()) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  let result = escaped;
  for (const token of tokens) {
    const escapedToken = escapeHtml(token);
    const regex = new RegExp(`(${escapedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<span class="highlight">$1</span>');
  }
  return result;
}

function renderSearchResults(query, results) {
  smartQAResults.innerHTML = '';
  if (!results || results.length === 0) {
    smartQAResults.innerHTML = '<div style="padding:16px;color:#a6adc8;font-size:13px;">未找到匹配的文档片段</div>';
    return;
  }
  for (const r of results) {
    const ch = r.chunk;
    const div = document.createElement('div');
    div.className = 'search-result';

    let snippet = ch.content;
    if (snippet.length > 300) {
      snippet = snippet.substring(0, 300) + '...';
    }

    div.innerHTML =
      `<div class="score">相关度: ${r.score.toFixed(2)}</div>` +
      `<div class="snippet">${highlightText(snippet, query)}</div>` +
      `<div class="cite">来自: <span class="cite-link" data-doc="${escapeHtml(ch.docName)}">${escapeHtml(ch.docName)}</span> (第${ch.chunkIndex + 1}段)</div>`;

    div.querySelector('.cite-link').addEventListener('click', () => {
      const doc = { name: ch.docName, path: ch.docName };
      openDocBySearch(doc);
    });
    smartQAResults.appendChild(div);
  }
}

async function openDocBySearch(docRef) {
  const docs = await window.kbAPI.getDocuments();
  const found = docs.find(d => d.name === docRef.name);
  if (found) {
    openDoc(found);
  }
}

function switchQATab(tab) {
  currentQATab = tab;
  if (tab === 'manual') {
    tabManualQA.classList.add('active');
    tabSmartQA.classList.remove('active');
    qaManual.classList.remove('hidden');
    qaSmart.classList.add('hidden');
  } else {
    tabSmartQA.classList.add('active');
    tabManualQA.classList.remove('active');
    qaSmart.classList.remove('hidden');
    qaManual.classList.add('hidden');
  }
}

function updateMeta(info) {
  docMeta.textContent = `大小: ${formatFileSize(info.size)} | 修改时间: ${formatMtime(info.mtime)}`;
}

function enterViewMode(text) {
  isEditMode = false;
  docViewContent.textContent = text;
  docViewContent.classList.remove('hidden');
  docContent.classList.add('hidden');
  btnToggleMode.textContent = '编辑';
}

function enterEditMode() {
  isEditMode = true;
  docContent.value = docViewContent.textContent;
  docContent.classList.remove('hidden');
  docViewContent.classList.add('hidden');
  btnToggleMode.textContent = '查看';
}

async function loadDocList() {
  const docs = await window.kbAPI.getDocuments();
  docList.innerHTML = '';
  docs.forEach((doc) => {
    const li = document.createElement('li');
    li.textContent = doc.name;
    li.addEventListener('click', () => openDoc(doc));
    if (currentDoc && currentDoc.name === doc.name) li.classList.add('active');
    docList.appendChild(li);
  });
}

async function openDoc(doc) {
  currentDoc = doc;
  docViewer.classList.remove('hidden');
  qaPanel.style.display = 'none';
  docTitle.textContent = doc.name;
  const text = await window.kbAPI.readDocument(doc.path);
  const info = await window.kbAPI.getDocumentInfo(doc.path);
  updateMeta(info);
  enterViewMode(text);
  loadDocList();
}

btnToggleMode.addEventListener('click', () => {
  if (isEditMode) {
    enterViewMode(docContent.value);
  } else {
    enterEditMode();
  }
});

document.getElementById('btn-close-doc').addEventListener('click', () => {
  currentDoc = null;
  docViewer.classList.add('hidden');
  qaPanel.style.display = '';
  loadDocList();
});

document.getElementById('btn-save-doc').addEventListener('click', async () => {
  if (!currentDoc) return;
  const content = isEditMode ? docContent.value : docViewContent.textContent;
  await window.kbAPI.saveDocument({ name: currentDoc.name, content });
  await window.kbAPI.indexAllDocuments();
  await loadIndexStatus();
  const info = await window.kbAPI.getDocumentInfo(currentDoc.path);
  updateMeta(info);
  enterViewMode(content);
  alert('已保存');
});

document.getElementById('btn-delete-doc').addEventListener('click', async () => {
  if (!currentDoc) return;
  if (!confirm(`确定删除 ${currentDoc.name}？`)) return;
  await window.kbAPI.deleteDocumentIndex(currentDoc.name);
  await window.kbAPI.deleteDocument(currentDoc.name);
  await loadIndexStatus();
  currentDoc = null;
  docViewer.classList.add('hidden');
  qaPanel.style.display = '';
  loadDocList();
});

document.getElementById('btn-import-doc').addEventListener('click', async () => {
  const imported = await window.kbAPI.importDocument();
  if (imported.length > 0) {
    await window.kbAPI.logImport(imported);
    await window.kbAPI.indexAllDocuments();
    await loadIndexStatus();
    alert(`已导入 ${imported.length} 个文件`);
    loadDocList();
  }
});

document.getElementById('btn-new-doc').addEventListener('click', async () => {
  const name = prompt('输入文档名称（含扩展名，如 note.txt）：');
  if (!name) return;
  await window.kbAPI.saveDocument({ name, content: '' });
  loadDocList();
});

async function loadQA() {
  const items = await window.kbAPI.getQA();
  qaList.innerHTML = '';
  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    div.innerHTML = `<div class="q">Q: ${escapeHtml(item.q)}</div><div class="a">A: ${escapeHtml(item.a)}</div>`;
    qaList.appendChild(div);
  });
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

document.getElementById('btn-add-qa').addEventListener('click', async () => {
  const q = qaQuestion.value.trim();
  const a = qaAnswer.value.trim();
  if (!q || !a) return;
  await window.kbAPI.addQA({ q, a });
  qaQuestion.value = '';
  qaAnswer.value = '';
  loadQA();
});

document.getElementById('btn-rebuild-index').addEventListener('click', async () => {
  btnRebuildIndex.disabled = true;
  btnRebuildIndex.textContent = '索引中...';
  try {
    await window.kbAPI.indexAllDocuments();
    await loadIndexStatus();
  } finally {
    btnRebuildIndex.disabled = false;
    btnRebuildIndex.textContent = '重建索引';
  }
});

tabManualQA.addEventListener('click', () => switchQATab('manual'));
tabSmartQA.addEventListener('click', () => switchQATab('smart'));

document.getElementById('btn-search-qa').addEventListener('click', async () => {
  const query = smartQuery.value.trim();
  if (!query) return;
  const results = await window.kbAPI.searchChunks(query);
  renderSearchResults(query, results);
});

smartQuery.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-search-qa').click();
  }
});

loadDocList();
loadQA();
loadIndexStatus();
