# CCDesk UI 设计规范

> 基于 Google Stitch 导出的设计稿提取。**所有 UI 改动以本文档为准，不要猜数值。**

---

## 设计稿位置

| 主题 | 路径 |
|------|------|
| Light (Orange Accent) | `/tmp/stitch-new/stitch_main_chat_interface/main_chat_full_light_orange_accent_v2/code.html` |
| Dark (CN) | `/tmp/stitch-new/stitch_main_chat_interface/main_chat_desktop_dark_cn/code.html` |

工具：`stitch-mcp`（已安装）可直接读取。

---

## 颜色系统

### Light 主题

| 用途 | Token | 色值 | Tailwind 对应 |
|------|-------|------|-------------|
| 背景 | `--bg-primary` | `#f8f9fb` | `bg-surface` |
| 侧边栏 | `--bg-secondary` | `#f0f4f7` | `bg-surface-container-low` |
| 卡片 | `--bg-elevated` | `#e8eff3` | `bg-surface-container` |
| 悬停 | `--bg-hover` | `#d9e4ea` | `bg-surface-container-highest` |
| 输入框 | `--bg-input` | `#ffffff` | `bg-surface-container-lowest` |
| 主文字 | `--text-primary` | `#2a3439` | `text-on-surface` |
| 次文字 | `--text-muted` | `#566166` | `text-on-surface-variant` |
| 边框 | `--border` | `#a9b4b9` | `border-outline-variant` |
| **品牌橙** | `--brand-orange` | **`#D97706`** | — |
| 品牌橙暗 | `--brand-orange-hover` | `#B45309` | — |
| 成功 | `--success` | `#22c55e` | — |
| 错误 | `--error` | `#ef4444` | — |

### Dark 主题

| 用途 | Token | 色值 |
|------|-------|------|
| 背景 | `--bg-primary` | `#131314` |
| 侧边栏 | `--bg-secondary` | `#201f20` |
| 主文字 | `--text-primary` | `#e5e2e3` |
| 边框 | `--border` | `#414755` |
| **主色** | `--accent` | `#adc6ff` |
| **品牌金** | `--brand-orange` | `#ffb95f` |

---

## 字体

| 用途 | 字体 | 字号 |
|------|------|------|
| UI 文字 | Inter, Noto Sans SC, PingFang SC | 14-15px |
| 代码 | JetBrains Mono, SF Mono | 13px |
| 标签 | Inter | 10-11px uppercase bold |
| Material Symbols | Material Symbols Outlined | 18-20px |

### 字号梯度

```
--font-size-2xs: 11px   (标签)
--font-size-xs:  12px   (辅助)
--font-size-sm:  13px   (正文)
--font-size-base: 14px  (基础)
--font-size-md:  15px   (AI 回答正文)
--font-size-lg:  16px   (用户消息正文)
--font-size-xl:  18px   (小标题)
--font-size-2xl: 21px   (标题)
```

---

## 圆角

```
--radius-xs:   2px    (小元素)
--radius-sm:   4px    (默认)
--radius-md:   8px    (按钮、输入框)
--radius-lg:   12px   (卡片)
--radius-xl:   16px   (输入框)
--radius-2xl:  24px   (气泡)
--radius-full: 24px   (圆形)
```

---

## 布局规范

### 侧边栏

| 属性 | 值 | 来源 |
|------|---|------|
| 宽度 | 48px | Stitch `w-16`(64px)，实际用 48px |
| 背景 | `surface-container-low` | `#f0f4f7` / `#201f20` |
| Logo | 32×32px, `rounded-lg`, 渐变橙色 | 设计图头像风格 |
| 导航图标 | 20px | Stitch `text-[20px]` |
| 导航项 | `padding: 8px 0`, 居中 | — |
| Active | brand-orange 底色 + 3px 左边框 | — |
| 底部 | 主题切换 + 设置 | — |

### 聊天区

| 属性 | 值 | 来源 |
|------|---|------|
| 最大宽度 | 768px, 居中 | Stitch `max-w-3xl mx-auto` |
| 消息间距 | 40px | Stitch `space-y-10` |
| AI 消息 | 左对齐 | — |
| 用户消息 | 右对齐, `max-width: 80%` | Stitch `justify-end` |
| 消息内间距 | `gap: 24px` | Stitch `gap-6` |
| 头像 | 32×32px, `rounded-lg` | Stitch `w-8 h-8 rounded-lg` |

### 用户消息气泡

| 属性 | 值 | 来源 |
|------|---|------|
| 背景 | `rgba(217,119,6,0.06)` Light / `rgba(255,185,95,0.08)` Dark | — |
| 边框 | `rgba(217,119,6,0.12)` | — |
| 圆角 | `24px 24px 24px 4px` | Stitch `rounded-3xl rounded-tr-sm` |
| 内距 | `16px 24px` | Stitch `px-6 py-4` |
| 文字 | 14px, medium | Stitch `text-[14px] font-medium` |

### 输入框

| 属性 | 值 | 来源 |
|------|---|------|
| 最小高度 | 100px | — |
| 圆角 | 16px | Stitch `rounded-2xl` |
| 内距 | `20px 24px` | Stitch `px-5 py-5` |
| 文字 | 14px | Stitch `text-[14px]` |
| 发送按钮 | 32×32px, `rounded-lg`, brand-orange bg | Stitch `p-2 rounded-xl bg-orange-500` |

### 代码块

| 属性 | 值 | 来源 |
|------|---|------|
| 圆角 | 12px | Stitch `rounded-xl` |
| Header | `px-4 py-2.5`, traffic lights (红黄绿圆点 12px) | Stitch |
| 代码 | `p-5`, 13px monospace | Stitch |
| 语法色 | keyword: `#005bc0`, string: `#0891b2`, comment: `#94a3b8` | — |

### 工具调用卡片

| 属性 | 值 | 来源 |
|------|---|------|
| 背景 | `brand-orange/5` + `border brand-orange/30` | Stitch `bg-primary/5 border-primary/30` |
| 圆角 | 12px | Stitch `rounded-xl` |
| 内距 | `14px` | Stitch `p-3.5` |
| 图标 | 28×28px, `rounded-lg`, `brand-orange/20` | Stitch `w-7 h-7 rounded-lg` |

---

## 交互规范

### 侧边栏图标

- 非活跃：`color: var(--text-muted)`
- Hover：`background: var(--bg-hover)` 或 `bg-hover-subtle`
- Active：`background: brand-orange/10` + `border-left: 3px solid brand-orange` + `color: brand-orange`
- 暗色 Active：`#ffb95f` 系列

### 按钮

- 主按钮：`brand-orange` 背景, 白色文字, shadow
- 暗色主按钮：`#ffb95f` 背景, `#2a1700` 文字
- 次按钮：透明背景, border-ghost 边框
- Hover：微上移 `translateY(-1px)`

### 输入框 Focus

- Light: `border-color: brand-orange`, `box-shadow: 0 0 0 4px rgba(217,119,6,0.05)`
- Dark: `border-color: #ffb95f`, `box-shadow: 0 0 0 4px rgba(255,185,95,0.05)`

---

## ❌ 不要做的事

1. **不要猜数值** — 不确定就查 Stitch HTML 或用 stitch-mcp
2. **不要用 inline style 覆盖 CSS** — 优先级问题（已踩坑 5+ 次）
3. **不要改 class selector 名** — TSX 引用会断裂
4. **不要用 `width: 100%` 在 flex 子元素上** — 会阻止 max-width + margin auto 居中
5. **不要忘记同步 JS auto-resize 最小值** — `Math.max(scrollHeight, N)` 中的 N 要和 CSS `min-height` 一致

---

*更新方式：设计稿变更时，用 stitch-mcp 重新提取 token 并更新本文档。*
