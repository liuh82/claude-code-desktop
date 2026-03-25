# Claude Code Desktop

Claude Code 桌面客户端 — 基于 Electron + React 18 的多面板编程环境。

## 技术栈
- **Electron** — 跨平台桌面框架
- **React 18 + TypeScript** — 前端框架
- **Zustand** — 状态管理
- **Monaco Editor** — 代码编辑器
- **SQLite** — 本地存储

## 功能特性
- 🖥️ **多面板分屏** — 同时运行多个 Claude Code 会话
- ⚡ **实时流式输出** — Direct API SSE 逐 token 流式
- 🔐 **权限控制系统** — VSCode 风格的内联权限确认条
- 📊 **Mermaid 可视化** — 支持 Mermaid 图表渲染（懒加载）
- 🎨 **浅色/深色主题** — 自动跟随系统偏好
- ⌨️ **键盘快捷键** — Ctrl+Enter 发送、Ctrl+Shift+C 中断、Ctrl+/ 聚焦输入
- 📁 **文件树 + @mention** — 快速引用项目文件
- 🔄 **消息操作** — 重新生成、复制、编辑消息

## 快速开始

### 安装
从 [Releases](https://github.com/liuh82/claude-code-desktop/releases) 下载最新版本。

### 前置条件
- Claude Code CLI 已安装（`npm i -g @anthropic-ai/claude-code`）
- Claude API Key 或兼容的第三方 API

### 配置
首次启动后，在设置中配置：
- **API 模式**：Direct API（推荐）或 Claude CLI 代理
- **API Base URL**：Anthropic 官方或第三方兼容端点
- **认证信息**：API Key 或 Auth Token

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run electron:build

# 测试
npm test
```

## 项目结构

```
├── electron/          # Electron 主进程 + Direct API 客户端
├── src/
│   ├── components/    # React 组件
│   │   ├── Chat/      # 聊天相关（消息气泡、权限条、Mermaid 等）
│   │   └── Pane/      # 面板（终端面板、文件树等）
│   ├── stores/        # Zustand 状态管理
│   ├── lib/           # 工具函数
│   └── types/         # TypeScript 类型定义
└── electron-builder.yml  # Electron Builder 配置
```

## License
MIT
