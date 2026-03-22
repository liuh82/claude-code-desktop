# CCDesk UI Redesign v3 — 严格按设计文件执行

## 参考文件
- **Light 主题**: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_full_light_orange_accent_v2/code.html` + `screen.png`
- **Dark 主题**: `/tmp/stitch-new/stitch_main_chat_interface/main_chat_desktop_dark_cn/code.html` + `screen.png`
- **Light 设计规范**: `/tmp/stitch-new/stitch_main_chat_interface/precision_light/DESIGN.md`
- **Dark 设计规范**: `/tmp/stitch-new/stitch_main_chat_interface/obsidian_pro/DESIGN.md`

**必须先读取这4个文件**，严格按照其中的颜色值、布局、字体来修改代码。

---

## 核心改动清单

### 1. 全局 CSS 变量（最优先）

#### Light 主题变量
```
--primary: #005bc0
--primary-dim: #004fa9
--primary-container: #d8e2ff
--on-primary: #f7f7ff
--on-primary-container: #004fa8
--surface: #f8f9fb
--surface-container-low: #f0f4f7
--surface-container: #e8eff3
--surface-container-high: #e1e9ee
--surface-container-highest: #d9e4ea
--surface-container-lowest: #ffffff
--on-surface: #2a3439
--on-surface-variant: #566166
--outline: #717c82
--outline-variant: #a9b4b9
--secondary: #57606a
--tertiary: #37647c
--background: #f8f9fb
--error: #ef4444
--success: #22c55e
```

#### Dark 主题变量
```
--primary: #adc6ff
--primary-dim: #adc6ff
--primary-container: #4b8eff
--on-primary: #002e69
--on-primary-container: #00285c
--surface: #131314
--surface-container-low: #1c1b1c
--surface-container: #201f20
--surface-container-high: #2a2a2b
--surface-container-highest: #353436
--surface-container-lowest: #0e0e0f
--on-surface: #e5e2e3
--on-surface-variant: #c1c6d7
--outline: #8b90a0
--outline-variant: #414755
--secondary: #ddb7ff
--tertiary: #ffb95f
--background: #131314
--surface-tint: #adc6ff
--error: #ffb4ab
```

#### 通用设计规则
- **禁止 1px solid border 用于分区**。用背景色差分界（"No-Line Rule"）
- **Ghost Border**: 如需边框用 `outline-variant` 20% 透明度
- **Glassmorphism**: 浮层用 85% opacity + 20px backdrop-blur
- **圆角**: 默认 0.125rem, lg=0.25rem, xl=0.5rem, full=0.75rem
- **阴影**: 多层环境光阴影，不要重的 drop-shadow

### 2. TopNav 组件

#### Light:
- 背景: `bg-white/90 backdrop-blur-xl`
- 底边: `border-b border-outline-variant/30`（即 `#a9b4b9` 30%）
- 高度: h-10 (40px)
- 左侧: "Claude Code" 用 `font-black text-primary uppercase text-xs tracking-tight`
- 菜单项: `text-on-surface-variant hover:text-primary font-semibold tracking-tight text-xs uppercase`
- 活跃菜单: `text-primary border-b-2 border-primary pb-1`
- 右侧项目路径: `bg-primary-container/20 px-3 py-1 rounded-full border border-primary/20` + 文本 `text-[10px] text-primary font-mono font-bold`
- Deploy 按钮: `bg-orange-500 text-on-primary px-4 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-orange-500/30`

#### Dark:
- 背景: `bg-[#131314]/80 backdrop-blur-xl`
- 底边: `border-[#414755]/20`
- "Claude Code": `font-black text-[#e5e2e3] uppercase text-xs tracking-tight`
- 活跃菜单: `text-[#adc6ff] border-b-2 border-[#adc6ff]`
- 项目路径: `bg-surface-container-lowest rounded-lg border border-outline-variant/10`
- Deploy: `bg-primary hover:bg-primary-container text-on-primary-container`

### 3. Sidebar 导航

#### Light:
- 背景: `bg-surface-container-low`（#f0f4f7）
- 右边框: `border-r border-outline-variant/30`
- Logo 区: 圆角图标 `bg-gradient-to-br from-primary to-indigo-600 shadow-md shadow-primary/30`，标题用渐变 `bg-gradient-to-r from-primary to-indigo-600`
- 活跃项: `bg-primary/10 text-primary border-l-[3px] border-primary`
- 默认项: `text-on-surface-variant hover:bg-surface-container`（hover 时文字变为各图标特色色：indigo-600/amber-600/blue-600/emerald-600）
- 用户卡片: `bg-surface-container-highest/30 border border-outline-variant/10`

#### Dark:
- 背景: `#201f20`
- Logo: `bg-primary-container/20`，标题 `text-[#adc6ff]`
- 活跃项: `bg-[#2a2a2b] text-[#adc6ff] border-l-2 border-[#adc6ff]`
- 默认项: `text-[#939393] hover:bg-[#2a2a2b] hover:text-[#e5e2e3]`
- 用户卡片: 底部分隔线 `border-t border-outline-variant/10`

### 4. 聊天消息

#### AI 消息:
- **Light**: 头像 `bg-gradient-to-br from-primary to-blue-600 shadow-md shadow-primary/20`，smart_toy 图标
- **Dark**: 头像 `bg-primary-container`，smart_toy 图标 FILL=1
- 文本: `text-on-surface text-[15px] leading-relaxed`
- 代码高亮: `bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono`

#### 用户消息:
- **Light**: `bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-3xl rounded-tr-sm shadow-sm`，`text-[14px] text-indigo-900 font-medium`
- **Dark**: 简洁背景，`text-sm`
- 头像: Light 用 `bg-indigo-600 shadow-md shadow-indigo-200`，Dark 用 `bg-surface-container-high`

### 5. 代码块

#### Light:
- 容器: `rounded-xl border border-outline-variant/40 bg-white overflow-hidden shadow-sm`
- 头部: `bg-surface-container/50 border-b border-outline-variant/10`
- 交通灯: 红 `bg-red-400` 黄 `bg-amber-400` 绿 `bg-emerald-400`，各 `w-3 h-3 rounded-full`
- 语言标签: `text-[11px] font-bold font-mono text-primary uppercase tracking-widest`
- 代码区: `p-5 text-[13px] font-mono leading-relaxed text-on-surface-variant`
- 语法: keyword=#005bc0, string=#0891b2, comment=#94a3b8 italic

#### Dark:
- 容器: `rounded-lg bg-surface-container-lowest border border-outline-variant/20`
- 头部: `bg-surface-container text-[10px] text-outline font-mono`
- 代码区: `p-4 font-mono text-sm`

### 6. 工具调用标签

#### Light:
- `bg-primary/5 border border-primary/30 p-3.5 rounded-xl shadow-sm`
- 图标: `bg-primary/20 text-primary`
- 文字: `text-[13px] text-primary font-bold`

#### Dark:
- `bg-surface-container-low rounded-lg p-3 border-l-4 border-primary/40`
- 文字: `text-xs font-mono text-outline`

### 7. 输入区域

#### Light:
- 外框: `p-6 bg-white/60 backdrop-blur-xl border-t border-outline-variant/20`
- 文本框: `bg-white border-2 border-outline-variant/20 rounded-2xl px-5 py-5 pr-14 text-[14px] focus:ring-4 focus:ring-primary/5 focus:border-primary/40 resize-none min-h-[64px] shadow-sm`
- 发送按钮: `bg-orange-500 text-on-primary shadow-lg shadow-orange-500/30 hover:brightness-110 hover:-translate-y-0.5 rounded-xl`
- 附件按钮: `text-outline hover:text-indigo-600 hover:bg-indigo-50`
- 状态栏: 模型名 `text-emerald-600 font-bold`，编码 `text-blue-600`，快捷键 `bg-primary/5 px-2 py-0.5 rounded`

#### Dark:
- 外框: `p-4 border-t border-outline-variant/10 bg-surface`
- 文本框: `bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2 focus-within:border-primary`
- 发送按钮: `bg-primary text-on-primary rounded-lg`
- 状态: `text-[10px] text-outline`

### 8. 右侧工具面板

#### Light:
- 文件树头部: `bg-white border-b border-outline-variant/10`，标题 `text-[11px] font-black text-primary uppercase tracking-widest`
- 文件树背景: `bg-surface-container-low/30`
- 选中文件: `bg-primary/10 border border-primary/20 shadow-sm`
- Diff 头部: `bg-surface-container/30`，标题 `text-[11px] font-black text-on-surface-variant uppercase`
- Diff 背景: `bg-surface-container-lowest`
- 增删行: 绿 `bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700`，红 `bg-red-50 border-l-4 border-red-500 text-red-700`
- 操作按钮: 拒绝=`bg-surface-container-highest/50`，通过=`bg-orange-500 text-on-primary shadow-lg shadow-orange-500/30`

#### Dark:
- 背景: `bg-surface-container-low`
- Diff: `bg-surface-container-lowest`，增=`bg-green-900/20 text-green-400`，删=`bg-red-900/20 text-red-400`
- 操作按钮: 通过=`bg-primary text-on-primary shadow-lg shadow-primary/10`

### 9. StatusBar

#### Light:
- `bg-white border-t border-outline-variant/20 h-7`
- 分支: `text-indigo-500`，hover `bg-indigo-50`
- 错误: `text-red-500`
- Ready: `bg-emerald-500` 圆点
- Token: `bg-primary/5 text-primary`
- 编码: `text-blue-600`
- 语言: `text-amber-600`

#### Dark:
- `bg-surface-container h-6 border-t border-outline-variant/10`
- Ready: `bg-primary animate-pulse`
- 所有文本: `text-outline`

### 10. 应用图标
- 左上角 Logo 保持 `terminal` Material Symbol + 渐变背景（Light: `from-primary to-indigo-600`，Dark: `bg-primary-container/20`）
- 如果有 claude-icon.png，用 `<img>` 替代 terminal icon

---

## 执行要求

1. **先读参考文件**：读取 `/tmp/stitch-new/stitch_main_chat_interface/` 下所有 4 个文件
2. **全局替换 CSS 变量**：先更新 `index.css` / `global.css` / theme 文件中的所有 CSS 变量
3. **逐组件修改**：按上面 10 个清单顺序修改
4. **保持中文 UI**：所有界面文案保持中文
5. **保持功能完整**：不要删除任何功能逻辑，只改样式和布局
6. **两个主题都要改**：Light 和 Dark 都按设计文件来
7. **TypeScript 编译**：最后 `tsc --noEmit` 确保零错误
8. **Build 验证**：`npm run build` 确保成功
9. **Git commit**：完成后 commit，message 格式 `design: apply v3 UI redesign from stitch spec`

## 特别注意
- Light 主题的 CTA 按钮（发送、Deploy、通过更改）用 **橙色 bg-orange-500**，不是蓝色
- Dark 主题的 CTA 按钮用 **primary 色** (#adc6ff 背景)
- 用户消息气泡 Light 用 **indigo 系** (bg-indigo-50)，不是紫色
- Ghost Border: `border-outline-variant/20` 或 `border-outline-variant/30`
- 代码块交通灯 Light 要比之前的小（w-3 h-3 而非 w-2.5 h-2.5）
