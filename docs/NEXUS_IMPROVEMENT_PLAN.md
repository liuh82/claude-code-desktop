# Nexus 改进方案设计

> 基于 CCDesk 项目端到端验证的 12 项不足，拆分为 4 个迭代
> 日期：2026-03-19

---

## 迭代一：P0 — 实时输出 + 结构化结果（最高优先级）

### 目标
消除任务执行黑盒，让用户实时看到 CC 在做什么、改了哪些文件。

### 任务列表

#### T1: oc-bridge 实时输出转发
**改动文件：**
- `bridges/oc-bridge/src/websocket/types.ts` — 新增 `TaskProgress` 消息类型
- `bridges/oc-bridge/src/websocket/connection.ts` — 发送 progress 消息
- `bridges/oc-bridge/src/agent/claude-code.ts` — stdout 每行实时转发

**设计：**
```typescript
// oc-bridge → Gateway 实时进度消息
interface TaskProgress {
  type: "task.progress";
  taskId: string;
  timestamp: number;
  eventType: "stdout" | "tool_use" | "tool_result" | "assistant" | "error";
  data: {
    // stdout: raw line
    // tool_use: { name, input_preview }
    // tool_result: { name, is_error }
    // assistant: text preview (前 200 字)
    // error: error message
    content: string;
  };
}
```

**实现要点：**
- `claude-code.ts` 的 stdout handler 中，每解析一行 stream-json 就调用 `onProgress` 回调
- `onProgress` 回调在 `task-manager.ts` 中通过 WebSocket 发送 `task.progress` 消息
- 不等待任务完成，实时推送（每行一个消息）

**验收标准：**
- CC 执行时，Gateway WebSocket 能收到 `task.progress` 消息
- 消息包含 `eventType` 和 `data.content`

---

#### T2: Gateway 实时输出 WebSocket 推送
**改动文件：**
- `backend/app/services/gateway/ws_server.py` — 新增 HTTP client 接收 bridge 消息并广播
- `backend/app/routers/gateway.py` — 新增 SSE 端点或 WS 端点给前端订阅

**设计：**
```
方案 A（推荐）：新增 SSE 端点
GET /api/gateway/tasks/{task_id}/stream → SSE
  - 后端从 bridge 收到 task.progress 后转发给所有 SSE 订阅者
  - 格式：event: tool_use\ndata: {"name":"Write","input":"/src/foo.rs"}\n\n

方案 B：复用现有 Gateway WebSocket
  - 前端连接 Gateway WS 后订阅 task_id
  - 后端广播 task.progress 到已订阅的前端连接
```

**验收标准：**
- `curl http://localhost:8082/api/gateway/tasks/{id}/stream` 能看到 SSE 事件
- 延迟 < 1s

---

#### T3: CC 输出解析器 — 结构化提取
**改动文件：**
- `bridges/oc-bridge/src/agent/output-parser.ts` — 新增文件

**设计：**
```typescript
interface StructuredResult {
  filesModified: Array<{ path: string; action: "created" | "edited" | "deleted" }>;
  commandsRun: Array<{ command: string; exitCode: number | null; duration?: number }>;
  errors: string[];
  summary: string; // 最后 result 消息的文本
  tokenUsage: { input: number; output: number; costUsd: number };
}

// 从 stream-json 行列表解析出结构化结果
function parseCcOutput(lines: string[]): StructuredResult
```

**实现要点：**
- 从 `type: "assistant"` 消息提取 tool_use（Write/Edit/Bash/Glob/Grep）
- 从 `type: "user"` 消息提取 tool_result
- 从 `type: "result"` 消息提取 summary 和 token usage
- 从 Write tool input 提取 file_path → filesModified
- 从 Bash tool input 提取 command → commandsRun

**验收标准：**
- 能从 CC 输出中正确提取文件修改列表
- 能提取 token 使用量和费用

---

#### T4: 结构化结果持久化
**改动文件：**
- `backend/app/models/gateway.py` — TaskRecord 新增 `result_data` JSON 列
- `backend/app/models/gateway_schemas.py` — TaskInfo 新增 `result_data` 字段
- `bridges/oc-bridge/src/websocket/types.ts` — `TaskComplete` 新增 `resultData`
- `bridges/oc-bridge/src/agent/claude-code.ts` — 完成时解析并发送结构化结果

**验收标准：**
- `GET /api/gateway/tasks/{id}` 返回 `result_data` 字段，包含 files_modified、commands_run 等

---

#### T5: 前端任务详情实时输出
**改动文件：**
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 新增实时输出标签页
- `frontend/src/stores/useTaskStore.ts` — 新增 SSE 连接逻辑

**设计：**
- 任务详情页新增"实时输出"标签页
- 连接 SSE 端点，实时渲染 CC 输出
- tool_use 渲染为可折叠卡片（工具名 + 参数预览）
- assistant 文本渲染为 Markdown
- 自动滚动到底部

**验收标准：**
- 打开正在运行的任务详情页，能看到 CC 实时输出
- 文件修改列表实时更新

---

### 迭代一 CC 执行 Prompt

```
Read CLAUDE.md and docs/architecture.md first.

Implement Iteration 1 for Nexus — Real-time output streaming + structured results.

Project: /root/.openclaw/workspace/agent-orchestration

Tasks:

1. bridges/oc-bridge/src/agent/output-parser.ts — CC stream-json parser:
   - parseCcOutput(lines: string[]) -> StructuredResult
   - Extract: filesModified (Write/Edit tool), commandsRun (Bash tool), errors, summary, tokenUsage
   - StructuredResult interface with all fields

2. bridges/oc-bridge/src/websocket/types.ts — Add TaskProgress message type:
   - type: "task.progress", taskId, timestamp, eventType ("stdout"|"tool_use"|"tool_result"|"assistant"|"error"), data: { content }
   - Add resultData to TaskComplete message

3. bridges/oc-bridge/src/agent/claude-code.ts — Real-time progress:
   - Parse each stdout line as stream-json
   - Extract eventType (assistant/tool_use/tool_result/error/done)
   - Call onProgress callback with structured progress info
   - On completion, parse full output and send StructuredResult

4. bridges/oc-bridge/src/task/task-manager.ts — Forward progress via WebSocket

5. backend/app/models/gateway.py — Add result_data TEXT column to gateway_tasks

6. backend/app/models/gateway_schemas.py — Add result_data field to TaskInfo

7. backend/app/services/gateway/task_router.py — Save result_data on task completion

8. backend/app/routers/gateway.py — Add SSE endpoint: GET /api/gateway/tasks/{task_id}/stream
   - Subscribe to task progress events
   - Return SSE with event types matching CC output types

After all changes:
- cd bridges/oc-bridge && npm run build
- cd backend && python3 -c "from app.models.gateway import *; print('OK')"

Commit: git add -A && git commit -m "feat: real-time task output streaming + structured results"
Do NOT push.
```

---

## 迭代二：P0 — 断点续传 + 任务依赖

### 任务列表

#### T6: 任务结果暂存机制
**改动文件：**
- `backend/app/services/gateway/task_router.py` — 超时时保存中间结果
- `bridges/oc-bridge/src/task/task-manager.ts` — 超时时保存 CC 已有输出

**设计：**
- CC 被终止时（SIGTERM），oc-bridge 保存已有的 stdout 到临时文件
- 发送 `task.timeout` 消息时带上 `partial_output` 和 `files_snapshot`
- Gateway 将 partial_output 存入数据库

**验收标准：**
- 任务超时后，`GET /api/gateway/tasks/{id}` 能看到 `partial_output`

---

#### T7: 任务 Resume API
**改动文件：**
- `backend/app/routers/gateway.py` — 新增 `POST /api/gateway/tasks/{task_id}/resume`
- `backend/app/services/gateway/task_router.py` — resume 逻辑
- `bridges/oc-bridge/src/websocket/types.ts` — 新增 `TaskResume` 消息

**设计：**
```python
# Resume request
class ResumeTaskRequest(BaseModel):
    prompt_suffix: str = ""  # 追加说明，如 "从上次中断的地方继续"
    timeout: int = 300
    skip_permissions: bool = False

# Resume 时自动在 prompt 前注入：
# "[RESUME] Previous output attached. Continue from where you left off.\n\n
#  [Previous files modified: {files_from_result_data}]\n\n
#  Original prompt: {original_prompt}"
```

**验收标准：**
- resume 后 CC 能拿到之前的输出上下文
- resume 的任务在新 task_id 下执行，关联原始 task_id

---

#### T8: 任务依赖链
**改动文件：**
- `backend/app/models/gateway_schemas.py` — SubmitTaskRequest 新增 `depends_on` 字段
- `backend/app/services/gateway/task_router.py` — 依赖检查逻辑

**设计：**
```python
class SubmitTaskRequest(BaseModel):
    # ... existing fields ...
    depends_on: Optional[list[str]] = None  # task_id list

# task_router.submit_task():
# if task.depends_on:
#     for dep_id in task.depends_on:
#         dep = get_task(dep_id)
#         if dep.status not in ('completed',):
#             queue task as 'blocked', return task_id
#
# task_router.on_task_completed():
# check if any tasks are blocked on this task_id
# if all deps completed, unblock and route
```

**验收标准：**
- depends_on 的任务在依赖完成前 status='blocked'
- 依赖全部完成后自动路由执行

---

### 迭代二 CC 执行 Prompt

```
Read CLAUDE.md first.

Implement Iteration 2 for Nexus — Task resume + dependency chain.

Project: /root/.openclaw/workspace/agent-orchestration

Tasks:

1. backend/app/models/gateway_schemas.py:
   - Add depends_on: Optional[list[str]] = None to SubmitTaskRequest
   - Add ResumeTaskRequest model (prompt_suffix, timeout, skip_permissions)
   - Add 'blocked' to TaskStatus

2. backend/app/services/gateway/task_router.py:
   - submit_task: if depends_on provided, check all deps completed; if not, set status='blocked'
   - on_task_completed: check if any blocked tasks depend on this task; if all deps done, route the blocked task
   - on_task_timeout: save partial_output to task record

3. backend/app/services/gateway/db_gateway.py:
   - add get_blocked_tasks(dep_task_id) method
   - add save_partial_output(task_id, output) method

4. backend/app/routers/gateway.py:
   - Add POST /api/gateway/tasks/{task_id}/resume endpoint
   - Resume injects previous output context into new prompt

5. bridges/oc-bridge/src/websocket/types.ts:
   - Add TaskResume message type
   - Add partial_output to TaskComplete/TaskTimeout

6. bridges/oc-bridge/src/task/task-manager.ts:
   - On timeout: save partial stdout before killing process
   - Send partial_output in completion message

After all changes:
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"
- cd bridges/oc-bridge && npm run build

Commit: git add -A && git commit -m "feat: task resume + dependency chain"
Do NOT push.
```

---

## 迭代三：P1 — 超时策略 + 前端增强

### 任务列表

#### T9: 优雅超时（Graceful Shutdown）
**改动文件：**
- `bridges/oc-bridge/src/task/task-manager.ts` — 超时前发 SIGINT 而非 SIGKILL
- `bridges/oc-bridge/src/agent/claude-code.ts` — 支持 grace_period 参数

**设计：**
```
超时策略：
- default_timeout: 300s
- grace_period: 60s (在超时前 60s 开始)
- 超时前 60s: 发送 task.warning 事件
- 到达 timeout: SIGINT（Ctrl+C），给 CC 30s 优雅退出
- grace_timeout: SIGKILL 强制终止
- CC 收到 SIGINT 后会完成当前操作并提交
```

---

#### T10: Bridge 负载均衡
**改动文件：**
- `backend/app/services/gateway/task_router.py` — select_bridge 改为加权选择

**设计：**
```python
def select_bridge(self, task):
    bridges = self.get_available_bridges()
    # 按 active_tasks 数排序，选最空闲的
    bridges.sort(key=lambda b: b.active_tasks)
    return bridges[0]
```

---

#### T11: 前端任务详情增强
**改动文件：**
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 文件变更标签页 + 命令历史标签页
- `frontend/src/components/tasks/FileChangeList.tsx` — 文件变更列表组件
- `frontend/src/components/tasks/CommandHistory.tsx` — 命令执行历史组件

**设计：**
- 新增"文件变更"标签页：显示 files_modified 列表（从 result_data 提取）
- 新增"命令历史"标签页：显示 commands_run 列表（命令 + 退出码 + 耗时）
- 每个文件显示操作类型图标（新建/编辑/删除）

---

### 迭代三 CC 执行 Prompt

```
Read CLAUDE.md first.

Implement Iteration 3 for Nexus — Graceful timeout + load balancing + frontend task detail.

Project: /root/.openclaw/workspace/agent-orchestration

Tasks:

1. bridges/oc-bridge/src/task/task-manager.ts — Graceful timeout:
   - 60s before timeout: send 'task.warning' message to Gateway
   - At timeout: send SIGINT (not SIGKILL) to CC process
   - 30s grace period after SIGINT: then SIGKILL
   - On SIGINT exit: save output as completed (not failed)

2. bridges/oc-bridge/src/agent/claude-code.ts:
   - Handle graceful shutdown via AbortController
   - Support grace_period in task config

3. backend/app/services/gateway/task_router.py:
   - select_bridge: sort by active_tasks ascending (least loaded first)
   - Log bridge load on each task assignment

4. frontend/src/pages/tasks/TaskDetailPage.tsx:
   - Add "File Changes" tab: list from result_data.files_modified
   - Add "Commands" tab: list from result_data.commands_run
   - File change: show icon for created/edited/deleted, file path
   - Command: show command, exit code, duration

5. frontend/src/components/tasks/FileChangeList.tsx — New component
6. frontend/src/components/tasks/CommandHistory.tsx — New component

After all changes:
- cd bridges/oc-bridge && npm run build
- cd frontend && npm run build

Commit: git add -A && git commit -m "feat: graceful timeout + load balancing + task detail enhancement"
Do NOT push.
```

---

## 迭代四：P2 — 增强功能

### 任务列表

#### T12: 优先级队列
- `backend/app/services/gateway/task_router.py` — pending 任务按 priority 排序路由

#### T13: 成本追踪
- `bridges/oc-bridge/src/agent/output-parser.ts` — 提取 token usage 和 cost
- `backend/app/models/gateway.py` — 新增 cost_usd 列
- 前端任务详情显示费用

#### T14: Prompt 模板
- `backend/app/models/gateway_schemas.py` — 新增 template_id 字段
- `backend/app/routers/gateway.py` — `POST /api/gateway/templates` CRUD

#### T15: Bridge 健康检查
- `bridges/oc-bridge/src/cli/start.ts` — 启动时验证 CC CLI
- 心跳消息附带 agent 健康状态

#### T16: 日志增强
- `backend/app/routers/gateway.py` — 任务输出分页 API
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 日志过滤和分页

---

## 执行计划

| 迭代 | 任务 | 改动范围 | 预估 CC 耗时 | 依赖 |
|------|------|---------|------------|------|
| 一 | T1-T5 实时输出+结构化结果 | oc-bridge + backend + frontend | 2 个 CC 任务 (各 600s) | 无 |
| 二 | T6-T8 断点续传+依赖链 | backend + oc-bridge | 1 个 CC 任务 (600s) | 迭代一 |
| 三 | T9-T11 超时策略+前端增强 | oc-bridge + backend + frontend | 1 个 CC 任务 (600s) | 迭代一 |
| 四 | T12-T16 增强功能 | 全部 | 2 个 CC 任务 | 迭代一 |

**总计：6 个 CC 任务，约 6 小时 CC 执行时间**

---

## CCDesk 本地安装指南

### 系统要求

| 组件 | 最低版本 | 推荐 |
|------|---------|------|
| macOS / Windows / Linux | — | macOS 14+ |
| Rust | 1.77.2+ | 最新 stable |
| Node.js | 18+ | 20 LTS |
| npm | 9+ | 10+ |
| Claude Code CLI | 2.0+ | 最新 |
| Xcode CLI Tools | — | macOS 需要 |

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/liuh82/claude-code-desktop.git
cd claude-code-desktop

# 2. 安装前端依赖
npm install

# 3. 安装 Claude Code CLI（如果没装）
npm install -g @anthropic-ai/claude-code

# 4. 添加项目权限白名单（root 环境需要）
mkdir -p .claude
cat > .claude/settings.local.json << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Write(*)",
      "Edit(*)",
      "Read(*)"
    ]
  }
}
EOF

# 5. 开发模式运行（需要图形界面）
npm run tauri dev
```

### macOS 特别依赖

```bash
# Tauri v2 macOS 依赖
xcode-select --install

# 如果遇到签名问题
npm run tauri dev -- --no-bundle
```

### Linux (Ubuntu/Debian) 依赖

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev
```

### Linux (Fedora/RHEL) 依赖

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  openssl-devel \
  gtk3-devel
```

### 验证检查

```bash
# 前端编译
npx tsc --noEmit  # 应无错误
npm run build      # 应成功生成 dist/

# Rust 编译
cd src-tauri && cargo check  # 应无 error（warning 可忽略）

# CC CLI 可用
claude --version
```

### 当前项目状态

- ✅ Phase 1-5 全部完成
- ✅ cargo check 通过
- ✅ tsc --noEmit 通过
- ✅ npm run build 通过
- ⚠️ 未做过 `cargo tauri dev` 图形界面验证（服务器无 GUI）
- ⚠️ CC 进程启动使用 `--permission-mode auto`，本地非 root 可能需要调整

### 已知限制

1. **CC 在 root 下不能使用 `--dangerously-skip-permissions`**，非 root 环境可以正常使用
2. **非 root 环境不需要 `.claude/settings.local.json`**，CC 会弹出权限确认对话框
3. **xterm.js 需要浏览器环境**，纯终端环境无法渲染前端
