import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '@/stores/useTabStore';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { claudeApi, isElectron } from '@/lib/claude-api';
import type { FileNode } from '@/types/chat';
import styles from './TerminalPane.module.css';

// Claude Code slash commands — grouped per Stitch design spec
const COMMON_COMMANDS = [
  { name: '/edit', description: '修改或创建工作区文件' },
  { name: '/explain', description: '获取代码或逻辑的详细解读' },
];

const ALL_COMMANDS = [
  { name: '/clear', description: '清除对话历史' },
  { name: '/compact', description: '压缩对话上下文' },
  { name: '/config', description: '查看/修改配置' },
  { name: '/cost', description: '查看 token 使用量' },
  { name: '/doctor', description: '检查 Claude Code 健康状态' },
  { name: '/help', description: '显示帮助信息' },
  { name: '/init', description: '初始化 Claude Code 项目' },
  { name: '/login', description: '登录 Anthropic 账户' },
  { name: '/logout', description: '登出 Anthropic 账户' },
  { name: '/model', description: '切换模型' },
  { name: '/permissions', description: '管理权限' },
  { name: '/review', description: '代码审查' },
  { name: '/status', description: '查看状态' },
  { name: '/test', description: '为选定函数生成单元测试' },
  { name: '/bug', description: '报告 CLI 行为中的 bug' },
  { name: '/vim', description: '切换 vim 模式' },
];

const ALL_SLASH = [...COMMON_COMMANDS, ...ALL_COMMANDS];

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

interface TerminalPaneProps {
  tabId: string;
  paneId: string;
  isActive: boolean;
}

// Flatten file tree for search
function flattenTree(nodes: FileNode[], prefix = ''): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ ...node, path });
    }
    if (node.children) {
      result.push(...flattenTree(node.children, path));
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
  const projectPath = activeProject?.path ?? '';

  // Chat state per pane from store
  const paneState = useChatStore((s) => s.panes.get(paneId));
  const messages = paneState?.messages ?? [];
  const isGenerating = paneState?.isGenerating ?? false;
    const fileTree = useChatStore((s) => s.fileTree);
  console.log('[CCDesk] fileTree top-level:', fileTree.length, 'projectPath:', projectPath);

  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMention, setShowMention] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Flatten file tree for @ mentions
  const flatFiles = useMemo(() => flattenTree(fileTree), [fileTree]);
  console.log('[CCDesk] flatFiles total:', flatFiles.length);

  const filteredCommands = useMemo(() => {
    if (!slashQuery) return ALL_SLASH;
    const q = slashQuery.toLowerCase();
    return ALL_SLASH.filter(c => c.name.toLowerCase().includes(q));
  }, [slashQuery]);

  const filteredFiles = useMemo(() => {
    if (!mentionQuery) return flatFiles;
    const q = mentionQuery.toLowerCase();
    return flatFiles
      .filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
;
  }, [flatFiles, mentionQuery]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 200)}px`;
  }, [text]);

  // Initialize pane session on mount
  useEffect(() => {
    if (projectPath) {
      useChatStore.getState().initPane(paneId, projectPath);
    }
  }, [paneId, projectPath]);

  // Clear pane session on unmount
  useEffect(() => {
    return () => {
      useChatStore.getState().clearPane(paneId);
    };
  }, [paneId]);

  // Scroll to bottom on new messages and during streaming
  const lastMsg = messages[messages.length - 1];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMsg?.content?.length, lastMsg?.isStreaming]);

  // Close mention dropdown on outside click
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

  const handleFocus = useCallback(() => {
    if (!isActive) setActivePane(tabId, paneId);
  }, [isActive, tabId, paneId, setActivePane]);

  const handleMentionSelect = useCallback((file: FileNode) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@\S*$/);
    if (!atMatch) return;

    const before = text.slice(0, atMatch.index) + `@${file.path} `;
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
    // Check if it's a slash command
    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      const cmd = ALL_SLASH.find(c => c.name === trimmed);
      if (cmd) { handleSlashSelect(cmd); return; }
    }
    setText('');
    setShowMention(false);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    useChatStore.getState().sendMessage(paneId, trimmed);
  }, [text, paneId]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Detect @ mentions
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMention(true);
      setMentionIndex(0);
      setShowSlash(false);
      console.log('[CCDesk] @ mention detected:', atMatch[1], 'files:', flatFiles.length);
    } else {
      setShowMention(false);
      setMentionQuery('');
    }
    // Detect / commands
    const slashMatch = newText.match(/\/(\S*)$/);
    if (slashMatch && !atMatch) {
      setSlashQuery(slashMatch[1]);
      setShowSlash(true);
      setSlashIndex(0);
    } else {
      setShowSlash(false);
      setSlashQuery('');
    }
  }, [flatFiles]);

  const handleSlashSelect = useCallback((cmd: typeof ALL_SLASH[0]) => {
    setShowSlash(false);
    const name = cmd.name;
    const store = useChatStore.getState();

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

    // CLI commands — send to Claude process
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
    if (showMention && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (mentionIndex + 1) % filteredFiles.length;
        setMentionIndex(next);
        // Scroll into view
        const list = document.querySelector('[data-mention-list]');
        const active = list?.children[next] as HTMLElement;
        active?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = (mentionIndex - 1 + filteredFiles.length) % filteredFiles.length;
        setMentionIndex(prev);
        const list = document.querySelector('[data-mention-list]');
        const active = list?.children[prev] as HTMLElement;
        active?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(filteredFiles[mentionIndex]);
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
  }, [showSlash, filteredCommands, slashIndex, handleSlashSelect, showMention, filteredFiles, mentionIndex, handleMentionSelect, handleSend]);

  const handleStop = useCallback(() => {
    useChatStore.getState().stopGeneration(paneId);
  }, [paneId]);

  const handleModelSelect = useCallback((modelId: string) => {
    setShowModelPicker(false);
    // Update chat store model
    const state = useChatStore.getState();
    state.currentModel = modelId;
    // Persist to settings
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
        // For now, insert as file reference (future: base64 embed)
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
  const canSend = text.trim().length > 0 && !isGenerating;

  // Token display (reserved for future use)

  return (
    <div
      className={`${styles.terminalPane} ${isActive ? styles.terminalPaneActive : ''}`}
      onClick={handleFocus}
    >
      {/* Pane header — only show when split */}
      {!isSinglePane && <div className={styles.paneHeader}>
        <div className={styles.paneHeaderLeft}>
          <span className={`${styles.paneStatus} ${styles[statusClass]}`} />
          <span className={styles.paneTitle}>{pane?.title || 'Terminal'}</span>
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
            {messages.length === 0 ? (
              <div className={styles.paneEmpty}>
                Claude Code 终端 — 输入消息开始
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input — Stitch design: all-in-one rounded box */}
        <div className={styles.paneInput}>
          <div className={styles.paneInputOuter} ref={inputWrapperRef}>
            {/* @ Mention dropdown — positioned above, outside rounded wrapper to avoid clipping */}
            {showMention && filteredFiles.length > 0 && (
              <div className={styles.mentionDropdown}>
                <div className={styles.mentionDropdownList} data-mention-list>
                  {filteredFiles.map((file, idx) => (
                    <div
                      key={file.path}
                      className={`${styles.mentionItem} ${idx === mentionIndex ? styles.mentionItemActive : ''}`}
                      onClick={() => handleMentionSelect(file)}
                      onMouseEnter={() => setMentionIndex(idx)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
                      <div className={styles.mentionInfo}>
                        <span className={styles.mentionName}>{file.name}</span>
                        <span className={styles.mentionPath}>{file.path}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* / Slash command dropdown — glass panel, grouped */}
            {showSlash && filteredCommands.length > 0 && (
              <div className={styles.slashDropdown}>
                <div className={styles.slashDropdownScroll}>
                  {/* Common Commands group */}
                  {filteredCommands.filter(c => COMMON_COMMANDS.some(cc => cc.name === c.name)).length > 0 && (
                    <>
                      <div className={styles.slashGroup}>Common Commands</div>
                      <div className={styles.slashGroupItems}>
                        {filteredCommands.filter(c => COMMON_COMMANDS.some(cc => cc.name === c.name)).map((cmd) => {
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
                              {globalIdx === slashIndex && <span className={styles.slashBadge}>Select</span>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {/* All Commands group */}
                  {filteredCommands.filter(c => !COMMON_COMMANDS.some(cc => cc.name === c.name)).length > 0 && (
                    <>
                      <div className={styles.slashGroup}>All Commands</div>
                      <div className={styles.slashGroupItems}>
                        {filteredCommands.filter(c => !COMMON_COMMANDS.some(cc => cc.name === c.name)).map((cmd) => {
                          const globalIdx = filteredCommands.indexOf(cmd);
                          return (
                            <div
                              key={cmd.name}
                              className={`${styles.slashItem} ${globalIdx === slashIndex ? styles.slashItemActive : ''}`}
                              onClick={() => handleSlashSelect(cmd)}
                              onMouseEnter={() => setSlashIndex(globalIdx)}
                              data-slash-item={globalIdx}
                            >
                              <span className={styles.slashName}>{cmd.name}</span>
                              <span className={styles.slashDesc}>{cmd.description}</span>
                              {globalIdx === slashIndex && <span className={styles.slashBadge}>Tab</span>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
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

              {/* Bottom row: attach + image | send */}
              <div className={styles.paneInputActions}>
                <div className={styles.paneInputActionsLeft}>
                  <button className={styles.actionToolBtn} title="附加文件" onClick={handleAttachFile}>
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <button className={styles.actionToolBtn} title="附加图片" onClick={handleAttachImage}>
                    <span className="material-symbols-outlined">image</span>
                  </button>
                </div>
                {isGenerating ? (
                  <button className={styles.paneSendBtn} onClick={handleStop} title="停止生成">
                    <span className="material-symbols-outlined">stop_circle</span>
                  </button>
                ) : (
                  <button
                    className={`${styles.paneSendBtn} ${canSend ? styles.paneSendBtnActive : ''}`}
                    onClick={handleSend}
                    disabled={!canSend}
                    title="发送 (⌘Enter)"
                  >
                    <span className="material-symbols-outlined">arrow_upward</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Bottom hint */}
          <div className={styles.paneInputHint}>
            Claude Code 正在预览阶段 · 使用 ⌘+K 快速唤起命令
          </div>
        </div>
      </div>
    </div>
  );
}

export { TerminalPane };
