import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import styles from './PaneSplit.module.css';

interface PaneSplitProps {
  direction: 'horizontal' | 'vertical';
  children: [ReactNode, ReactNode];
  ratios: [number, number];
  onRatioChange: (ratios: [number, number]) => void;
}

function PaneSplit({ direction, children, ratios, onRatioChange }: PaneSplitProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef(0);
  const startRatiosRef = useRef(ratios);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    startPosRef.current = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
    startRatiosRef.current = ratios;
  }, [direction, ratios]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalSize = direction === 'horizontal' ? rect.width : rect.height;
      const currentPos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
      const delta = currentPos - startPosRef.current;
      const ratioDelta = delta / totalSize;

      let newFirst = startRatiosRef.current[0] + ratioDelta;
      newFirst = Math.max(0.15, Math.min(0.85, newFirst));

      onRatioChange([newFirst, 1 - newFirst]);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onRatioChange]);

  const containerClass = [
    styles.splitContainer,
    direction === 'horizontal' ? styles.splitHorizontal : styles.splitVertical,
  ].join(' ');

  const handleClass = [
    styles.handle,
    direction === 'horizontal' ? styles.handleHorizontal : styles.handleVertical,
    isDragging ? styles.handleActive : '',
  ].join(' ');

  const overlayClass = [
    styles.resizeOverlay,
    direction === 'horizontal' ? styles.resizeOverlayHorizontal : styles.resizeOverlayVertical,
  ].join(' ');

  const childStyle: React.CSSProperties = { flexBasis: `${ratios[0] * 100}%`, flexGrow: 0 };
  const secondStyle: React.CSSProperties = { flexBasis: `${ratios[1] * 100}%`, flexGrow: 0 };

  return (
    <div className={containerClass} ref={containerRef}>
      <div className={styles.paneSlot} style={childStyle}>{children[0]}</div>
      <div className={handleClass} onMouseDown={handleMouseDown}>
        {isDragging && <div className={overlayClass} />}
      </div>
      <div className={styles.paneSlot} style={secondStyle}>{children[1]}</div>
    </div>
  );
}

export { PaneSplit };
