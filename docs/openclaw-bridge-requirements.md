# openclaw-bridge 设计需求

## 背景

当前 Nexus 已有 **oc-bridge**（Claude Code CLI 执行器），通过 WebSocket 连接 Nexus Gateway，接收任务并调用 Claude Code 执行代码开发任务。

现在需要新增 **openclaw-bridge**，让 OpenClaw agent（主 agent）也能注册到 Nexus Gateway 成为工作流执行节点。

## 为什么需要

1. **主 agent 需要参与工作流** — 决策节点、CC 确认托管、跨系统协调（创建仓库、配置 CI/CD）
2. **Nexus 可能迁移** — 当前服务器资源有限，Nexus 以后可能部署到别处，主 agent 需要远程接入
3. **完全自主运行** — 目标是工作流从提交到完成全链路自动化，人工只在必要时介入

## 现有 oc-bridge 参考

oc-bridge 代码位于 `bridges/oc-bridge/src/`，协议如下：

```
1. WebSocket 连接 → ws://<gateway>/api/gateway/ws
2. 注册 → { type: "register", bridgeId: "...", capabilities: [...] }
3. 收到任务 → { type: "task.submit", taskId: "...", prompt: "...", context: {...} }
4. 确认任务 → { type: "task.ack", taskId: "..." }
5. 上报进度 → { type: "task.progress", taskId: "...", data: {...} }
6. 完成任务 → { type: "task.complete", taskId: "...", result: {...} }
```

## 核心差异

| | oc-bridge | openclaw-bridge |
|--|-----------|-----------------|
| 执行者 | Claude Code CLI（无状态，一次性执行） | OpenClaw agent session（有状态，有记忆） |
| 执行方式 | `claude --print --verbose --output-format stream-json "prompt"` | 通过 OpenClaw 内部机制分派给 agent session |
| 任务类型 | 代码开发、文件操作 | 决策判断、用户沟通、任务协调 |
| 交互能力 | 无（单次 prompt→output） | 有（多轮对话、飞书通信） |
| 状态 | 无状态 | 有状态（记忆、会话上下文） |

## 设计要求

### 1. 协议层
- 复用现有 bridge WebSocket 协议（register/ack/progress/complete）
- 可以扩展新的 message type（如 `task.confirm` 需要人工确认时）

### 2. 任务类型支持
- **决策任务**：收到任务后分析，给出决策或选项列表，可能需要等用户确认
- **确认托管**：CC 执行过程中的确认请求（如文件写入确认），由主 agent 自动判断并回复
- **协调任务**：跨系统操作（创建 GitHub 仓库、配置 CI/CD、发消息通知等）
- **评审任务**：代码审查、方案评审

### 3. 会话管理
- 一个 openclaw-bridge 实例对应一个 agent session
- 任务执行可以跨多轮对话
- 需要处理任务排队（同时收到多个任务时的优先级）

### 4. 与 oc-bridge 的关系
- 两个 bridge 并行运行，各自注册到 Gateway
- Gateway 根据任务类型路由到不同 bridge（或工作流中明确指定）
- 共享同一个 Nexus 后端

### 5. 部署考虑
- openclaw-bridge 随 OpenClaw 运行（不需要单独进程？还是需要？）
- 需要能在 Nexus 迁移后仍然连接

## 交付物

1. 架构设计方案（含协议扩展、会话管理、任务路由）
2. 接口定义（新增/修改的 message type）
3. 模块拆分（代码结构）
4. 与现有系统的集成点

## 参考资料

- oc-bridge 代码：`bridges/oc-bridge/src/`
- Gateway 协议：`backend/app/services/gateway/ws_server.py`
- Bridge 管理器：`backend/app/services/gateway/bridge_manager.py`
- OpenClaw 文档：`/root/.openclaw/workspace/docs/`

## 补充需求（2026-03-18 23:16）

### 6. 通用性 — 所有 OpenClaw agent 都能注册

openclaw-bridge 不是一个专门的 bridge，而是一个**通用的 OpenClaw agent bridge**：

```
openclaw-bridge --agent main       → 注册为主 agent（协调/决策/用户沟通）
openclaw-bridge --agent architect  → 注册为架构师（评审/设计）
openclaw-bridge --agent writer     → 注册为写手（文案/文档）
openclaw-bridge --agent reviewer   → 注册为审查员（代码审查）
```

**注册时需要声明**：
- agent session key（用于路由到正确的 OpenClaw session）
- agent 能力/类型（用于 Gateway 任务路由）
- bridge 名称（用于 Nexus 前端显示）

**Gateway 任务路由**：
- 工作流中的 Agent 节点可以指定 `bridgeType: "openclaw"` + `agentId: "architect"`
- Gateway 根据 agentId 找到对应的 openclaw-bridge 实例，分发任务

**工作流示例**：
```
[Input: 产品需求]
  → [Agent: architect]        ← openclaw-bridge(architect)
  → [Fork]
    → [Agent: cc-bridge]      ← oc-bridge (Claude Code)
    → [Agent: cc-bridge]      ← oc-bridge (Claude Code)
  → [Join]
  → [Agent: reviewer]         ← openclaw-bridge(reviewer)
  → [Agent: writer]           ← openclaw-bridge(writer)
  → [Result Output]
```

**关键设计点**：
- 多个 openclaw-bridge 实例可以并行运行（每个对应一个 agent session）
- 每个实例有独立的状态持久化
- 任务按 agentId 路由，不是按 bridge 类型
- oc-bridge 和 openclaw-bridge 在 Gateway 看来是同级别的 bridge
