import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useTerminalStore, type OutputLine } from '@/stores/useTerminalStore';
import './TerminalView.css';

export interface TerminalViewProps {
  paneId: string;
  onSendInput?: (input: string) => void;
}

interface ToolBlock {
  id: string;
  name: string;
  input: string;
  expanded: boolean;
}

function ToolUseBlock({ tool }: { tool: ToolBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tv-tool-block">
      <button className="tv-tool-block__header" onClick={() => setExpanded((v) => !v)}>
        <span className={`tv-tool-block__arrow ${expanded ? 'tv-tool-block__arrow--open' : ''}`}>
          &#9654;
        </span>
        <span className="tv-tool-block__name">{tool.name}</span>
      </button>
      {expanded && (
        <pre className="tv-tool-block__input">{tool.input}</pre>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable
    }
  }, [text]);

  return (
    <button
      className="tv-copy-btn"
      onClick={handleCopy}
      title="Copy"
      aria-label="Copy to clipboard"
    >
      {copied ? '\u2713' : '\u2398'}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="tv-code-block">
      <div className="tv-code-block__header">
        <span>Code</span>
        <CopyButton text={code} />
      </div>
      <pre className="tv-code-block__code">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function isToolUseBlock(line: string): boolean {
  try {
    const parsed = JSON.parse(line);
    return parsed.type === 'tool_use';
  } catch {
    return false;
  }
}

function isToolResultBlock(line: string): boolean {
  try {
    const parsed = JSON.parse(line);
    return parsed.type === 'tool_result';
  } catch {
    return false;
  }
}

function parseToolUse(line: string): ToolBlock | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.type === 'tool_use') {
      return {
        id: parsed.id ?? crypto.randomUUID(),
        name: parsed.name ?? 'unknown',
        input: typeof parsed.input === 'string' ? parsed.input : JSON.stringify(parsed.input ?? {}, null, 2),
        expanded: false,
      };
    }
  } catch {
    // not JSON
  }
  return null;
}

function parseToolResult(line: string): string | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.type === 'tool_result') {
      const content = parsed.content ?? parsed.output ?? '';
      return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    }
  } catch {
    // not JSON
  }
  return null;
}

function OutputLineView({ line }: { line: OutputLine }) {
  // Check for tool use blocks
  const toolUse = isToolUseBlock(line.content) ? parseToolUse(line.content) : null;
  if (toolUse) {
    return <ToolUseBlock tool={toolUse} />;
  }

  // Check for tool results
  const toolResult = isToolResultBlock(line.content) ? parseToolResult(line.content) : null;
  if (toolResult) {
    // If tool result looks like code (multi-line or has common code patterns)
    if (toolResult.includes('\n') || toolResult.length > 200) {
      return <CodeBlock code={toolResult} />;
    }
    return <div className="tv-output-line tv-output-line--result">{toolResult}</div>;
  }

  // Check for assistant text (markdown-like)
  if (line.content.startsWith('{') || line.content.startsWith('[')) {
    try {
      const parsed = JSON.parse(line.content);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        return (
          <div className="tv-output-line tv-output-line--text">
            {parsed.delta.text}
          </div>
        );
      }
      if (parsed.type === 'content_block_start') {
        return null;
      }
      if (parsed.type === 'content_block_stop') {
        return null;
      }
      if (parsed.type === 'assistant' && typeof parsed.message?.content === 'string') {
        return (
          <div className="tv-output-line tv-output-line--text tv-output-line--thinking">
            {parsed.message.content}
          </div>
        );
      }
    } catch {
      // not JSON — treat as plain text
    }
  }

  // Plain text output
  if (line.stream === 'stderr') {
    return <div className="tv-output-line tv-output-line--error">{line.content}</div>;
  }

  return (
    <div className="tv-output-line">
      <CopyButton text={line.content} />
      <span>{line.content}</span>
    </div>
  );
}

function TerminalView({ paneId, onSendInput }: TerminalViewProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const outputs = useTerminalStore((s) => s.outputs.get(paneId) ?? []);

  // Auto-scroll to bottom when new output arrives, unless user scrolled up
  useEffect(() => {
    if (!isAutoScrollRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [outputs.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 50;
    isAutoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSendInput?.(trimmed);
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue, onSendInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="tv-container">
      <div className="tv-output" ref={scrollRef} onScroll={handleScroll}>
        {outputs.length === 0 ? (
          <div className="tv-empty">
            <p>No output yet</p>
            <p className="tv-empty__hint">Type a message below to start</p>
          </div>
        ) : (
          outputs.map((line, i) => (
            <OutputLineView key={`${line.timestamp}-${i}`} line={line} />
          ))
        )}
      </div>
      <div className="tv-input-area">
        <textarea
          ref={inputRef}
          className="tv-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Send a message... (Shift+Enter for newline)"
          rows={1}
          onClick={focusInput}
        />
        <button
          className="tv-send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim()}
          aria-label="Send"
        >
          &#9654;
        </button>
      </div>
    </div>
  );
}

export default TerminalView;
