# Claude Code Desktop — 项目文档索引

> **状态**：Phase 0 准备中
> **架构师**：老张（system architect）
> **架构文档版本**：v2.4
> **目标**：用 Nexus 工作流系统开发此项目，同时作为 Nexus 的第一个端到端测试

---

## 📁 文档结构

```
claude-code-desktop/
├── docs/
│   ├── README.md                    ← 你在这里
│   ├── architecture.md              ← 完整架构设计（v2.4）
│   ├── workflow-design/             ← Nexus 工作流设计（每个阶段一条）
│   │   ├── phase0-system-validation.md
│   │   ├── phase1-scaffold.md
│   │   ├── phase2a-rust-core.md
│   │   ├── phase2b-react-frontend.md
│   │   ├── phase2c-database.md
│   │   ├── phase3-integration.md
│   │   └── phase4-ui-polish.md
│   └── review/                      ← 评审记录
│       └── architecture-review.md
├── src/                             ← 源码（待创建）
├── CLAUDE.md                        ← Claude Code 执行指南
└── README.md                        ← 项目说明
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

---

## 📋 开发阶段

### Phase 0：系统验证
- **目标**：验证 Nexus 能跑通简单任务
- **工作流**：Input → Agent(echo hello) → Output
- **通过标准**：任务执行成功，输出正确

### Phase 1：项目脚手架
- **目标**：Tauri v2 初始化 + 目录结构 + CI/CD 配置
- **交付物**：可编译的空壳项目 + GitHub Actions workflow
- **预计时间**：~15 分钟

### Phase 2a：Rust 核心层
- **目标**：进程池 + CLI Bridge + 会话管理 + 标签页/面板管理
- **交付物**：`src-tauri/src/` 核心模块
- **预计时间**：~30 分钟

### Phase 2b：React 前端
- **目标**：多面板容器 + 标签页 + 终端组件 + Monaco 集成
- **交付物**：`src/` 前端组件
- **预计时间**：~30 分钟

### Phase 2c：数据库层
- **目标**：SQLite 表结构 + 持久化逻辑 + 会话历史
- **交付物**：数据库模块 + migration
- **预计时间**：~15 分钟

### Phase 3：集成联调
- **目标**：前后端通信 + 流式输出 + 事件系统
- **交付物**：端到端可用的原型
- **预计时间**：~20 分钟

### Phase 4：UI 精化
- **目标**：快捷键 + 布局保存/恢复 + 主题
- **交付物**：完整可用版本
- **预计时间**：~20 分钟

---

## 🔧 环境要求

| 依赖 | 版本 | 用途 |
|------|------|------|
| Rust | stable | Tauri 后端 |
| Node.js | v20+ | 前端构建 |
| Tauri CLI | v2 | 项目管理 |
| Claude Code | latest | 开发执行（Agent 节点） |
| SQLite | 3.x | 本地数据存储 |

---

## ⚠️ 已知风险

| 风险 | 应对 |
|------|------|
| Rust 编译时间长 | Agent timeout 设 600s+ |
| Claude Code 不支持交互式执行 | 把交互拆成多步，每步有明确输入 |
| macOS 构建 | GitHub Actions macOS runner |
| CLI 版本兼容 | CLI Bridge 做版本检测 |
| 进程泄漏 | 进程池限制 + 定期清理 |

---

## 📌 决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-03-18 | 用 Nexus 开发此项目 | 既是测试也是真需求 |
| 2026-03-18 | 每阶段独立工作流 | 控制复杂度，降低风险 |
| 2026-03-18 | 主 agent 接管日常推进 | 用户不定期查看进度 |
| 2026-03-18 | Nexus 项目不结束 | 后续继续迭代优化 |

---

*最后更新：2026-03-18*
