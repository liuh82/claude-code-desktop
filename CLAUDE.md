# Claude Code Desktop — CC 执行指南

## 项目概述
Claude Code 桌面客户端，基于 Tauri v2 + React 18 + TypeScript 的多面板编程环境。

## 技术栈
- Tauri v2 (Rust 后端)
- React 18 + TypeScript (前端)
- Zustand (状态管理)
- Monaco Editor (代码编辑器)
- SQLite (本地存储)

## 架构要点
- 每面板独立 CLI 进程
- tmux 风格多面板分屏
- 进程池管理

## 架构文档
详细架构见 `docs/architecture.md` (v2.4)

## 开发规范
- TypeScript strict mode
- 组件使用函数式组件 + hooks
- 状态管理用 Zustand store
- 样式用 CSS Modules 或 Tailwind
