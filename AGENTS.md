# AGENTS.md

这个仓库面向长时运行的 coding agent 工作流。目标是构建一个 Electron 知识库应用。

## 项目概览

详细架构见 `ARCHITECTURE.md`，产品范围见 `PRODUCT.md`。

- **技术栈**：Node.js + Electron
- **启动命令**：`npm start`（即 `electron .`）
- **主进程**：`main.js` — 窗口创建、本地数据目录、IPC 处理
- **预加载**：`preload.js` — contextBridge 暴露 API
- **渲染进程**：`index.html` + `style.css` + `renderer.js`
- **数据目录**：`app.getPath('userData')/kb-data/`

## Electron 四层边界（不可违反）

```
┌── renderer.js ──────┐  ← 只能通过 window.kbAPI 访问后端
│  index.html         │    禁止: require('electron')、Node.js API
├── preload.js ───────┤  ← 只能用 contextBridge + ipcRenderer
│                     │    禁止: 暴露 Node API 直接给 renderer
├── main.js ──────────┤  ← 主进程，可用 Node.js + Electron API
│  IPC handlers       │    禁止: 直接操作 DOM
├── services/ ────────┤  ← 纯逻辑模块（如 logger、索引引擎）
│                     │    禁止: 依赖 electron 包
└─────────────────────┘
```

- **renderer.js** 中不得出现 `require('electron')`、`require('fs')`、`require('path')`
- **preload.js** 只能使用 contextBridge 和 ipcRenderer，不得暴露 `require` 给渲染进程
- **main.js** `webPreferences` 必须：`contextIsolation: true, nodeIntegration: false`
- 修改代码后运行 `bash scripts/check-architecture.sh` 确认无违规
- 违规检查脚本失败时，必须先修复违规再继续

## 开工流程

写代码前先做这些事：

1. 用 `pwd` 确认当前目录。
2. 读取 `claude-progress.md`，了解最新已验证状态和下一步。
3. 读取 `feature_list.json`，选择优先级最高的未完成功能。
4. 用 `git log --oneline -5` 看最近提交。
5. 运行 `./init.sh`。
6. 在开始新功能前，先跑必需的 smoke test 或端到端验证。

如果 `init.sh` 初始就失败，先修基础状态，不要在坏的起点上继续叠新功能。

## 工作规则

- 一次只做一个功能。
- 不要因为"代码已经写了"就把功能标记为完成。
- 除非为了消除当前 blocker 的窄范围修复，否则不要扩大到其他功能。
- 实现过程中不要悄悄改弱验证规则。
- 优先依赖仓库里的持久化文件，而不是聊天记录。

## 完成定义

一个功能只有在以下条件都满足时才算完成：

- 目标行为已经实现
- 要求的验证真的跑过
- 证据记录在 `feature_list.json` 或 `claude-progress.md`
- `./init.sh` 能正常运行

## P05 规划者-生成者-评估者工作流

本分支使用三角色分工：先规划、再实现、再评审。

### 会话 A 前半部分 — 规划者
1. 读取 `sprint-contract.md` 了解目标范围。
2. 读取现有 QA 面板代码（main.js, preload.js, renderer.js, index.html）。
3. 输出 `sprint-plan.md`，包含：
   - 需要修改/新增的文件清单
   - IPC handler 设计（通道名、参数、返回值）
   - 数据模型设计（conversations.json 结构）
   - UI 布局变更草图
   - 实施步骤和依赖关系（先做数据层，再做 IPC，最后 UI）
   - 潜在风险和边缘情况
4. 提交 `sprint-plan.md` 到仓库。

### 会话 A 后半部分 — 生成者
1. 读取 `sprint-plan.md` 按步骤实现。
2. 记录实现证据到 `feature_list.json`。
3. 更新 `session-handoff.md`。
4. 提交代码。**不要标记功能为完成**，等待评估者评审。

### 会话 B — 评估者
1. 用 `evaluator-rubric.md` 独立评分。
2. 对照 `sprint-plan.md` 检查实现是否与规划一致。
3. 记录发现的问题和建议修复。
4. 更新 `evaluator-rubric.md` 中的评分和修订记录。

### 修订循环
1. 生成者根据评估者反馈修复问题。
2. 评估者重新评分。
3. 至少完成一轮修订后，评估者给出 Accept/Block 结论。

## 收尾

结束会话前：

1. 更新 `claude-progress.md`
2. 更新 `feature_list.json`
3. **更新 `session-handoff.md`**：记录做了什么、没做什么、下一步是什么。这是下一轮会话接手的关键文件。
4. 记录仍未解决的风险或 blocker
5. 在工作处于安全状态后，用清晰的提交信息提交
6. 保证下一轮会话可以直接运行 `./init.sh`

## 会话接手

新会话开始时，按以下顺序恢复上下文：
1. 读 `session-handoff.md` 了解上次进度
2. 读 `feature_list.json` 了解功能状态
3. 读 `ARCHITECTURE.md` 了解项目结构
4. 读 `claude-progress.md` 了解历史
5. 运行 `./init.sh` 恢复可运行状态
