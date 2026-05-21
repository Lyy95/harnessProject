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

const convList = document.getElementById('conv-list');

let currentDoc = null;
let isEditMode = false;
let activeConversationId = null;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatMtime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN');
}

function updateMeta(info) {
  const parts = [
    `大小: ${formatFileSize(info.size)}`,
    `修改: ${formatMtime(info.mtime)}`,
  ];
  if (info.wordCount !== undefined) parts.push(`字数: ${info.wordCount}`);
  if (info.paragraphCount !== undefined) parts.push(`段落: ${info.paragraphCount}`);
  docMeta.textContent = parts.join(' | ');
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
  const meta = await window.kbAPI.getDocumentMetadata(doc.name);
  updateMeta({ ...info, wordCount: meta?.wordCount, paragraphCount: meta?.paragraphCount });
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
  await window.kbAPI.chunkDocument({ name: currentDoc.name, content });
  const extracted = await window.kbAPI.extractMetadata({ name: currentDoc.name, content });
  const info = await window.kbAPI.getDocumentInfo(currentDoc.path);
  updateMeta({ ...info, wordCount: extracted.wordCount, paragraphCount: extracted.paragraphCount });
  enterViewMode(content);
  loadIndexStats();
  alert('已保存');
});

document.getElementById('btn-delete-doc').addEventListener('click', async () => {
  if (!currentDoc) return;
  if (!confirm(`确定删除 ${currentDoc.name}？`)) return;
  await window.kbAPI.deleteDocument(currentDoc.name);
  currentDoc = null;
  docViewer.classList.add('hidden');
  qaPanel.style.display = '';
  loadDocList();
});

document.getElementById('btn-import-doc').addEventListener('click', async () => {
  const imported = await window.kbAPI.importDocument();
  if (imported.length > 0) {
    await window.kbAPI.logImport(imported);
    // 对每个导入的文档进行分块 + 提取元数据
    for (const doc of imported) {
      const content = await window.kbAPI.readDocument(doc.path);
      await window.kbAPI.chunkDocument({ name: doc.name, content });
      await window.kbAPI.extractMetadata({ name: doc.name, content });
    }
    alert(`已导入 ${imported.length} 个文件`);
    loadDocList();
    loadIndexStats();
  }
});

document.getElementById('btn-new-doc').addEventListener('click', async () => {
  const name = prompt('输入文档名称（含扩展名，如 note.txt）：');
  if (!name) return;
  await window.kbAPI.saveDocument({ name, content: '' });
  loadDocList();
});

async function loadConversations() {
  const summaries = await window.kbAPI.getConversations();
  // 如果列表为空，自动创建默认对话
  if (summaries.length === 0) {
    const conv = await window.kbAPI.createConversation('默认对话');
    activeConversationId = conv.id;
    renderConvList([{ id: conv.id, name: conv.name, createdAt: conv.createdAt, qaCount: 0 }]);
    return;
  }
  // 如果当前活跃对话已被删除（不在列表中），回退到第一个
  if (activeConversationId && !summaries.find(s => s.id === activeConversationId)) {
    activeConversationId = summaries[0].id;
  }
  // 如果尚未设置活跃对话，默认选中第一个
  if (!activeConversationId) {
    activeConversationId = summaries[0].id;
  }
  renderConvList(summaries);
}

function renderConvList(summaries) {
  convList.innerHTML = '';
  summaries.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'conv-item';
    if (s.id === activeConversationId) div.classList.add('active');
    div.innerHTML = `
      <span class="conv-name">${escapeHtml(s.name)}</span>
      <span class="conv-count">(${s.qaCount})</span>
      <button class="conv-delete danger" data-conv-id="${s.id}">删除</button>
    `;
    // 点击对话项切换（排除删除按钮）
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('conv-delete')) return;
      switchConversation(s.id);
    });
    // 删除按钮事件
    div.querySelector('.conv-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversationById(s.id);
    });
    convList.appendChild(div);
  });
}

async function switchConversation(id) {
  const targetId = id;
  activeConversationId = targetId;
  renderConvListFromCache(targetId);
  const conv = await window.kbAPI.getConversation(targetId);
  // 防止异步竞态：请求返回时检查 id 是否仍匹配
  if (activeConversationId !== targetId) return;
  renderQAList(conv ? conv.qa : []);
}

function renderConvListFromCache(activeId) {
  // 仅更新 .active 高亮，不重新获取数据
  const items = convList.querySelectorAll('.conv-item');
  items.forEach((item) => {
    const delBtn = item.querySelector('.conv-delete');
    if (delBtn && delBtn.dataset.convId === activeId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

async function deleteConversationById(id) {
  const conv = await window.kbAPI.getConversation(id);
  if (!conv) return;
  if (!confirm(`确定删除对话「${conv.name}」及其所有问答？`)) return;
  await window.kbAPI.deleteConversation(id);
  // 如果删除的是当前活跃对话，回退到第一个剩余对话
  if (activeConversationId === id) {
    activeConversationId = null;
  }
  await loadConversations();
  // 如果所有对话被删，loadConversations 已自动创建默认对话并设置 activeConversationId
  loadQA();
}

function renderQAList(qaItems) {
  qaList.innerHTML = '';
  qaItems.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'qa-item';
    let html = `<div class="q">Q: ${escapeHtml(item.q)}</div><div class="a">A: ${escapeHtml(item.a)}</div>`;
    if (item.citations && item.citations.length > 0) {
      html += '<div class="citations"><span class="citation-label">引用来源：</span><ul>';
      for (const c of item.citations) {
        html += `<li><strong>${escapeHtml(c.docName)}</strong>: "${escapeHtml(c.snippet)}"</li>`;
      }
      html += '</ul></div>';
    }
    div.innerHTML = html;
    qaList.appendChild(div);
  });
}

async function loadQA() {
  if (!activeConversationId) return;
  const conv = await window.kbAPI.getConversation(activeConversationId);
  if (!conv) return;
  renderQAList(conv.qa);
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
  if (!activeConversationId) return;
  // 搜索相关文档块作为引用来源
  const citations = await window.kbAPI.searchChunks(q);
  await window.kbAPI.addQAToConversation(activeConversationId, { q, a, citations });
  qaQuestion.value = '';
  qaAnswer.value = '';
  loadQA();
  // 刷新对话列表以更新 qaCount
  const summaries = await window.kbAPI.getConversations();
  renderConvList(summaries);
});

document.getElementById('btn-new-conv').addEventListener('click', async () => {
  const name = prompt('输入对话名称：');
  if (!name || !name.trim()) return;
  const conv = await window.kbAPI.createConversation(name.trim());
  activeConversationId = conv.id;
  await loadConversations();
  loadQA();
});

async function loadIndexStats() {
  const stats = await window.kbAPI.getIndexStats();
  const { totalDocs, indexedDocs, totalChunks } = stats;
  const docRatio = totalDocs > 0 ? Math.round((indexedDocs / totalDocs) * 100) : 0;
  const statusText = document.getElementById('index-status-text');
  const detail = document.getElementById('index-detail');
  if (totalDocs === 0) {
    statusText.textContent = '就绪';
    statusText.style.color = '#a6adc8';
  } else if (docRatio < 100) {
    statusText.textContent = docRatio + '%';
    statusText.style.color = '#f9e2af';
  } else {
    statusText.textContent = '完成';
    statusText.style.color = '#a6e3a1';
  }
  detail.textContent = `文档: ${indexedDocs}/${totalDocs} | 块: ${totalChunks}`;
}

async function ensureAllIndexed() {
  const docs = await window.kbAPI.getDocuments();
  for (const doc of docs) {
    const chunks = await window.kbAPI.getDocumentChunks(doc.name);
    if (chunks.length === 0) {
      const content = await window.kbAPI.readDocument(doc.path);
      await window.kbAPI.chunkDocument({ name: doc.name, content });
    }
    const meta = await window.kbAPI.getDocumentMetadata(doc.name);
    if (!meta) {
      const content = await window.kbAPI.readDocument(doc.path);
      await window.kbAPI.extractMetadata({ name: doc.name, content });
    }
  }
}

async function loadRuntimeMetrics() {
  const metrics = await window.kbAPI.getRuntimeMetrics();
  document.getElementById('rt-log-count').textContent = metrics.logCount;
  document.getElementById('rt-error-count').textContent = metrics.errorCount;
  document.getElementById('rt-avg-ipc').textContent = metrics.avgIpcDuration + 'ms';
  document.getElementById('rt-uptime').textContent = metrics.uptime + 's';
}

await ensureAllIndexed();
await loadConversations();
loadDocList();
loadQA();
loadIndexStats();
loadRuntimeMetrics();
setInterval(loadRuntimeMetrics, 5000);
