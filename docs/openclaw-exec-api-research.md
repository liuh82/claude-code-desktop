# OpenClaw 执行接口调研结果

**日期**: 2026-03-18 23:48
**调研人**: 主 Agent

## 结论：OpenClaw 有现成的 CLI 执行接口

**不需要开发新的 REST API**。`openclaw agent` 命令就是 openclaw-bridge 需要的执行接口。

### 可用命令

```bash
openclaw agent \
  --agent <agent_id> \
  --message "<prompt>" \
  --session-id <session_id> \
  --json \
  --timeout <seconds> \
  --local    # 可选：跳过 Gateway，直接本地执行（更稳定）
```

### 参数说明

| 参数 | 必选 | 说明 |
|------|------|------|
| `--agent <id>` | 是 | 目标 agent（main/architect/writer/reviewer 等） |
| `--message <text>` | 是 | 发送的 prompt 内容 |
| `--session-id <id>` | 推荐 | 会话 ID，相同 ID 的多次调用共享上下文 |
| `--json` | 推荐 | 结构化 JSON 输出 |
| `--timeout <sec>` | 否 | 超时秒数，默认 600 |
| `--local` | 推荐 | 本地嵌入执行，不走 Gateway WebSocket（更稳定） |
| `--deliver` | 否 | 通过配置的渠道发送回复（飞书等） |
| `--thinking <level>` | 否 | 思考级别：off/minimal/low/medium/high/xhigh |

### 输出格式（--json）

```json
{
  "payloads": [
    {
      "text": "执行结果文本",
      "mediaUrl": null
    }
  ],
  "meta": {
    "durationMs": 13022,
    "aborted": false,
    "agentMeta": {
      "sessionId": "346b58e0-d2c7-44aa-8411-e9a61d613276",
      "provider": "zai-coding-plan",
      "model": "glm-5",
      "usage": { "input": 52271, "output": 87, ... }
    },
    "stopReason": "stop"
  }
}
```

### 关键特性（实测验证）

1. **会话连续性** ✅
   - 相同 `--session-id` 的多次调用共享对话上下文
   - 测试：第一次说"回复OK"，第二次问"还记得吗"，agent 准确回忆

2. **自动 Fallback** ✅
   - Gateway 连接失败时自动 fallback 到 embedded 模式
   - 不会因为 Gateway 问题导致执行失败

3. **`--local` 模式** ✅（稳定性推荐）
   - 完全跳过 Gateway WebSocket，本地嵌入执行
   - 少一层网络依赖，更稳定
   - openclaw-bridge 推荐使用 `--local`

4. **超时控制** ✅
   - 默认 600 秒，可通过 `--timeout` 调整
   - 对于架构设计、评审等长任务，建议设 600-1800 秒

5. **工具权限** ✅
   - 每个 agent 的 `tools.allow` 配置独立生效
   - architect 有 read/write/exec/browser 等权限

### 对 openclaw-bridge 架构的影响

老张方案中第 5 节（OpenClaw API 需求）**不需要开发了**。替代方案：

```typescript
// 不需要 REST API，直接用 CLI 子进程
const result = await execFile('openclaw', [
  'agent',
  '--agent', config.agentId,
  '--message', prompt,
  '--session-id', sessionId,
  '--json',
  '--timeout', String(timeout),
  '--local',  // 稳定性优先
]);
```

**优势**：
- 零开发成本，接口已存在
- `--local` 模式跳过 Gateway，更稳定
- 天然支持会话管理（`--session-id`）
- 天然支持多 agent（`--agent`）

**需要注意**：
- CLI 每次启动有插件初始化开销（~2-3 秒）
- `--json` 输出在 stderr 前面有插件日志，需要处理
- 长任务（>10 分钟）建议加 `--timeout` 保护

### 简化后的开发排期

| Phase | 内容 | 时间 | 变化 |
|-------|------|------|------|
| Phase 1 | 共享模块抽取 | 1 周 | 不变 |
| Phase 2 | openclaw-bridge 核心（CLI 执行器） | 1 周 | 原 1.5 周，去掉 REST API 部分 |
| Phase 3 | Gateway 扩展 | 0.5 周 | 不变 |
| ~~Phase 4~~ | ~~OpenClaw API~~ | ~~1 周~~ | **取消**，用 CLI 替代 |
| Phase 4 | 集成测试 | 1 周 | 原 Phase 5 |
| **总计** | | **3.5 周** | 原 5 周 → 3.5 周 |
