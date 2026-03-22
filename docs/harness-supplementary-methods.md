# 补充报告：Claude Code / AI Coding Agent 方法论扩展

**基于来源：**
- Eesel.ai：《7 Claude Code Best Practices for 2026 (from real projects)》
- Anthropic Engineering：《Quantifying Infrastructure Noise in Agentic Coding Evals》
- ArXiv：《Decoding the Configuration of AI Coding Agents: Insights from Claude Code Projects》（研究328个真实项目）

**说明：** 本报告作为《Harness Engineering》深度解读的补充，新增以下维度的方法论，这些内容在 Harness 文中未涉及或未深入展开。

---

## 一、基础设施资源对 Agent 效果的影响（Anthropic 新发现）

> Harness Engineering 核心是"环境即一切"——Anthropic 用量化数据证明了环境资源的重要性：**基础设施配置本身就能让评测分数相差 6 个百分点**，有时比顶级模型之间的差距还大。

### 核心发现

Anthropic 在 Terminal-Bench 2.0 上做了严格对照实验，控制变量：相同模型、相同评测集、只改变资源配额。

| 资源配置 | 基础设施错误率 | 任务成功率 |
|---------|------------|----------|
| 1x 严格（= 规格上限） | 5.8% | 基准 |
| 3x 资源余量 | 2.1% | 上升（不显著）|
| 无上限 | 0.5% | **+6 个百分点**（p<0.01）|

### 关键洞察

**1x 严格模式的失败原因不是模型弱，而是基础设施杀死了容器。** 资源限制先于模型能力触发了失败。内存瞬时波动就能让一个本该成功的任务 OOM 崩溃。

**3x 以后出现质变：** 从 3x 到无上限，任务成功率提升幅度远大于基础设施错误率下降幅度。这意味着更多资源不只是让系统更稳定，还让 Agent 能够**尝试需要大量资源的方案**——比如拉取大型依赖、生成内存密集型测试套件。

### 对 Harness Engineering 的补全

Harness 强调了"环境"和"反馈循环"的重要性，但没有量化资源对 Agent 能力的影响。Anthropic 的结论是：**即使模型相同，更充裕的资源预算 = 更强的 Agent 表现**。

**实操含义：**
- 给 Agent 运行的任务分配**高于基准规格的内存和 CPU**（建议 ≥3x）
- 特别是在执行需要拉取大型依赖、运行重型测试套件的任务时
- 这个发现对评测基准设计也有影响：leaderboard 上的分数差距可能不是模型差距，而是基础设施差距

---

## 二、真实项目 CLAUDE.md 配置研究（ArXiv）

Harness Engineering 分享了 OpenAI 内部的 AGENTS.md 实践，而 ArXiv 这篇论文研究的是**全球 328 个真实 Claude Code 项目**的配置文件（2025年8月数据），是实打实的工业界调研。

### 真实项目中 CLAUDE.md 的内容分布

| 类别 | 占比 | 说明 |
|------|------|------|
| **软件架构规范** | 72.6% | 最核心！定义了 Agent 应该遵循的架构 |
| 通用开发指南 | 44.8% | 代码风格、命名规范等 |
| 项目概览 | 39% | 项目结构、入口、核心文件 |
| **测试指南** | 35.4% | 测试策略、覆盖率要求 |
| 测试命令 | 33.2% | 如何运行测试 |
| 依赖管理 | 30.8% | 包管理、版本约束 |
| 项目总体规范 | 25.6% | 工作流、安全要求 |
| 集成和使用说明 | 18% | API、第三方服务接入方式 |
| 配置说明 | 17.4% | 环境变量、本地配置 |

### 关键发现

**架构规范是真实项目的第一优先级（72.6%）** —— 比 Harness Engineering 里 OpenAI 团队的实践更高频。这说明：**让 Agent 理解架构，比告诉它怎么写代码更重要**。

**测试是第二大关注点（35%+）** —— 真实项目里超过 1/3 的 CLAUDE.md 在讲测试，反映了生产级项目对代码可靠性的要求。

**没有"放之四海"的通用模板** —— 328 个项目的中位配置文件只有 7 个二级标题，但差异极大。说明 CLAUDE.md 必须高度定制化，不能抄来就用。

### 常见配置模式

论文发现了几种常见模式（按出现频率）：
1. **架构 + 测试**（最常见）
2. **架构 + 开发指南 + 测试**
3. **架构 + 项目概览 + 依赖**
4. **架构 + 集成说明 + 配置**

---

## 三、Eesel 7条实战方法论（来自真实项目）

### 方法 1：分层 CLAUDE.md（根目录 + 子目录）

单一 CLAUDE.md 容易变得臃肿（参考 Harness 的"巨型 AGENTS.md 失败"经验）。

更好的做法：**根目录放总体规范，子目录放领域特定规范。**

```
CLAUDE.md              ← 项目总体规范（根目录）
frontend/CLAUDE.md      ← 前端专项（组件规范、样式约定）
backend/CLAUDE.md       ← 后端专项（API 规范、中间件约定）
tests/CLAUDE.md         ← 测试专项（覆盖率、测试策略）
```

Agent 进入对应子目录时自动加载对应的 CLAUDE.md，获得更聚焦的上下文。

> 这与 Harness Engineering 的"渐进式披露"原则完全一致，只是更具体地给出了目录结构。

---

### 方法 2：Plan-Then-Execute 工作流（强制思考再动手）

对于复杂任务，**不要直接让 Agent 写代码**：

```
1. Ask → "Create a detailed implementation plan. Do not write any code yet."
2. Pause → "Do not write any code. Just give me the plan."
3. Review → 和 Agent 讨论计划，质疑假设，纠正方向
4. Go → 确认计划后再让它开始写代码
```

诀窍：使用 "think hard" 这类提示词，给 Agent 更多的推理时间和计算预算。

> 这与 Harness 的"Ralph Wiggum Loop"形成互补：Harness 关注的是 PR 审查循环，这里关注的是需求澄清循环。**两个循环都是为了让 Agent 的输出更符合预期。**

---

### 方法 3：自定义工具 / 斜杠命令 + MCP 扩展

Agent 的能力边界可以被扩展。

**斜杠命令（Slash Commands）：** 在 `.claude/commands/` 目录下创建 Markdown 模板文件，每个文件就是一个可复用的提示模板。

```
.claude/commands/
├── new-component.md     # /new-component → 脚手架新组件
├── security-review.md    # /security-review → 安全审查
├── test-coverage.md     # /test-coverage → 覆盖率检查
```

**MCP（Model Context Protocol）集成：** 连接外部工具和数据源：
- Puppeteer → 浏览器自动化
- Sentry → 错误日志查询
- 数据库 → 自然语言查询
- Jira / Notion → 项目管理

> 这扩展了 Harness 中 MCP 的应用场景，不只是数据库和 GitHub，而是整个外部工具生态。

---

### 方法 4：Git Worktrees 实现并行 Agent 工作流

**AI 会犯错，保护 main 分支是底线。**

每个任务创建一个新分支。更进一步：使用 Git Worktrees 同时在多个分支上工作。

```
git worktree add ../feature-login feature/login
git worktree add ../feature-payment feature/payment
```

每个工作目录可以独立启动一个 Claude Code 实例，同时处理多个任务，互不干扰，不产生合并冲突。

> Harness Engineering 已经在用 Worktree 实现每个变更的独立应用实例（用于 UI Verification）。这里扩展到并行多 Agent 工作流。

---

### 方法 5：精准提示技巧

**上下文质量直接决定输出质量。**

| 技巧 | 说明 | 示例 |
|------|------|------|
| 文件直接引用 | 用 Tab 自动补全路径 | "Read `src/auth/login.ts` and `src/middleware/jwt.ts`" |
| URL 上下文 | 粘贴链接让 Agent 自己读 | GitHub Issue、文档、StackOverflow |
| 图片拖入 | UI 开发时拖入设计稿截图 | Agent 会理解视觉布局 |
| 具体指令 | 避免泛泛的要求 | "Write unit tests for `foo.py` edge case: logged out user. Do not use mocks." |

> 精准提示是 Harness Engineering 里没有展开的细节，但直接影响 Agent 单次执行质量。

---

### 方法 6：Sub-Agent 和上下文管理

长会话中 Agent 会"遗忘"早期指令，有两个工具：

**`/clear`**：在不同任务之间清理会话历史，避免之前任务的上下文干扰新任务。

**Sub-Agent 委托**：复杂任务拆解后，让主 Agent 把子任务委托给 sub-agent，每个 sub-agent 有独立上下文，互不污染。

```
"你刚写完了支付处理模块。现在用 sub-agent 对这段代码做安全审查。"
```

> 这与 Harness 的多 Agent 协作理念一致，但在单次对话层面给出了具体操作手法。

---

### 方法 7：Headless Mode + Hooks 实现自动化

用 `-p` 参数以脚本模式运行 Claude Code，结合 Hooks 把 AI 能力嵌入 CI/CD 流程。

**实际应用场景：**
- 自动分类 GitHub Issue
- 自动生成 PR 描述
- 提交前自动触发 linter / type-checker
- 自动化代码质量检查

**Hooks 示例：**
- `pre-command` hook：Agent 编辑文件前先跑 lint
- `post-command` hook：Agent 操作后自动运行测试

> 这是对 Harness"自动化审查"的具体实现路径，Harness 用的是 pre-commit 钩子，这里扩展到了更多 CI/CD 场景。

---

## 四、综合认知框架

把四篇文章的洞察整合，得到一个更完整的 Agent 工程体系：

### 基础设施层（Anthropic 新发现）
- 资源预算 ≥ 3x 评测规格
- 无上限资源让 Agent 能尝试重型方案
- 基础设施配置对评测结果的影响 > 模型差距

### 配置管理层（ArXiv + Harness 互证）
- CLAUDE.md = 架构规范（72.6% 真实项目首选）
- 分层结构（根目录 + 子目录 CLAUDE.md）
- 不要巨型文档 → 渐进式披露

### 工作流设计层（Eesel + Harness 互补）
| 阶段 | Eesel 方法 | Harness 方法 |
|------|-----------|-------------|
| 任务接收 | Plan-Then-Execute | 指定意图 prompt |
| 执行过程 | Git Worktree 并行 | Worktree 独立实例 |
| 质量保证 | 自定义工具 + Hooks | Agent 自验证 + UI Verification |
| 上下文管理 | Sub-Agent + /clear | 文档园丁 Agent |
| 知识积累 | 分层 CLAUDE.md | AGENTS.md 目录 + docs/ 结构 |

### 环境可观测层（Harness 核心）
- Chrome DevTools Protocol（UI 验证）
- LogQL/PromQL/TraceQL（指标查询）
- 临时可观测性栈 per worktree

---

## 五、对 Harness Engineering 解读报告的行动项补充

在之前提出的5条行动项基础上，新增：

**行动项 6：给 Agent 充足的资源预算（本月可落地）**
- 测试环境的资源配额建议设为评测基准的 3 倍以上
- 让 Agent 能执行重型任务（大型依赖拉取、内存密集型测试）

**行动项 7：建立分层 CLAUDE.md 体系（本月可落地）**
- 根目录 CLAUDE.md：架构规范、代码风格、测试命令
- 子目录 CLAUDE.md：frontend/backend/tests 各一个
- 参考 ArXiv 真实项目数据：架构规范（72.6%）> 开发指南（44.8%）> 测试指南（35%）

**行动项 8：建立 Plan-Then-Execute 工作流规范（本月可落地）**
- 复杂任务强制两阶段：先计划，再动手
- 计划阶段用 "think hard" 提示词让 Agent 充分推理
- 用 Eesel 的 4 步流程替代直接写代码的习惯

---

*本补充报告基于 2026年3月23日全网搜索结果生成，来源文章均发表于 2025-2026 年。*
