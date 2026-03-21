import { useState, useMemo, useCallback } from 'react';
import type { DiffFile, DiffLine } from '@/types/chat';
import styles from './DiffView.module.css';

type FilterType = 'all' | 'added' | 'modified' | 'deleted';

interface DiffViewProps {
  files: DiffFile[];
}

function countChanges(file: DiffFile): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') add++;
      if (line.type === 'delete') del++;
    }
  }
  return { add, del };
}

function statusLabel(status: DiffFile['status']): string {
  switch (status) {
    case 'added': return '\u65B0\u589E';
    case 'modified': return '\u4FEE\u6539';
    case 'deleted': return '\u5220\u9664';
  }
}

function statusBadgeClass(status: DiffFile['status']): string {
  switch (status) {
    case 'added': return styles.badgeAdded;
    case 'modified': return styles.badgeModified;
    case 'deleted': return styles.badgeDeleted;
  }
}

function filterLabel(t: FilterType): string {
  switch (t) {
    case 'all': return '\u5168\u90E8';
    case 'added': return '\u65B0\u589E';
    case 'modified': return '\u4FEE\u6539';
    case 'deleted': return '\u5220\u9664';
  }
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const lineClass = line.type === 'add'
    ? styles.lineAdd
    : line.type === 'delete'
      ? styles.lineDel
      : styles.lineContext;

  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';

  return (
    <div className={`${styles.diffLine} ${lineClass}`}>
      <span className={styles.lineNumbers}>
        <span className={styles.lineNum}>{line.oldLineNumber ?? ''}</span>
        <span className={styles.lineNum}>{line.newLineNumber ?? ''}</span>
      </span>
      <span className={styles.linePrefix}>{prefix}</span>
      <span className={styles.lineContent}>{line.content}</span>
    </div>
  );
}

function DiffFileCard({ file, defaultExpanded }: { file: DiffFile; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { add, del } = countChanges(file);

  return (
    <div className={styles.diffFile}>
      <div
        className={styles.diffFileHeader}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
          <svg width="10" height="10" viewBox="0 0 8 8" fill="currentColor">
            <path d="M2 1l4 3-4 3z" />
          </svg>
        </span>
        <span className={styles.diffFilePath} title={file.filePath}>{file.filePath}</span>
        <span className={styles.changeStats}>
          {add > 0 && <span className={styles.statAdd}>+{add}</span>}
          {add > 0 && del > 0 && <span className={styles.statSep}>&nbsp;</span>}
          {del > 0 && <span className={styles.statDel}>-{del}</span>}
        </span>
        <span className={`${styles.diffBadge} ${statusBadgeClass(file.status)}`}>
          {statusLabel(file.status)}
        </span>
      </div>
      {expanded && (
        <div className={styles.diffFileBody}>
          {file.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className={styles.hunkHeader}>{hunk.header}</div>
              {hunk.lines.map((line, li) => (
                <DiffLineRow key={li} line={line} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffView({ files }: DiffViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);

  const counts = useMemo(() => ({
    all: files.length,
    added: files.filter((f) => f.status === 'added').length,
    modified: files.filter((f) => f.status === 'modified').length,
    deleted: files.filter((f) => f.status === 'deleted').length,
  }), [files]);

  const displayFiles = useMemo(() => {
    let result = files;
    if (filter !== 'all') {
      result = result.filter((f) => f.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.filePath.toLowerCase().includes(q));
    }
    return result;
  }, [files, filter, search]);

  const handleToggleAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
  }, []);

  const filterTypes: FilterType[] = ['all', 'added', 'modified', 'deleted'];

  if (files.length === 0) {
    return (
      <div className={styles.empty}>
        <span>{'\u6682\u65E0\u6587\u4EF6\u53D8\u66F4'}</span>
      </div>
    );
  }

  return (
    <div className={styles.diffView}>
      <div className={styles.filterBar}>
        <div className={styles.filterBtns}>
          {filterTypes.map((t) => (
            <button
              key={t}
              className={`${styles.filterBtn} ${filter === t ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(t)}
            >
              {filterLabel(t)}
              <span className={styles.filterCount}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterActions}>
          <button className={styles.toggleAllBtn} onClick={handleToggleAll}>
            {allExpanded ? '\u5168\u90E8\u6536\u8D77' : '\u5168\u90E8\u5C55\u5F00'}
          </button>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={'\u641C\u7D22\u6587\u4EF6...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className={styles.fileList}>
        {displayFiles.length === 0 ? (
          <div className={styles.noMatch}>{'\u6CA1\u6709\u5339\u914D\u7684\u6587\u4EF6'}</div>
        ) : (
          displayFiles.map((file) => (
            <DiffFileCard
              key={`${file.filePath}-${allExpanded}`}
              file={file}
              defaultExpanded={allExpanded || search.trim().length > 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

export { DiffView };
