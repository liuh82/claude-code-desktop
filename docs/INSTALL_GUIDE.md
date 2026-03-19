# Claude Code Desktop — 安装与使用指南

> 基于 Tauri v2 的 Claude Code 桌面客户端
> 版本：v0.1.0 | 2026-03-19

---

## 1. 系统要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| 操作系统 | macOS 12+ / Windows 10+ / Ubuntu 22.04+ | 推荐 macOS 14+ |
| Rust | 1.77.2+ | `rustup --version` |
| Node.js | 18+ | 推荐 20 LTS |
| npm | 9+ | 随 Node.js 安装 |
| Claude Code CLI | 2.0+ | `claude --version` |

---

## 2. 前置安装

### 2.1 安装 Rust

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Windows: 下载 https://rustup.rs/ 运行安装器

# 验证
rustc --version   # 应 >= 1.77.2
cargo --version
```

### 2.2 安装 Node.js

```bash
# 推荐 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20

# 验证
node --version   # v20.x
npm --version    # 10.x
```

### 2.3 安装 Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code

# 验证
claude --version   # 应 >= 2.0
```

首次运行 `claude` 需要登录 Anthropic 账号或配置 API Key。

### 2.4 操作系统依赖

**macOS：**
```bash
xcode-select --install
```

**Ubuntu / Debian：**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libjavascriptcoregtk-4.1-dev
```

**Fedora / RHEL / OpenCloudOS：**
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  openssl-devel \
  javascriptcoregtk4.1-devel
```

---

## 3. 安装 CCDesk

```bash
# 克隆项目
git clone https://github.com/liuh82/claude-code-desktop.git
cd claude-code-desktop

# 安装前端依赖
npm install

# 编译 Rust 后端（首次较慢，需下载依赖）
cd src-tauri
cargo build
cd ..
```

---

## 4. 运行

### 4.1 开发模式

```bash
# 启动开发服务器（带热重载）
npm run tauri dev
```

首次启动会编译 Rust 代码（约 2-5 分钟），后续启动会快很多。

启动后会打开桌面窗口，包含：
- **左侧边栏**：项目列表
- **顶部标签栏**：多标签页管理
- **主内容区**：CLI 终端面板
- **底部状态栏**：连接状态 + 模型信息

### 4.2 生产构建

```bash
# 构建安装包
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/`：
- macOS: `.dmg`
- Windows: `.msi` / `.exe`
- Linux: `.deb` / `.rpm` / `.AppImage`

---

## 5. 使用方法

### 5.1 打开项目

1. 点击左侧边栏 **"Open Project"** 按钮
2. 选择本地项目文件夹
3. 自动创建标签页并启动 Claude Code 会话

### 5.2 与 Claude Code 交互

在终端面板底部的输入框中输入指令：

```
> 帮我重构 src/utils/format.ts，提取重复的日期格式化逻辑

> 给这个函数添加单元测试

> 修复 src/components/Login.tsx 里的 TypeScript 类型错误
```

**快捷键：**
- `Cmd/Ctrl + Enter`：发送消息
- `Shift + Enter`：换行
- `Cmd/Ctrl + N`：新建标签页
- `Cmd/Ctrl + W`：关闭当前标签页
- `Cmd/Ctrl + K`：打开命令面板
- `Cmd/Ctrl + Shift + N`：分屏（新面板）

### 5.3 多面板分屏

1. 右键点击当前面板标签
2. 选择 **"Split Right"** 或 **"Split Down"**
3. 拖动分隔线调整大小
4. 每个面板运行独立的 Claude Code 会话

### 5.4 切换主题

- `Cmd/Ctrl + K` 打开命令面板
- 输入 "Toggle Theme"
- 在暗色/亮色主题间切换

---

## 6. 配置

### 6.1 Claude Code CLI 配置

CCDesk 启动 Claude Code 时使用以下参数：
```
claude --print --verbose --output-format stream-json --permission-mode auto
```

如需自定义，在设置面板（齿轮图标）中调整：
- **Claude CLI 路径**：默认自动检测
- **默认模型**：跟随 CC 全局配置
- **权限模式**：auto（自动批准）/ default（询问确认）

### 6.2 权限说明

| 权限模式 | 行为 | 适用场景 |
|---------|------|---------|
| `auto` | 自动批准所有操作 | 受信任项目，CI/CD 环境 |
| `default` | 每次操作询问确认 | 不熟悉的项目 |
| `acceptEdits` | 自动批准编辑，命令需确认 | 一般开发 |

> ⚠️ **root 用户注意**：`--dangerously-skip-permissions` 在 root 下被禁止。推荐使用 `auto` 模式或在项目 `.claude/settings.local.json` 中配置白名单。

### 6.3 项目权限白名单

在项目根目录创建 `.claude/settings.local.json`：
```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Write(*)",
      "Edit(*)",
      "Read(*)"
    ]
  }
}
```

---

## 7. 常见问题

### Q: `cargo build` 报错找不到 webkit2gtk
**A:** 安装系统依赖（见第 2.4 节）。Ubuntu 用 `libwebkit2gtk-4.1-dev`，Fedora 用 `webkit2gtk4.1-devel`。

### Q: 启动后窗口空白
**A:** 打开开发者工具（菜单 → View → Developer Tools）查看控制台错误。通常是前端编译问题，运行 `npm run build` 检查。

### Q: Claude Code 会话无响应
**A:** 检查 Claude Code CLI 是否正确安装：`claude --version`。如果使用 API Key 方式，确保环境变量 `ANTHROPIC_API_KEY` 已设置。

### Q: macOS 提示"应用已损坏"
**A:** 系统偏好设置 → 安全性与隐私 → 仍要打开。或使用 `npm run tauri dev` 开发模式运行。

### Q: 多面板之间能否共享上下文？
**A:** 当前每个面板运行独立的 Claude Code 进程，不共享上下文。未来版本考虑支持。

---

## 8. 项目结构

```
claude-code-desktop/
├── src/                    # React 前端
│   ├── App.tsx             # 主入口
│   ├── components/         # UI 组件
│   │   ├── Sidebar.tsx     # 项目侧边栏
│   │   ├── TabBar.tsx      # 标签栏
│   │   ├── PaneView.tsx    # 面板视图
│   │   ├── TerminalView.tsx # 终端组件
│   │   ├── SplitPane.tsx   # 分屏组件
│   │   ├── CommandPalette.tsx # 命令面板
│   │   ├── SettingsDialog.tsx # 设置面板
│   │   └── StatusBar.tsx   # 状态栏
│   ├── hooks/              # React Hooks
│   │   ├── useTauri.ts     # Tauri 集成
│   │   └── useKeyboard.ts  # 快捷键
│   ├── stores/             # Zustand 状态管理
│   ├── theme/              # 主题系统
│   └── types/              # TypeScript 类型
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── core/           # 核心模块
│   │   │   ├── process_pool.rs    # CC 进程池
│   │   │   ├── session_manager.rs # 会话管理
│   │   │   ├── tab_manager.rs     # 标签页管理
│   │   │   ├── pane_manager.rs    # 面板管理
│   │   │   ├── output_parser.rs   # CC 输出解析
│   │   │   └── stream_handler.rs  # 输出流处理
│   │   ├── db/             # SQLite 数据层
│   │   ├── commands/       # Tauri 命令
│   │   └── error.rs        # 错误类型
│   └── Cargo.toml
├── docs/                   # 文档
└── package.json
```

---

## 9. 技术支持

- **问题反馈**：GitHub Issues
- **仓库**：https://github.com/liuh82/claude-code-desktop
- **Nexus 平台**：https://github.com/liuh82/agent-orchestration
