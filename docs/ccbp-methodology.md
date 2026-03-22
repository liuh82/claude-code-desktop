# Claude Code 最佳实践方法论（CCDesk 适配版）

> 基于 shanraisshan/claude-code-best-practice（20.3k stars）+ Harness Engineering + Anthropic 官方实践，结合 CCDesk 项目实际踩坑经验整合。

---

## 一、CLAUDE.md 编写规范

### Boris Cherny（CC 创始人）的核心原则

| 原则 | 说明 |
|------|------|
| **< 200 行** | 超过 200 行 Claude 开始忽略后半部分 |
| **用 ``` 代码块包裹关键规则** | 防止 Claude 在文件变长时忽略 |
| **犯错后立刻更新** | "Update your CLAUDE.md so you don't make that mistake again" |
| **放什么不放什么** | 放约束和规则，不放教程和百科 |
| **团队共享** | commit 进 git，每周多人维护 |

### CCDesk 的 CLAUDE.md 策略

```
CLAUDE.md (< 200 行) — 执行约束 + 设计稿路径 + 验证流程
AGENTS.md — 文档导航索引（CC 不自动读，需手动指定）
docs/ui-design-spec.md — 设计 token 完整规范（按需读）
docs/coding-standards.md — 编码规范（按需读）
docs/agent-first-workflow.md — 视觉验证基础设施
```

### ⚠️ 已知陷阱

- **Claude 80% 概率忽略 MUST 全大写指令** → 用 ``` 代码块 + 具体值替代
- **Claude 不自动读 AGENTS.md** → 在 CLAUDE.md 开头显式指定
- **Claude 不自动读子目录 CLAUDE.md** → 不依赖分层加载

---

## 二、Command → Agent → Skill 三层架构

### 三者本质区别

| | Agent | Command | Skill |
|---|---|---|---|
| **本质** | 独立进程 + 独立上下文 | 内联模板（共享主上下文） | 内联模板（共享主上下文） |
| **触发** | 被 Claude/Agent 工具调用 | 用户 `/command-name` | Claude 根据描述自动匹配 |
| **上下文隔离** | ✅ 独立 | ❌ 共享 | ❌ 共享（可用 `context: fork` 隔离） |
| **适用** | 复杂自主探索 | 用户显式触发的工作流入口 | 可复用专业流程 |

### 编排流程

```
用户 /command → Command 编排（询问参数） → Agent 执行（独立上下文） → Skill 产出
```

### CCDesk 适用建议

| 当前做法 | 建议 |
|---------|------|
| 我写 prompt 给 CC 执行 | → 做成 **Command**（`.claude/commands/align-design.md`） |
| CC 做视觉验证循环 | → 做成 **Agent**（`.claude/agents/ui-verifier.md`） |
| 设计稿 token 提取 | → 做成 **Skill**（`.claude/skills/design-token-extract.md`） |

---

## 三、Plan Mode（计划模式）

### Boris 的实践

- 几乎所有复杂任务都用 **Plan Mode** 开始（shift+tab 两次）
- 一个好计划可以让 Claude **1-shot 完成实现**
- 可以让**第二个 Claude 作为 Staff Engineer 审查计划**

### CCDesk 的 Plan-Then-Execute 流程

```
1. 我读取设计稿，提取差异
2. 写成结构化 prompt（.cc-prompt-xxx.md）
3. CC 读取 prompt → 输出实施计划
4. 人类审核计划（或跳过，信任 CC）
5. CC 按计划执行
6. tsc + build 验证
7. commit + push
```

### 关键改进

- 让 CC **自己对比设计稿和当前代码**，而不是我只列差异
- Plan 输出应该包含：文件清单 + 改动类型（CSS-only vs TSX+CSS）+ 优先级
- 复杂任务分阶段，每阶段后验证

---

## 四、并行化策略

### Git Worktree 的 5 种用法（Boris）

1. 每个功能一个 worktree，互不干扰
2. 一个专门做日志分析（只读）
3. 用 alias 快速切换（`2a`, `2b`, `2c`）
4. 一个专门跑重型测试
5. 每个 worktree 用不同 Model

### CCDesk 适用场景

- UI 改版 + 后端开发并行（不同 worktree）
- 设计稿对齐 + Bug fix 并行
- 但：服务器配置低，并行跑 2-3 个 CC 可能资源不足

---

## 五、搜索策略：Agentic Search > RAG

### Boris 的结论

> **Agentic search (glob + grep) beats RAG** — Claude Code tried and discarded vector databases because code drifts out of sync and permissions are complex.

### CCDesk 策略

- ❌ 不要给 CC 塞太多文档到上下文
- ✅ 让 CC 用 `glob` + `grep` 自己搜需要的信息
- ✅ CLAUDE.md 只放约束和路径指引，不放完整内容
- ✅ 设计稿 token 让 CC 自己从 HTML 提取，不要预提取

---

## 六、Skill 编写规范

### 描述字段是 Trigger，不是 Summary

```
# ❌ 错误
description: "这个 Skill 用于创建 SVG 卡片"

# ✅ 正确
description: "当用户要求可视化数据、生成图表或创建图片时触发"
```

### 每个 Skill 应包含 Gotchas

```markdown
## Gotchas
- CC 经常在 xxx 场景失败，原因是 yyy
- 已知 workaround: zzz
```

### 写 Goals 和 Constraints，不写 Prescriptive Steps

```
# ❌ "第一步...第二步...第三步..."
# ✅ "目标：...约束条件：..."
```

### 用 context: fork 隔离

- 主上下文只看最终结果
- 中间工具调用在子 Agent 中执行

---

## 七、Hooks（钩子）

| Hook 类型 | CCDesk 适用场景 |
|---------|----------------|
| PreToolUse | 测量 CC 修改频率，发现改错文件 |
| PostToolUse | 自动格式化代码 |
| Stop | 提醒 CC 验证构建结果 |
| Pre-command | CC 编辑前先跑 lint |

---

## 八、CCDesk 专属 Gotchas（高频踩坑记录）

| 问题 | 原因 | 规则 |
|------|------|------|
| inline style 覆盖 CSS | CC 偷懒用 style={{}} | 禁止 inline style |
| 改 class selector 名 | TSX 引用断裂 | 只改 property 值 |
| width:100% 阻止居中 | flex 子元素撑满 | 禁止 width:100% 在 flex 子元素 |
| JS/CSS min-height 不同步 | auto-resize 基准值偏移 | N 必须一致 |
| 用错设计稿版本 | 路径未更新 | 设计稿路径明确标注版本 |
| 猜数值不查设计稿 | 省事但不准 | 每个值从 HTML 提取 |
| 忽略 AGENTS.md | CC 不自动读 | CLAUDE.md 里手动指定 |

---

## 九、被低估的功能

| 功能 | 说明 | CCDesk 潜力 |
|------|------|------------|
| **Ralph Wiggum Loop** | 自主循环直到任务完成 | 持续 UI 微调直到设计稿对齐 |
| **Scheduled Tasks (/loop)** | 循环任务最长 3 天 | 定期检查 UI regression |
| **Programmatic Tool Calling** | Token 节省 37% | 批量文件修改效率提升 |
| **context: fork** | Skill 在独立子 Agent 运行 | 保持主上下文精简 |

---

## 十、开放问题（待思考）

1. CCDesk 的 CLAUDE.md 该多长？当前 ~150 行，是否可以更短？
2. 要不要给 CCDesk 建 Command/Skill/Agent 体系？还是继续我写 prompt 的方式？
3. Dark 主题对齐要做吗？还是先专注 Light？
4. 视觉验证自动化：CC 截图 + 对比，可信度够吗？还是必须人类看？
5. 后端 Rust 进程池 + CLI 通信，什么时候启动开发？

---

*基于 claude-code-best-practice（20.3k stars）、Harness Engineering、CCDesk 实战经验整合。2026-03-23。*
