# Claude Code Desktop — 项目文档索引

> **状态**：Phase 1 待执行
> **架构师**：老张（system architect）+ 主 Agent 审核
> **架构文档版本**：v3.0（已审核修订）
> **仓库**：https://github.com/liuh82/claude-code-desktop（private）
> **本地路径**：`/root/.openclaw/workspace/claude-code-desktop/`
> **执行方式**：通过 Nexus Gateway → oc-bridge → Claude Code CLI

---

## 📁 文档结构

```
claude-code-desktop/
├── docs/
│   ├── README.md                ← 你在这里
│   ├── architecture.md          ← 完整架构设计（v3.0 已审核）
│   ├── openclaw-bridge-architecture.md  ← Bridge 架构参考
│   ├── openclaw-bridge-requirements.md   ← Bridge 需求参考
│   └── openclaw-exec-api-research.md    ← 执行 API 研究
├── CLAUDE.md                    ← ⚠️ CC 执行约束（必读）
├── README.md                    ← 项目说明
└── .github/workflows/           ← CI/CD（Phase 1 创建）
```

---

## 🎯 核心设计

| 设计决策 | 选择 | 原因 |
|---------|------|------|
| 桌面框架 | **Tauri v2** | 比 Electron 轻量 10x，Rust 后端性能好 |
| 前端 | **React 18 + TypeScript** | 生态成熟，组件丰富 |
| 状态管理 | **Zustand** | 轻量，适合多面板状态 |
| 代码编辑 | **Monaco Editor** | VS Code 同款，diff 支持好 |
| 进程模型 | **每面板独立 CLI 进程** | 上下文隔离 + 故障隔离 |
| 数据库 | **SQLite** | 本地存储，无需服务端 |
| CI/CD | **GitHub Actions** | 跨平台构建（macOS/Linux/Windows） |
| 样式 | **CSS Modules** | 作用域隔离，零运行时 |

---

## 📋 Phase 规划

### Phase 1: 项目脚手架 + CI/CD ← 📍 当前
- **目标**：可编译的空壳 Tauri v2 项目 + GitHub Actions
- **任务**：8 项（初始化、目录结构、配置、CI/CD、验证）
- **验收**：`tsc --noEmit` ✅ + `cargo check` ✅ + `tauri dev` 空窗口 ✅
- **预计**：1-2 次 CC 调用

### Phase 2: Rust 核心层
- **目标**：进程池 + CLI Bridge + 会话管理 + 标签页/面板管理 + SQLite
- **任务**：15 项（error → db → process_pool → session → tab → parser → bridge → commands → app）
- **验收**：`cargo test` ✅ + invoke 可创建标签页/启动 CLI
- **预计**：3-5 次 CC 调用

### Phase 3: React 前端
- **目标**：多面板 UI + 终端组件 + 标签页 + 流式输出
- **任务**：19 项（依赖 → types → stores → hooks → 组件 → 样式）
- **验收**：`tsc --noEmit` ✅ + `npm run build` ✅ + UI 可交互
- **预计**：3-5 次 CC 调用

### Phase 4: 集成联调
- **目标**：前后端通信 + 端到端流程跑通
- **任务**：8 项（IPC → 流式渲染 → 完整流程 → 持久化）
- **验收**：完整用户流程可用 + 崩溃隔离 + 状态恢复
- **预计**：2-3 次 CC 调用

### Phase 5: UI 精化
- **目标**：快捷键 + 主题 + 布局保存 + 文件树 + 设置页
- **任务**：8 项
- **验收**：全部快捷键正常 + 明暗主题 + 布局恢复
- **预计**：2-3 次 CC 调用

---

## 🔧 Nexus 执行信息

- **Nexus 项目 ID**: `b8261dca-f7e9-458a-9bf2-9e8f1f4a82c3`
- **Agent ID**: `e35c4fd5-96d1-4f22-9fb3-413df24dd43a`
- **工作流 ID**: `f1d79d29-abdb-4c25-9ab6-92505c2581df`
- **Gateway Token**: `nexus-gateway-ca15d4b47eaf67f1e86299056c03f589`
- **Bridge WS**: `ws://127.0.0.1:8082/api/gateway/ws`

---

## ⚠️ 执行约束（CC 必读）

1. **CLAUDE.md 是最高优先级** — 所有编码行为必须遵守 CLAUDE.md 中的约束
2. **架构文档 authority** — `docs/architecture.md` 定义数据结构和接口契约
3. **目录结构必须严格遵循** — 不能自行创建额外目录
4. **每个 Phase 完成后必须验收** — 按验收标准逐项检查
5. **不要自行安装未列出的依赖** — 除非任务明确要求

---

*最后更新：2026-03-19 — v3.0 审核修订完成*
