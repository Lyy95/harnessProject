# P06 Sprint Plan — 运行时可观测性改进

> 分支: p06-improved | 基线: 29/40 (B-) | 目标: 35+/40 (B+)
> 基准测试: 5 个任务 (p06-benchmark.md)，核心目标 T-04 PASS (7/7)

---

## 实施顺序

kb-016 (生命周期) → kb-017 (IPC包装) → kb-018 (错误捕获) → kb-019 (仪表板UI) → kb-020 (消融验证)

依赖: kb-019 依赖 kb-016~018 的日志数据，其余独立

---

## kb-016: 应用生命周期监控

### 修改文件
- `main.js`: app.whenReady() 增加 app_ready 日志; createWindow() 增加 window_created 日志 (ready-to-show 事件); 新增 app_close 日志 (window-all-closed)

### 具体改动
1. app.whenReady() 回调中，在 createWindow() 之后记录 `logger.info('app_ready', {...})`
2. createWindow() 中 win.on('ready-to-show') 记录 `logger.info('window_created', {...})`
3. app.on('window-all-closed') 记录 `logger.info('app_close', {...})`

### 对应 T-04 标准
- 日志含 app_ready / window_created 生命周期事件

---

## kb-017: IPC 调用性能自动包装

### 修改文件
- `main.js`: 新增 wrapHandler(name, handler) 工具函数

### 具体改动
1. 新增 `wrapHandler(name, fn)` — 包装 IPC handler，记录开始时间 → 调用原始 handler → 计算 durationMs → logger.info('ipc_call', {handler, durationMs}) → 返回结果
2. 应用到全部 22 个 handler

### wrapHandler 设计
```js
function wrapHandler(name, fn) {
  return async (_event, ...args) => {
    const start = Date.now();
    const result = await fn(_event, ...args);
    const durationMs = Date.now() - start;
    logger.info('ipc_call', { handler: name, durationMs });
    return result;
  };
}
```
注意：需处理同步 handler（如 get-documents），用 Promise.resolve() 包装返回值

### 对应 T-04 标准
- 日志含 IPC 调用记录 (handler 名称 + durationMs)

---

## kb-018: 全局错误捕获

### 修改文件
- `main.js`: process.on('uncaughtException') + process.on('unhandledRejection')
- `preload.js`: window.onerror + window.onunhandledrejection 转发
- `main.js`: 新增 IPC handler report-renderer-error

### 具体改动
1. main.js 末尾注册:
   - `process.on('uncaughtException', (err) => logger.error('uncaught_exception', { message: err.message, stack: err.stack }))`
   - `process.on('unhandledRejection', (reason) => logger.error('unhandled_rejection', { reason }))`
2. preload.js 新增:
   - `reportRendererError: (error) => ipcRenderer.invoke('report-renderer-error', error)`
3. preload.js 暴露后，renderer.js 中通过 window.onerror 转发:
   - 但实际上需要在 preload.js 中设置 window 错误监听，因为 renderer.js 不能访问 Node API
   - 在 contextBridge 暴露之前加入 `window.addEventListener('error', ...)` 和 `window.addEventListener('unhandledrejection', ...)`，通过 ipcRenderer.invoke 转发
4. main.js 新增 handler:
   - `ipcMain.handle('report-renderer-error', (_event, error) => { logger.error('renderer_error', error); return { success: true }; })`

### 对应 T-04 标准
- 触发无效操作后日志有 ERROR 级别条目

---

## kb-019: 运行时指标仪表板 UI

### 修改文件
- `main.js`: 新增 get-runtime-metrics IPC handler
- `preload.js`: 暴露 getRuntimeMetrics API
- `index.html`: 左侧面板底部新增 #runtime-panel
- `style.css`: 新增 #runtime-panel 样式
- `renderer.js`: 新增 loadRuntimeMetrics() + setInterval 定时刷新

### 具体改动
1. main.js 新增 handler:
```js
let startTime = Date.now();
ipcMain.handle('get-runtime-metrics', async () => {
  const logFile = path.join(dataDir, 'kb.log');
  let logCount = 0, errorCount = 0, totalIpcDuration = 0, ipcCount = 0;
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(l => l.trim());
    logCount = lines.length;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.level === 'ERROR') errorCount++;
        if (entry.message === 'ipc_call' && entry.data && entry.data.durationMs) {
          totalIpcDuration += entry.data.durationMs;
          ipcCount++;
        }
      } catch (_) {}
    }
  }
  return {
    logCount,
    errorCount,
    avgIpcDuration: ipcCount > 0 ? Math.round(totalIpcDuration / ipcCount) : 0,
    uptime: Math.round((Date.now() - startTime) / 1000),
  };
});
```
2. index.html: #index-status 下方新增 #runtime-panel
3. style.css: 与 #index-status 风格一致
4. renderer.js: loadRuntimeMetrics() 调用 getRuntimeMetrics() 渲染，setInterval 每 5 秒刷新

### 对应 T-04 标准
- 可视化展示日志条目数、ERROR 数、IPC 平均耗时、运行时长

---

## kb-020: 消融实验框架

### 修改文件
- 新增 `scripts/ablation-check.sh`

### 具体内容
- 验证 kb-016~019 的证据链完整性
- 检查项:
  1. kb-016: kb.log 含 app_ready + window_created
  2. kb-017: kb.log 含 ipc_call + durationMs
  3. kb-018: process.on('uncaughtException') + report-renderer-error handler 已注册
  4. kb-019: get-runtime-metrics handler 已注册 + #runtime-panel 存在
- 输出 PASS/FAIL + 影响的 T-04 子项

---

## 文件修改汇总

| 文件 | kb-016 | kb-017 | kb-018 | kb-019 | kb-020 |
|------|:---:|:---:|:---:|:---:|:---:|
| main.js | ✓ | ✓ | ✓ | ✓ | |
| preload.js | | | ✓ | ✓ | |
| renderer.js | | | | ✓ | |
| index.html | | | | ✓ | |
| style.css | | | | ✓ | |
| scripts/ablation-check.sh | | | | | ✓ |
