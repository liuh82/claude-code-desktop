import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { claudeApi, isElectron } from '@/lib/claude-api';
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

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
}

function flattenTree(nodes: FileNode[], prefix = ''): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    const p = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
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
  const tokenUsage = paneState?.tokenUsage ?? { input: 0, output: 0 };
  const currentModel = useChatStore((s) => s.currentModel) || 'claude-sonnet-4-6';

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

  // ── Scroll to bottom ──

  const lastMsg = messages[messages.length - 1];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // ── Consume file mention from ToolPanel click ──
  useEffect(() => {
    const filePath = useChatStore.getState().consumeFileMention();
    if (!filePath || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const insert = `@${filePath} `;
    const pos = textarea.selectionStart;
    const before = text.slice(0, pos) + insert;
    const after = text.slice(pos);
    setText(before + after);
    setTimeout(() => {
      textarea.setSelectionRange(before.length, before.length);
      textarea.focus();
    }, 0);
  }, [useChatStore.getState().pendingFileMention]);

  // ── Handlers ──

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleMentionSelect = useCallback((item: typeof allMentionItems[0]) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@\S*$/);
    if (!atMatch) return;

    const insert = `@${item.path} `;

    const before = text.slice(0, atMatch.index) + insert;
    const after = text.slice(cursorPos);
    const newPos = before.length;
    setText(before + after);
    setShowMention(false);
    setMentionQuery('');
    setMentionIndex(0);
    setTimeout(() => {
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      const cmd = allCommands.find(c => c.name === trimmed);
      if (cmd) { handleSlashSelect(cmd); return; }
    }
    setText('');
    setShowMention(false);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    useChatStore.getState().sendMessage(paneId, trimmed);
  }, [text, paneId, allCommands]);

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
    }

    // All other commands (built-in fallback, skill, plugin, project) → send to CLI
    setText('');
    store.sendMessage(paneId, name);
  }, [paneId, paneState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [showSlash, filteredCommands, slashIndex, handleSlashSelect, showMention, allMentionItems, mentionIndex, handleMentionSelect, handleSend]);

  const handleStop = useCallback(() => {
    useChatStore.getState().stopGeneration(paneId);
  }, [paneId]);

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
        const fileRefs = files.map(f => {
          const name = f.split('/').pop() || f;
          return `@${name}`;
        }).join(' ');
        setText(prev => prev ? prev + ' ' + fileRefs : fileRefs);
        textareaRef.current?.focus();
      }
    } catch {}
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
  const canSend = text.trim().length > 0 && !isGenerating;
  const shortProjectName = paneProjectPath ? paneProjectPath.split('/').filter(Boolean).pop() || '' : '';

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
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input — Stitch design: all-in-one rounded box */}
        <div className={styles.paneInput}>
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
                placeholder="给 Claude 发送消息或询问代码问题..."
                spellCheck={false}
                rows={2}
              />

              {/* Bottom row: attach + image | mode selector | send */}
              <div className={styles.paneInputActions}>
                <div className={styles.paneInputActionsLeft}>
                  <button className={styles.actionToolBtn} title="附加文件" onClick={handleAttachFile}>
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <button className={styles.actionToolBtn} title="附加图片" onClick={handleAttachImage}>
                    <span className="material-symbols-outlined">image</span>
                  </button>
                </div>
                <div className={styles.paneInputSpacer} />
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
