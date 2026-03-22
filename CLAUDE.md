# CCDesk — Claude Code Desktop

> ⚠️ 启动时先读 `AGENTS.md` — 这是项目文档索引，包含所有相关文档的导航。

```
⚠️ 启动时先读 AGENTS.md，然后按需读相关文档。不要猜，不要跳过。
```

---

## 不可违反的规则

```
以下规则违反 = bug，修复后必须更新此文件记录教训。

1. 禁止 inline style — 所有样式通过 CSS class 或 CSS 变量
2. 禁止 width: 100% 在 flex 子元素上 — 阻止 max-width + margin auto 居中
3. JS ↔ CSS 同步 — Math.max(scrollHeight, N) 的 N 必须和 CSS min-height 一致
4. 不要猜数值 — 从设计稿 HTML 提取，不凭感觉
5. 禁止改 class selector 名 — TSX 引用会断裂
6. 设计稿 HTML 是最终真相 — 文档数值和 HTML 不一致时以 HTML 为准
7. dist/ 不在 git 里 — 不提交 dist/，不依赖 dist/ 验证
```

---

## 架构

- **框架**: Tauri v2 + React 18 + TypeScript + Zustand + SQLite
- **布局**: Sidebar(64px) + ChatHeader(56px) + 聊天区 + 右侧面板(288px)
- **CSS**: CSS Modules（.module.css），全局变量在 `src/styles/globals.css`
- **构建**: `npm run build`（Vite），用户用 `npm run electron:build` 打包

```
src/
├── app/                    # App 入口 + 主题
├── components/
│   ├── Chat/               # ChatView, InputArea, MessageBubble, CodeBlock, ChatHeader
│   ├── Sidebar/            # 64px 侧边栏（icon-only）
│   ├── Pane/               # TabBar, TerminalPane, PaneSplit
│   └── ToolPanel/          # 右侧面板（FileTree, DiffView）
├── stores/                 # Zustand stores
├── hooks/                  # React hooks
├── lib/                    # 工具函数
├── styles/globals.css      # 全局 CSS 变量
└── types/                  # TypeScript 类型
```

---

## 设计稿（唯一正确版本）

```
⚠️ 只读以下路径，不要读 /tmp/stitch-new/ 或 /tmp/stitch-final/

Light: /tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_balanced_blue_orange/code.html
Light 截图: .../screen.png
Dark: /tmp/stitch-final-v2/stitch_main_chat_interface/main_chat_desktop_dark_distinct_panels/code.html
Light 设计系统: .../precision_light/DESIGN.md
Dark 设计系统: .../obsidian_pro/DESIGN.md
```

完整设计 token 见 `docs/ui-design-spec.md`。

---

## UI 修改验证流程

```
修改 CSS/TSX → 必须按顺序执行，不可跳过：

1. npx tsc --noEmit        # 零错误才继续
2. npm run build           # 构建成功才继续
3. bash scripts/screenshot.sh /tmp/ccdesk-after light
4. Read 对比设计稿截图和实际截图
5. 自 Review 清单（侧边栏64px、消息左对齐无气泡、输入区实色、发送按钮橙色）
6. 有差异 → 修复 → 从步骤 1 重来
7. 全部通过 → git commit
```

复杂任务先输出计划，确认后再执行。

---

## 工作习惯

- Plan-Then-Execute：复杂任务先输出计划再动手
- Git Worktree：并行任务用独立 worktree
- 上下文管理：`/clear` 清理，复杂任务拆 sub-agent
- 踩坑记录：犯错后记录到 `docs/ccbp-methodology.md` 的 Gotchas 段

---

## 相关文档

| 文档 | 内容 |
|------|------|
| `AGENTS.md` | 项目导航索引（**启动时必读**） |
| `docs/ui-design-spec.md` | 设计 token 完整规范 |
| `docs/coding-standards.md` | 编码规范 |
| `docs/agent-first-workflow.md` | 视觉验证基础设施 |
| `docs/ccbp-methodology.md` | CC 最佳实践方法论 + Gotchas |
