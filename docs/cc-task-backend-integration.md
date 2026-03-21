# CCDesk 前后端对接任务

## 当前状态
CCDesk v0.2.0 前端已完成（Cline 风格聊天 UI），Electron 后端也已写好（main.ts 有完整的 IPC handlers）。
需要打通前后端，让前端能真正调用 Claude CLI。

## 已有文件
- `electron/main.ts` — 完整的 Electron main 进程，含 CC CLI 进程管理
- `electron/preload.ts` — 完整的 IPC bridge，暴露 window.claudeAPI
- `src/lib/claude-api.ts` — 前端 API wrapper（新加）
- `src/lib/claude-parser.ts` — stream-json 解析器（新加）
- `src/stores/useChatStore.ts` — 已重写，支持 Electron IPC 和 mock 双模式

## 需要完成的任务

### 1. 修复 start-session 的 stdin 交互
当前 `start-session` 使用 `--print` 模式，这会一次性执行完就退出。
需要改为：不传 prompt，让 CC 进入交互模式，然后通过 stdin 发送每条用户消息。

修改 `electron/main.ts` 中的 `start-session`：
- 去掉 `--print` 参数（CC 默认交互模式）
- `send-input` 发送后需要 flush stdin
- 需要处理 CC 的 permission prompt（auto mode 下自动允许）

### 2. 验证 stream-json 输出格式
CC 在非 --print 模式下的 stdout 格式可能不同。
先用真实 CC 测试一下输出格式（在服务器上运行 `claude --output-format stream-json` 然后输入消息，观察输出）。

### 3. 完善 claude-parser.ts
根据实际 CC 输出格式调整解析逻辑。CC 的 stream-json 输出类型包括：
- `assistant` — AI 回复（content 数组含 text 和 tool_use blocks）
- `tool_result` — 工具执行结果
- `user` — 用户消息回显
确保 parser 正确处理所有类型。

### 4. 连接 Sidebar 模型选择器到 start-session
`src/components/Sidebar/Sidebar.tsx` 里有模型选择器。
选择模型后应该关闭当前 session 并重新 start-session（带 --model 参数）。

### 5. 连接 StatusBar 到真实 token 使用量
CC 的输出中包含 token 使用信息，需要解析并更新 StatusBar 显示。

### 6. 处理 permission prompt
CC 在执行工具前会请求权限（除非 --permission-mode auto）。
需要在 UI 上显示权限请求，让用户允许/拒绝。
暂时可以用 `--permission-mode auto` 绕过，后续再做 approve/reject UI。

### 7. 错误处理
- CC CLI 不存在时显示友好提示
- CC 进程崩溃时显示错误消息
- 网络错误/超时处理

## 重要约束
- 浏览器模式下（npm run dev）必须继续使用 mock，不能因为后端 API 不存在而报错
- 不要破坏现有的 UI 外观和功能
- 所有 UI 文本保持中文
- TypeScript 零错误
- `npm run build` 必须成功

## 验证方式
在服务器上测试：先用 `claude --output-format stream-json --verbose` 运行 CC，手动输入消息看输出格式，然后据此调整 parser。
