import { useState, useCallback, useEffect } from 'react';
import type { FileNode } from '@/types/chat';
import styles from './FileTree.module.css';

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick?: (node: FileNode) => void;
  allCollapsed?: boolean;
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') return 'data_object';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'css' || ext === 'scss') return 'palette';
  if (ext === 'json') return 'data_object';
  if (ext === 'md') return 'article';
  if (ext === 'html') return 'html';
  if (ext === 'py') return 'code';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'svg' || ext === 'webp') return 'image';
  if (ext === 'sql') return 'storage';
  if (ext === 'yaml' || ext === 'yml') return 'settings';
  if (ext === 'lock') return 'lock';
  if (name === 'package.json') return 'inventory_2';
  if (name === 'tsconfig.json') return 'data_object';
  return 'description';
}

function TreeNode({ node, depth, onFileClick, defaultExpanded, allCollapsed }: { node: FileNode; depth: number; onFileClick?: (node: FileNode) => void; defaultExpanded: boolean; allCollapsed: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // allCollapsed 作为触发器：为 true 时收起，用户可单独展开
  useEffect(() => {
    if (allCollapsed) {
      setExpanded(false);
    }
  }, [allCollapsed]);

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
        {isDir ? (
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            <span className="material-symbols-outlined">chevron_right</span>
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={`${styles.nodeIcon} ${isDir ? styles.nodeIconDir : ''}`}>
          <span className="material-symbols-outlined">
            {isDir ? 'folder' : getFileIcon(node.name)}
          </span>
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
              allCollapsed={allCollapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileTree({ nodes, onFileClick, allCollapsed }: FileTreeProps) {
  return (
    <div className={styles.tree}>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileClick={onFileClick}
          defaultExpanded={true}
          allCollapsed={allCollapsed ?? false}
        />
      ))}
    </div>
  );
}

export { FileTree };
