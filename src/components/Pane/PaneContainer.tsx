import type { ReactNode } from 'react';
import { PaneSplit } from './PaneSplit';
import { TerminalPane } from './TerminalPane';
import type { LayoutNode, LayoutSplit } from '@/types/pane';

interface PaneContainerProps {
  layout: LayoutNode;
  tabId: string;
  activePaneId: string;
  onRatioChange: (direction: 'horizontal' | 'vertical', index: number, ratios: number[]) => void;
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
  onRatioChange: (direction: 'horizontal' | 'vertical', index: number, ratios: number[]) => void;
}) {
  const handleRatioChange = (ratios: [number, number]) => {
    onRatioChange(split.direction, 0, ratios);
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
      ratios={[split.ratios[0], split.ratios[1]]}
      onRatioChange={handleRatioChange}
    >
      {children as [ReactNode, ReactNode]}
    </PaneSplit>
  );
}

export { PaneContainer };
