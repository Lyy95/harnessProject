# Session Handoff — P05 准备阶段

## 会话时间
2026-05-20 (P05 Prep)

## 做了什么

### P05 分支创建与准备
基于 P04 完成后代码（commit `1e20be4`），创建三个分支用于角色分离实验：

| 分支 | 角色分工 | Harness 文件 |
|------|---------|-------------|
| `p05-single` | 单角色（自规划自实现自评） | AGENTS.md |
| `p05-gen-eval` | 生成者 + 评估者 | AGENTS.md + evaluator-rubric.md + sprint-contract.md |
| `p05-plan-gen-eval` | 规划者 + 生成者 + 评估者 | AGENTS.md + evaluator-rubric.md + sprint-contract.md |

### kb-015 多轮对话历史 —— 功能定义
- 已添加到 `feature_list.json`（status: not_started）
- 验收标准：创建/切换/删除对话、QA 隔离、持久化
- 数据模型：`conversations.json` [{ id, name, createdAt, qa: [...] }]

### 评估量表（evaluator-rubric.md）
- 11 个评分维度（总分 22）
- 涵盖：正确性(3)、可靠性(2)、可维护性(2)、用户体验(2)、范围纪律(1)、交接准备度(1)
- 结论：Accept ≥18 且无 0 分项

### Sprint Contract（sprint-contract.md）
- 明确 Done 定义（11 条验收项）
- 明确不在范围内（6 项）
- 数据模型和 IPC 通道建议
- 旧 qa.json 迁移策略

## 实验流程

所有三个分支做同一个功能升级（多轮对话历史），唯一变量是角色分工：

1. **p05-single**：一个 agent 包揽规划、实现、自查（弱 harness）
2. **p05-gen-eval**：生成者实现 → 评估者打分 → 修订循环（强 harness）
3. **p05-plan-gen-eval**：规划者拆解 → 生成者实现 → 评估者打分 → 修订循环（更强 harness）

## 要收集的数据

- 评估量表评分（各维度 + 总分）
- 缺陷检出数量
- 返工轮数和内容
- 评估者调优轮数
- 最终功能健壮性

## 当前分支

当前在 `p05-plan-gen-eval`。三个分支均已提交准备内容。

## 启动命令

```bash
./init.sh                      # 安装依赖 + 验证
bash scripts/check-architecture.sh  # 架构边界检查
npm start                      # 启动应用
```
