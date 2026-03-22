CCDesk 前后端对接任务 — 请阅读 docs/cc-task-backend-integration.md 然后执行。

关键发现：我已经测试了 CC 的 stream-json 输出格式，输出类型有：
1. `{"type":"system","subtype":"init",...}` — 初始化信息，包含 session_id、model、tools 等
2. `{"type":"assistant","message":{"id":"...","role":"assistant","model":"glm-5-turbo","content":[{"type":"text","text":"..."}],"stop_reason":null|stop_reason,...}}` — AI 回复，content 数组可能含 text 和 tool_use blocks
3. `{"type":"result","subtype":"success","result":"...","usage":{"input_tokens":N,"output_tokens":N},...}` — 最终结果，含 token 使用量

请重点完成：
1. 修改 electron/main.ts 的 start-session — 去掉 --print，改用 -p 模式（每次发送消息时把用户输入作为 prompt 传给 claude -p "用户消息"），这样更简单可靠
2. 完善 claude-parser.ts — 正确解析上述三种 JSON 格式
3. 更新 useChatStore.ts — 把 system init 消息的 model 信息存起来，result 消息的 usage 更新 tokenUsage
4. 确保 mock 模式在浏览器下正常工作
5. TypeScript 零错误，npm run build 成功
6. commit 并 push
