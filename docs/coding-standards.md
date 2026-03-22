# CCDesk 编码规范

> 所有 Agent 和开发者修改此项目时必须遵守。**违反 = bug。**

---

## 1. CSS 规则（最重要）

### 1.1 绝对禁止

| ❌ 禁止 | 原因 | ✅ 替代 |
|---------|------|--------|
| 改 class selector 名 | TSX 引用断裂，全量崩溃 | 只改 property 值 |
| inline style 覆盖 CSS | 优先级混乱，难以维护 | CSS Modules + variables |
| `width: 100%` 在 flex 子元素 | 阻止 `max-width + margin: auto` 居中 | 去掉 `width: 100%` 或用 `width: auto` |
| 新增 class 不写 `.module.css` | 全局污染 | 所有样式必须在 `.module.css` |

### 1.2 CSS 变量

所有颜色、间距、圆角必须用 `globals.css` 中定义的 CSS 变量：

```css
/* ✅ 正确 */
color: var(--brand-orange);
padding: var(--space-4);

/* ❌ 错误 */
color: #D97706;
padding: 16px;
```

例外：动态计算值（如 JS 计算的宽度）可用 inline style。

### 1.3 JS ↔ CSS 同步

如果 CSS 设了 `min-height: N`，JS auto-resize 的 `Math.max(scrollHeight, N)` 必须同步。

---

## 2. TypeScript 规则

### 2.1 组件

```typescript
// ✅ function 声明
function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}

// ❌ 箭头函数
const MyComponent = ({ title }: MyComponentProps) => {
  return <div>{title}</div>;
};
```

### 2.2 Props

```typescript
// ✅ 必须定义 interface
interface MyComponentProps {
  title: string;
  onAction: (id: string) => void;
  count?: number; // 可选用 ?
}
```

### 2.3 Hooks 顺序

```
useState → useRef → useEffect → useCallback → useMemo → 自定义 hooks
```

### 2.4 导入

```typescript
// ✅ 绝对路径
import { Sidebar } from '@/components/Sidebar/Sidebar';

// ❌ 相对路径深层
import { Sidebar } from '../../components/Sidebar/Sidebar';
```

---

## 3. 状态管理

### 3.1 Store 结构

```typescript
// ✅ state 和 actions 分离
interface ChatState {
  // State
  messages: Message[];
  isStreaming: boolean;
  
  // Actions
  sendMessage: (text: string) => void;
  clearChat: () => void;
}
```

### 3.2 禁止

| ❌ | ✅ |
|----|----|
| 在组件内直接修改 store state | 通过 store 的 action 修改 |
| store 之间直接互相调用 | 通过组件桥接 |
| `any` 类型 | 明确类型定义 |

---

## 4. 文件规范

### 4.1 大小限制

- **单文件 < 500 行** — 超过必须拆分
- 超过时优先按职责拆分（render / logic / types）

### 4.2 命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件文件 | PascalCase.tsx | `MessageBubble.tsx` |
| 样式文件 | PascalCase.module.css | `MessageBubble.module.css` |
| Store | camelCase.ts | `useChatStore.ts` |
| Hook | camelCase.ts | `useKeyboard.ts` |
| 类型 | camelCase.ts | `chat.ts`, `pane.ts` |
| 工具函数 | camelCase.ts | `format.ts` |

### 4.3 目录结构（当前）

```
src/
├── app/          → App.tsx (根组件)
├── components/
│   ├── Chat/     → 聊天相关
│   ├── Sidebar/  → 侧边栏
│   ├── ToolPanel/→ 工具面板
│   ├── Pane/     → 面板容器
│   └── *.tsx     → 顶层组件
├── hooks/        → 自定义 hooks
├── stores/       → Zustand stores
├── styles/       → globals.css, theme
├── types/        → 类型定义
└── lib/          → claude-api.ts 等
```

---

## 5. Git 规范

### Commit 格式

```
<type>: <简短描述>
```

type: `feat` | `fix` | `refactor` | `style` | `chore` | `docs` | `test`

### 提交前检查

```bash
npx tsc --noEmit    # 零错误
npm run build       # 构建成功
```

### 不要提交

- `dist/` — 构建产物
- `node_modules/` — 依赖
- `.claude/` — CC 工作目录

---

## 6. 设计稿对齐

修改 UI 时的工作流：

1. 用 `stitch-mcp` 读取设计稿 → 获取精确 token
2. 或手动查 `docs/ui-design-spec.md` 中的数值
3. 只改 CSS property 值
4. `npm run build` 验证
5. 截图对比（如可能）

**不确定时，查文档，不要猜。**

---

*此文档从实际踩坑经验中提炼。发现新坑时立即更新。*
