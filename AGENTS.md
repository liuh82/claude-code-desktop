# CCDesk — Agent 导航索引

> **给 Agent 的地图，不是手册。** 从这里出发，按需深入。

---

## 🏗️ 项目概况

| 项 | 值 |
|---|---|
| 仓库 | `liuh82/claude-code-desktop`（private） |
| 本地 | `/root/.openclaw/workspace/claude-code-desktop` |
| 技术栈 | React 18 + TypeScript + Zustand + CSS Modules + Electron |
| 设计稿 | `/tmp/stitch-new/stitch_main_chat_interface/`（Stitch 导出） |
| 当前阶段 | Phase 3 完成，UI 精化中 |

## 📁 文档地图

### 必读（改代码前）
| 文件 | 内容 | 何时读 |
|------|------|--------|
| `CLAUDE.md` | **执行约束** — 所有编码规则 | 每次改代码前 |
| `docs/ui-design-spec.md` | UI 设计规范 — Stitch token + 布局规则 | 改 UI/样式前 |
| `docs/coding-standards.md` | 编码规范 — 命名、结构、模式 | 写新代码前 |
| `docs/architecture.md` | 架构设计 v3.0 — 数据结构和接口 | 改架构前 |

### 参考（按需）
| 文件 | 内容 |
|------|------|
| `docs/ui-redesign-v4-strict.md` | UI 重设计 v4 严格模式规则 |
| `docs/implementation-plan.md` | 实施计划 |
| `docs/INSTALL_GUIDE.md` | 安装指南 |

## ⚠️ 关键规则（浓缩版）

### UI 改动铁律
1. **只改 CSS property 值，禁止改 class selector 名** — 否则 TSX 引用断裂
2. **禁止 inline style 覆盖 CSS** — 优先级问题已踩坑多次（App.tsx width 覆盖 Sidebar.css）
3. **设计 token 以 Stitch `code.html` 为准** — 用 `stitch-mcp` 或手动提取，不要猜

### 架构约束
1. **分层**: UI Components → State Stores → Services → Core
2. **单文件 < 500 行** — 超过必须拆分
3. **组件用 `function` 声明**，不用箭头函数
4. **Props 必须定义 TypeScript interface**，禁止 `any`

### Git 流程
1. 每次改完必须 `npx tsc --noEmit && npm run build` 通过
2. commit 格式: `<type>: <简短描述>`
3. `dist/` 不在 git 里 — 用户端需 `npm run electron:build`

## 🎨 当前 UI 状态

| 组件 | 状态 | 备注 |
|------|------|------|
| 侧边栏 | ✅ 48px icon-only | logo 渐变方块，底部 theme+settings |
| ChatHeader | ✅ 品牌橙色 | 模型选择器 + 项目路径 |
| 消息布局 | ⚠️ 基础完成 | 需对齐 Stitch 细节 |
| 输入框 | ⚠️ 基础完成 | 100px min-height, 需调视觉 |
| 设置对话框 | ✅ v4 风格 | brand-orange 按钮 |
| 启动页 | ✅ terminal 图标 | 橙色文字 |
| 代码块 | ⬜ 需对齐设计稿 | traffic lights + 语法高亮 |
| 工具调用 | ⬜ 需对齐设计稿 | 可折叠卡片样式 |
| 空状态 | ✅ terminal 图标 | |
| 文件树 | ⬜ 未实现 | ToolPanel 基础有 |
| DiffView | ⬜ 未实现 | 组件存在但功能空 |

## 🔧 后端（Electron）状态

| 功能 | 状态 | 备注 |
|------|------|------|
| 窗口管理 | ✅ | 默认 1280×800 |
| 目录选择 | ✅ | openDirectoryDialog |
| CLI 通信 | ⬜ 桩代码 | claudeApi 调用但无真实进程 |
| 多标签页 | ✅ UI 完成 | 但无 CLI 进程绑定 |
| 进程池 | ⬜ 未实现 | 架构文档有设计 |
| SQLite 持久化 | ⬜ 未实现 | 架构文档有设计 |
| 会话持久化 | ⬜ 未实现 | |
| 流式输出 | ⬜ 桩代码 | store 有接口但无真实数据 |

## 🐛 已知坑点（踩过不要再踩）

1. **inline style 覆盖 CSS** — App.tsx 曾设 `style={{ width: 240 }}` 覆盖 Sidebar CSS 的 48px
2. **CSS class 重命名** — CC 第一次改 UI 重命名了所有 class → TSX 全部断裂，必须回滚
3. **InputArea auto-resize** — JS 里 `Math.max(scrollHeight, 64)` 覆盖 CSS `min-height: 100px`
4. **`dist/` 不跟踪** — 用户 pull 后必须手动 build，否则看到旧版本
5. **handleProjectOpen 依赖顺序** — useCallback 的 deps 必须在声明之后引用
6. **electron import** — App.tsx 需从 `@/lib/claude-api` 导入 `isElectron`

---

*维护原则：每完成一个功能/修一个 bug，更新对应状态。保持精炼，每条可直接执行。*
