import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { PermissionBar } from '@/components/Chat/PermissionBar';
import { claudeApi, isElectron } from '@/lib/claude-api';
import { getPermissionInfo } from '@/lib/tool-utils';
import type { FileNode } from '@/types/chat';
import styles from './TerminalPane.module.css';

// ── Slash command types ──

interface SlashCommand {
  name: string;
  description: string;
  source: 'built-in' | 'skill' | 'plugin' | 'project';
  pluginName?: string;
}

// Built-in commands — locally handled
const BUILT_IN_COMMANDS: SlashCommand[] = [
  { name: '/clear', description: '清除对话历史', source: 'built-in' },
  { name: '/compact', description: '压缩对话上下文', source: 'built-in' },
  { name: '/config', description: '查看/修改配置', source: 'built-in' },
  { name: '/cost', description: '查看 token 使用量', source: 'built-in' },
  { name: '/doctor', description: '检查 Claude Code 健康状态', source: 'built-in' },
  { name: '/help', description: '显示帮助信息', source: 'built-in' },
  { name: '/init', description: '初始化 Claude Code 项目', source: 'built-in' },
  { name: '/login', description: '登录 Anthropic 账户', source: 'built-in' },
  { name: '/logout', description: '登出 Anthropic 账户', source: 'built-in' },
  { name: '/model', description: '切换模型', source: 'built-in' },
  { name: '/permissions', description: '管理权限', source: 'built-in' },
  { name: '/review', description: '代码审查', source: 'built-in' },
  { name: '/status', description: '查看状态', source: 'built-in' },
  { name: '/test', description: '为选定函数生成单元测试', source: 'built-in' },
  { name: '/bug', description: '报告 CLI 行为中的 bug', source: 'built-in' },
  { name: '/vim', description: '切换 vim 模式', source: 'built-in' },
  { name: '/slide', description: 'PPT 风格信息幻灯片（如：/slide:business 项目概览）', source: 'built-in' },
];

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

// File extension → Material Symbols icon
function getFileIcon(filename: string): { icon: string; colorClass: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h'].includes(ext)) {
    return { icon: 'code_blocks', colorClass: styles.fileIconCode };
  }
  if (['html', 'htm'].includes(ext)) {
    return { icon: 'html', colorClass: styles.fileIconStyle };
  }
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return { icon: 'css', colorClass: styles.fileIconStyle };
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) {
    return { icon: 'data_object', colorClass: styles.fileIconJson };
  }
  if (['md', 'txt', 'rst'].includes(ext)) {
    return { icon: 'description', colorClass: styles.fileIconDocs };
  }
  if (['sh', 'bash', 'zsh', 'fish'].includes(ext)) {
    return { icon: 'terminal', colorClass: styles.fileIconConfig };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)) {
    return { icon: 'image', colorClass: styles.fileIconImage };
  }
  if (['test.ts', 'test.tsx', 'test.js', 'test.jsx', 'spec.ts', 'spec.tsx', 'spec.js', 'spec.jsx'].some(t => filename.endsWith(t))) {
    return { icon: 'science', colorClass: styles.fileIconTest };
  }
  return { icon: 'description', colorClass: styles.fileIconDefault };
}

// ── Props & helpers ──

// Directories and files to exclude from @mention file list
const MENTION_EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '.turbo', '.cache', 'coverage', '.nyc_output', '.terraform',
]);
const MENTION_EXCLUDED_PATTERNS = /^[._]/;  // hidden dirs/files (starting with . or _)

function shouldExcludeFromMention(path: string): boolean {
  const segments = path.split('/');
  for (const seg of segments) {
    if (MENTION_EXCLUDED_DIRS.has(seg)) return true;
    if (MENTION_EXCLUDED_PATTERNS.test(seg)) return true;
  }
  return false;
}

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
}

function flattenTree(nodes: FileNode[], prefix = ''): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    const p = prefix ? `${prefix}/${node.name}` : node.name;
    // Skip excluded directories entirely (don't recurse into them)
    if (node.type === 'directory' && MENTION_EXCLUDED_DIRS.has(node.name)) continue;
    if (node.type === 'file') {
      // Skip hidden files/files in hidden dirs
      if (shouldExcludeFromMention(p)) continue;
      result.push({ ...node, path: p });
    }
    if (node.children) {
      result.push(...flattenTree(node.children, p));
    }
  }
  return result;
}

function TerminalPane({ tabId, paneId, isActive }: TerminalPaneProps) {
  const tab = useTabStore((s) => s.tabs.get(tabId));
  const pane = tab?.panes.get(paneId);
  const setActivePane = useTabStore((s) => s.setActivePane);
  const splitPane = useTabStore((s) => s.splitPane);
  const closePane = useTabStore((s) => s.closePane);
  const activeProject = useProjectStore((s) => s.activeProject);
  const paneProjectPath = useTabStore((s) => s.projectPaths.get(paneId)) ?? activeProject?.path ?? '';
  const projectPath = activeProject?.path ?? '';

  const paneState = useChatStore((s) => s.panes.get(paneId));
  const messages = paneState?.messages ?? [];
  const isGenerating = paneState?.isGenerating ?? false;
  const fileTree = useChatStore((s) => s.fileTree);
  const pendingFileMention = useChatStore((s) => s.pendingFileMention);
  const tokenUsage = paneState?.tokenUsage ?? { input: 0, output: 0 };
  const currentModel = useChatStore((s) => s.currentModel) || 'claude-sonnet-4-6';
  const permissionMode = useChatStore((s) => s.permissionMode);
  const grantPermission = useChatStore((s) => s.grantPermission);
  const denyPermission = useChatStore((s) => s.denyPermission);
  const setPermissionMode = useChatStore((s) => s.setPermissionMode);
  const pendingPermission = useChatStore((s) => s.pendingPermission);

  const [text, setText] = useState('');
  const [editMode, setEditMode] = useState<'plan' | 'auto' | 'confirm'>('confirm');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMention, setShowMention] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [dynamicCommands, setDynamicCommands] = useState<SlashCommand[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // ── Dynamic slash command loading ──

  useEffect(() => {
    if (!isElectron() || !projectPath) return;
    claudeApi.listSlashCommands({ projectPath }).then((cmds) => {
      setDynamicCommands(cmds as SlashCommand[]);
    }).catch(() => {});
  }, [projectPath]);

  // Merge built-in + dynamic commands, deduplicated by name
  const allCommands = useMemo(() => {
    const seen = new Set<string>();
    const merged: SlashCommand[] = [];
    for (const cmd of BUILT_IN_COMMANDS) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        merged.push(cmd);
      }
    }
    for (const cmd of dynamicCommands) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        merged.push(cmd);
      }
    }
    return merged;
  }, [dynamicCommands]);

  // Group commands by source for display
  const commandGroups = useMemo(() => {
    const groups: { key: string; label: string; commands: SlashCommand[] }[] = [];

    const builtIn = allCommands.filter(c => c.source === 'built-in');
    if (builtIn.length > 0) groups.push({ key: 'built-in', label: 'Built-in', commands: builtIn });

    const skills = allCommands.filter(c => c.source === 'skill');
    if (skills.length > 0) groups.push({ key: 'skills', label: 'Skills', commands: skills });

    const plugins = allCommands.filter(c => c.source === 'plugin');
    if (plugins.length > 0) groups.push({ key: 'plugins', label: 'Plugins', commands: plugins });

    const project = allCommands.filter(c => c.source === 'project');
    if (project.length > 0) groups.push({ key: 'project', label: 'Project', commands: project });

    return groups;
  }, [allCommands]);

  // ── @ Mention items (special contexts + files) ──

  const flatFiles = useMemo(() => flattenTree(fileTree), [fileTree]);

  // Mention items — files only
  const allMentionItems = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const filteredFiles = mentionQuery
      ? flatFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      : flatFiles;
    // Files only (special contexts like @git, @tree, @url are handled by Claude CLI directly)
    return filteredFiles.map(f => ({ type: 'file' as const, name: f.name, path: f.path }));
  }, [flatFiles, mentionQuery]);

  // ── Filtered commands ──

  const filteredCommands = useMemo(() => {
    if (!slashQuery) return allCommands;
    const q = slashQuery.toLowerCase();
    return allCommands.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [allCommands, slashQuery]);

  // Filtered command groups for display
  const filteredGroups = useMemo(() => {
    return commandGroups
      .map(g => ({ ...g, commands: g.commands.filter(c => filteredCommands.includes(c)) }))
      .filter(g => g.commands.length > 0);
  }, [commandGroups, filteredCommands]);

  // ── Auto-resize textarea ──

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 200)}px`;
  }, [text]);

  // ── Initialize / cleanup pane ──

  useEffect(() => {
    if (paneProjectPath) {
      useChatStore.getState().initPane(paneId, paneProjectPath);
    }
  }, [paneId, paneProjectPath]);

  useEffect(() => {
    return () => {
      useChatStore.getState().clearPane(paneId);
    };
  }, [paneId]);

  // ── Scroll to bottom — smooth for new messages, instant for streaming updates ──

  const lastMsg = messages[messages.length - 1];
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    const isNewMessage = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    // New message or stream finished → smooth scroll; during streaming → instant to avoid jitter
    const isStreaming = lastMsg?.isStreaming;
    messagesEndRef.current?.scrollIntoView({ behavior: isNewMessage && !isStreaming ? 'smooth' : 'instant' });
  }, [messages.length, lastMsg?.content?.length, lastMsg?.isStreaming]);

  // ── Close dropdowns on outside click ──

  useEffect(() => {
    if (!showMention && !showSlash && !showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowMention(false);
        setShowSlash(false);
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMention, showSlash, showModelPicker]);

  // ── Global shortcut: Ctrl+/ focus input ──
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isActive]);

  // ── Consume file mention from ToolPanel click → add as chip ──
  useEffect(() => {
    if (!pendingFileMention) return;
    const filePath = useChatStore.getState().consumeFileMention();
    if (!filePath) return;
    setAttachedFiles(prev => {
      if (prev.includes(filePath)) return prev;
      return [...prev, filePath];
    });
    textareaRef.current?.focus();
  }, [pendingFileMention]);

  // ── Handlers ──

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleMentionSelect = useCallback((item: typeof allMentionItems[0]) => {
    // Remove the @query from textarea text
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = text.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@\S*$/);
      if (atMatch && atMatch.index !== undefined) {
        const before = text.slice(0, atMatch.index);
        const after = text.slice(cursorPos);
        setText(before + after);
      }
    }
    // Add as chip
    setAttachedFiles(prev => {
      if (prev.includes(item.path)) return prev;
      return [...prev, item.path];
    });
    setShowMention(false);
    setMentionQuery('');
    setMentionIndex(0);
    textareaRef.current?.focus();
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    // Handle /permissions <mode> with argument
    if (trimmed.startsWith('/permissions ')) {
      const modeArg = trimmed.split(/\s+/)[1]?.toLowerCase();
      const validModes = ['bypass', 'auto', 'ask'];
      if (validModes.includes(modeArg)) {
        setPermissionMode(modeArg as 'bypass' | 'auto' | 'ask');
        useChatStore.getState().addSystemMessage(paneId, `权限模式已切换为: ${modeArg.toUpperCase()}`);
      } else {
        useChatStore.getState().addSystemMessage(paneId, `无效模式: ${modeArg}。可用: bypass, auto, ask`);
      }
      setText('');
      setAttachedFiles([]);
      return;
    }

    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      const cmd = allCommands.find(c => c.name === trimmed);
      if (cmd) { handleSlashSelect(cmd); return; }
    }
    // Prepend attached files as @path format
    const filePrefix = attachedFiles.map(f => `@${f}`).join(' ');
    const fullMessage = attachedFiles.length > 0 ? `${filePrefix} ${trimmed}` : trimmed;
    setText('');
    setAttachedFiles([]);
    setShowMention(false);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    useChatStore.getState().sendMessage(paneId, fullMessage);
  }, [text, paneId, allCommands, attachedFiles]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMention(true);
      setMentionIndex(0);
      setShowSlash(false);
    } else {
      setShowMention(false);
      setMentionQuery('');
    }

    const slashMatch = newText.match(/\/(\S*)$/);
    if (slashMatch && !atMatch) {
      setSlashQuery(slashMatch[1]);
      setShowSlash(true);
      setSlashIndex(0);
    } else {
      setShowSlash(false);
      setSlashQuery('');
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setShowSlash(false);
    const name = cmd.name;
    const store = useChatStore.getState();

    // Built-in commands: local handling
    if (cmd.source === 'built-in') {
      if (name === '/clear') {
        store.clearPane(paneId);
        store.initPane(paneId, store.projectPath);
        setText('');
        return;
      }
      if (name === '/model') {
        setShowModelPicker(true);
        setText('');
        return;
      }
      if (name === '/config') {
        window.dispatchEvent(new CustomEvent('ccdesk:open-settings'));
        setText('');
        return;
      }
      if (name === '/cost') {
        const usage = paneState?.tokenUsage ?? { input: 0, output: 0 };
        store.addSystemMessage(paneId, [
          '```',
          'Token 使用统计',
          '━━━━━━━━━━━━',
          '输入 tokens: ' + usage.input,
          '输出 tokens: ' + usage.output,
          '总计: ' + (usage.input + usage.output),
          '```',
        ].join('\n'));
        setText('');
        return;
      }
      if (name === '/status') {
        const p = store.panes.get(paneId);
        const lines = [
          '```',
          'Claude Code Desktop 状态',
          '━━━━━━━━━━━━',
          '模型: ' + (store.currentModel || 'claude-sonnet-4-6'),
          '状态: ' + (p?.isGenerating ? '生成中' : '空闲'),
          '消息数: ' + (p?.messages?.length ?? 0),
          '项目: ' + (store.projectPath || '未设置'),
          '```',
        ];
        store.addSystemMessage(paneId, lines.join('\n'));
        setText('');
        return;
      }
      if (name === '/compact') {
        store.sendMessage(paneId, '/compact');
        setText('');
        return;
      }
      if (name === '/permissions') {
        const mode = useChatStore.getState().permissionMode;
        const modeDescriptions: Record<string, string> = {
          bypass: '所有工具直接执行（无确认）',
          auto: '安全工具自动执行，危险工具（Write/Edit/Bash）弹确认',
          ask: '所有工具都需要人工确认',
        };
        store.addSystemMessage(paneId, [
          '```',
          '权限模式',
          '━━━━━━━━━━━━',
          '当前模式: ' + mode.toUpperCase(),
          modeDescriptions[mode],
          '',
          '可用模式:',
          '  bypass — 不确认，直接执行',
          '  auto   — 安全工具自动，危险工具确认',
          '  ask    — 全部需要确认',
          '',
          '使用 /permissions <模式> 切换，例如: /permissions bypass',
          '```',
        ].join('\n'));
        setText('');
        return;
      }
    }

    // All other commands (built-in fallback, skill, plugin, project) → send to CLI
    setText('');
    store.sendMessage(paneId, name);
  }, [paneId, paneState]);

  const handleStop = useCallback(() => {
    useChatStore.getState().stopGeneration(paneId);
  }, [paneId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Shift+C / Cmd+Shift+C — stop generation
    if (e.key === 'C' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      handleStop();
      return;
    }

    // Ctrl+/ — focus input (already focused, but re-focus in case)
    if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      textareaRef.current?.focus();
      return;
    }

    // Ctrl+Enter / Cmd+Enter — send message
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Handle slash command navigation
    if (showSlash && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (slashIndex + 1) % filteredCommands.length;
        setSlashIndex(next);
        const el = document.querySelector(`[data-slash-item="${next}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = (slashIndex - 1 + filteredCommands.length) % filteredCommands.length;
        setSlashIndex(prev);
        const el = document.querySelector(`[data-slash-item="${prev}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleSlashSelect(filteredCommands[slashIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setShowSlash(false); setShowModelPicker(false); return; }
    }
    // Handle mention dropdown navigation
    if (showMention && allMentionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (mentionIndex + 1) % allMentionItems.length;
        setMentionIndex(next);
        const list = document.querySelector('[data-mention-list]');
        const active = list?.children[next] as HTMLElement;
        active?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = (mentionIndex - 1 + allMentionItems.length) % allMentionItems.length;
        setMentionIndex(prev);
        const list = document.querySelector('[data-mention-list]');
        const active = list?.children[prev] as HTMLElement;
        active?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(allMentionItems[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMention(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showSlash, filteredCommands, slashIndex, handleSlashSelect, showMention, allMentionItems, mentionIndex, handleMentionSelect, handleSend, handleStop]);

  const handleModelSelect = useCallback((modelId: string) => {
    setShowModelPicker(false);
    const state = useChatStore.getState();
    state.currentModel = modelId;
    useSettingsStore.getState().updateSetting('defaultModel', modelId);
    useChatStore.getState().addSystemMessage(paneId, '已切换模型: ' + modelId);
  }, [paneId]);

  const handleAttachFile = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const files = await claudeApi.openFileDialog();
      if (files.length > 0) {
        setAttachedFiles(prev => {
          const next = [...prev];
          for (const f of files) {
            if (!next.includes(f)) next.push(f);
          }
          return next;
        });
        textareaRef.current?.focus();
      }
    } catch {}
  }, []);

  const removeAttachedFile = useCallback((filePath: string) => {
    setAttachedFiles(prev => prev.filter(f => f !== filePath));
  }, []);

  const handleAttachImage = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const files = await claudeApi.openFileDialog({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      });
      if (files.length > 0) {
        const names = files.map(f => f.split('/').pop() || f).join(', ');
        setText(prev => prev ? prev + ` [图片: ${names}]` : `[图片: ${names}]`);
        textareaRef.current?.focus();
      }
    } catch {}
  }, []);

  const handleSplitHorizontal = useCallback(() => {
    splitPane(tabId, paneId, 'horizontal');
  }, [tabId, paneId, splitPane]);

  const handleSplitVertical = useCallback(() => {
    splitPane(tabId, paneId, 'vertical');
  }, [tabId, paneId, splitPane]);

  const handleClose = useCallback(() => {
    closePane(tabId, paneId);
  }, [tabId, paneId, closePane]);

  const status = pane?.status || 'idle';
  const statusClass = `paneStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  const isSinglePane = (tab?.panes.size ?? 0) <= 1;
  const paneRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setIsNarrow(entries[0].contentRect.width < 500);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const canSend = (text.trim().length > 0 || attachedFiles.length > 0) && !isGenerating;
  const shortProjectName = paneProjectPath ? paneProjectPath.split('/').filter(Boolean).pop() || '' : '';

  // M6: compute permission info outside JSX (replaces IIFE)
  const permissionInfo = useMemo(() => {
    if (!pendingPermission) return null;
    return getPermissionInfo(pendingPermission.name, pendingPermission.input);
  }, [pendingPermission]);

  return (
    <div
      ref={paneRef}
      className={`${styles.terminalPane} ${isActive ? styles.terminalPaneActive : ''} ${isNarrow ? styles.terminalPaneNarrow : ''}`}
      onClick={handleFocus}
    >
      {/* Pane header — only show when split */}
      {!isSinglePane && <div className={styles.paneHeader}>
        <div className={styles.paneHeaderLeft}>
          <span className={`${styles.paneStatus} ${styles[statusClass]}`} />
          <span className={styles.paneTitle}>{shortProjectName || pane?.title || 'Terminal'}</span>
        </div>
        <div className={styles.paneHeaderRight}>
          <button
            className={`${styles.paneAction} ${styles.paneActionSplit}`}
            onClick={handleSplitHorizontal}
            title="水平分割 (⌘D)"
          >
            <span className="material-symbols-outlined">vertical_split</span>
          </button>
          <button
            className={`${styles.paneAction} ${styles.paneActionSplit}`}
            onClick={handleSplitVertical}
            title="垂直分割 (⌘⇧D)"
          >
            <span className="material-symbols-outlined">horizontal_split</span>
          </button>
          <button
            className={`${styles.paneAction} ${styles.paneActionClose}`}
            onClick={handleClose}
            title="关闭面板 (⌘W)"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>}

      {/* Messages */}
      <div className={styles.paneBody}>
        <div className={styles.paneMessages}>
          <div className={styles.paneMessagesInner}>
            {messages.length === 0 && (
              <div className={styles.paneEmpty}>
                Claude Code 终端 — 输入消息开始
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                paneId={paneId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input — Stitch design: all-in-one rounded box */}
        <div className={styles.paneInput}>
          {/* Permission bar — floats above input when a tool needs approval */}
          {permissionInfo && (
            <PermissionBar
              toolName={permissionInfo.toolName}
              toolIcon={permissionInfo.toolIcon}
              target={permissionInfo.target}
              detail={pendingPermission!.input.content as string | undefined}
              isDangerous={permissionInfo.isDangerous}
              onAllow={() => grantPermission()}
              onDeny={() => denyPermission()}
              onAllowAlways={() => { grantPermission(); setPermissionMode('bypass'); }}
            />
          )}

          <div className={styles.paneInputOuter} ref={inputWrapperRef}>
            {/* @ Mention dropdown — special contexts + files */}
            {showMention && allMentionItems.length > 0 && (
              <div className={styles.mentionDropdown}>
                <div className={styles.mentionDropdownList} data-mention-list>
                  {allMentionItems.map((item, idx) => {
                    const isActive = idx === mentionIndex;
                    const fileIcon = getFileIcon(item.name);
                    return (
                      <div
                        key={item.path}
                        className={`${styles.mentionItem} ${isActive ? styles.mentionItemActive : ''}`}
                        onClick={() => handleMentionSelect(item)}
                        onMouseEnter={() => setMentionIndex(idx)}
                      >
                        <span className={`material-symbols-outlined ${fileIcon.colorClass}`} style={{ fontSize: 18 }}>{fileIcon.icon}</span>
                        <div className={styles.mentionInfo}>
                          <span className={styles.mentionName}>{item.name}</span>
                          <span className={styles.mentionPath}>{item.path}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* / Slash command dropdown — glass panel, grouped */}
            {showSlash && filteredGroups.length > 0 && (
              <div className={styles.slashDropdown}>
                <div className={styles.slashDropdownScroll}>
                  {filteredGroups.map((group) => (
                    <div key={group.key}>
                      <div className={styles.slashGroup}>{group.label}</div>
                      <div className={styles.slashGroupItems}>
                        {group.commands.map((cmd) => {
                          const globalIdx = filteredCommands.indexOf(cmd);
                          return (
                            <div
                              key={cmd.name}
                              data-slash-item={globalIdx}
                              className={`${styles.slashItem} ${globalIdx === slashIndex ? styles.slashItemActive : ''}`}
                              onClick={() => handleSlashSelect(cmd)}
                              onMouseEnter={() => setSlashIndex(globalIdx)}
                            >
                              <span className={styles.slashName}>{cmd.name}</span>
                              <span className={styles.slashDesc}>{cmd.description}</span>
                              {globalIdx === slashIndex && <span className={styles.slashBadge}>Tab</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.paneInputWrapper}>
              {/* Model picker dropdown */}
              {showModelPicker && (
                <div className={styles.modelPickerDropdown}>
                  <div className={styles.modelPickerList}>
                    {AVAILABLE_MODELS.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.modelPickerItem} ${useChatStore.getState().currentModel === m.id ? styles.modelPickerItemActive : ''}`}
                        onClick={() => handleModelSelect(m.id)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>model_training</span>
                        <div>
                          <div className={styles.modelPickerName}>{m.label}</div>
                          <div className={styles.modelPickerId}>{m.id}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className={styles.paneInputField}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={attachedFiles.length > 0 ? '' : '给 Claude 发送消息... (Enter 发送, Shift+Enter 换行)'}
                spellCheck={false}
                rows={2}
              />

              {/* Bottom row: attach + image | chips | mode selector | send */}
              <div className={styles.paneInputActions}>
                <div className={styles.paneInputActionsLeft}>
                  <button className={styles.actionToolBtn} title="附加文件" onClick={handleAttachFile}>
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <button className={styles.actionToolBtn} title="附加图片" onClick={handleAttachImage}>
                    <span className="material-symbols-outlined">image</span>
                  </button>
                  {attachedFiles.length > 0 && (
                    <span className={styles.chipListDivider} />
                  )}
                  {attachedFiles.map((filePath) => {
                    const fileName = filePath.split('/').pop() || filePath;
                    const fileIcon = getFileIcon(fileName);
                    return (
                      <div key={filePath} className={styles.chip}>
                        <span className={`material-symbols-outlined ${fileIcon.colorClass}`} style={{ fontSize: 14 }}>{fileIcon.icon}</span>
                        <span className={styles.chipName}>{fileName}</span>
                        <button className={styles.chipRemove} onClick={() => removeAttachedFile(filePath)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.paneInputSpacer} />
                <button
                  className={styles.modelPickerBtn}
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  title="切换模型"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>model_training</span>
                </button>
                <div className={styles.modeSelector}>
                  {([
                    { key: 'plan' as const, icon: 'psychology', label: 'Plan' },
                    { key: 'auto' as const, icon: 'bolt', label: 'Auto Edit' },
                    { key: 'confirm' as const, icon: 'verified', label: 'Confirm Edit' },
                  ]).map((m) => (
                    <button
                      key={m.key}
                      className={`${styles.modeBtn} ${editMode === m.key ? styles.modeBtnActive : ''}`}
                      onClick={() => setEditMode(m.key)}
                      title={m.label}
                    >
                      <span className="material-symbols-outlined">{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={`${styles.paneSendBtn} ${isGenerating ? '' : canSend ? styles.paneSendBtnActive : ''}`}
                  onClick={isGenerating ? handleStop : handleSend}
                  disabled={!isGenerating && !canSend}
                  title={isGenerating ? '停止生成' : '发送 (⌘Enter)'}
                >
                  <span className="material-symbols-outlined">
                    {isGenerating ? 'stop_circle' : 'arrow_upward'}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {/* Bottom hint — 2-row layout */}
          <div className={styles.paneInputHint}>
            <div className={styles.paneInputHintRow}>
              <span>{currentModel.replace('claude-', '').replace(/-\d{8}$/, '')}</span>
              <span className={styles.paneInputHintDot} />
              <span>{editMode === 'plan' ? 'Plan' : editMode === 'auto' ? 'Auto Edit' : 'Confirm Edit'}</span>
              <span className={styles.paneInputHintDot} />
              <span>{permissionMode}</span>
            </div>
            <div className={styles.paneInputHintRow}>
              <span>{tokenUsage.input > 1000 ? Math.round(tokenUsage.input / 1000) + 'K' : tokenUsage.input} in / {tokenUsage.output > 1000 ? Math.round(tokenUsage.output / 1000) + 'K' : tokenUsage.output} out</span>
              <span className={styles.paneInputHintDot} />
              <span>{200000 - tokenUsage.input - tokenUsage.output > 0 ? Math.round((200000 - tokenUsage.input - tokenUsage.output) / 1000) + 'K' : 0} remaining</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TerminalPane };
