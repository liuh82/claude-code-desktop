import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import styles from './PaneSplit.module.css';

interface PaneSplitProps {
  direction: 'horizontal' | 'vertical';
  children: ReactNode[];
  ratios: number[];
  onRatioChange: (dividerIndex: number, newRatio: number) => void;
}

function PaneSplit({ direction, children, ratios, onRatioChange }: PaneSplitProps) {
  const [draggingDivider, setDraggingDivider] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef(0);
  const startRatiosRef = useRef<number[]>(ratios);

  const handleMouseDown = useCallback((e: React.MouseEvent, dividerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingDivider(dividerIndex);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    startPosRef.current = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
    startRatiosRef.current = [...ratios];
  }, [direction, ratios]);

  useEffect(() => {
    if (draggingDivider === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalSize = direction === 'horizontal' ? rect.width : rect.height;
      const currentPos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
      const delta = currentPos - startPosRef.current;
      const ratioDelta = delta / totalSize;

      const idx = draggingDivider;
      const startRatios = startRatiosRef.current;
      let newLeft = startRatios[idx] + ratioDelta;
      let newRight = startRatios[idx + 1] - ratioDelta;
      const MIN_RATIO = 0.1;

      if (newLeft < MIN_RATIO) {
        newRight -= (MIN_RATIO - newLeft);
        newLeft = MIN_RATIO;
      }
      if (newRight < MIN_RATIO) {
        newLeft -= (MIN_RATIO - newRight);
        newRight = MIN_RATIO;
      }

      newLeft = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, newLeft));
      newRight = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, newRight));

      onRatioChange(idx, newLeft);
    };

    const handleMouseUp = () => {
      setDraggingDivider(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingDivider, direction, onRatioChange]);

  const containerClass = [
    styles.splitContainer,
    direction === 'horizontal' ? styles.splitHorizontal : styles.splitVertical,
  ].join(' ');

  return (
    <div className={containerClass} ref={containerRef}>
      {children.map((child, index) => {
        const nodes: ReactNode[] = [
          <div
            key={`pane-${index}`}
            className={styles.paneSlot}
            style={{ flexBasis: `${ratios[index] * 100}%`, flexGrow: 0 }}
          >
            {child}
          </div>,
        ];

        // Add divider between panes (not after the last one)
        if (index < children.length - 1) {
          const isDragging = draggingDivider === index;
          const handleClass = [
            styles.handle,
            direction === 'horizontal' ? styles.handleHorizontal : styles.handleVertical,
            isDragging ? styles.handleActive : '',
          ].join(' ');

          const overlayClass = [
            styles.resizeOverlay,
            direction === 'horizontal' ? styles.resizeOverlayHorizontal : styles.resizeOverlayVertical,
          ].join(' ');

          nodes.push(
            <div
              key={`divider-${index}`}
              className={handleClass}
              onMouseDown={(e) => handleMouseDown(e, index)}
            >
              {isDragging && <div className={overlayClass} />}
            </div>,
          );
        }

        return nodes;
      })}
    </div>
  );
}

export { PaneSplit };
