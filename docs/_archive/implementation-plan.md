# Claude Code Desktop — 实施计划 v3.0

**版本：** v3.0（修订版）  
**日期：** 2026-03-19  
**修订内容：** 补充执行规范、细化 Phase 拆分、修正 Tauri v2 API、CLI 交互协议  
**执行方式：** Nexus Gateway → oc-bridge → Claude Code CLI

---

## Phase 0: Nexus 端到端验证 ✅ 已完成

**目标**: 验证 Nexus 能跑通简单任务  
**状态**: 已通过（bridge 在线、任务提交→执行→完成 全链路通）

---

## Phase 1: 项目脚手架初始化

**目标**: 创建可编译的 Tauri v2 + React 空壳项目  
**CC 执行时间**: ~10 分钟  
**验收**: `npm run dev` 可启动前端，`npx tsc --noEmit` 零错误

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 1.1 | Tauri v2 项目初始化 | `package.json`, `src-tauri/`, `tauri.conf.json` | 用 `npm create tauri-app@latest`，选择 React + TS + Vite |
| 1.2 | 安装核心前端依赖 | `node_modules/`, `package.json` | zustand, @tauri-apps/api, xterm（暂不装 monaco） |
| 1.3 | 创建前端目录结构 | `src/components/`, `src/stores/`, `src/hooks/`, `src/types/` | 按空目录 + `.gitkeep` 或占位文件 |
| 1.4 | 创建 Rust 目录结构 | `src-tauri/src/commands/`, `core/`, `cli/`, `db/` | 按模块创建 mod.rs |
| 1.5 | 配置 TypeScript 严格模式 | `tsconfig.json` | `"strict": true`, path alias `@/*` |
| 1.6 | 配置 ESLint + Prettier | `.eslintrc.cjs`, `.prettierrc` | Airbnb 风格基础 |
| 1.7 | 创建 CSS 主题变量 | `src/styles/globals.css`, `src/styles/theme.ts` | 明暗主题 CSS variables |
| 1.8 | 创建 Zustand store 骨架 | `src/stores/useTabStore.ts` 等 | 类型定义 + 空 actions |
| 1.9 | 创建 Tauri 类型声明 | `src/types/tauri.d.ts` | 所有 command 的 TS 类型 |
| 1.10 | Git 提交 + Push | commit | message: `feat: project scaffold with Tauri v2 + React` |

### CC Prompt 模板
```
你是 CCDesk 项目开发者。请按 CLAUDE.md 中的规范完成以下任务：

**Phase 1: 项目脚手架初始化**

步骤：
1. 在 /root/.openclaw/workspace/claude-code-desktop 目录下初始化 Tauri v2 + React + TypeScript 项目
2. 用 `npm create tauri-app@latest . -- --template react-ts` 初始化（如该命令不可用，手动创建）
3. 安装核心依赖：zustand, @tauri-apps/api
4. 按 CLAUDE.md 第5节创建完整的目录结构（前端 + Rust）
5. 配置 tsconfig.json 严格模式 + path alias @/*
6. 配置 ESLint + Prettier
7. 创建 CSS 主题变量（明暗双主题）
8. 创建 Zustand store 骨架（useTabStore, usePaneStore, useSessionStore, useSettingsStore）
9. 创建 src/types/ 下的 TypeScript 类型定义
10. 运行 `npx tsc --noEmit` 确认零错误
11. 运行 `npm run build` 确认前端构建成功
12. Git add + commit + push

重要约束（来自 CLAUDE.md）：
- Tauri v2 API，不要用 v1
- TypeScript strict mode
- 函数组件用 function 声明
- 文件 PascalCase，变量 camelCase
- 所有 Tauri command 返回 Result<T, String>
- 不提交 node_modules/, target/, dist/
```

---

## Phase 2a: Rust 核心层 — 进程池 + CLI Bridge

**目标**: 实现进程池管理和 Claude CLI 通信桥  
**前置**: Phase 1 完成  
**CC 执行时间**: ~20 分钟  
**验收**: `cargo check` 零错误，单元测试通过

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 2a.1 | 定义错误类型 | `src-tauri/src/error.rs` | 用 thiserror，覆盖 TabError, ProcessError, SessionError |
| 2a.2 | 定义数据类型 | `src-tauri/src/core/types.rs` | Tab, Pane, Session, LayoutNode, ProcessInfo 等 |
| 2a.3 | 实现 SQLite 连接管理 | `src-tauri/src/db/connection.rs` | rusqlite, 应用目录下创建数据文件 |
| 2a.4 | 实现数据库迁移 | `src-tauri/src/db/migrations.rs` | tabs, panes, sessions, projects 四表 |
| 2a.5 | 实现进程池管理器 | `src-tauri/src/core/process_pool.rs` | tokio::process::Command, 最大并发 10, 超时清理 |
| 2a.6 | 实现 CLI Bridge | `src-tauri/src/cli/bridge.rs` | spawn claude, stdin/stdout 管道通信 |
| 2a.7 | 实现 stream-json 解析器 | `src-tauri/src/cli/parser.rs` | 逐行解析 JSON 事件流 |
| 2a.8 | 实现 Tab Manager | `src-tauri/src/core/tab_manager.rs` | 创建/关闭/分割面板 |
| 2a.9 | 实现 Session Manager | `src-tauri/src/core/session_manager.rs` | 会话生命周期管理 |
| 2a.10 | 实现 Tauri Commands | `src-tauri/src/commands/*.rs` | 所有 command 用 State 注入 |
| 2a.11 | 实现 App 状态 | `src-tauri/src/app.rs` | AppState struct，在 main 中初始化 |
| 2a.12 | Cargo.toml 依赖 | `Cargo.toml` | tokio, rusqlite, serde, uuid, tracing, thiserror |
| 2a.13 | 单元测试 | `src-tauri/src/core/*.rs` | 进程池 spawn/kill 测试 |
| 2a.14 | Git commit + push | commit | message: `feat: Rust core - process pool + CLI bridge + managers` |

### CLI Bridge 详细设计
```rust
// Claude Code CLI 启动方式
pub struct ClaudeCli {
    child: tokio::process::Child,
    stdin: tokio::process::ChildStdin,
    stdout: tokio::process::BufReader<tokio::process::ChildStdout>,
}

impl ClaudeCli {
    pub async fn spawn(project_path: &str) -> Result<Self, ProcessError> {
        let mut child = tokio::process::Command::new("claude")
            .args(["--output-format", "stream-json"])
            .current_dir(project_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| ProcessError::SpawnFailed(e.to_string()))?;
        
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        
        Ok(Self {
            child,
            stdin,
            stdout: tokio::io::BufReader::new(stdout),
        })
    }
    
    /// 发送用户消息
    pub async fn send_message(&mut self, message: &str) -> Result<(), ProcessError> {
        self.stdin.write_all(message.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }
    
    /// 读取一行输出
    pub async fn read_output(&mut self) -> Result<Option<CliEvent>, ProcessError> {
        let mut line = String::new();
        let bytes = self.stdout.read_line(&mut line).await?;
        if bytes == 0 { return Ok(None); }
        
        let event: CliEvent = serde_json::from_str(line.trim())
            .map_err(|e| ProcessError::ParseError(e.to_string()))?;
        Ok(Some(event))
    }
}
```

---

## Phase 2b: React 前端 — 多面板 + 终端

**目标**: 实现多面板容器、标签页、终端输出视图  
**前置**: Phase 2a 完成  
**CC 执行时间**: ~20 分钟  
**验收**: `npx tsc --noEmit` 零错误，UI 可见

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 2b.1 | 标签页栏组件 | `TabBar.tsx` | 横向排列，+ 新建，× 关闭，活跃态高亮 |
| 2b.2 | 面板容器组件 | `PaneContainer.tsx` | 递归 LayoutNode 渲染，支持水平/垂直分割 |
| 2b.3 | 面板分割器组件 | `PaneSplit.tsx` | 可拖拽调整比例，最小 10% |
| 2b.4 | 面板头部组件 | `PaneHeader.tsx` | 显示标题、会话状态、关闭按钮 |
| 2b.5 | 终端视图组件 | `TerminalView.tsx` | 虚拟滚动，ANSI 颜色支持，自动滚动到底部 |
| 2b.6 | 输出流渲染 | `OutputStream.tsx` | 区分 stdout/stderr 样式，markdown 渲染 |
| 2b.7 | 输入组件 | `InputBar.tsx` | 底部输入框，Enter 发送，Shift+Enter 换行 |
| 2b.8 | useTabStore 实现 | `useTabStore.ts` | 调用 Tauri commands，Map 存储 tabs |
| 2b.9 | usePaneStore 实现 | `usePaneStore.ts` | 面板 CRUD，布局树操作 |
| 2b.10 | useProcess Hook | `useProcess.ts` | 监听 process:output 事件，按 pane_id 路由 |
| 2b.11 | useKeyboard Hook | `useKeyboard.ts` | Cmd+D 分割，Cmd+W 关闭，方向键导航 |
| 2b.12 | App 布局整合 | `App.tsx` | TabBar + PaneContainer + StatusBar 组合 |
| 2b.13 | 类型检查 + 构建 | — | `npx tsc --noEmit` + `npm run build` |
| 2b.14 | Git commit + push | commit | message: `feat: React frontend - multi-pane + terminal` |

### 面板容器递归渲染
```typescript
// PaneContainer.tsx 核心逻辑
function PaneContainer({ layoutNode, tabId }: Props) {
  if (layoutNode.node_type === 'Leaf' && layoutNode.pane_id) {
    return <TerminalPane paneId={layoutNode.pane_id} tabId={tabId} />;
  }

  const isHorizontal = layoutNode.direction === 'Horizontal';
  
  return (
    <div style={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column' }}>
      {layoutNode.children.map((child, i) => (
        <Fragment key={i}>
          <PaneContainer layoutNode={child} tabId={tabId} />
          {i < layoutNode.children.length - 1 && (
            <PaneSplit direction={isHorizontal ? 'vertical' : 'horizontal'} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
```

---

## Phase 2c: 数据库持久化 + 会话历史

**目标**: SQLite 持久化标签页布局、会话历史、项目配置  
**前置**: Phase 2b 完成  
**CC 执行时间**: ~10 分钟  
**验收**: 重启后数据不丢失

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 2c.1 | Rust 端 CRUD 操作 | `db/` 模块 | tabs/panes/sessions/projects 增删改查 |
| 2c.2 | 布局树序列化/反序列化 | `core/tab_manager.rs` | LayoutNode ↔ JSON |
| 2c.3 | 启动时恢复上次布局 | `commands/tab.rs` | 从 SQLite 读取 layout_tree 恢复 |
| 2c.4 | 会话消息持久化 | `db/` + `core/session_manager.rs` | 每条消息存 SQLite |
| 2c.5 | 会话历史搜索 | `commands/session.rs` | 按关键词/日期搜索 |
| 2c.6 | 项目配置管理 | `commands/settings.rs` | 读写 .claude 配置 |
| 2c.7 | Git commit + push | commit | message: `feat: SQLite persistence + session history` |

---

## Phase 3: 前后端集成联调

**目标**: Tauri 全栈联调，流式输出打通  
**前置**: Phase 2 全部完成  
**CC 执行时间**: ~15 分钟  
**验收**: `npm run tauri dev` 可交互使用

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 3.1 | 事件系统集成 | 前后端 | process:output/started/exited 事件 |
| 3.2 | 流式输出渲染 | OutputStream.tsx | 逐字追加，自动滚动，性能优化 |
| 3.3 | 用户输入 → CLI | InputBar → bridge | 消息发送到对应面板的 CLI 进程 |
| 3.4 | 面板分割交互 | PaneSplit | 拖拽实际触发 split_pane command |
| 3.5 | 状态同步 | stores ↔ Rust | 前端状态与后端数据库一致 |
| 3.6 | 错误状态 UI | ErrorBoundary + Toast | 进程崩溃、连接失败提示 |
| 3.7 | 全链路测试 | 手动测试 | 新建→分割→发送消息→接收输出→关闭 |
| 3.8 | Git commit + push | commit | message: `feat: full-stack integration with streaming output` |

---

## Phase 4: UI 精化 + 快捷键

**目标**: 完整可用的桌面应用  
**前置**: Phase 3 完成  
**CC 执行时间**: ~15 分钟  

### 任务清单

| # | 任务 | 交付物 | 约束 |
|---|------|--------|------|
| 4.1 | 全局快捷键系统 | useKeyboard | Cmd+D/W/T, 方向键导航, Cmd+1-9 |
| 4.2 | 主题切换 | useSettingsStore | 明/暗主题切换 |
| 4.3 | 布局保存/恢复 | useTabStore | 多布局方案，命名保存 |
| 4.4 | 拖拽调整面板大小 | PaneSplit | 平滑拖拽，debounce 更新 |
| 4.5 | 会话列表侧边栏 | SessionList | 左侧边栏，项目→会话树 |
| 4.6 | 设置面板 | SettingsPage | 全局配置页面 |
| 4.7 | Git commit + push + tag | commit + v0.1.0 | message: `feat: UI polish + keyboard shortcuts` |

---

## 执行策略

### Nexus 工作流使用
- 每个 Phase 作为一次 Nexus 任务提交
- CC 通过 `claude --print --output-format stream-json "<prompt>"` 执行
- 任务超时设为 600 秒（Rust 编译时间长）
- 每个 Phase 完成后主 Agent 审核 + 推送

### 审核检查点
每个 Phase 完成后，主 Agent 检查：
1. `npx tsc --noEmit` 零错误
2. `npm run build` / `cargo check` 通过
3. `git log` 有对应 commit
4. 目录结构符合 CLAUDE.md 规范
5. 无硬编码路径、无 console.log、无 unwrap()

### 风险应对
| 风险 | 应对 |
|------|------|
| CC 超时 | 一次只提交一个 Phase，Phase 内部再分步 |
| Rust 编译失败 | 缩小 Phase 2a 范围，先只做进程池 |
| Tauri v2 API 不熟悉 | CLAUDE.md 中已注明关键差异 |
| macOS 构建失败 | 推到 GitHub Actions，本地只开发 Linux 版 |
