import type { DiffFile, DiffLine } from '@/types/chat';
import styles from './DiffView.module.css';

interface DiffViewProps {
  files: DiffFile[];
}

function statusLabel(status: DiffFile['status']): string {
  switch (status) {
    case 'added': return '新增';
    case 'modified': return '修改';
    case 'deleted': return '删除';
  }
}

function statusClass(status: DiffFile['status']): string {
  switch (status) {
    case 'added': return styles.status新增;
    case 'modified': return styles.status修改;
    case 'deleted': return styles.status删除;
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

function DiffFileView({ file }: { file: DiffFile }) {
  return (
    <div className={styles.diffFile}>
      <div className={styles.diffFileHeader}>
        <span className={styles.diffFilePath}>{file.filePath}</span>
        <span className={`${styles.diffBadge} ${statusClass(file.status)}`}>
          {statusLabel(file.status)}
        </span>
      </div>
      {file.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className={styles.hunkHeader}>{hunk.header}</div>
          {hunk.lines.map((line, li) => (
            <DiffLineRow key={li} line={line} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffView({ files }: DiffViewProps) {
  if (files.length === 0) {
    return (
      <div className={styles.empty}>
        <span>No changes to display</span>
      </div>
    );
  }

  return (
    <div className={styles.diffView}>
      {files.map((file) => (
        <DiffFileView key={file.filePath} file={file} />
      ))}
    </div>
  );
}

export { DiffView };
