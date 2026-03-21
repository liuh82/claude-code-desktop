import { useCallback, useRef, type MouseEvent } from 'react';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  direction: 'left' | 'right';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: globalThis.MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onResize(direction === 'left' ? delta : -delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, onResize]);

  return (
    <div
      className={`${styles.handle} ${styles[direction]}`}
      onMouseDown={handleMouseDown}
    />
  );
}
