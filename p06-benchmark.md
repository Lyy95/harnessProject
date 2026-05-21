# P06 基准任务集与评分表

> **冻结版本**：本文件在跑任何 agent 之前定稿，跑的过程中不修改。
> 定稿时间：2026-05-21（P06 准备阶段）
> 基准 commit：00b8431

---

## 说明

- 每项任务包含：**操作步骤**（可复现）、**通过标准**（二值：PASS / FAIL）
- 评分列：**baseline 得分**（P05 终态）和 **improved 得分**（P06 实现后）在运行前已锁定 0 分，运行后人工填写
- 评分规则：PASS = 1 分，FAIL = 0 分；满分 5 分
- 禁止在运行期间修改任务步骤或通过标准

---

## 任务 T-01：导入一篇文档

### 操作步骤

1. 启动应用（`npm start`）
2. 点击左侧面板"导入文档"按钮
3. 在系统文件对话框中选择任意 `.txt` 文件（测试文件：`test-doc.txt`，内容不少于 50 字）
4. 确认文件出现在左侧文档列表中
5. 点击该文档，在右侧内容区看到文档内容

### 通过标准

- [ ] 文件对话框正常弹出
- [ ] 导入后文档名出现在文档列表（无需刷新）
- [ ] 点击文档名可在右侧面板读取到文件内容
- [ ] `kb.log` 中出现 `import_document` 日志条目（可用文本编辑器打开 `%APPDATA%/Roaming/harnessproject/kb-data/kb.log` 验证）

**全部满足 → PASS（1分）；任一不满足 → FAIL（0分）**

| 运行 | 结果 | 备注 |
|------|------|------|
| baseline | PASS | test-doc.txt 导入成功，kb.log 含 import_document |
| improved | PASS | 同 baseline；额外含 ipc_call(handler=import-document) 自动计时 |

---

## 任务 T-02：构建或刷新索引

### 操作步骤

1. 在 T-01 导入文档后（或应用已有至少 2 篇文档的状态下）
2. 点击"刷新索引"按钮（或重启应用触发自动索引）
3. 等待索引完成（无错误弹窗）
4. 检查 `%APPDATA%/Roaming/harnessproject/kb-data/` 目录下的 `chunks/` 和 `metadata/` 子目录

### 通过标准

- [ ] 操作完成后无错误消息/弹窗
- [ ] `chunks/` 目录下存在以文档名命名的 `.json` 文件，内容为分块数组
- [ ] `metadata/` 目录下存在对应的 `.json` 文件，内容包含 `idf` 字段
- [ ] `kb.log` 中出现 `build_index` 或 `chunk_document` 日志条目

**全部满足 → PASS（1分）；任一不满足 → FAIL（0分）**

| 运行 | 结果 | 备注 |
|------|------|------|
| baseline | PASS | chunks/test-doc.txt.json 与 metadata/test-doc.txt.json 均生成，含 idf 字段 |
| improved | PASS | 同 baseline；ipc_call(handler=chunk-document) 含 durationMs |

---

## 任务 T-03：回答一个带引用的问题

### 操作步骤

1. 确保索引已构建（T-02 通过后的状态）
2. 在问答面板的"问题"输入框填入："Electron 是什么？"
3. 在"回答"输入框填入："Electron 是用于构建桌面应用的框架。"
4. 点击"添加"按钮
5. 观察 QA 列表中该条目是否显示了来源引用（docName 和 snippet）

### 通过标准

- [ ] QA 条目成功添加到列表，无报错
- [ ] 该 QA 条目下方显示至少 1 个引用来源（包含文档名称）
- [ ] 引用来源的 snippet 内容与文档内容相关（非空字符串）
- [ ] `conversations.json` 文件中该 QA 条目包含非空 `citations` 数组

**全部满足 → PASS（1分）；任一不满足 → FAIL（0分）**

| 运行 | 结果 | 备注 |
|------|------|------|
| baseline | PASS | conversations.json 中 QA 含非空 citations 数组（snippet+docName） |
| improved | PASS | 同 baseline；ipc_call(handler=search-chunks) 自动计时 |

---

## 任务 T-04：查看运行时日志确认可观测性

### 操作步骤

1. 启动应用并执行任意操作（如：浏览文档列表、添加一条 QA）
2. 打开文件管理器，导航至 `%APPDATA%/Roaming/harnessproject/kb-data/`
3. 用文本编辑器打开 `kb.log`
4. 检查日志内容格式和覆盖范围

### 通过标准（baseline 版本）

- [ ] `kb.log` 文件存在且非空
- [ ] 每条日志为合法 JSON，包含 `timestamp`、`level`、`message` 字段
- [ ] 至少包含 `app_start` 事件（应用启动时记录）
- [ ] 日志条目数量 ≥ 3（反映多个操作被记录）

**baseline 标准：满足以上 4 项 → PASS**

### 通过标准（improved 版本，P06 目标）

额外要求（在 baseline 4 项基础上）：

- [ ] 日志中包含 IPC 调用记录（含 handler 名称和耗时 `durationMs`）
- [ ] 日志中包含 `app_ready` / `window_created` 等生命周期事件
- [ ] 如果发生过任何错误，日志中有 ERROR 级别条目（测试方法：手动触发一次无效操作）

**improved 标准：baseline 4 项 + improved 3 项全部满足 → PASS**

| 运行 | 结果 | 备注 |
|------|------|------|
| baseline | PASS | 4/4：kb.log 非空、JSON 合法、含 app_start、≥3 条 |
| improved | PASS | 7/7：baseline 4 项 + IPC durationMs(48 条) + app_ready/window_created + ERROR 级别(1 条 renderer_error) |

---

## 任务 T-05：关掉重开后状态仍在

### 操作步骤

1. 确保应用处于以下状态：
   - 文档列表有 ≥ 2 篇文档
   - 至少 1 个对话，对话内有 ≥ 1 条 QA（带引用）
2. 完全关闭应用（关闭窗口）
3. 重新启动应用（`npm start`）
4. 检查应用状态恢复情况

### 通过标准

- [ ] 关闭前的所有文档仍出现在文档列表中
- [ ] 对话列表中对话名称和数量与关闭前一致
- [ ] 打开对话后，QA 条目（含引用）完整保留
- [ ] 索引数据完整：重启后无需重新导入即可搜索（`search-chunks` IPC 返回结果）

**全部满足 → PASS（1分）；任一不满足 → FAIL（0分）**

| 运行 | 结果 | 备注 |
|------|------|------|
| baseline | PASS | 重启后文档/对话/QA/索引全部恢复 |
| improved | PASS | 同 baseline；额外含 app_close 日志条目记录关闭事件 |

---

## 汇总评分表

| 任务 | 描述 | baseline 得分 | improved 得分 | 变化 |
|------|------|:---:|:---:|:---:|
| T-01 | 导入一篇文档 | 1 | 1 | — |
| T-02 | 构建或刷新索引 | 1 | 1 | — |
| T-03 | 回答带引用的问题 | 1 | 1 | — |
| T-04 | 查看运行时日志（可观测性）| 1 (baseline 4/4) | 1 (improved 7/7) | 子项 +3/3 |
| T-05 | 关掉重开后状态仍在 | 1 | 1 | — |
| **合计** | | **5/5** | **5/5** | T-04 子项 4/4→7/7 |

---

## 测试用文件

执行 T-01 ~ T-05 时，使用固定测试文档以确保可复现性：

**文件名**：`test-doc.txt`
**内容**（在项目根目录创建，不提交）：

```
Electron 是一个使用 JavaScript、HTML 和 CSS 构建桌面应用程序的框架。
它将 Chromium 渲染引擎和 Node.js 运行时结合在一起。

知识库系统可以帮助用户管理和检索文档信息。
通过分块和 TF-IDF 算法，系统能够找到与问题最相关的文档片段。

本应用使用 contextBridge 确保渲染进程的安全隔离。
所有文件操作都在主进程中完成，渲染进程通过 IPC 通信。
```

---

## 运行记录

| 日期 | 运行者 | baseline 总分 | improved 总分 | 备注 |
|------|--------|:---:|:---:|------|
| 2026-05-21 | Claude Opus 4.6 | 5/5 | — | P06 baseline 阶段，commit 3e47fd7 |
| 2026-05-22 | Claude Opus 4.6 | — | 5/5 | P06 improved 阶段，kb-016~020 全部 passing；T-04 子项 4/4→7/7（日志总条 56，IPC 48，ERROR 1） |
