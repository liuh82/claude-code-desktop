# CCDesk v0.2.0 架构设计 — Cline 风格聊天 UI

> 基于 Cline (Claude Dev) 界面参考，重构 CCDesk 前端交互层。
> 日期：2026-03-20

---

## 一、现状分析

### v0.1.0 问题
- **终端风格 UI 无法交互**：tmux 分屏 + TerminalView 在 Tauri WebView 中渲染正常但输入/快捷键全部失效
- **设计方向偏差**：以终端模拟器思路设计，但 CC CLI 输出是 JSON stream 而非纯文本终端
- **功能缺失**：设置入口不可见、会话管理未接通、输入框无法使用

### Cline 参考设计的优势
- **聊天式交互**：消息列表 + 底部输入框，用户直觉操作
- **结构化输出**：AI 回复支持 markdown 渲染、代码块语法高亮、工具调用折叠展示
- **文件集成**：右侧面板展示文件树 + diff 视图
- **工具栏清晰**：项目路径、模型选择、操作按钮一目了然

---

## 二、整体布局

```
┌──────────────────────────────────────────────────────┐
│  Toolbar（项目路径 | 分支 | 模型选择 | 新建 | 设置）  │
├──────────┬───────────────────────┬───────────────────┤
│          │                       │                   │
│ Sidebar  │    Chat Area          │  Tool Panel       │
│ ──────── │                       │  ──────────────   │
│ Sessions │  User Message         │  Files (文件树)   │
│          │  ┌──────────────┐     │                   │
│ History  │  │ Hello       │     │  ─── OR ───       │
│          │  └──────────────┘     │                   │
│          │                       │  Diff (变更预览)  │
│          │  Assistant Message    │                   │
│          │  ┌──────────────┐     │                   │
│          │  │ I'll help... │     │                   │
│          │  │ ┌──────────┐ │     │                   │
│          │  │ │ code     │ │     │                   │
│          │  │ └──────────┘ │     │                   │
│          │  └──────────────┘     │                   │
│          │                       │                   │
│          ├───────────────────────┤                   │
│          │  Input Area           │                   │
│          │  ┌─────────────────┐  │                   │
│          │  │ Type message... │  │                   │
│          │  └─────────────────┘  │                   │
│          │  [📎] [▶ Send]        │                   │
│          │                       │                   │
└──────────┴───────────────────────┴───────────────────┘
```

### 三栏布局
| 区域 | 宽度 | 可折叠 | 说明 |
|------|------|--------|------|
| Sidebar | 240px | ✅ Cmd+B | 会话列表 + 历史记录 |
| Chat Area | flex:1 | ❌ | 消息列表 + 输入框 |
| Tool Panel | 300px | ✅ Cmd+Shift+F | 文件树 / Diff 视图 |

---

## 三、组件架构

```
src/
├── app/
│   ├── App.tsx                  # 三栏布局 + 全局状态
│   ├── App.css
│   └── theme/                   # 主题系统（保留现有）
├── components/
│   ├── Toolbar/
│   │   ├── Toolbar.tsx          # 顶部工具栏
│   │   └── Toolbar.css
│   ├── Sidebar/
│   │   ├── Sidebar.tsx          # 左侧边栏容器
│   │   ├── SessionList.tsx      # 会话列表
│   │   ├── SessionItem.tsx      # 单个会话条目
│   │   └── Sidebar.css
│   ├── Chat/
│   │   ├── ChatView.tsx         # 聊天主容器（消息列表 + 输入）
│   │   ├── MessageList.tsx      # 消息列表（虚拟滚动）
│   │   ├── MessageBubble.tsx    # 单条消息（用户/AI）
│   │   ├── AssistantContent.tsx # AI 回复渲染
│   │   ├── ToolCallBlock.tsx    # 工具调用折叠块
│   │   ├── CodeBlock.tsx        # 代码块（语法高亮）
│   │   ├── MarkdownRenderer.tsx # Markdown → React
│   │   ├── InputArea.tsx        # 底部输入区
│   │   └── Chat.css
│   ├── ToolPanel/
│   │   ├── ToolPanel.tsx        # 右侧面板容器
│   │   ├── FileTree.tsx         # 文件树
│   │   ├── DiffView.tsx         # 变更预览
│   │   └── ToolPanel.css
│   ├── Settings/
│   │   ├── SettingsDialog.tsx   # 设置弹窗（保留）
│   │   └── Settings.css
│   └── common/
│       ├── IconButton.tsx       # 通用图标按钮
│       ├── Tooltip.tsx          # 工具提示
│       └── Avatar.tsx           # 用户/AI 头像
├── stores/
│   ├── useChatStore.ts          # 聊天状态（消息列表、当前会话）
│   ├── useSessionStore.ts       # 会话管理
│   ├── useProjectStore.ts       # 项目信息
│   └── useSettingsStore.ts      # 设置（保留）
├── hooks/
│   ├── useClaudeCLI.ts          # CC CLI 进程管理 + 输出解析
│   ├── useKeyboard.ts           # 快捷键（保留）
│   └── useAutoScroll.ts         # 消息自动滚动
└── utils/
    ├── streamParser.ts          # Claude stream-json 解析
    ├── markdown.ts              # Markdown 工具函数
    └── fileIcons.ts             # 文件图标映射
```

---

## 四、核心组件详细设计

### 4.1 Toolbar（顶部工具栏）

```
┌─────────────────────────────────────────────────────────────┐
│  📁 /Users/lh8/my-project  │  main  │  ⬇ Claude 3.5  │  +  ⚙️ │
└─────────────────────────────────────────────────────────────┘
```

**功能：**
- 项目路径显示 + 点击切换项目
- Git 分支显示（如可用）
- 模型选择下拉（claude-sonnet-4-20250514 等）
- 新建会话按钮
- 设置按钮

**高度：** 40px，固定顶部

### 4.2 Chat Area（聊天主区域）

#### MessageBubble 消息气泡

**用户消息：**
```
┌──────────────────────────────┐
│ 👤 User                      │
│                              │
│ 帮我写一个 Python 快速排序    │
└──────────────────────────────┘
```
- 右对齐，蓝色背景
- 无工具调用，纯文本

**AI 回复：**
```
┌──────────────────────────────┐
│ 🤖 Assistant                 │
│                              │
│ 好的，这是一个快速排序实现：    │
│                              │
│ ┌─ Python ────────── [📋] ┐ │
│ │ def quicksort(arr):      │ │
│ │     if len(arr) <= 1:    │ │
│ │         return arr       │ │
│ │     pivot = arr[0]       │ │
│ │     left = [x for x...  │ │
│ └──────────────────────────┘ │
│                              │
│ ▶ Read file: src/main.py     │  ← 工具调用（可折叠）
│   │ main.py 内容...          │
│                              │
│ ▶ Write file: src/main.py    │
│   │ +12 -3 lines             │
└──────────────────────────────┘
```
- 左对齐，暗色背景
- 支持 Markdown 渲染（标题、列表、粗体等）
- 代码块带语法高亮 + 复制按钮
- 工具调用显示为可折叠块

#### ToolCallBlock 工具调用块

```tsx
interface ToolCall {
  id: string;
  name: string;        // 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' ...
  status: 'running' | 'completed' | 'error';
  input: Record<string, any>;
  output?: string;
  duration?: number;   // ms
}
```

**展示规则：**
- 默认折叠，显示工具名 + 状态图标
- Read/Write/Edit：显示文件路径 + 行数变更
- Bash：显示命令 + 可展开查看输出
- Grep/Glob：显示匹配结果数量

### 4.3 InputArea（底部输入区）

```
┌──────────────────────────────────────────┐
│                                          │
│  Type a message or / to see commands...  │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  📎  │  ▶ Send                           │
└──────────────────────────────────────────┘
```

**功能：**
- 多行输入（Shift+Enter 换行，Enter 发送）
- `/` 命令提示（/clear, /model, /compact）
- 附件按钮（拖拽文件自动添加为上下文）
- 发送按钮（有输入时激活）
- 停止生成按钮（AI 回复中显示 ⏹）

**高度：** 自适应，最小 60px，最大 200px

### 4.4 Sidebar（左侧边栏）

```
┌──────────────────────┐
│  💬 Sessions    [+]  │
├──────────────────────┤
│  📁 my-project       │
│  ├ Session 1   ⋯    │
│  ├ Session 2   ⋯    │
│  └ Session 3         │
│                      │
│  📁 other-project    │
│  └ Session 1         │
│                      │
│  🕐 Today            │
│  ├ Session A         │
│  └ Session B         │
│                      │
│  🕐 Yesterday        │
│  └ Session C         │
└──────────────────────┘
```

**功能：**
- 按项目分组显示会话
- 按时间分组（Today / Yesterday / Earlier）
- 右键菜单：重命名、删除、固定
- 搜索会话（Cmd+K 全局搜索）

### 4.5 Tool Panel（右侧工具面板）

两个视图，Tab 切换：

**Files 视图：**
- 项目文件树（从 Rust 后端读取）
- 点击文件在 Diff 视图中打开

**Diff 视图：**
- 显示当前会话中所有文件变更
- 绿色 = 新增行，红色 = 删除行
- 点击文件跳转到对应工具调用

---

## 五、CC CLI 集成方案

### 5.1 进程管理

```rust
// src-tauri/src/core/process.rs

pub struct ClaudeProcess {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    session_id: String,
}

impl ClaudeProcess {
    /// 启动 CC CLI 进程
    pub async fn start(
        cli_path: &str,
        working_dir: &str,
        model: Option<&str>,
        permission_mode: &str,
    ) -> Result<Self, Error> { ... }

    /// 发送用户输入
    pub async fn send_input(&mut self, input: &str) -> Result<(), Error> { ... }

    /// 流式读取输出（SSE/JSON stream）
    pub async fn read_output(&mut self) -> Result<StreamEvent, Error> { ... }

    /// 终止进程
    pub async fn kill(&mut self) -> Result<(), Error> { ... }
}
```

### 5.2 输出解析（前端）

CC CLI `--output-format stream-json` 输出格式：
```json
{"type":"assistant","message":{"content":"...","role":"assistant"}}
{"type":"content_block_start","index":0,"content_block":{"type":"text"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
{"type":"content_block_stop","index":0}
{"type":"tool_use","id":"...","name":"Read","input":{"file_path":"..."}}
{"type":"tool_result","tool_use_id":"...","content":"..."}
{"type":"result","result":"...","duration_ms":1234}
```

```typescript
// utils/streamParser.ts

export type StreamEvent =
  | { type: 'assistant_start'; sessionId: string }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; output: string }
  | { type: 'tool_error'; id: string; error: string }
  | { type: 'result'; output: string; duration: number }
  | { type: 'error'; message: string };

export function parseStreamLine(line: string): StreamEvent | null {
  try {
    const json = JSON.parse(line);
    // 映射 CC stream-json → 内部事件
  } catch {
    return null;
  }
}
```

### 5.3 Tauri 事件流

```typescript
// Rust 端：用 Tauri event system 推送输出到前端
// app.emit("claude-output", payload);

// 前端：监听事件
// listen("claude-output", (event) => {
//   const streamEvent = parseStreamLine(event.payload);
//   useChatStore.getState().appendEvent(streamEvent);
// });
```

---

## 六、数据模型

### 6.1 Chat Store

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;           // Markdown 文本
  toolCalls?: ToolCall[];    // 工具调用列表
  timestamp: number;
  isStreaming?: boolean;     // AI 正在生成中
}

interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  input: any;
  output?: string;
  duration?: number;
}

interface ChatState {
  messages: ChatMessage[];
  currentMessage: string;     // 正在流式拼接的 AI 回复
  currentToolCalls: ToolCall[];
  isGenerating: boolean;
  sessionId: string | null;
  // Actions
  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  clearChat: () => void;
}
```

### 6.2 Session Store

```typescript
interface Session {
  id: string;
  title: string;
  projectPath: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}
```

---

## 七、样式系统

### 7.1 主题色（Dark Mode 优先）

```css
:root {
  /* Backgrounds */
  --bg-primary: #1e1e1e;      /* 主背景 */
  --bg-secondary: #252526;    /* 侧边栏 */
  --bg-tertiary: #2d2d30;     /* 工具栏 */
  --bg-input: #3c3c3c;        /* 输入框 */

  /* Text */
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #6a6a6a;

  /* Accents */
  --accent: #6c8cff;          /* 主色调 - 蓝紫 */
  --accent-hover: #5a7ae8;
  --success: #4ec9b0;
  --error: #f14c4c;
  --warning: #cca700;

  /* Chat */
  --user-bubble: #264f78;     /* 用户消息背景 */
  --ai-bubble: #2d2d30;       /* AI 消息背景 */
  --code-bg: #1a1a1a;         /* 代码块背景 */

  /* Borders */
  --border: #3e3e42;
}
```

### 7.2 关键尺寸

| 元素 | 高度/宽度 | 字号 |
|------|-----------|------|
| Toolbar | 40px | 13px |
| Sidebar | 240px | 12px |
| Tool Panel | 300px | 12px |
| 消息气泡 padding | 12px 16px | 14px |
| 代码块 padding | 8px 12px | 13px monospace |
| 输入框 min-height | 60px | 14px |
| 状态栏 | 24px | 11px |

---

## 八、快捷键

| 快捷键 | 功能 |
|--------|------|
| Enter | 发送消息 |
| Shift+Enter | 换行 |
| Cmd+N | 新建会话 |
| Cmd+B | 切换侧边栏 |
| Cmd+Shift+F | 切换工具面板 |
| Cmd+, | 打开设置 |
| Cmd+K | 全局搜索会话 |
| Escape | 停止生成 / 关闭弹窗 |
| Cmd+1/2/3 | 切换左侧/中间/右侧焦点 |

---

## 九、迁移策略

### 保留（不改动）
- ✅ Rust 后端：`core/`, `db/`, `error/`, `commands/`
- ✅ SQLite 数据库 schema
- ✅ Tauri 配置（capabilities, permissions）
- ✅ 主题系统 `theme/`
- ✅ CI/CD workflow
- ✅ 设置弹窗组件

### 重写（前端）
- 🔄 `TerminalView` → `ChatView` + `MessageList` + `InputArea`
- 🔄 `StatusBar` → `Toolbar`
- 🔄 `SplitPane` → 移除（不再需要分屏）
- 🔄 `ProjectManager` → 集成到 Sidebar + Toolbar
- 🔄 `SessionList` → 保留结构，优化 UI
- 🔄 `CommandPalette` → 保留

### 新增
- ➕ `MarkdownRenderer`（react-markdown + remark-gfm + rehype-highlight）
- ➕ `CodeBlock`（语法高亮 + 复制 + 行号）
- ➕ `ToolCallBlock`（工具调用折叠）
- ➕ `ToolPanel`（文件树 + Diff）
- ➕ `streamParser`（CC stream-json 解析）
- ➕ `useClaudeCLI` hook（进程管理）

### 新增依赖
```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0",
  "highlight.js": "^11.0.0"
}
```

---

## 十、开发阶段（建议 5 个 Phase）

### Phase 1：基础框架（1 天）
- 三栏布局骨架
- Toolbar + Sidebar + ChatView 占位
- 主题色确认

### Phase 2：聊天核心（2 天）
- InputArea 输入 + 发送
- MessageList 消息列表
- MessageBubble 用户/AI 消息渲染
- MarkdownRenderer 集成
- useClaudeCLI hook + stream-json 解析

### Phase 3：工具调用展示（1 天）
- ToolCallBlock 折叠/展开
- CodeBlock 语法高亮
- 工具调用状态动画（running spinner）

### Phase 4：会话管理（1 天）
- Sidebar 会话列表完善
- 新建/删除/重命名
- SQLite 持久化

### Phase 5：工具面板 + 收尾（1 天）
- ToolPanel 文件树
- DiffView 变更预览
- 快捷键完善
- 窗口大小记忆
- 设置接入

---

## 十一、与现有代码的兼容性

- **CLAUDE.md 保持不变**：CC 执行指南不变
- **Rust 后端 API 兼容**：现有 Tauri commands 保持，新增少量事件通道
- **数据库 schema 兼容**：在现有 tables 基础上扩展
- **CI 流程不变**：构建脚本无需改动
