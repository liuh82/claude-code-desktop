import type { ReactNode } from 'react';
import { PaneSplit } from './PaneSplit';
import { TerminalPane } from './TerminalPane';
import type { LayoutNode, LayoutSplit } from '@/types/pane';

interface PaneContainerProps {
  layout: LayoutNode;
  tabId: string;
  activePaneId: string;
  onRatioChange: (direction: 'horizontal' | 'vertical', dividerIndex: number, ratios: number[]) => void;
}

function PaneContainer({ layout, tabId, activePaneId, onRatioChange }: PaneContainerProps) {
  if (layout.type === 'leaf') {
    return (
      <TerminalPane
        tabId={tabId}
        paneId={layout.paneId}
        isActive={layout.paneId === activePaneId}
      />
    );
  }

  return (
    <SplitRenderer
      split={layout}
      tabId={tabId}
      activePaneId={activePaneId}
      onRatioChange={onRatioChange}
    />
  );
}

function SplitRenderer({
  split,
  tabId,
  activePaneId,
  onRatioChange,
}: {
  split: LayoutSplit;
  tabId: string;
  activePaneId: string;
  onRatioChange: (direction: 'horizontal' | 'vertical', dividerIndex: number, ratios: number[]) => void;
}) {
  const handleDividerDrag = (dividerIndex: number, newLeftRatio: number) => {
    onRatioChange(split.direction, dividerIndex, split.ratios.map((r, i) => {
      if (i === dividerIndex) return newLeftRatio;
      if (i === dividerIndex + 1) return split.ratios[dividerIndex] + split.ratios[dividerIndex + 1] - newLeftRatio;
      return r;
    }));
  };

  const children: ReactNode[] = split.children.map((child, index) => (
    <PaneContainer
      key={child.type === 'leaf' ? child.paneId : `split-${index}`}
      layout={child}
      tabId={tabId}
      activePaneId={activePaneId}
      onRatioChange={onRatioChange}
    />
  ));

  return (
    <PaneSplit
      direction={split.direction}
      ratios={split.ratios}
      onRatioChange={handleDividerDrag}
    >
      {children}
    </PaneSplit>
  );
}

export { PaneContainer };
