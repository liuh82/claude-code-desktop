# CCDesk UI Redesign v4 — Final Design Spec（严格按设计文件执行）

## 参考文件（必须先全部读取）
- Light 主题 HTML: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/code.html`
- Light 截图: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/screen.png`
- Dark 主题 HTML: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/code.html`
- Dark 截图: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/screen.png`
- Light 设计规范: `/tmp/stitch-final/stitch_main_chat_interface/precision_light/DESIGN.md`
- Dark 设计规范: `/tmp/stitch-final/stitch_main_chat_interface/obsidian_pro/DESIGN.md`

**先读这 6 个文件，再动手改代码。严格按照 HTML 中的颜色值、布局、字体执行。**

---

## 🎨 核心色彩体系

### brand-orange = #D97706（Light 主题的关键 accent 色）
这个颜色在设计稿中大量使用，是 v4 最重要的变化：
- 左侧 Sidebar Logo: `bg-brand-orange` + 白色 "C" 字母
- AI 头像: `bg-brand-orange` + 白色 `smart_toy` 图标
- 用户头像: `bg-brand-orange/20 border border-brand-orange`
- 发送按钮: `bg-brand-orange text-white shadow-lg shadow-brand-orange/20`
- 应用更改按钮: `bg-brand-orange text-white`
- 侧边栏用户头像框: `bg-brand-orange/20 border border-brand-orange`
- 底部 "更改的文件": `text-brand-orange`
- 代码行数进度条可用 `bg-primary`

### Light 主题关键色
```
primary: #005bc0
brand-orange: #D97706
surface: #f8f9fb
surface-container-low: #f0f4f7
surface-container: #e8eff3
surface-container-highest: #d9e4ea
surface-container-lowest: #ffffff
on-surface: #2a3439
on-surface-variant: #566166
outline-variant: #a9b4b9
```

### Dark 主题关键色
```
primary: #adc6ff
secondary: #ddb7ff
tertiary: #ffb95f
surface: #131314
surface-container: #201f20
surface-container-high: #2a2a2b
surface-container-low: #1c1b1c
surface-container-lowest: #0e0e0f
on-surface: #e5e2e3
outline: #8b90a0
outline-variant: #414755
```

### Dark 主题特殊色彩
- Logo/品牌: `#ffb95f`（tertiary 金色）
- 用户头像: `bg-[#ffb95f] text-[#2a1700]`
- AI 头像: `bg-primary-container text-[#adc6ff]`
- 发送按钮: `bg-[#ffb95f] text-[#2a1700] shadow-lg shadow-tertiary/20`
- 接受更改: `bg-primary text-on-primary`
- Diff 文件图标: `text-[#ffb95f]`
- 代码语法高亮: keyword=#adc6ff, type=#ddb7ff, function=#ffb95f, string=#a5d6ff

---

## 🔧 架构变更

### ❌ 去掉 TopNav
- 删除 `src/components/TopNav.tsx` 和 `src/components/TopNav.module.css`
- 从 `src/app/App.tsx` 中移除 `<TopNav>` 组件
- 原本 TopNav 显示的项目路径和模型信息移到**聊天区头部**（Chat Header）

### ✅ Chat Header（替代 TopNav）
位置：聊天区顶部，高度 `h-14`

**Light:**
```jsx
<header class="h-14 flex items-center justify-between px-6 bg-surface border-b border-outline-variant/20">
  <div class="flex items-center gap-3">
    <!-- 项目路径 pill -->
    <div class="flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant">
      <span class="material-symbols-outlined text-sm">folder</span>
      <span>~/projects/xxx</span>
    </div>
    <div class="h-4 w-[1px] bg-outline-variant/30"></div>
    <!-- 模型名 -->
    <div class="flex items-center gap-2 text-xs font-semibold text-primary">
      <span class="material-symbols-outlined text-sm">model_training</span>
      <span>Claude 3.7 Sonnet</span>
    </div>
  </div>
  <div class="flex items-center gap-4">
    <button class="text-on-surface-variant hover:text-on-surface">
      <span class="material-symbols-outlined text-xl">more_horiz</span>
    </button>
  </div>
</header>
```

**Dark:**
```jsx
<header class="h-14 flex items-center justify-between px-6 bg-[#131314]/80 backdrop-blur-md border-b border-white/5">
  <div class="flex items-center gap-2 text-label-md font-mono text-outline/80">
    <span class="material-symbols-outlined text-sm">home</span>
    <span class="text-xs">~/projects/xxx</span>
    <span class="material-symbols-outlined text-xs">chevron_right</span>
    <span class="text-on-surface font-medium">main.ts</span>
  </div>
  <!-- 模型选择器 -->
  <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high/50 border border-outline-variant/10 hover:border-primary/40">
    <div class="w-2 h-2 rounded-full bg-[#adc6ff] animate-pulse"></div>
    <span class="text-xs font-medium text-on-surface-variant">Claude 3.7 Sonnet</span>
    <span class="material-symbols-outlined text-sm text-primary">unfold_more</span>
  </div>
</header>
```

---

## 📐 组件详细规范

### 1. 左侧 Sidebar（64px 宽, w-16）

**Light:**
- 背景: `bg-slate-100` (≈surface-container-low)
- 右边框: `border-r border-slate-200`
- Logo 区: `w-10 h-10 bg-brand-orange rounded-lg flex items-center justify-center text-white font-bold text-xl` — 显示字母 "C"
- 导航图标默认: `text-slate-500 hover:text-slate-900 hover:bg-slate-200`
- 活跃图标: `border-l-2 border-blue-600 text-blue-600 font-semibold bg-white`
- 底部用户: `w-8 h-8 rounded-full bg-brand-orange/20 border border-brand-orange`

**Dark:**
- 背景: `bg-[#201f20]`
- 右边框: `border-r border-white/5 shadow-xl`
- Logo: `text-[#ffb95f] font-black text-xl` + terminal 图标 FILL=1
- 导航默认: `text-[#414755]/80 hover:text-[#adc6ff] hover:bg-[#2a2a2b]`
- 活跃: `text-[#adc6ff] border-l-2 border-[#adc6ff] bg-[#2a2a2b]`
- 底部: `text-[#414755]/80 hover:text-[#adc6ff]`

### 2. 聊天消息布局

**重要：两个主题中，用户消息和 AI 消息都是 LEFT 对齐**（不是 right-aligned）。

**Light:**
- AI 消息:
  - 头像: `w-8 h-8 rounded bg-brand-orange text-white` + `smart_toy` 图标
  - 名称: `text-sm font-semibold text-on-surface` ("Claude Code")
  - 内容: `prose prose-sm text-on-surface-variant leading-relaxed`
- 用户消息:
  - 头像: `w-8 h-8 rounded-full bg-brand-orange/20 border border-brand-orange` + 用户图片或 person 图标
  - 名称: `text-sm font-semibold text-on-surface` ("你")
  - 内容: `prose prose-sm text-on-surface-variant`

**Dark:**
- AI 消息:
  - 头像: `w-8 h-8 rounded bg-primary-container text-[#adc6ff]` + `smart_toy` 图标 FILL=1
  - 内容: `text-on-surface/90 text-[15px] leading-relaxed`
- 用户消息:
  - 头像: `w-8 h-8 rounded bg-[#ffb95f] text-[#2a1700]` + `person` 图标 FILL=1
  - 内容: `text-on-surface text-[15px] leading-relaxed`

### 3. Diff 代码块

**Light:**
- 容器: `bg-surface-container-low rounded-xl border border-outline-variant/20`
- 头部: `px-4 py-2 bg-surface-container flex items-center justify-between`
- 状态标签: `text-green-600` "MODIFIED"
- 操作按钮: 拒绝=`bg-surface-container-lowest border border-outline-variant/20`, 应用=`bg-brand-orange text-white`
- 代码区: `bg-surface-container-lowest p-4 font-mono text-xs`

**Dark:**
- 容器: `bg-black/40 rounded-xl border border-white/5 shadow-2xl`
- 头部: `px-4 py-2 bg-[#201f20] border-b border-white/5`
- 交通灯: `w-2 h-2 rounded-full` — 红/yellow-500/50, 黄/yellow-500/50, 绿/green-500/50（注意小号！）
- 语言标签: `text-[10px] uppercase tracking-widest text-outline font-bold`
- 代码区: `bg-black/20 p-5 font-mono text-[13px] leading-6`
- Diff 增: `diff-added` = `bg rgba(34,197,94,0.12) border-left 3px solid #4ade80`
- Diff 删: `diff-removed` = `bg rgba(239,68,68,0.12) border-left 3px solid #f87171`
- 行号: `w-8 text-right pr-2 text-outline/30 border-r border-white/5 mr-2`
- 语法: `.code-keyword{color:#adc6ff} .code-type{color:#ddb7ff} .code-function{color:#ffb95f} .code-string{color:#a5d6ff}`

### 4. 输入区域

**Light:**
- 外层: `p-6 bg-surface`，`max-w-3xl mx-auto`
- 文本框容器: `bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 p-3`
- Textarea: `bg-transparent border-none text-sm py-2 px-2 resize-none min-h-[44px]`
- 底部分割线: `mt-2 pt-2 border-t border-outline-variant/10`
- 附件按钮: `p-2 text-on-surface-variant hover:bg-surface-container rounded-lg`
- 发送按钮: `bg-brand-orange text-white p-2 rounded-xl hover:bg-brand-orange/90 active:scale-95 shadow-lg shadow-brand-orange/20`
- 底部提示: `text-[10px] text-center mt-3 text-on-surface-variant/60`

**Dark:**
- 外层: `p-6 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent`
- 焦点发光: `absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-tertiary/10 rounded-xl blur opacity-30 group-focus-within:opacity-100`
- 文本框容器: `bg-[#1a1c1e] border border-white/10 rounded-xl p-2 gap-2 shadow-2xl`
- 发送按钮: `w-10 h-10 rounded-lg bg-[#ffb95f] text-[#2a1700] shadow-lg shadow-tertiary/20 hover:scale-105 active:scale-95`
- 快捷键: `text-[10px] text-outline/50`，model token: `text-[10px] text-outline/50`

### 5. 右侧面板

**Light:**
- 背景: `bg-surface-container-low border-l border-outline-variant/20`
- 头部: `h-14 px-4 border-b border-outline-variant/10`，标题 `text-xs font-bold uppercase tracking-widest text-on-surface-variant`
- 文件夹图标: `text-primary` + FILL=1
- 选中文件: `text-blue-600 bg-blue-50/50 border-r-2 border-blue-600`
- 底部上下文区: `p-4 bg-surface-container-high/50 border-t border-outline-variant/20`
  - 标题: `text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter`
  - 数值: `font-mono text-on-surface`
  - 橙色数值: `text-brand-orange`
  - 进度条: `bg-primary w-[65%]` 在 `bg-outline-variant/20` 上

**Dark:**
- 背景: `bg-[#1a1c1e] border-l border-white/5 shadow-[-2px_0_10px_rgba(0,0,0,0.5)]`
- Tab 头: `bg-[#131314] border-b border-white/5`
- 活跃 Tab: `text-primary border-b-2 border-primary bg-[#1a1c1e]`
- 文件图标: `text-[#ffb95f]` (description 图标)
- Diff 行号: `text-outline/30 border-r border-white/5`
- 选中文件: `bg-primary/10 border-l-2 border-primary text-primary`
- 底部操作:
  - 接受: `bg-primary text-on-primary shadow-lg shadow-primary/10`
  - 放弃: `bg-white/5 text-on-surface/80 border border-white/10 hover:bg-white/10`

### 6. Tool Call 块

**Dark:**
- `flex items-center gap-3 px-4 py-3 rounded-lg bg-[#201f20] border border-white/5 w-fit cursor-pointer hover:bg-surface-container`
- 图标: `text-primary text-lg`
- 文本: `text-[13px] font-medium text-on-surface-variant/80`

---

## 🚀 执行步骤

1. **先读参考文件** — 读取上述 6 个文件
2. **更新 CSS 变量** — `src/styles/globals.css` 添加 `--brand-orange: #D97706`，更新 Dark 的 tertiary 等
3. **删除 TopNav** — 移除组件和引用
4. **新增 ChatHeader** — 在聊天区顶部，显示项目路径和模型信息
5. **修改 Sidebar** — Logo 用 brand-orange + "C" 字母，图标颜色按新规范
6. **修改 MessageBubble** — 改回 LEFT 对齐（两个主题都是），头像用 brand-orange 配色
7. **修改 InputArea** — 发送按钮 brand-orange，Dark 用 tertiary 金色
8. **修改 ToolPanel** — 右侧面板配色按新规范
9. **修改 CodeBlock** — Dark 代码块用黑底 + 语法高亮色
10. **修改 ToolCallBlock** — Dark 样式
11. **tsc --noEmit** — 零错误
12. **npm run build** — 成功
13. **git add -A && git commit** — message: `design: apply v4 final UI redesign`

## ⚠️ 关键差异（v3 → v4）
1. **去掉 TopNav**，用 Chat Header 替代
2. **消息都是 LEFT 对齐**，不是用户 right-aligned
3. **brand-orange (#D97706)** 是核心 accent 色，不仅限于 CTA 按钮
4. **Dark 主题发送按钮用 tertiary (#ffb95f)** 金色，不用 primary 蓝
5. **Dark 代码块用黑底** (bg-black/40)，不用 surface-container-lowest
6. **AI 头像** Light=brand-orange 背景，Dark=primary-container 背景
7. **用户头像** Light=brand-orange/20 边框，Dark=#ffb95f 背景

## ⚠️ 注意事项
- 所有中文 UI 文案保持不变
- 不要删除任何功能逻辑
- 不要用 claude-icon-32.png 了，用 smart_toy 图标 + 品牌色背景
- 两个主题都必须改
- TypeScript 编译零错误
