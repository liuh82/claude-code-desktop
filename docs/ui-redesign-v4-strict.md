# CCDesk v4 UI Redesign — STRICT MODE

## 参考设计文件（必须先全部读取）
- Light HTML: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/code.html`
- Dark HTML: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/code.html`
- Light 截图: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/screen.png`
- Dark 截图: `/tmp/stitch-final/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/screen.png`
- Light 设计规范: `/tmp/stitch-final/stitch_main_chat_interface/precision_light/DESIGN.md`
- Dark 设计规范: `/tmp/stitch-final/stitch_main_chat_interface/obsidian_pro/DESIGN.md`

**先读取上述 6 个文件**，然后读取下方"需修改的文件清单"中的每一个文件。

---

## 🚨 绝对规则（违反 = 失败）

1. **FORBID** 重命名任何 CSS class selector（`.className` 不能改名）
2. **FORBID** 添加新的 CSS class selector（不能在 .module.css 中新增 `.xxx { ... }`）
3. **FORBID** 删除任何 CSS class selector
4. **FORBID** 修改任何 .tsx 文件中的 `styles.xxx` 引用
5. **ONLY ALLOW** 修改 CSS property 的值（颜色、背景、边框、阴影、间距、字体等）
6. **ONLY ALLOW** 修改 CSS custom properties (`--variable: value`)
7. **EXCEPTION**: 以下 3 个文件允许有限的 TSX 修改：
   - `src/app/App.tsx` — 允许删除 TopNav 引用，添加 ChatHeader
   - `src/components/Chat/ChatHeader.tsx` — 新建文件
   - `src/components/Chat/ChatHeader.module.css` — 新建文件

---

## 需修改的文件清单

### Phase 1: globals.css（只改 CSS 变量值）
**文件**: `src/styles/globals.css`
- 读取当前文件，理解所有已有变量
- 添加新的 CSS 变量（不能删除已有的）:
  ```
  --brand-orange: #D97706;  /* Light */
  --brand-orange-hover: #B45309;
  --brand-orange-muted: rgba(217, 119, 6, 0.10);
  ```
  Dark theme 区块添加:
  ```
  --brand-orange: #ffb95f;
  --brand-orange-hover: #ffb95f;
  --brand-orange-muted: rgba(255, 185, 95, 0.10);
  ```
- 更新已有 `--cta` 变量指向 brand-orange（Light: #D97706, Dark: #ffb95f）
- 可以调整已有颜色变量值来匹配设计稿，但不能删除变量

### Phase 2: App.tsx + 新建 ChatHeader
**文件**: `src/app/App.tsx`
- 删除 `import { TopNav }` 行
- 删除 JSX 中的 `<TopNav projectName={projectName} />` 行
- 添加 `import { ChatHeader } from '@/components/Chat/ChatHeader';`
- 在 `<TabBar projectPath={projectPath} />` 之后添加 `<ChatHeader />`
- 其他所有代码不动

**新建文件**: `src/components/Chat/ChatHeader.tsx`
```tsx
import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import styles from './ChatHeader.module.css';

function ChatHeader() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const currentModel = useChatStore((s) => s.currentModel);
  const { settings } = useSettingsStore();
  const projectPath = activeProject?.path ?? '';
  const projectName = activeProject?.name || projectPath.split('/').pop() || '';
  const displayModel = currentModel || settings.defaultModel || 'claude-sonnet-4-6';
  const modelLabel = displayModel.replace('claude-', '').replace(/-\d{8}$/, '');

  return (
    <header className={styles.chatHeader}>
      <div className={styles.headerLeft}>
        <div className={styles.pathPill}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
          <span>{projectPath ? `~/${projectName}` : '~/projects'}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.modelInfo}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>model_training</span>
          <span>{modelLabel}</span>
        </div>
      </div>
      <div className={styles.headerRight}>
        <button className={styles.moreBtn} title="更多选项">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_horiz</span>
        </button>
      </div>
    </header>
  );
}

export { ChatHeader };
```

**新建文件**: `src/components/Chat/ChatHeader.module.css`
```css
.chatHeader {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid rgba(169, 180, 185, 0.20);
  flex-shrink: 0;
}

[data-theme="dark"] .chatHeader {
  background: rgba(19, 19, 20, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pathPill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--bg-secondary);
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}

[data-theme="dark"] .pathPill {
  background: transparent;
  border-radius: 0;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.80;
}

.divider {
  width: 1px;
  height: 16px;
  background: rgba(169, 180, 185, 0.30);
}

[data-theme="dark"] .divider {
  display: none;
}

.modelInfo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}

.moreBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s;
}

.moreBtn:hover {
  color: var(--text-primary);
}
```

### Phase 3: 组件 CSS（只改值，不改 class 名）

对以下每个文件：
1. 读取当前 `.module.css` 文件
2. 读取对应 `.tsx` 文件（仅为了理解哪些 class 被使用）
3. 参考设计文件中的颜色/样式
4. **只修改 CSS property 值**，不添加不删除 class

需要修改的 CSS 文件（按优先级）：

**3a. Sidebar.module.css** — 参考 Light sidebar `bg-slate-100`、nav colors、brand-orange logo
**3b. MessageBubble.module.css** — 参考 Light/Dark 头像配色、消息布局（左对齐）
**3c. InputArea.module.css** — 参考 Light/Dark 输入框样式、brand-orange 发送按钮
**3d. CodeBlock.module.css** — 参考 Dark `bg-black/40`、交通灯小号、语法高亮色
**3e. ToolCallBlock.module.css** — 参考 Dark `bg-[#201f20]` 工具调用样式
**3f. StatusBar.module.css** — 参考底部状态栏配色
**3g. ToolPanel.module.css** — 参考右侧面板背景色
**3h. DiffView.module.css** — 参考 diff 增删行颜色、头部样式
**3i. FileTree.module.css** — 参考文件树配色
**3j. TabBar.module.css** — 参考标签栏样式
**3k. TerminalPane.module.css** — 参考面板头部样式
**3l. ChatView.module.css** — 聊天容器背景色

---

## 核心配色速查

### Light 主题
| 用途 | 颜色 |
|------|------|
| brand-orange | #D97706 |
| primary | #005bc0 |
| surface/bg | #f8f9fb |
| surface-container | #e8eff3 |
| surface-container-low | #f0f4f7 |
| surface-container-lowest | #ffffff |
| on-surface | #2a3439 |
| on-surface-variant | #566166 |
| outline-variant | #a9b4b9 |
| AI 头像 | bg-brand-orange, white smart_toy |
| 用户头像 | bg-brand-orange/20, border-brand-orange |
| 发送按钮 | bg-brand-orange, shadow-brand-orange/20 |
| 活跃 nav | border-l-2 border-blue-600 text-blue-600 bg-white |
| 默认 nav | text-slate-500 hover:text-slate-900 |

### Dark 主题
| 用途 | 颜色 |
|------|------|
| brand-orange / tertiary | #ffb95f |
| primary | #adc6ff |
| secondary | #ddb7ff |
| surface/bg | #131314 |
| surface-container | #201f20 |
| surface-container-high | #2a2a2b |
| surface-container-low | #1c1b1c |
| surface-container-lowest | #0e0e0f |
| on-surface | #e5e2e3 |
| outline | #8b90a0 |
| outline-variant | #414755 |
| AI 头像 | bg-primary-container (#4b8eff/20), text-primary |
| 用户头像 | bg-[#ffb95f], text-[#2a1700] |
| 发送按钮 | bg-[#ffb95f], text-[#2a1700], shadow-tertiary/20 |
| 代码块 | bg-black/40, border-white/5 |
| 语法 keyword | #adc6ff |
| 语法 type | #ddb7ff |
| 语法 function | #ffb95f |
| 语法 string | #a5d6ff |
| 活跃 nav | border-l-2 border-[#adc6ff] text-[#adc6ff] bg-[#2a2a2b] |
| 默认 nav | text-[#414755]/80 hover:text-[#adc6ff] |

### Ghost Border 规则
- 禁止 1px solid border 用于分区
- 必须时用 `rgba(169,180,185,0.20)` (Light) 或 `rgba(255,255,255,0.05)` (Dark)
- 或用背景色差分界

---

## 执行后验证

1. `npx tsc --noEmit` — 零错误（忽略 TS6133 unused variable 警告）
2. `npm run build` — 成功
3. `git add -A && git commit -m "design: v4 UI — brand-orange theme, no TopNav, ChatHeader"`

## ⚠️ 重要提醒
- **不要改任何 .tsx 文件中的 styles.xxx 引用**
- **不要在 .module.css 中新增或重命名 class**
- **只能修改已有 class 里面的 property 值**
- **功能逻辑完全不动**
- 如果你不确定某个值该改成什么，参考设计 HTML 中的 Tailwind class 推导
