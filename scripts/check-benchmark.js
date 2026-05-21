// scripts/check-benchmark.js
// P06 基准任务集 — 文件系统验证脚本
// 用法: node scripts/check-benchmark.js
// 在完成手动 GUI 操作后运行，验证文件层面的通过标准

const fs = require('fs');
const path = require('path');
const os = require('os');

const dataDir = path.join(
  os.platform() === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'harnessproject', 'kb-data')
    : path.join(os.homedir(), 'Library', 'Application Support', 'harnessproject', 'kb-data'),
);

let passed = 0;
let failed = 0;
const results = [];

function check(label, fn) {
  try {
    const ok = fn();
    const status = ok ? 'PASS' : 'FAIL';
    if (ok) passed++; else failed++;
    results.push({ status, label });
    console.log(`  [${status}] ${label}`);
  } catch (e) {
    failed++;
    results.push({ status: 'FAIL', label, error: e.message });
    console.log(`  [FAIL] ${label} — ERROR: ${e.message}`);
  }
}

console.log('\n=== P06 Benchmark — 文件系统验证 ===');
console.log(`数据目录: ${dataDir}\n`);

// --- T-02: 索引构建验证 ---
console.log('T-02: 构建或刷新索引');
check('chunks/ 目录存在', () => fs.existsSync(path.join(dataDir, 'chunks')));
check('chunks/ 下有 .json 文件', () => {
  const dir = path.join(dataDir, 'chunks');
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(f => f.endsWith('.json'));
});
check('至少一个 chunk 文件包含分块数组', () => {
  const dir = path.join(dataDir, 'chunks');
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return false;
  const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
  return Array.isArray(data) && data.length > 0;
});
check('metadata/ 目录存在且有文件', () => {
  const dir = path.join(dataDir, 'metadata');
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(f => f.endsWith('.json'));
});
check('metadata 文件包含 idf 字段', () => {
  const dir = path.join(dataDir, 'metadata');
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return false;
  const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
  return data && typeof data.idf !== 'undefined';
});

// --- T-03: 引用验证 ---
console.log('\nT-03: 带引用的问答');
check('conversations.json 存在', () =>
  fs.existsSync(path.join(dataDir, 'conversations.json')));
check('conversations.json 中有包含 citations 的 QA 条目', () => {
  const convFile = path.join(dataDir, 'conversations.json');
  if (!fs.existsSync(convFile)) return false;
  const convs = JSON.parse(fs.readFileSync(convFile, 'utf-8'));
  return convs.some(c =>
    Array.isArray(c.qa) && c.qa.some(q =>
      Array.isArray(q.citations) && q.citations.length > 0
    )
  );
});
check('citations 包含非空 docName 和 snippet', () => {
  const convFile = path.join(dataDir, 'conversations.json');
  if (!fs.existsSync(convFile)) return false;
  const convs = JSON.parse(fs.readFileSync(convFile, 'utf-8'));
  for (const c of convs) {
    for (const q of (c.qa || [])) {
      for (const cit of (q.citations || [])) {
        if (cit.docName && cit.snippet && cit.snippet.length > 0) return true;
      }
    }
  }
  return false;
});

// --- T-04: 运行时日志验证 ---
console.log('\nT-04: 运行时日志（可观测性）');
const logFile = path.join(dataDir, 'kb.log');
check('kb.log 存在且非空', () => {
  if (!fs.existsSync(logFile)) return false;
  return fs.statSync(logFile).size > 0;
});
check('日志条目为合法 JSON，包含 timestamp/level/message', () => {
  if (!fs.existsSync(logFile)) return false;
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length === 0) return false;
  const entry = JSON.parse(lines[0]);
  return entry.timestamp && entry.level && entry.message;
});
check('包含 app_start 事件', () => {
  if (!fs.existsSync(logFile)) return false;
  const content = fs.readFileSync(logFile, 'utf-8');
  return content.includes('app_start');
});
check('日志条目数量 ≥ 3', () => {
  if (!fs.existsSync(logFile)) return false;
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(l => l.trim());
  return lines.length >= 3;
});

// --- T-04 improved 标准（P06 新增，baseline 预期 FAIL）---
console.log('\nT-04 (improved 标准 — baseline 预期 FAIL):');
check('[P06目标] 日志包含 IPC 调用计时 durationMs', () => {
  if (!fs.existsSync(logFile)) return false;
  const content = fs.readFileSync(logFile, 'utf-8');
  return content.includes('durationMs');
});
check('[P06目标] 日志包含生命周期事件 app_ready 或 window_created', () => {
  if (!fs.existsSync(logFile)) return false;
  const content = fs.readFileSync(logFile, 'utf-8');
  return content.includes('app_ready') || content.includes('window_created');
});

// --- T-05: 持久化验证（重启后文件仍在）---
console.log('\nT-05: 重启后状态');
check('documents/ 目录有文档文件', () => {
  const dir = path.join(dataDir, 'documents');
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).length > 0;
});
check('conversations.json 有数据（非空数组）', () => {
  const f = path.join(dataDir, 'conversations.json');
  if (!fs.existsSync(f)) return false;
  const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
  return Array.isArray(data) && data.length > 0;
});
check('索引文件在重启后仍存在', () => {
  const dir = path.join(dataDir, 'chunks');
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(f => f.endsWith('.json'));
});

// --- 汇总 ---
console.log('\n=== 汇总 ===');
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
const score = passed / (passed + failed);
console.log(`得分率: ${(score * 100).toFixed(1)}%`);

// 输出 T-04 baseline 实际得分（4 项中通过多少）
const t04Items = results.filter(r =>
  r.label.startsWith('kb.log') ||
  r.label.startsWith('日志条目') ||
  r.label.startsWith('包含 app_start') ||
  r.label.startsWith('日志条目数量')
);
const t04Pass = t04Items.filter(r => r.status === 'PASS').length;
console.log(`\nT-04 baseline 得分: ${t04Pass}/4`);
if (t04Pass === 4) console.log('  → T-04 PASS（baseline 标准）');
else console.log('  → T-04 FAIL（baseline 标准）');

console.log('\n注：T-01（导入文档）和 T-02（GUI操作）需人工确认。');
console.log('    T-04 [P06目标] 项目在 baseline 预期 FAIL，这是正常的。\n');
