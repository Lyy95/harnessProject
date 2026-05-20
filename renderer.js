const docList = document.getElementById('doc-list');
const docViewer = document.getElementById('doc-viewer');
const docTitle = document.getElementById('doc-title');
const docContent = document.getElementById('doc-content');
const docDetail = document.getElementById('doc-detail');
const docDisplay = document.getElementById('doc-display');
const docMetaSize = document.getElementById('doc-meta-size');
const docMetaModified = document.getElementById('doc-meta-modified');
const btnEditToggle = document.getElementById('btn-edit-toggle');
const btnSaveDoc = document.getElementById('btn-save-doc');
const qaPanel = document.getElementById('qa-panel');
const qaList = document.getElementById('qa-list');
const qaQuestion = document.getElementById('qa-question');
const qaAnswer = document.getElementById('qa-answer');

let currentDoc = null;
let isEditing = false;

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

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showViewMode() {
  isEditing = false;
  docDetail.classList.remove('hidden');
  docContent.classList.add('hidden');
  btnEditToggle.textContent = '编辑';
  btnSaveDoc.style.display = 'none';
}

function showEditMode() {
  isEditing = true;
  docDetail.classList.add('hidden');
  docContent.classList.remove('hidden');
  btnEditToggle.textContent = '查看';
  btnSaveDoc.style.display = '';
}

btnEditToggle.addEventListener('click', () => {
  if (!currentDoc) return;
  if (isEditing) {
    docContent.value = docDisplay.textContent;
    showViewMode();
  } else {
    docContent.value = docDisplay.textContent;
    showEditMode();
  }
});

async function openDoc(doc) {
  currentDoc = doc;
  docViewer.classList.remove('hidden');
  qaPanel.style.display = 'none';
  docTitle.textContent = doc.name;

  const content = await window.kbAPI.readDocument(doc.path);
  const info = await window.kbAPI.getDocumentInfo(doc.path);
  docDisplay.textContent = content;
  docContent.value = content;
  docMetaSize.textContent = '大小: ' + formatSize(info.size);
  docMetaModified.textContent = '修改: ' + new Date(info.modified).toLocaleString('zh-CN');
  showViewMode();
  loadDocList();
}

document.getElementById('btn-close-doc').addEventListener('click', () => {
  currentDoc = null;
  isEditing = false;
  docViewer.classList.add('hidden');
  qaPanel.style.display = '';
  loadDocList();
});

btnSaveDoc.addEventListener('click', async () => {
  if (!currentDoc) return;
  await window.kbAPI.saveDocument({ name: currentDoc.name, content: docContent.value });
  docDisplay.textContent = docContent.value;
  const info = await window.kbAPI.getDocumentInfo(currentDoc.path);
  docMetaSize.textContent = '大小: ' + formatSize(info.size);
  docMetaModified.textContent = '修改: ' + new Date(info.modified).toLocaleString('zh-CN');
  showViewMode();
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

loadDocList();
loadQA();
