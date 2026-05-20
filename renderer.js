const docList = document.getElementById('doc-list');
const docViewer = document.getElementById('doc-viewer');
const docTitle = document.getElementById('doc-title');
const docContent = document.getElementById('doc-content');
const qaPanel = document.getElementById('qa-panel');
const qaList = document.getElementById('qa-list');
const qaQuestion = document.getElementById('qa-question');
const qaAnswer = document.getElementById('qa-answer');

let currentDoc = null;

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
  docContent.value = await window.kbAPI.readDocument(doc.path);
  loadDocList();
}

document.getElementById('btn-close-doc').addEventListener('click', () => {
  currentDoc = null;
  docViewer.classList.add('hidden');
  qaPanel.style.display = '';
  loadDocList();
});

document.getElementById('btn-save-doc').addEventListener('click', async () => {
  if (!currentDoc) return;
  await window.kbAPI.saveDocument({ name: currentDoc.name, content: docContent.value });
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
