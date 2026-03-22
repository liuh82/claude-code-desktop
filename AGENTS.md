# CCDesk — Agent 导航索引

> **给 Agent 的地图，不是手册。** 从这里出发，按需深入。

---

## 🏗️ 项目概况

| 项 | 值 |
|---|---|
| 仓库 | `liuh82/claude-code-desktop`（private） |
| 本地 | `/root/.openclaw/workspace/claude-code-desktop` |
| 技术栈 | React 18 + TypeScript + Zustand + CSS Modules + Tauri v2 |
| 设计稿 | `/tmp/stitch-final-v2/`（最终版 2026-03-23） |
| 当前阶段 | UI 结构对齐设计稿完成，细节精化中 |

## 📁 文档地图

### 必读（改代码前）
| 文档 | 内容 | 何时读 |
|------|------|--------|
| `CLAUDE.md` | **执行约束** — 所有编码规则 | 每次改代码前 |
| `docs/ui-design-spec.md` | UI 设计规范 — Stitch token + 布局规则 | 改 UI/样式前 |
| `docs/coding-standards.md` | 编码规范 — 命名、结构、模式 | 写新代码前 |

### 参考（按需）
| 文档 | 内容 |
|------|------|
| `docs/ccbp-methodology.md` | CC 最佳实践方法论 + Gotchas |
| `docs/agent-first-workflow.md` | 视觉验证基础设施 |
| `docs/architecture-v4-chat-ui.md` | UI 架构设计 |
| `docs/harness-supplementary-methods.md` | Harness 方法论补充 |

### 归档（不要再读）
| 文档 | 原因 |
|------|------|
| `docs/_archive/*` | 过时/无关文档 |

## ⚠️ 关键规则（浓缩版）

### UI 改动铁律
1. **只改 CSS property 值，禁止改 class selector 名** — TSX 引用断裂
2. **禁止 inline style** — 优先级混乱
3. **设计 token 以 Stitch `code.html` 为准** — 不要猜
4. **用户消息左对齐、无气泡** — 2026-03-23 对齐设计稿后确定

### 架构约束
1. 单文件 < 500 行，超过拆分
2. 组件用 `function` 声明，不用箭头函数
3. Props 必须定义 TypeScript interface，禁止 `any`

### Git 流程
1. 每次改完 `npx tsc --noEmit && npm run build` 通过
2. commit 格式: `<type>: <简短描述>`
3. `dist/` 不在 git 里

## 🎨 当前 UI 状态

| 组件 | 状态 | 备注 |
|------|------|------|
| 侧边栏 | ✅ 64px | 橙色"C" logo，code/search/history/extension 导航 |
| ChatHeader | ✅ 56px | 灰底 path pill + 模型名 |
| 消息布局 | ✅ 左对齐 | AI/用户都在左，无气泡，AI 头像橙色，用户圆形 |
| 输入区 | ✅ 实色 | 容器化 textarea + 底部工具栏，min-height 44px |
| 发送按钮 | ✅ bg-brand-orange | |
| 右侧面板 | ✅ 288px | "资源管理器" + 文件树 |
| 设置对话框 | ✅ | |
| 代码块 | ⚠️ 基础 | 需精化语法高亮 |
| 工具调用 | ⚠️ 基础 | 需对齐设计稿卡片样式 |

## 🔧 后端（Tauri）状态

| 功能 | 状态 |
|------|------|
| 窗口管理 | ✅ 默认 1280×800 |
| 目录选择 | ✅ |
| CLI 通信 | ⬜ 桩代码 |
| 进程池 | ⬜ 未实现 |
| SQLite 持久化 | ⬜ 未实现 |
| 流式输出 | ⬜ 桩代码 |

## 🐛 Gotchas（踩过不要再踩）

1. **inline style 覆盖 CSS** — App.tsx width 覆盖 Sidebar → 已修
2. **CSS class 重命名** → TSX 全断 → 只改 property 值
3. **JS/CSS min-height 不同步** → auto-resize 基准偏
4. **设计稿版本混淆** — 多个版本，只读 `/tmp/stitch-final-v2/`
5. **CLAUDE.md 不自动读 AGENTS.md** — 需手动指定
6. **CLAUDE.md 超 200 行** → CC 忽略后半部分 → 控制长度

---

*维护原则：每完成一个功能/修一个 bug，更新对应状态。保持精炼。*
