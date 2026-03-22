# CCDesk — Claude Code Desktop

> Agent-First 项目。所有规则在下面，遵守即可。

---

## 🚨 绝对规则

1. **禁止 inline style** — 所有样式通过 CSS class 或 CSS 变量
2. **禁止 `width: 100%` 在 flex 子元素上** — 会阻止 max-width + margin auto 居中
3. **JS ↔ CSS 同步** — `Math.max(scrollHeight, N)` 中的 N 必须和 CSS `min-height` 一致
4. **不要猜数值** — 间距/颜色/字号从设计稿 HTML 提取，不要凭感觉
5. **dist/ 不在 git 里** — 不要提交 dist/，不要依赖 dist/ 里的内容验证
6. **设计稿 HTML 是最终真相** — `docs/ui-design-spec.md` 里的数值如果和设计 HTML 不一致，以 HTML 为准

---

## 🏗️ 架构

- **框架**: Tauri v2 + React 18 + TypeScript + Zustand + SQLite
- **布局**: Sidebar(64px) + TopNav + 聊天区 + 右侧面板(FileTree + DiffView)
- **CSS**: CSS Modules（.module.css），全局变量在 `src/styles/globals.css`
- **构建**: `npm run build`（Vite），用户用 `npm run electron:build` 打包

### 目录结构

```
src/
├── app/                    # App 入口 + 主题
├── components/
│   ├── Chat/               # 聊天核心（ChatView, InputArea, MessageBubble, CodeBlock...）
│   ├── Sidebar/            # 64px 侧边栏（有展开文字）
│   ├── TopNav/             # 顶部导航栏（File/Edit/View/Terminal/Window）
│   ├── Pane/               # 多面板（TabBar, TerminalPane, PaneSplit）
│   ├── ToolPanel/          # 右侧面板（FileTree, DiffView）
│   └── ...                 # 其他组件
├── stores/                 # Zustand stores
├── hooks/                  # React hooks
├── lib/                    # 工具函数
├── styles/globals.css      # 全局 CSS 变量（颜色、字号、间距）
└── types/                  # TypeScript 类型
```

---

## 🎨 设计规范

### ⚠️ 设计稿位置（最终版，2026-03-23 更新）
- **Light**: `/tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/code.html`
- **Light 截图**: `/tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/screen.png`
- **Dark**: `/tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/code.html`
- **Dark 截图**: `/tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/screen.png`
- **Light 设计系统**: `/tmp/stitch-final-v2/stitch_main_chat_interface/precision_light/DESIGN.md`
- **Dark 设计系统**: `/tmp/stitch-final-v2/stitch_main_chat_interface/obsidian_pro/DESIGN.md`
- ❌ **不要再读** `/tmp/stitch-new/` 或 `/tmp/stitch-final/`，那些是旧版

### 颜色速查

| 用途 | Light | Dark |
|------|-------|------|
| primary (accent) | #005bc0 | #adc6ff |
| primary-dim | #004fa9 | #adc6ff |
| primary-container | #d8e2ff | — |
| brand-orange (CTA) | #D97706 | #ffb95f |
| bg surface | #f8f9fb | #131314 |
| bg surface-container-low | #f0f4f7 | — |
| bg surface-container | #e8eff3 | #201f20 |
| bg surface-container-lowest | #ffffff | #0e0e0f |
| bg surface-container-high | #e1e9ee | #2a2a2b |
| bg surface-container-highest | #d9e4ea | #353436 |
| text on-surface | #2a3439 | #e5e2e3 |
| text on-surface-variant | #566166 | #8b90a0 |
| outline-variant | #a9b4b9 | #414755 |

### 设计系统原则（"The Digital Atelier"）
1. **No-Line Rule**: 禁止用 1px solid border 做区域分隔，用背景色差（tonal layering）
2. **Ghost Border**: 如需 border，用 outline-variant 20% opacity
3. **Glassmorphism**: 浮层用 surface-container-lowest 85% + 20px backdrop-blur
4. **Surface Hierarchy**: surface → surface-container-low → surface-container-lowest（从外到内）
5. **渐变**: CTA 用 primary→primary-dim 145° 线性渐变

### 关键布局值（从设计 HTML 提取）
- **侧边栏**: 64px (w-16)，支持 md:w-64 展开（有文字）
- **TopNav**: 40px 高，bg-white/90 backdrop-blur-xl
- **消息区**: max-w-3xl (768px), mx-auto, p-8 (32px), space-y-10 (40px gap)
- **消息布局**: gap-6 (24px)
- **AI 消息**: 左对齐，头像 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600
- **用户消息**: 右对齐 (justify-end)，气泡 max-w-[80%] bg-indigo-50 border-indigo-100 rounded-3xl rounded-tr-sm
- **代码块**: rounded-xl, traffic lights (红黄绿 w-3 h-3), p-5, text-[13px]
- **输入区**: p-6, bg-white/60 backdrop-blur-xl, textarea rounded-2xl px-5 py-5 min-h-[64px]
- **发送按钮**: p-2 rounded-xl bg-orange-500 shadow-orange-500/30
- **右侧面板**: 420px (w-[420px])，文件树 + Diff 查看器
- **空状态**: 设计稿没有空状态页，直接显示聊天内容

完整规范见 `docs/ui-design-spec.md`。

---

## ✅ UI 修改强制验证流程

> 修改任何 CSS/TSX 后，**必须按顺序执行**，不可跳过。

### Step 1: 编译检查
```bash
npx tsc --noEmit
```
有错误 → 修。零错误 → 继续。

### Step 2: Build 验证
```bash
npm run build
```
失败 → 修。成功 → 继续。

### Step 3: 视觉验证（必须执行！）
```bash
bash scripts/screenshot.sh /tmp/ccdesk-after light
```
然后用 Read 工具查看 `/tmp/ccdesk-after/light-main.png`，**亲眼看到自己改的效果**。

### Step 4: 对比设计稿
读取设计稿截图进行对比：
- `/tmp/stitch-final-v2/.../screen.png`（设计稿）
- `/tmp/ccdesk-after/light-main.png`（实际效果）

### Step 5: 自 Review 清单
对着截图逐项检查：
- [ ] 侧边栏是 64px 吗？有展开文字吗？
- [ ] 有 TopNav 吗？（File/Edit/View/Terminal/Window）
- [ ] 消息布局是 AI 左 / 用户右吗？
- [ ] 用户气泡是 bg-indigo-50 + border-indigo-100 + rounded-3xl rounded-tr-sm 吗？
- [ ] 消息区居中 max-w-768px 吗？gap 40px 吗？
- [ ] 输入区有 backdrop-blur 半透明效果吗？
- [ ] 发送按钮是 bg-orange-500 吗？
- [ ] 有右侧文件树面板吗（420px）？
- [ ] 有没有残留的 inline style？

### Step 6: 修复差异
发现任何问题 → 修复 → 从 Step 1 重新开始。
全部通过 → 继续 Step 7。

### Step 7: Commit
```bash
git add -A
git commit -m "描述具体改了什么，验证了什么"
```

---

## 🔧 工作习惯

### Plan-Then-Execute（复杂任务）
1. 先输出详细计划，**不要直接写代码**
2. 等人类审核计划后再动手
3. 这样能避免方向性错误导致的返工

### Git Worktree
每个任务用新分支，不要在 main 上直接改。如果需要并行多个任务，用 git worktree。

### 上下文管理
- 任务之间用 `/clear` 清理上下文
- 复杂任务拆成 sub-agent，各自独立上下文

---

## 📋 相关文档

| 文档 | 内容 |
|------|------|
| `docs/ui-design-spec.md` | 设计 token 完整规范 |
| `docs/coding-standards.md` | 编码规范 |
| `docs/agent-first-workflow.md` | 视觉验证基础设施方案 |
