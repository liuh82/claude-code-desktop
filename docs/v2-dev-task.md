# CCDesk v0.2.0 开发任务

## 目标
将 CCDesk 从 v0.1（终端模拟器风格）重写为 v0.2（Cline 风格聊天式 UI）。

## 当前状态
- 仓库: `/root/.openclaw/workspace/claude-code-desktop`
- 框架: Electron + React 18 + TypeScript + Zustand + Vite
- v0.1 状态: 终端模拟器 UI（TerminalView + SplitPane），基本可用但交互体验差
- v0.1 需要保留的: `stores/useSettingsStore.ts`, `stores/useSessionStore.ts`, `components/SettingsDialog.tsx`, `components/CommandPalette.tsx`, `theme/` 目录
- v0.1 要删除/重写的: `TerminalView`, `SplitPane`, `PaneContainer`, `PaneSplit`, `PaneHeader`, `StatusBar`（旧版）, `InputBar`（旧版）, `OutputStream`

## 设计参考
完整设计文档在 `docs/architecture-v4-chat-ui.md`，请仔细阅读。

核心布局：三栏（Sidebar | Chat Area | Tool Panel），参考 Cline (Claude Dev)。

## 实施步骤

### Step 1: 安装依赖
```bash
npm install react-markdown remark-gfm rehype-highlight highlight.js
```

### Step 2: 重写 App.tsx
- 三栏布局: 左 Sidebar (240px, 可折叠 Cmd+B) | 中 Chat Area (flex:1) | 右 Tool Panel (300px, 可折叠 Cmd+Shift+F)
- 面板折叠状态存 localStorage

### Step 3: 创建核心组件

#### Toolbar.tsx（顶部 40px）
- 项目路径显示 + Git 分支 + 模型选择下拉 + 设置按钮
- 暗色主题，CSS 变量

#### Sidebar.tsx
- 新建会话按钮 + 会话列表 + 搜索框
- 会话按项目分组

#### ChatView.tsx
- MessageList（消息列表，自动滚动）
- InputArea（底部输入框，Enter 发送，Shift+Enter 换行）

#### MessageBubble.tsx
- 用户消息: 👤 头像，左对齐
- AI 消息: 🤖 头像，左对齐
- Markdown 渲染 + 代码块语法高亮 + 复制按钮

#### ToolCallBlock.tsx
- 折叠块: 工具名 + 状态图标(⏳/✅/❌) + 耗时
- 展开: 完整 input + output

#### CodeBlock.tsx
- highlight.js 语法高亮 + 行号 + 复制按钮
- 暗色主题匹配应用主题

#### PermissionPrompt.tsx（Phase 3，先占位）
- 弹窗: Approve / Reject / Edit & Approve

#### ToolPanel.tsx
- 两个 Tab: Files | Diff（Phase 5，先占位）

### Step 4: 状态管理
- useChatStore: messages, currentMessage, isGenerating
- useSessionStore: 复用现有的
- useSettingsStore: 复用现有的

### Step 5: 暗色主题
使用 CSS 变量，参考 architecture-v4-chat-ui.md 第八章的颜色定义。

## 样式方案
使用 CSS Modules（`.module.css`），不用 styled-components。
主题变量用 CSS custom properties。

## 编码规范
- 只用 `function` 声明组件
- Props 必须定义 interface
- 绝对路径 `@/components/...`
- 不用 `any`
- 不用 `console.log`

## 验收
1. `npx tsc --noEmit` 零错误
2. `npm run build` 构建成功
3. 暗色主题默认开启
4. 三栏布局正确，面板可折叠
5. 输入消息 → 回车 → 消息列表显示用户消息 + 模拟 AI 回复
6. Markdown 渲染正确（标题、代码块、列表）
7. 代码块语法高亮 + 复制按钮

## 重要
- Phase 1 只做前端 mock（不接 Claude CLI），纯 UI
- Claude CLI 集成是 Phase 2，本次不涉及
- 保留 Electron 框架，不做 Tauri 迁移
- 更新 CLAUDE.md 反映当前 Electron 技术栈
