import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  execute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const MAX_RECENT = 5;
const RECENT_KEY = 'claude-code-desktop-recent-commands';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // unavailable
  }
}

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact substring match
  const idx = t.indexOf(q);
  if (idx >= 0) {
    return { match: true, score: 100 - idx };
  }

  // Character-by-character fuzzy match
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10 - ti; // earlier matches score higher
      qi++;
    }
  }

  return { match: qi === q.length, score };
}

function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtered and scored commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((cmd) => ({ cmd, ...fuzzyMatch(query, cmd.label) }))
      .filter((r) => r.match)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd);
  }, [query, commands]);

  // Organize into recent + filtered
  const displayList = useMemo(() => {
    if (!query.trim()) {
      const recent = recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is CommandItem => c !== undefined);
      const rest = commands.filter((c) => !recentIds.includes(c.id));
      return { recent, rest };
    }
    return { recent: [] as CommandItem[], rest: filtered };
  }, [query, commands, filtered, recentIds]);

  const flatList = useMemo(() => {
    return [...displayList.recent, ...displayList.rest];
  }, [displayList]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Sync selected index with list changes
  useEffect(() => {
    if (selectedIndex >= flatList.length) {
      setSelectedIndex(Math.max(0, flatList.length - 1));
    }
  }, [flatList.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Close on Escape pressed outside
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.target !== inputRef.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      cmd.execute();
      setRecentIds((prev) => {
        const next = [cmd.id, ...prev.filter((id) => id !== cmd.id)];
        saveRecent(next);
        return next;
      });
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          executeCommand(flatList[selectedIndex]);
        }
        return;
      }
    },
    [flatList, selectedIndex, executeCommand, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="cp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp-container" role="dialog" aria-label="Command Palette">
        <div className="cp-search">
          <input
            ref={inputRef}
            className="cp-search__input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="cp-list" ref={listRef}>
          {displayList.recent.length > 0 && !query.trim() && (
            <div className="cp-section">
              <div className="cp-section__title">Recent</div>
              {displayList.recent.map((cmd) => (
                <CommandPaletteItem
                  key={cmd.id}
                  command={cmd}
                  index={flatList.indexOf(cmd)}
                  selectedIndex={selectedIndex}
                  onSelect={executeCommand}
                  onHover={setSelectedIndex}
                />
              ))}
            </div>
          )}

          {(query.trim() || displayList.rest.length > 0) && (
            <div className="cp-section">
              {!query.trim() && displayList.recent.length > 0 && (
                <div className="cp-section__title">All Commands</div>
              )}
              {displayList.rest.map((cmd, i) => (
                <CommandPaletteItem
                  key={cmd.id}
                  command={cmd}
                  index={displayList.recent.length + i}
                  selectedIndex={selectedIndex}
                  onSelect={executeCommand}
                  onHover={setSelectedIndex}
                />
              ))}
              {displayList.rest.length === 0 && query.trim() && (
                <div className="cp-empty">No commands found</div>
              )}
            </div>
          )}
        </div>

        <div className="cp-footer">
          <span className="cp-footer__hint">
            <kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate
          </span>
          <span className="cp-footer__hint">
            <kbd>Enter</kbd> execute
          </span>
          <span className="cp-footer__hint">
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function CommandPaletteItem({
  command,
  index,
  selectedIndex,
  onSelect,
  onHover,
}: {
  command: CommandItem;
  index: number;
  selectedIndex: number;
  onSelect: (cmd: CommandItem) => void;
  onHover: (index: number) => void;
}) {
  const isSelected = index === selectedIndex;

  return (
    <div
      className={`cp-item ${isSelected ? 'cp-item--selected' : ''}`}
      data-selected={isSelected}
      onClick={() => onSelect(command)}
      onMouseEnter={() => onHover(index)}
      role="option"
      aria-selected={isSelected}
    >
      <span className="cp-item__label">{command.label}</span>
      {command.shortcut && (
        <span className="cp-item__shortcut">{command.shortcut}</span>
      )}
    </div>
  );
}

export { CommandPalette };
export type { CommandItem };
