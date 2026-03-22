# CCDesk — Claude Code Desktop

> Agent-First 项目。所有规则在下面，遵守即可。

---

## 🚨 绝对规则

1. **禁止 inline style** — 所有样式通过 CSS class 或 CSS 变量
2. **禁止 `width: 100%` 在 flex 子元素上** — 会阻止 max-width + margin auto 居中
3. **JS ↔ CSS 同步** — `Math.max(scrollHeight, N)` 中的 N 必须和 CSS `min-height` 一致（当前 N=100）
4. **不要猜数值** — 间距/颜色/字号从设计稿提取，不要凭感觉
5. **dist/ 不在 git 里** — 不要提交 dist/，不要依赖 dist/ 里的内容验证

---

## 🏗️ 架构

- **框架**: Tauri v2 + React 18 + TypeScript + Zustand + SQLite
- **布局**: 48px icon-only Sidebar + 多面板 ChatView + 可选 ToolPanel
- **CSS**: CSS Modules（.module.css），全局变量在 `src/styles/globals.css`
- **构建**: `npm run build`（Vite），用户用 `npm run electron:build` 打包

### 目录结构

```
src/
├── app/                    # App 入口 + 主题
├── components/
│   ├── Chat/               # 聊天核心（ChatView, InputArea, MessageBubble, CodeBlock...）
│   ├── Sidebar/            # 48px 图标侧边栏
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

### 设计稿位置
- Light: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_full_light_orange_accent_v2/code.html`
- Light 截图: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_full_light_orange_accent_v2/screen.png`
- Dark: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_desktop_dark_cn/code.html`
- Dark 截图: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_desktop_dark_cn/screen.png`
- 工具: `stitch-mcp`（已安装）可直接读取设计文件

### 颜色速查

| 用途 | Light | Dark |
|------|-------|------|
| brand-orange | #D97706 | #ffb95f |
| accent | #005bc0 | #adc6ff |
| bg-primary | #f8f9fb | #131314 |
| bg-secondary | #e8eff3 | #201f20 |
| bg-input | #ffffff | #0e0e0f |
| text-primary | #2a3439 | #e5e2e3 |
| text-muted | #566166 | #8b90a0 |
| border-ghost | rgba(169,180,185,0.20) | rgba(255,255,255,0.05) |
| code-bg | #f8f9fb | rgba(0,0,0,0.40) |

### 关键布局值
- Sidebar: 48px 宽，icon-only
- 消息区: max-width 768px, margin 0 auto
- 消息间距: gap 24px
- AI 消息 LEFT（头像左），用户消息 RIGHT（头像右）
- 用户气泡: border-radius 24px 24px 24px 4px
- 输入框: min-height 100px, max-height 200px, border-radius 16px
- 发送按钮: 36x36px, bg brand-orange, 圆角 12px

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
- `/tmp/stitch-new/.../screen.png`（Light 设计稿）
- `/tmp/ccdesk-after/light-main.png`（实际效果）

### Step 5: 自 Review 清单
对着截图逐项检查：
- [ ] 消息布局是 AI 左 / 用户右吗？
- [ ] 输入框 min-height 至少 100px 吗？
- [ ] 侧边栏是 48px icon-only 吗？
- [ ] 发送按钮是 brand-orange 吗？
- [ ] 消息区居中（max-width 768px）吗？
- [ ] 有没有残留的 inline style？
- [ ] Dark 模式颜色正确吗？

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
| `docs/harness-methodology-cn.md` | Harness 方法论中文版 |
| `docs/harness-deep-analysis.md` | Harness 深度解读 |
