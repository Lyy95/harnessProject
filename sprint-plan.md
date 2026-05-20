# Sprint Plan — kb-015 多轮对话历史

> 规划者：Claude（会话 A 前半部分）
> 日期：2026-05-20
> 分支：p05-plan-gen-eval

---

## 1. 需要修改/新增的文件清单

| 文件 | 操作 | 改动范围 |
|---|---|---|
| `main.js` | 修改 | 新增 5 个 IPC handler（conversation CRUD）+ 数据迁移逻辑 + 辅助读写函数 |
| `preload.js` | 修改 | 新增 5 个 API 暴露方法；**保留** `getQA`/`addQA` 向后兼容（标记 deprecated，内部转发到活跃对话） |
| `renderer.js` | 修改 | 新增 conversation 状态管理 + UI 事件绑定；改造 `loadQA()` / `btn-add-qa` 使用活跃对话 |
| `index.html` | 修改 | QA 面板 header 区域新增对话选择器 DOM 结构 |
| `style.css` | 修改 | 新增对话选择器、对话列表项、当前活跃标识的样式 |
| `scripts/check-architecture.sh` | 无修改 | 不改动，但实施后必须运行通过 |

---

## 2. IPC Handler 设计

### 2.1 新增 Handler

| 通道名 | 方向 | 参数 | 返回值 | 说明 |
|---|---|---|---|---|
| `create-conversation` | renderer→main | `{ name: string }` | `Conversation` | 创建新对话，name 为空时默认 "未命名对话" |
| `get-conversations` | renderer→main | 无 | `ConversationSummary[]` | 返回所有对话摘要（不含 qa 数组，减少数据传输） |
| `get-conversation` | renderer→main | `{ id: string }` | `Conversation \| null` | 获取单个对话完整数据（含 qa 数组） |
| `add-qa-to-conversation` | renderer→main | `{ conversationId: string, qa: QAItem }` | `Conversation` | 向指定对话添加 QA，返回更新后的对话 |
| `delete-conversation` | renderer→main | `{ id: string }` | `{ success: boolean }` | 删除对话及其所有 QA |

### 2.2 保留旧 Handler（兼容期）

- `get-qa`：保留，内部改为返回当前活跃对话的 QA 列表（如果 conversations.json 不存在则回退读 qa.json）
- `add-qa`：保留，内部改为向 "默认对话" 添加 QA

> 评估者注意：旧 handler 保留是为了不破坏已有的文档面板功能引用。如果确认无其他引用，可在后续 sprint 移除。

### 2.3 数据迁移触发

在 `get-conversations` 首次调用时（或 `ensureDataDir()` 阶段）检查：
- 如果 `conversations.json` 不存在但 `qa.json` 有数据 → 自动创建 "默认对话"，将 `qa.json` 数据迁入
- 迁移完成后保留 `qa.json` 不删除（作为备份），但后续所有读写走 `conversations.json`

---

## 3. 数据模型设计

### 3.1 文件位置

```
{userData}/kb-data/conversations.json
```

### 3.2 类型定义

```typescript
// 完整对话对象（存储在 conversations.json 中）
interface Conversation {
  id: string;            // crypto.randomUUID() 生成
  name: string;           // 用户输入的对话名称
  createdAt: string;      // ISO-8601 时间戳
  qa: QAItem[];           // 该对话的问答历史
}

// 问答条目
interface QAItem {
  q: string;              // 问题
  a: string;              // 回答
  citations?: Citation[]; // 引用来源（来自 kb-011）
}

// 引用来源
interface Citation {
  docName: string;
  snippet: string;
  chunkId: string;
  score: number;
}

// 对话摘要（get-conversations 返回，不含 qa）
interface ConversationSummary {
  id: string;
  name: string;
  createdAt: string;
  qaCount: number;        // 问答数量，用于列表展示
}
```

### 3.3 文件格式

```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "默认对话",
    "createdAt": "2026-05-20T10:00:00.000Z",
    "qa": [
      {
        "q": "什么是 Electron？",
        "a": "Electron 是一个使用前端技术构建桌面应用的框架。",
        "citations": [
          {
            "docName": "notes.txt",
            "snippet": "Electron is a framework for building desktop apps...",
            "chunkId": "...",
            "score": 1
          }
        ]
      }
    ]
  }
]
```

---

## 4. 旧数据迁移策略

### 4.1 触发条件

在 `main.js` 的 `ensureDataDir()` 中，初始化数据目录后执行 `migrateIfNeeded()`：

```
if conversations.json 不存在:
    if qa.json 存在 且 非空数组:
        创建 conversations.json，内容为:
        [
          {
            id: crypto.randomUUID(),
            name: "默认对话",
            createdAt: new Date().toISOString(),
            qa: <qa.json 的全部内容>
          }
        ]
        记录 logger.info('migrate_qa_to_conversations', { itemCount })
    else:
        创建空的 conversations.json: []
```

### 4.2 迁移后行为

- `qa.json` 保留不删除（人工可检查备份）
- 所有新 QA 写入 `conversations.json`
- `qa.json` 不再被任何写入操作修改

### 4.3 无旧数据场景

- `conversations.json` 不存在且 `qa.json` 也不存在（或为空）→ 创建空 `conversations.json: []`
- 首次启动时 UI 检测到 conversations 为空 → 自动调用 `create-conversation({ name: "默认对话" })`

---

## 5. UI 布局变更

### 5.1 当前 QA 面板结构

```
┌──────────────────────────┐
│ 问答面板                  │  ← panel-header
├──────────────────────────┤
│                          │
│  QA 列表                 │  ← qa-list
│                          │
├──────────────────────────┤
│ [问题输入] [回答输入] [添加] │  ← qa-input-area
└──────────────────────────┘
```

### 5.2 目标 QA 面板结构

```
┌──────────────────────────┐
│ 问答面板    [+ 新建对话]   │  ← panel-header（保持）
├──────────────────────────┤
│ ▼ 默认对话 (3)     [删除] │  ← conversation-selector（新增）
│   其他对话 (1)            │
│   研究笔记 (0)            │
├──────────────────────────┤
│                          │
│  QA 列表                 │  ← qa-list（保持）
│  （仅显示活跃对话的QA）    │
│                          │
├──────────────────────────┤
│ [问题输入] [回答输入] [添加] │  ← qa-input-area（保持）
└──────────────────────────┘
```

### 5.3 新增 DOM 元素

在 `index.html` 的 `#qa-panel` 内，`#qa-list` 上方插入：

```html
<div id="conversation-selector">
  <div id="conv-list"></div>
  <button id="btn-new-conv">+ 新建对话</button>
</div>
```

### 5.4 交互行为

- **对话列表**：垂直排列，每行显示 `对话名称 (问答数)`，当前活跃对话高亮（`.active`）
- **切换对话**：点击非活跃对话行 → 设置该对话为活跃，刷新 QA 列表
- **新建对话**：点击 "+ 新建对话" → `prompt("输入对话名称：")` → 创建并切换到新对话
- **删除对话**：每行末尾有删除按钮（`.danger` 样式），点击 → `confirm()` → 删除。如果删除的是活跃对话，自动切换到第一个剩余对话（若无剩余则自动创建 "默认对话"）
- **对话选择器默认折叠**：如果只有 1 个对话且名称是 "默认对话"，选择器可考虑简化显示（可选优化）

---

## 6. 实施步骤和依赖关系

按依赖排序，先底层后上层。每一步说明：改哪个文件、做什么、为什么。

### 步骤 1：数据层 — 读写 conversations.json

**文件**：`main.js`

**做什么**：
- 新增 `readConversations()` 辅助函数：读取并解析 `conversations.json`，文件不存在返回 `[]`，解析失败返回 `[]` 并 log error
- 新增 `writeConversations(data)` 辅助函数：将数据写入 `conversations.json`

**为什么先做**：所有后续 IPC handler 都依赖这两个函数，是最底层的数据访问。

---

### 步骤 2：数据迁移 — migrateIfNeeded

**文件**：`main.js`

**做什么**：
- 在 `ensureDataDir()` 末尾调用 `migrateIfNeeded()`
- `migrateIfNeeded()` 逻辑：检查 `conversations.json` 是否存在 → 不存在则检查 `qa.json` 是否有数据 → 有数据则创建 "默认对话" 包装 → 写入 `conversations.json`
- 记录 logger.info 迁移事件

**为什么第二步**：必须在任何 conversation IPC handler 调用前完成迁移，确保数据一致。

---

### 步骤 3：IPC Handler — create-conversation + get-conversations

**文件**：`main.js`

**做什么**：
- 实现 `create-conversation` handler：
  - 参数 `{ name }`，name 为空/空白时默认 "未命名对话"
  - 生成 UUID、ISO 时间戳，创建 `{ id, name, createdAt, qa: [] }`
  - 追加到 conversations 数组，写入文件
  - 返回完整 conversation 对象
  - 记录 logger.info
- 实现 `get-conversations` handler：
  - 读取 conversations，返回摘要数组（去掉 qa，添加 qaCount）
  - 如果 conversations 为空且从未迁移过，触发迁移后再返回

**为什么第三步**：最基本的 CRUD 操作，创建和列表是后续 UI 的基础。

---

### 步骤 4：IPC Handler — get-conversation + add-qa-to-conversation + delete-conversation

**文件**：`main.js`

**做什么**：
- 实现 `get-conversation` handler：
  - 按 id 查找并返回完整对话（含 qa），未找到返回 null
- 实现 `add-qa-to-conversation` handler：
  - 按 conversationId 查找对话，追加 qa 条目
  - 写入文件，返回更新后的对话
  - 记录 logger.info
- 实现 `delete-conversation` handler：
  - 按 id 过滤删除，写入文件
  - 返回 `{ success: true }`
  - 记录 logger.info

**为什么第四步**：依赖步骤 1 的读写函数，是完整的 conversation CRUD。

---

### 步骤 5：Preload — 暴露新 API

**文件**：`preload.js`

**做什么**：
- 在 `contextBridge.exposeInMainWorld('kbAPI', { ... })` 中新增 5 个方法：
  - `createConversation: (name) => ipcRenderer.invoke('create-conversation', { name })`
  - `getConversations: () => ipcRenderer.invoke('get-conversations')`
  - `getConversation: (id) => ipcRenderer.invoke('get-conversation', { id })`
  - `addQAToConversation: (conversationId, qa) => ipcRenderer.invoke('add-qa-to-conversation', { conversationId, qa })`
  - `deleteConversation: (id) => ipcRenderer.invoke('delete-conversation', { id })`

**为什么第五步**：preload 是 renderer 和 main 之间的桥梁，必须在 UI 代码前就位。

---

### 步骤 6：UI 结构 — index.html 新增对话选择器 DOM

**文件**：`index.html`

**做什么**：
- 在 `#qa-panel` 内部、`#qa-list` 之前插入 `#conversation-selector` 区域
- 包含 `#conv-list`（对话列表容器）和 `#btn-new-conv`（新建按钮）

**为什么第六步**：DOM 结构必须存在，renderer.js 才能操作。

---

### 步骤 7：样式 — style.css 对话选择器样式

**文件**：`style.css`

**做什么**：
- 新增 `#conversation-selector` 样式：内边距、背景色、底部边框分隔
- 新增 `.conv-item` 样式：列表项、hover 效果、padding
- 新增 `.conv-item.active` 样式：高亮当前活跃对话（参照 `#doc-list li.active`）
- 新增 `.conv-item .conv-name`：名称文字样式
- 新增 `.conv-item .conv-count`：问答数量灰色小字
- 新增 `.conv-item .conv-delete`：删除按钮（小号 danger）
- 新增 `#btn-new-conv` 样式：小号按钮

**为什么第七步**：样式在 UI 逻辑之前准备好。

---

### 步骤 8：渲染逻辑 — renderer.js 对话管理

**文件**：`renderer.js`

**做什么**：
- 新增状态变量：`activeConversationId`（当前活跃对话 ID）
- 新增函数 `loadConversations()`：
  - 调用 `getConversations()` 获取摘要列表
  - 渲染 `#conv-list`：每个对话一行 `.conv-item`，显示名称 + QA 数量 + 删除按钮
  - 标记 `activeConversationId` 对应的项为 `.active`
  - 如果列表为空，自动调用 `createConversation({ name: "默认对话" })` 并设为活跃
- 新增函数 `switchConversation(id)`：
  - 设置 `activeConversationId = id`
  - 调用 `getConversation(id)` 获取完整数据
  - 更新 QA 列表渲染
  - 刷新对话列表高亮
- **改造 `loadQA()`**：
  - 不再调用 `getQA()`，改为调用 `getConversation(activeConversationId)` 获取 QA 数组
  - 渲染逻辑不变
- **改造 `btn-add-qa` 事件**：
  - 不再调用 `addQA()`，改为调用 `addQAToConversation(activeConversationId, { q, a, citations })`
  - 添加后刷新当前对话的 QA 列表和对话列表（更新 qaCount）
- 新增事件绑定：
  - `#btn-new-conv` click → `prompt("输入对话名称：")` → `createConversation(name)` → `switchConversation(newId)`
  - `.conv-item` click（非删除按钮）→ `switchConversation(id)`
  - `.conv-delete` click → `confirm("确定删除？")` → `deleteConversation(id)` → 若删除的是活跃对话则切换到第一个剩余对话，无剩余则创建 "默认对话"
- **改造启动流程**：
  - `ensureAllIndexed()` 之后新增 `await loadConversations()`，初始化活跃对话和 QA 列表
  - 移除直接调用 `loadQA()`

**为什么第八步**：UI 逻辑最后实现，依赖前面所有层就位。

---

## 7. 边缘情况和风险

| 场景 | 处理策略 |
|---|---|
| **conversations.json 文件不存在** | `readConversations()` 返回 `[]`，UI 检测为空后自动创建 "默认对话" |
| **conversations.json 内容损坏（JSON 解析失败）** | `readConversations()` catch 后返回 `[]`，记录 logger.error，UI 按空列表处理 |
| **用户创建空白名称的对话** | `main.js` 中 `create-conversation` handler 检查 name.trim()，为空则设为 "未命名对话" |
| **删除当前活跃对话** | 前端逻辑：删除后自动切换到第一个剩余对话；若已无对话，自动创建 "默认对话" |
| **并发快速切换对话** | 每次 `switchConversation` 使用当前 `activeConversationId` 发起异步请求，渲染前检查 id 是否仍匹配（防止旧请求覆盖新状态） |
| **qa.json 有数据但 conversations.json 已存在** | 迁移只执行一次（检查 conversations.json 不存在才迁移），不会重复迁移 |
| **用户有旧 qa.json 但 conversations.json 已被手动创建为空** | 不做迁移（conversations.json 已存在即跳过）— 除非用户手动删除 conversations.json |
| **删除对话后磁盘写入失败** | `writeConversations` 中的 fs.writeFileSync 会抛异常，IPC handler 不 catch，让前端收到错误；建议后续 sprint 加全局错误处理 |
| **对话名称含特殊字符（XSS）** | `renderer.js` 渲染对话名称时使用 `escapeHtml()` 处理（已有工具函数） |
| **空对话（qa: []）的正常显示** | 对话列表中 qaCount 显示 0，QA 列表区域为空（显示空状态或仅不渲染条目） |
| **初始化时 conversations.json 为空数组** | `loadConversations()` 检测到空数组，自动创建 "默认对话" |
| **旧 IPC（get-qa / add-qa）向后兼容** | 保留这两个 handler，内部默认操作 "默认对话"（id 匹配 name === "默认对话" 的第一个对话），确保不破坏现有调用链 |
| **Electron 安全边界** | 所有对话数据读写只在 main 进程进行，renderer 不能直接访问文件系统 |

---

## 8. 验证清单（实施后检查）

1. `./init.sh` 正常运行
2. `bash scripts/check-architecture.sh` 通过（0 违规）
3. 创建对话 → 名称出现在选择器列表中
4. 在对话中添加多个 QA → 所有 QA 按顺序显示
5. 切换对话 → QA 列表正确切换
6. 删除对话 → 对话及 QA 被移除，列表更新
7. 重启应用 → 所有对话和 QA 完整恢复
8. 首次启动（无 conversations.json 但有 qa.json） → 自动迁移到 "默认对话"
9. `conversations.json` 数据结构符合规范
