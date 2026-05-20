# ARCHITECTURE.md — Electron 知识库应用

## 项目概览

用 Electron 构建的桌面知识库应用，左侧文档列表，右侧内容/问答面板。支持本地文件导入与持久化。

## 技术栈

- Electron v42 — 桌面框架
- Node.js (主进程) — 文件系统、IPC
- 原生 JS (渲染进程) — 无框架，纯 DOM 操作
- contextBridge + ipcRenderer — 安全的进程间通信

## 目录结构

```
main.js          — 主进程：窗口管理 + IPC handlers + 数据目录
preload.js       — 预加载：contextBridge 暴露 kbAPI
index.html       — UI 布局
renderer.js      — 渲染进程：DOM 交互逻辑
style.css        — 样式（Catppuccin Mocha 深色主题）
package.json     — npm start → electron .
init.sh          — 一键恢复可运行状态
```

## 分层架构

```
┌─────────────────────────────────┐
│  渲染进程 (renderer.js)          │  ← DOM 操作、用户交互
│  index.html + style.css         │
├─────────────────────────────────┤
│  preload.js (contextBridge)     │  ← 安全 API 暴露层
├─────────────────────────────────┤
│  main.js (主进程)                │  ← IPC handlers、文件 I/O
│  ├── 窗口管理 (BrowserWindow)    │
│  ├── IPC handlers               │
│  └── 数据目录 (ensureDataDir)    │
├─────────────────────────────────┤
│  文件系统                        │
│  %APPDATA%/harnessproject/      │
│    └── kb-data/                 │
│        ├── documents/  (*.txt)  │
│        ├── qa.json              │
│        └── imports.json         │
└─────────────────────────────────┘
```

## 数据流

1. 用户操作 → renderer.js 调用 `window.kbAPI.xxx()`
2. preload.js 通过 `ipcRenderer.invoke` 转发到主进程
3. main.js IPC handler 处理请求，读写文件系统
4. 结果通过 IPC 返回渲染进程，更新 DOM

## 数据目录

- 位置：`app.getPath('userData') + '/kb-data/'`
- Windows: `%APPDATA%/Roaming/harnessproject/kb-data/`
- 文档存储：`documents/` 子目录，每文件一个 .txt
- 问答存储：`qa.json`（JSON 数组）
- 导入日志：`imports.json`（JSON 数组）

## 启动命令

```bash
./init.sh          # 安装依赖 + 验证
npm start          # 启动 Electron
```
