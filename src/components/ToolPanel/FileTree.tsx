import { useState, useCallback } from 'react';
import type { FileNode } from '@/types/chat';
import styles from './FileTree.module.css';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick?: (node: FileNode) => void;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#3178c6" opacity="0.2" stroke="#3178c6" strokeWidth="1"/>
        <text x="8" y="11" textAnchor="middle" fontSize="7" fill="#3178c6" fontWeight="bold">TS</text>
      </svg>
    );
  }
  if (ext === 'css') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#264de4" opacity="0.2" stroke="#264de4" strokeWidth="1"/>
        <text x="8" y="11" textAnchor="middle" fontSize="6" fill="#264de4" fontWeight="bold">C</text>
      </svg>
    );
  }
  if (ext === 'json') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#d97706" opacity="0.2" stroke="#d97706" strokeWidth="1"/>
        <text x="8" y="11" textAnchor="middle" fontSize="6" fill="#d97706" fontWeight="bold">{}</text>
      </svg>
    );
  }
  if (ext === 'md') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#083fa1" opacity="0.2" stroke="#083fa1" strokeWidth="1"/>
        <text x="8" y="11" textAnchor="middle" fontSize="6" fill="#083fa1" fontWeight="bold">M</text>
      </svg>
    );
  }
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'svg') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#059669" opacity="0.2" stroke="#059669" strokeWidth="1"/>
        <circle cx="6" cy="6" r="2" fill="#059669" opacity="0.5"/>
        <path d="M3 12l3-3 2 2 2-2 3 3H3z" fill="#059669" opacity="0.5"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1">
      <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
      <polyline points="9,2 9,5 12,5" />
    </svg>
  );
}

function DirIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1">
      <path d="M1.5 3.5v9a1 1 0 001 1h11a1 1 0 001-1v-7a1 1 0 00-1-1H8l-1.5-2H2.5a1 1 0 00-1 1z" fill="var(--accent-muted)"/>
    </svg>
  );
}

function TreeNode({ node, depth, onFileClick, defaultExpanded }: { node: FileNode; depth: number; onFileClick?: (node: FileNode) => void; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isDir = node.type === 'directory';
  const hasChildren = isDir && node.children && node.children.length > 0;

  const handleClick = useCallback(() => {
    if (isDir && hasChildren) {
      setExpanded((prev) => !prev);
    } else if (!isDir) {
      onFileClick?.(node);
    }
  }, [isDir, hasChildren, node, onFileClick]);

  const statusDot = node.status ? (
    <span className={`${styles.statusDot} ${styles[`status${node.status}`]}`} />
  ) : null;

  return (
    <div>
      <div
        className={`${styles.treeRow} ${!isDir ? styles.treeRowFile : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
      >
        {isDir && (
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
              <path d="M2 1l4 3-4 3z" />
            </svg>
          </span>
        )}
        {!isDir && <span className={styles.chevronSpacer} />}
        <span className={styles.nodeIcon}>
          {isDir ? <DirIcon /> : <FileIcon name={node.name} />}
        </span>
        <span className={styles.nodeName}>{node.name}</span>
        {statusDot}
      </div>
      {isDir && expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              defaultExpanded={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileTree({ nodes, onFileClick }: FileTreeProps) {
  return (
    <div className={styles.tree}>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileClick={onFileClick}
          defaultExpanded={true}
        />
      ))}
    </div>
  );
}

export { FileTree };
