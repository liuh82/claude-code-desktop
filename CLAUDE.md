# Claude Code Desktop — CC 执行约束

## ⚠️ 必读约束

**执行此项目时，必须严格遵守以下规则。违反任何一条都算错误。**

---

## 1. 项目基本信息

- **仓库**: https://github.com/liuh82/claude-code-desktop
- **本地路径**: `/root/.openclaw/workspace/claude-code-desktop`
- **技术栈**: Tauri v2 + React 18 + TypeScript + Zustand + Monaco + SQLite
- **Node.js**: v22+
- **Rust**: stable toolchain

## 2. 命令规范

### 构建与运行
```bash
# 前端开发（仅前端，最快）
npm run dev

# Tauri 开发模式（前端 + Rust 后端）
npm run tauri dev

# 类型检查
npx tsc --noEmit

# 构建
npm run tauri build

# 前端构建产物检查
npm run build
```

### Git 规范
```bash
# 提交信息格式（必须）
git commit -m "<type>: <简短描述>"
# type: feat | fix | refactor | chore | docs | test
# 示例: feat: add tab manager with split pane support
```

## 3. Tauri v2 API 约束

**必须使用 Tauri v2 API，不要使用 v1 API。**

### ❌ 错误写法（Tauri v1）
```rust
#[tauri::command]
async fn create_tab(app_handle: AppHandle, ...) -> Result<Tab, String> {
    // v1 风格
}
```

### ✅ 正确写法（Tauri v2）
```rust
#[tauri::command]
fn create_tab(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<Tab, String> {
    // v2: 用 tauri::State 管理共享状态
}
```

### Tauri v2 关键差异
- 使用 `tauri::State` 而非 `Arc<Mutex<>>` 传递全局状态
- 使用 `app.emit()` 而非 `app_handle.emit_all()` 发送事件
- 事件监听用 `app.listen()` 
- 窗口管理用 `Window` trait 而非 `WindowBuilder`
- 配置文件: `tauri.conf.json`（不是 `tauri.conf.json5`）

## 4. CLI 交互协议

### Claude Code CLI 调用方式
```bash
# 启动交互式会话（NOT --print 模式）
claude --output-format stream-json

# 通过 stdin 发送消息
echo "用户消息内容" | claude --output-format stream-json
```

### stream-json 输出格式
每行一个 JSON 事件，关键类型：
```json
{"type":"assistant","message":{"content":"思考内容..."}}
{"type":"content_block_start","content_block":{"type":"text"}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":"输出内容"}}
{"type":"content_block_stop"}
{"type":"result","result":"最终结果","session_id":"xxx"}
```

### 进程管理规范
- 每面板启动一个独立的 `claude` 子进程
- 通过 stdin/stdout 管道通信
- stderr 用于日志
- 使用 `tokio::process::Command` spawn 子进程
- 子进程必须用 `kill(Pid)` + `wait()` 正确清理
- 超时用 `tokio::time::timeout` 包装

## 5. 前端目录结构

```
src/
├── app/                    # 应用入口
│   ├── App.tsx             # 根组件
│   ├── routes.tsx          # 路由配置（如需）
│   └── providers.tsx       # Context Providers
├── components/             # 组件
│   ├── layout/             # 布局组件
│   │   ├── TabBar.tsx
│   │   ├── StatusBar.tsx
│   │   └── TitleBar.tsx
│   ├── panels/             # 面板组件
│   │   ├── PaneContainer.tsx    # 面板容器（递归分割）
│   │   ├── PaneSplit.tsx        # 分割器（可拖拽）
│   │   ├── PaneHeader.tsx       # 面板头部（标题+操作）
│   │   └── PaneResizer.tsx      # 面板大小调整
│   ├── terminal/           # 终端组件
│   │   ├── TerminalView.tsx     # 终端视图
│   │   ├── OutputStream.tsx     # 输出流渲染
│   │   └── DiffView.tsx         # Diff 查看器
│   ├── editor/             # 编辑器组件
│   │   ├── CodeEditor.tsx       # Monaco 编辑器
│   │   └── FileTree.tsx         # 文件树
│   └── common/             # 通用组件
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── IconButton.tsx
├── hooks/                  # 自定义 Hooks
│   ├── useTauri.ts              # Tauri invoke 封装
│   ├── useProcess.ts           # 进程管理
│   └── useKeyboard.ts          # 快捷键
├── stores/                 # Zustand 状态
│   ├── useTabStore.ts           # 标签页状态
│   ├── usePaneStore.ts          # 面板状态
│   ├── useSessionStore.ts       # 会话状态
│   └── useSettingsStore.ts      # 设置状态
├── types/                  # TypeScript 类型
│   ├── tab.ts
│   ├── pane.ts
│   ├── session.ts
│   └── tauri.d.ts              # Tauri command 类型
├── utils/                  # 工具函数
│   ├── uuid.ts
│   └── format.ts
├── styles/                 # 全局样式
│   ├── globals.css
│   └── theme.ts
└── main.tsx                # 入口文件
```

### Rust 目录结构
```
src-tauri/
├── src/
│   ├── main.rs             # 入口
│   ├── lib.rs              # 库入口
│   ├── app.rs              # App 状态定义
│   ├── commands/           # Tauri Commands
│   │   ├── mod.rs
│   │   ├── tab.rs
│   │   ├── pane.rs
│   │   ├── session.rs
│   │   └── settings.rs
│   ├── core/               # 核心逻辑
│   │   ├── mod.rs
│   │   ├── tab_manager.rs
│   │   ├── pane_manager.rs
│   │   ├── session_manager.rs
│   │   └── process_pool.rs
│   ├── cli/                # CLI Bridge
│   │   ├── mod.rs
│   │   ├── bridge.rs       # Claude CLI 通信桥
│   │   └── parser.rs       # stream-json 解析
│   ├── db/                 # 数据库
│   │   ├── mod.rs
│   │   ├── connection.rs   # SQLite 连接
│   │   └── migrations.rs   # 表迁移
│   └── error.rs            # 错误类型
├── Cargo.toml
├── tauri.conf.json         # Tauri 配置
└── build.rs                # 构建脚本
```

## 6. 编码规范

### TypeScript
- **严格模式**: `tsconfig.json` 必须开启 `"strict": true`
- **函数组件**: 只用 `function` 声明，不用 `const Fn = () =>`
- **Props 类型**: 必须定义 interface，不用 `any`
- **Hooks 顺序**: useState → useEffect → useCallback → useMemo → 自定义 hooks
- **禁止**: `eval()`, `any`（极特殊情况需注释说明）
- **命名**: 文件 PascalCase, 变量 camelCase, 常量 UPPER_SNAKE_CASE
- **导入**: 绝对路径用 `@/components/...`, 相对路径用 `./`, `../`

### Rust
- **错误处理**: 所有函数返回 `Result<T, E>`，用 `thiserror` 定义错误类型
- **异步**: 使用 `tokio` runtime，async/await
- **状态**: 通过 `tauri::State<'_, T>` 注入，用 `Mutex` 或 `RwLock` 保护
- **进程**: 用 `tokio::process::Command`，不用 `std::process::Command`
- **日志**: 用 `tracing` crate, 不要 `println!`
- **命名**: 文件 snake_case, 类型 PascalCase, 函数 snake_case, 常量 UPPER_SNAKE_CASE
- **禁止**: `unwrap()`（测试除外），用 `?` 或 `map_err()`

### 样式
- **方案**: CSS Modules（`.module.css`）
- **不用**: 内联 style 对象（除动态计算值外）
- **主题变量**: 通过 CSS custom properties，定义在 `styles/theme.ts`

## 7. Zustand Store 规范

```typescript
// 正确写法：分离 state 和 actions
interface TabState {
  // State
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  
  // Actions
  createTab: (projectId: string, projectPath: string, title: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => void;
}

export const useTabStore = create<TabState>()((set, get) => ({
  // State
  tabs: new Map(),
  activeTabId: null,
  
  // Actions
  createTab: async (projectId, projectPath, title) => {
    const result = await invoke('create_tab', { projectId, projectPath, title });
    set((state) => {
      const newTabs = new Map(state.tabs);
      newTabs.set(result.tabId, result);
      return { tabs: newTabs, activeTabId: result.tabId };
    });
  },
  // ...
}));
```

## 8. 事件通信规范

### Rust → Frontend（事件推送）
```rust
// Rust 端
app.emit("process:output", ProcessOutputPayload {
    pane_id: pane_id.clone(),
    content: line,
    stream: "stdout".to_string(),
})?;

// 前端
import { listen } from '@tauri-apps/api/event';
listen<string>('process:output', (event) => {
  const { pane_id, content, stream } = event.payload;
  // 更新对应面板的输出
});
```

### Frontend → Rust（命令调用）
```typescript
import { invoke } from '@tauri-apps/api/core';

const tab = await invoke<Tab>('create_tab', {
  projectId: 'xxx',
  projectPath: '/path/to/project',
  title: 'Project A',
});
```

## 9. 快捷键绑定

```typescript
// 使用 @tauri-apps/plugin-global-shortcut（Phase 4）
// Phase 1-2 先用 React keydown 事件
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey && e.key === 'd') {
      e.preventDefault();
      splitPane('horizontal');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

## 10. 验收标准

### 每个 Phase 完成后必须满足：
1. `npx tsc --noEmit` 零错误
2. `npm run build` 构建成功（前端）
3. `cargo check` 零错误（Rust 部分，如涉及）
4. `git status` 无未提交的改动
5. 功能可通过 `npm run tauri dev` 验证（如涉及 UI）

### 不要做的事：
- ❌ 不要安装额外的 npm 依赖（除非 Phase 明确要求）
- ❌ 不要修改 `tauri.conf.json` 中的 app identifier
- ❌ 不要硬编码路径（用 `app_data_dir()` 获取应用目录）
- ❌ 不要使用 `console.log` 调试（用 `tracing` 或删掉）
- ❌ 不要提交 `node_modules/`、`target/`、`dist/`
