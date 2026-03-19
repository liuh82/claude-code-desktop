import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import './SplitPane.css';

export interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  children: ReactNode[];
  initialSizes?: number[];
  onChange?: (sizes: number[]) => void;
  minSize?: number;
  maxSize?: number;
}

const MIN_PANE = 100;

function SplitPane({
  direction,
  children,
  initialSizes,
  onChange,
  minSize = MIN_PANE,
}: SplitPaneProps) {
  const paneCount = children.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingIndexRef = useRef<number | null>(null);

  const equalSizes = () => {
    const each = 100 / paneCount;
    return Array(paneCount).fill(each);
  };

  const [sizes, setSizes] = useState<number[]>(
    initialSizes && initialSizes.length === paneCount
      ? initialSizes
      : equalSizes(),
  );

  // Normalize sizes to ensure they stay within bounds
  const normalize = useCallback(
    (newSizes: number[]): number[] => {
      const total = newSizes.reduce((a, b) => a + b, 0);
      if (total === 0) return equalSizes();
      const normalized = newSizes.map((s) => (s / total) * 100);
      // Enforce minimums
      for (let i = 0; i < normalized.length; i++) {
        const containerSize = containerRef.current
          ? direction === 'horizontal'
            ? containerRef.current.offsetWidth
            : containerRef.current.offsetHeight
          : 400;
        const minPercent = (minSize / containerSize) * 100;
        if (normalized[i] < minPercent) {
          normalized[i] = minPercent;
        }
      }
      return normalized;
    },
    [direction, minSize, paneCount],
  );

  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingIndexRef.current = index;
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIndexRef.current === null || !containerRef.current) return;
      const index = draggingIndexRef.current;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerSize =
        direction === 'horizontal' ? rect.width : rect.height;
      const offset =
        direction === 'horizontal'
          ? e.clientX - rect.left
          : e.clientY - rect.top;

      const currentPercent = (offset / containerSize) * 100;
      const prevPercent = sizes
        .slice(0, index)
        .reduce((a, b) => a + b, 0);
      const delta = currentPercent - prevPercent;

      const newSizes = [...sizes];
      newSizes[index] = Math.max(minSize / (containerSize / 100), sizes[index] + delta);
      newSizes[index + 1] = Math.max(minSize / (containerSize / 100), sizes[index + 1] - delta);
      const normalized = normalize(newSizes);
      setSizes(normalized);
      onChange?.(normalized);
    };

    const handleMouseUp = () => {
      if (draggingIndexRef.current !== null) {
        draggingIndexRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sizes, direction, minSize, normalize, onChange]);

  if (paneCount < 2) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className={`split-pane split-pane--${direction}`}
    >
      {children.map((child, i) => (
        <div key={i} className="split-pane__item" style={{ [direction === 'horizontal' ? 'width' : 'height']: `${sizes[i]}%` }}>
          {child}
          {i < paneCount - 1 && (
            <div
              className="split-pane__handle"
              onMouseDown={handleMouseDown(i)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default SplitPane;
