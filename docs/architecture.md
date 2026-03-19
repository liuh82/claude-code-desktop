# Claude Code Desktop 应用架构设计方案

**版本：** v3.0  
**日期：** 2026-03-19  
**作者：** 老张（系统架构师）+ 主 Agent 审核  
**状态：** 已审核，待执行  
**核心设计**：每会话独立 CLI 进程 + 多面板分屏（tmux 风格）+ 可选记忆模块

---

## 1. 业务需求分析

### 1.1 核心目标
打造一款跨平台桌面应用，完美支持 Claude Code 所有功能，提供可视化操作界面，优化中文用户体验。

### 1.2 核心功能清单

| 功能模块 | 功能点 | 优先级 | 说明 |
|----------|--------|--------|------|
| **会话管理** | 多会话创建/切换/保存 | P0 | 每会话独立 CLI 进程 |
| | 会话历史记录与搜索 | P0 | SQLite 持久化 |
| | 会话导出/导入 | P1 | JSON/Markdown |
| **多面板分屏** | 标签页内分屏（tmux 风格） | P0 | 一标签页多 CLI 实例 |
| | 自由分割/调整大小 | P0 | 递归分割面板 |
| | 快捷键切换焦点 | P0 | 类似 tmux 操作 |
| | 布局保存/恢复 | P1 | 持久化面板配置 |
| **代码交互** | 代码文件浏览与编辑 | P0 | Monaco Editor |
| | 代码 diff 查看与接受/拒绝 | P0 | 实时 diff |
| | 多文件批量操作 | P0 | 批量 accept/reject |
| **终端集成** | 内置终端执行命令 | P0 | 每面板独立终端 |
| | 命令输出实时展示 | P0 | 流式输出 |
| | 命令历史与收藏 | P1 | 跨会话共享 |
| **AI 对话** | 流式响应展示 | P0 | SSE 实时渲染 |
| | 代码块高亮与复制 | P0 | Monaco 语法高亮 |
| | 中文优化展示 | P0 | UTF-8 + 字体优化 |
| **项目管理** | 多项目支持 | P0 | 项目配置隔离 |
| | 项目配置管理 | P0 | .claude 配置编辑 |
| | 项目快速切换 | P1 | 下拉菜单切换 |
| **设置中心** | API Key 管理 | P0 | 系统密钥链存储 |
| | 模型选择与配置 | P0 | 多模型支持 |
| | 主题与界面定制 | P1 | 明/暗主题 |
| **记忆管理** | 自动捕获/回忆（可选） | P2 | 插件式模块 |

### 1.3 技术难点
1. **多会话进程隔离** — 每会话独立 CLI 进程，上下文隔离
2. **多面板进程管理** — 一标签页内多个面板各自独立进程
3. **进程池管理** — 限制并发数，资源控制
4. **跨平台兼容性** — Windows/macOS/Linux 三端一致体验
5. **流式响应处理** — SSE 流式数据的实时渲染
6. **Rust 异步编程** — tokio 异步运行时与前端通信

---

## 2. 整体架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────┐
│                   用户界面 (Webview)                  │
│  ┌─────────┐  ┌──────────────────────────────────┐  │
│  │ TabBar  │  │      PaneContainer               │  │
│  │         │  │  ┌──────────┬──────────┐         │  │
│  │ Tab1|T2 │  │  │ Pane 1   │ Pane 2   │         │  │
│  │         │  │  │ (CLI #1) │ (CLI #2) │         │  │
│  │         │  │  ├──────────┴──────────┤         │  │
│  │         │  │  │     Pane 3            │         │  │
│  │         │  │  │     (CLI #3)          │         │  │
│  │         │  │  └───────────────────────┘         │  │
│  └─────────┘  └──────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│               React 18 + TypeScript                  │
│         Zustand Stores + React Components            │
├─────────────────────────────────────────────────────┤
│              Tauri Commands (IPC)                    │
│   invoke('create_tab') / app.emit('process:output') │
├─────────────────────────────────────────────────────┤
│              Rust Core Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │TabManager│ │PaneMgr   │ │  ProcessPool       │  │
│  │          │ │          │ │  ┌──────┐┌──────┐  │  │
│  │          │ │          │ │  │CLI #1││CLI #2│  │  │
│  │          │ │          │ │  └──┬───┘└──┬───┘  │  │
│  └──────────┘ └──────────┘ │  ┌──┴───┐        │  │
│  ┌──────────┐ ┌──────────┐ │  │CLI #3│        │  │
│  │SessionMgr│ │CLIBridge │ │  └──────┘        │  │
│  └──────────┘ └──────────┘ └────────────────────┘  │
├─────────────────────────────────────────────────────┤
│              SQLite + Config Store                    │
└─────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

**每面板独立 CLI 进程**
```
Tab 1
├── Pane 1 ──────► CLI 进程 1 ──────► project-foo/ (分析)
├── Pane 2 ──────► CLI 进程 2 ──────► project-foo/ (测试)
└── Pane 3 ──────► CLI 进程 3 ──────► project-foo/ (Git)

Tab 2
└── Pane 4 ──────► CLI 进程 4 ──────► project-bar/
```

**为什么这样设计？**
- 上下文隔离：每个面板有独立的 Claude Code 上下文
- 任务并行：同一项目可同时进行多个任务
- 状态独立：切换面板不影响其他面板运行
- 故障隔离：一个进程崩溃不影响其他面板
- 资源控制：进程池限制最大并发数

---

## 3. 核心模块详解

### 3.1 标签页管理器（Tab Manager）

**职责**：管理标签页 CRUD、面板关系、布局持久化

**数据结构**：
```rust
// src-tauri/src/core/tab_manager.rs

/// 布局树节点（支持递归分割）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutNode {
    pub node_type: LayoutNodeType,
    pub direction: Option<SplitDirection>,  // Split 节点才有
    pub children: Vec<LayoutNode>,
    pub pane_id: Option<String>,            // Leaf 节点才有
    pub size: f32,                          // 占比 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LayoutNodeType { Leaf, Split }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SplitDirection { Horizontal, Vertical }

/// 标签页
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub tab_id: String,
    pub project_id: String,
    pub project_path: String,
    pub title: String,
    pub active_pane_id: String,
    pub layout_tree: LayoutNode,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 面板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    pub pane_id: String,
    pub session_id: String,
    pub is_active: bool,
}
```

**核心方法**：
```rust
impl TabManager {
    pub async fn create_tab(&self, project_id: String, project_path: String, title: String) -> Result<Tab, AppError>;
    pub async fn split_pane(&self, tab_id: &str, pane_id: &str, direction: SplitDirection) -> Result<LayoutNode, AppError>;
    pub async fn close_pane(&self, tab_id: &str, pane_id: &str) -> Result<LayoutNode, AppError>;
    pub async fn focus_pane(&self, tab_id: &str, pane_id: &str) -> Result<(), AppError>;
    pub async fn focus_next_pane(&self, tab_id: &str, direction: FocusDirection) -> Result<String, AppError>;
    pub async fn resize_pane(&self, tab_id: &str, pane_id: &str, ratio: f32) -> Result<(), AppError>;
    pub async fn get_tab_layout(&self, tab_id: &str) -> Result<LayoutNode, AppError>;
    pub async fn close_tab(&self, tab_id: &str) -> Result<(), AppError>;
}
```

### 3.2 会话管理器（Session Manager）

**职责**：管理会话 CRUD、CLI 进程映射、状态持久化

**数据结构**：
```rust
// src-tauri/src/core/session_manager.rs

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionStatus { Idle, Starting, Running, Waiting, Error, Closed }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub project_path: String,
    pub pane_id: String,
    pub title: String,
    pub status: SessionStatus,
    pub process_id: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: i32,
}
```

**核心方法**：
```rust
impl SessionManager {
    pub async fn create_session(&self, project_id: String, project_path: String, title: String) -> Result<Session, AppError>;
    pub async fn start_session(&self, session_id: &str) -> Result<u32, AppError>;  // 返回 PID
    pub async fn send_input(&self, session_id: &str, input: &str) -> Result<(), AppError>;
    pub async fn close_session(&self, session_id: &str) -> Result<(), AppError>;
    pub async fn list_sessions(&self, project_id: &str) -> Result<Vec<Session>, AppError>;
}
```

### 3.3 进程池管理器（Process Pool）

**职责**：CLI 子进程生命周期管理、并发限制、崩溃监控

**配置**：
```rust
pub struct ProcessPoolConfig {
    pub max_global: usize,           // 全局最大并发（默认 10）
    pub max_per_tab: usize,          // 每标签页最大（默认 5）
    pub startup_timeout_ms: u64,     // 启动超时（默认 30s）
    pub idle_timeout_ms: u64,        // 空闲超时（默认 10min）
    pub claude_executable: String,   // claude CLI 路径
}
```

**核心方法**：
```rust
impl ProcessPool {
    pub async fn spawn(&self, session_id: String, project_path: String) -> Result<u32, AppError>;
    pub async fn kill(&self, pid: u32) -> Result<(), AppError>;
    pub async fn send_stdin(&self, pid: u32, input: &str) -> Result<(), AppError>;
    pub async fn get_status(&self, pid: u32) -> Result<ProcessStatus, AppError>;
    pub async fn list_active(&self) -> Vec<ProcessInfo>;
    pub async fn cleanup_zombies(&self) -> Vec<u32>;  // 返回清理的 PID
}
```

### 3.4 CLI Bridge（Claude CLI 通信桥）

**职责**：启动 claude 进程、解析 stream-json 输出、格式化输入

**调用方式**：
```bash
# 启动交互式会话
claude --output-format stream-json --verbose
# 通过 stdin 发送消息
echo '{"type":"user_message","content":"..."}' | claude --output-format stream-json
```

**stream-json 输出协议**：
```json
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"流式内容..."}}
{"type":"content_block_stop","index":0}
{"type":"result","subtype":"success","session_id":"abc123","total_duration_ms":5000}
```

**Parser 接口**：
```rust
impl CliParser {
    pub fn parse_line(&mut self, line: &str) -> Option<CliEvent>;
}

pub enum CliEvent {
    Thinking { text: String },
    OutputDelta { text: String },
    OutputComplete,
    ToolUse { name: String, input: serde_json::Value },
    Error { message: String },
    Result { session_id: String, duration_ms: u64 },
}
```

---

## 4. 前端架构

### 4.1 组件树

```
<App>
  <TitleBar />                    # 自定义标题栏（macOS 需隐藏原生）
  <TabBar tabs={...} />           # 标签栏
  <ActiveTabContainer>
    <PaneContainer layout={tree}>
      <PaneHeader pane={...} />   # 面板标题栏
      <TerminalView output={...} /> # 终端输出
      <InputBar onSend={...} />   # 输入框
    </PaneContainer>
    <PaneSplitter />              # 可拖拽分割线
  </ActiveTabContainer>
  <StatusBar />                   # 底部状态栏（连接状态、进程数等）
</App>
```

### 4.2 状态管理（Zustand）

```typescript
// stores/useTabStore.ts
interface TabState {
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  createTab: (projectId: string, projectPath: string, title: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => void;
}

// stores/useSessionStore.ts
interface SessionState {
  sessions: Map<string, Session>;
  createSession: (projectId: string, projectPath: string) => Promise<string>;
  sendInput: (sessionId: string, input: string) => Promise<void>;
}

// stores/useTerminalStore.ts
interface TerminalState {
  outputs: Map<string, OutputLine[]>;  // paneId → 输出行
  appendOutput: (paneId: string, line: OutputLine) => void;
  clearOutput: (paneId: string) => void;
}
```

### 4.3 事件监听（Rust → Frontend）

```typescript
// hooks/useTauri.ts
import { listen } from '@tauri-apps/api/event';

export function useProcessEvents(paneId: string) {
  useEffect(() => {
    const unlisten = listen('process:output', (event) => {
      const { pane_id, content } = event.payload;
      if (pane_id === paneId) {
        useTerminalStore.getState().appendOutput(paneId, content);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [paneId]);
}
```

---

## 5. 数据库设计

### 5.1 表结构

```sql
-- 标签页表
CREATE TABLE IF NOT EXISTS tabs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  title TEXT NOT NULL,
  active_pane_id TEXT,
  layout_tree TEXT NOT NULL,  -- JSON 字符串
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  pane_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  process_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  config TEXT,                 -- JSON 字符串
  last_opened_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 会话消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON messages(session_id);
```

---

## 6. Tauri Commands 接口（v2）

### 6.1 共享状态

```rust
// src-tauri/src/app.rs
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub tab_manager: TabManager,
    pub session_manager: SessionManager,
    pub process_pool: ProcessPool,
    pub db: Mutex<Connection>,
}

// main.rs 中注册
tauri::Builder::default()
    .manage(AppState { /* ... */ })
    .invoke_handler(tauri::generate_handler![
        commands::tab::create_tab,
        commands::tab::close_tab,
        commands::tab::split_pane,
        commands::tab::close_pane,
        commands::tab::focus_pane,
        commands::session::create_session,
        commands::session::start_session,
        commands::session::send_input,
        commands::session::close_session,
        commands::settings::get_config,
        commands::settings::set_config,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### 6.2 标签页命令

```rust
// src-tauri/src/commands/tab.rs
use tauri::State;
use crate::app::AppState;

#[tauri::command]
pub async fn create_tab(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
    title: String,
) -> Result<Tab, String> {
    state.tab_manager.create_tab(project_id, project_path, title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn split_pane(
    state: State<'_, AppState>,
    tab_id: String,
    pane_id: String,
    direction: String,
) -> Result<LayoutNode, String> {
    let dir = match direction.as_str() {
        "horizontal" => SplitDirection::Horizontal,
        "vertical" => SplitDirection::Vertical,
        _ => return Err(format!("Invalid direction: {}", direction)),
    };
    state.tab_manager.split_pane(&tab_id, &pane_id, dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_pane(
    state: State<'_, AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<LayoutNode, String> { /* ... */ }

#[tauri::command]
pub async fn focus_pane(
    state: State<'_, AppState>,
    tab_id: String,
    pane_id: String,
) -> Result<(), String> { /* ... */ }
```

### 6.3 会话命令

```rust
// src-tauri/src/commands/session.rs
#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    project_id: String,
    project_path: String,
) -> Result<Session, String> { /* ... */ }

#[tauri::command]
pub async fn start_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<u32, String> { /* ... */ }

#[tauri::command]
pub async fn send_input(
    state: State<'_, AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> { /* ... */ }
```

---

## 7. 错误处理

```rust
// src-tauri/src/error.rs
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Cannot close last pane in tab")]
    CannotCloseLastPane,
    
    #[error("Max concurrent processes reached ({max}), current: {current}")]
    MaxProcessesReached { max: usize, current: usize },
    
    #[error("Process spawn failed: {0}")]
    SpawnFailed(String),
    
    #[error("Process {pid} already {status}")]
    ProcessBusy { pid: u32, status: String },
    
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// 实现 Into<InvokeError> 让 Tauri 自动转换
impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        tauri::ipc::InvokeError::from(err.to_string())
    }
}
```

---

## 8. 性能优化

| 策略 | 实现 | 说明 |
|------|------|------|
| 输出缓冲 | 每面板 Ring Buffer 10000 行 | 限制内存占用 |
| 事件节流 | 最多 50fps per pane | 减少前端渲染压力 |
| 虚拟滚动 | Monaco 虚拟滚动 | 大量输出时不卡顿 |
| 事件路由 | 按 pane_id 路由 | 避免全局广播 |
| 进程清理 | 空闲 10min 自动 kill | 防止进程泄漏 |

---

## 9. 开发计划（详细 Phase 拆分）

### Phase 1: 项目脚手架 + CI/CD

**目标**：可编译的空壳 Tauri v2 项目 + GitHub Actions

**任务清单**：
1. `npm create tauri-app` 初始化项目（React + TypeScript 模板）
2. 创建 `src-tauri/src/` Rust 目录结构（`main.rs`, `lib.rs`, `app.rs`, `commands/`, `core/`, `cli/`, `db/`, `error.rs`）
3. 创建 `src/` 前端目录结构（`components/`, `hooks/`, `stores/`, `types/`, `utils/`, `styles/`）
4. 配置 `tsconfig.json`（strict mode）+ ESLint + Prettier
5. 配置 `.gitignore`（`node_modules/`, `target/`, `dist/`）
6. 编写 `.github/workflows/build.yml`（macOS/Linux/Windows 三平台构建）
7. 确认 `npm run tauri dev` 可启动空壳窗口
8. Git commit + push

**验收标准**：
- `npx tsc --noEmit` 零错误
- `npm run tauri dev` 能弹出空窗口
- `cargo check` 零错误
- GitHub Actions workflow 文件存在且语法正确

**预计耗时**：1-2 次 CC 调用

---

### Phase 2: Rust 核心层

**目标**：进程池 + CLI Bridge + 会话管理 + 标签页/面板管理 + SQLite

**任务清单**：
1. **error.rs** — AppError 枚举 + thiserror 实现
2. **db/connection.rs** — SQLite 连接初始化 + migrations
3. **db/migrations.rs** — 建表 SQL（tabs, sessions, projects, messages）
4. **core/process_pool.rs** — 进程 spawn/kill/status/cleanup
5. **core/session_manager.rs** — 会话 CRUD + 进程映射
6. **core/tab_manager.rs** — 标签页 CRUD + LayoutNode 分割/合并
7. **core/pane_manager.rs** — 面板 CRUD + 焦点管理
8. **cli/parser.rs** — stream-json 行解析 → CliEvent
9. **cli/bridge.rs** — Claude CLI 进程启动 + stdin/stdout 管道
10. **commands/tab.rs** — Tauri commands（create_tab, split_pane, close_pane, focus_pane）
11. **commands/session.rs** — Tauri commands（create_session, start_session, send_input, close_session）
12. **commands/settings.rs** — 配置读写
13. **app.rs** — AppState 定义 + 注册
14. **lib.rs** + **main.rs** — 入口集成
15. 单元测试（process_pool, parser, tab_manager）

**验收标准**：
- `cargo check` + `cargo test` 零错误
- 通过 `invoke('create_tab', ...)` 可创建标签页
- 通过 `invoke('start_session', ...)` 可启动 claude CLI 进程
- 通过 `invoke('send_input', ...)` 可发送消息到 CLI
- 进程池限制生效（不超过 max_global）
- SQLite 数据持久化（重启后数据不丢失）

**预计耗时**：3-5 次 CC 调用

---

### Phase 3: React 前端

**目标**：多面板 UI + 终端组件 + 标签页 + 流式输出

**任务清单**：
1. **安装前端依赖** — `@tauri-apps/api`, `zustand`, `@monaco-editor/react`
2. **types/** — tab.ts, pane.ts, session.ts, tauri.d.ts（invoke 类型）
3. **stores/useTabStore.ts** — 标签页状态管理
4. **stores/useSessionStore.ts** — 会话状态管理
5. **stores/useTerminalStore.ts** — 终端输出状态管理
6. **stores/useSettingsStore.ts** — 设置状态管理
7. **hooks/useTauri.ts** — Tauri invoke 封装 + 事件监听
8. **hooks/useKeyboard.ts** — 快捷键绑定（Cmd+D 分割, Cmd+W 关闭, 方向键导航）
9. **components/layout/TabBar.tsx** — 标签栏组件
10. **components/panels/PaneContainer.tsx** — 递归布局树渲染
11. **components/panels/PaneSplit.tsx** — 可拖拽分割线
12. **components/panels/PaneHeader.tsx** — 面板标题栏（会话名+状态指示）
13. **components/terminal/TerminalView.tsx** — 终端输出渲染（虚拟滚动）
14. **components/terminal/OutputStream.tsx** — 流式输出行渲染
15. **components/layout/StatusBar.tsx** — 底部状态栏
16. **components/common/InputBar.tsx** — 消息输入框
17. **app/App.tsx** — 根组件组装
18. **styles/globals.css** — 全局样式 + CSS 变量 + 明暗主题
19. **types/tauri.d.ts** — 自动生成或手动定义 invoke 类型

**验收标准**：
- `npx tsc --noEmit` 零错误
- `npm run build` 构建成功
- 多标签页切换正常
- 水平/垂直分割面板正常
- 终端输出实时流式渲染
- 消息输入和发送正常
- 快捷键（Cmd+D, Cmd+W, 方向键）生效

**预计耗时**：3-5 次 CC 调用

---

### Phase 4: 集成联调

**目标**：前后端通信 + 端到端流程跑通

**任务清单**：
1. 前后端 IPC 通信测试（invoke + emit 双向）
2. 进程输出流式渲染到面板
3. 会话创建 → CLI 启动 → 输入 → 输出 → 关闭 完整流程
4. 面板分割后独立会话验证
5. 标签页切换后状态保持验证
6. 进程崩溃后错误显示
7. SQLite 持久化验证（重启后恢复标签页/会话）
8. 多项目切换验证

**验收标准**：
- 完整流程：打开应用 → 创建项目 → 创建标签页 → 分割面板 → 启动会话 → 发送消息 → 接收流式输出 → 关闭
- 进程崩溃不影响其他面板
- 重启应用后恢复之前的标签页布局
- `npm run tauri dev` 端到端可用

**预计耗时**：2-3 次 CC 调用

---

### Phase 5: UI 精化

**目标**：快捷键完善 + 主题 + 布局保存/恢复

**任务清单**：
1. 完整快捷键方案（参考 CLAUDE.md 快捷键速查表）
2. 明暗主题切换（CSS variables + prefers-color-scheme）
3. 布局保存/恢复（persist layout_tree to SQLite）
4. 面板拖拽调整大小（mousedown/mousemove/mouseup）
5. 文件树组件（读取项目目录结构）
6. 设置页面（模型选择、claude 路径、并发数配置）
7. 会话历史搜索
8. 退出时自动保存状态

**验收标准**：
- 所有快捷键正常工作
- 明暗主题切换无闪烁
- 面板大小可拖拽调整
- 应用退出后重启可恢复布局

**预计耗时**：2-3 次 CC 调用

---

## 10. 快捷键设计

| 快捷键 | 功能 | 备注 |
|--------|------|------|
| `Cmd/Ctrl+T` | 新建标签页 | |
| `Cmd/Ctrl+W` | 关闭当前面板 | 保留最后面板 |
| `Cmd/Ctrl+Shift+W` | 关闭标签页 | |
| `Cmd/Ctrl+D` | 水平分割面板 | 左右布局 |
| `Cmd/Ctrl+Shift+D` | 垂直分割面板 | 上下布局 |
| `Cmd/Ctrl+←/→/↑/↓` | 焦点导航 | tmux 风格 |
| `Cmd/Ctrl+{1-9}` | 切换到第 N 个标签页 | |
| `Enter` | 发送输入到当前面板 | |
| `Cmd/Ctrl+Shift+P` | 打开设置 | |

---

## 11. CI/CD

### 11.1 构建配置

```yaml
# .github/workflows/build.yml
on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: aarch64-apple-darwin, x86_64-apple-darwin }
      - run: npm ci
      - uses: tauri-apps/tauri-action@v0
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }

  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: dtolnay/rust-toolchain@stable
      - run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
            libappindicator3-dev librsvg2-dev patchelf libasound2-dev
      - run: npm ci
      - run: npm run tauri build

  release:
    needs: [build-macos, build-linux]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: softprops/action-gh-release@v1
        with: { generate_release_notes: true }
```

### 11.2 开发流程
```
Linux 服务器开发 → git push → GitHub Actions 构建 → 下载产物 → 本地安装
```

---

## 12. 风险与应对

| 风险 | 概率 | 应对 |
|------|------|------|
| Rust 编译时间长 | 高 | CC timeout 设 600s+，Phase 2 可拆多次 |
| macOS 构建依赖 | 中 | GitHub Actions macOS runner |
| 进程泄漏 | 中 | 进程池限制 + 定期清理 |
| CLI 版本变更 | 中 | Bridge 做版本检测 + fallback |
| 内存占用 | 低 | 输出缓冲限制 + 虚拟滚动 |
| Tauri v2 API 变更 | 低 | 锁定 tauri 版本 |

---

## 13. 依赖版本锁定

| 依赖 | 版本 | 说明 |
|------|------|------|
| tauri | v2.x | 最新 v2 |
| react | ^18.3 | React 18 |
| typescript | ^5.5 | TypeScript 5.x |
| zustand | ^5.x | 状态管理 |
| @monaco-editor/react | ^4.x | 代码编辑器 |
| @tauri-apps/api | v2.x | Tauri 前端 API |
| rusqlite | ^0.32 | SQLite 绑定 |
| tokio | ^1.x | 异步运行时 |
| serde | ^1.x | 序列化 |
| thiserror | ^2.x | 错误类型 |

---

**文档结束**

v3.0 已完成审核修订：
- ✅ Tauri v2 API 规范（含 v1 vs v2 对比）
- ✅ CLI 交互协议（stream-json 格式 + parser 接口）
- ✅ 前端组件树 + 目录结构
- ✅ Zustand Store 接口定义
- ✅ 事件通信规范（Rust ↔ Frontend）
- ✅ Phase 拆分到具体任务级别（5 个 Phase，每 Phase 有任务清单）
- ✅ 每个 Phase 的验收标准
- ✅ 编码约束（详见 CLAUDE.md）
- ✅ 依赖版本锁定
