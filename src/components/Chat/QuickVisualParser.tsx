/**
 * QuickVisualParser — converts short @-syntax commands into VisualizationCard JSON.
 *
 * Supported commands:
 *   @arch [title]        → architecture card
 *   @flow [title]        → dataflow card
 *   @compare [title]     → comparison card
 *   @timeline [title]    → timeline card
 *
 * Parse failure falls back to plain text rendering.
 */

/* ── Icon helpers ── */

const NODE_ICON_MAP: Record<string, string> = {
  api: 'api',
  gateway: 'router',
  server: 'dns',
  backend: 'dns',
  frontend: 'desktop_windows',
  react: 'web',
  vue: 'web',
  angular: 'web',
  database: 'storage',
  db: 'storage',
  cache: 'flash_on',
  redis: 'flash_on',
  queue: 'list_alt',
  auth: 'lock',
  user: 'person',
  client: 'phone_android',
  mobile: 'phone_android',
  docker: 'view_in_ar',
  k8s: 'hub',
  kubernetes: 'hub',
  aws: 'cloud',
  cloud: 'cloud',
  cdn: 'public',
  dns: 'language',
  proxy: 'swap_horiz',
  nginx: 'settings_ethernet',
  log: 'receipt_long',
  monitoring: 'monitor_heart',
  ci: 'build',
  git: 'commit',
  search: 'search',
  ai: 'psychology',
  llm: 'psychology',
  ml: 'model_training',
  store: 'store',
  state: 'data_object',
  config: 'settings',
};

function guessIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, icon] of Object.entries(NODE_ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return 'widgets';
}

function guessModuleColor(index: number, _layerIndex?: number): 'primary' | 'secondary' | 'tertiary' {
  if (index === 0) return 'primary';
  if (index === 1) return 'primary';
  return 'secondary';
}

function guessLayerColor(layerIndex: number): 'primary' | 'secondary' | 'tertiary' {
  // Cycle through colors by layer depth
  if (layerIndex === 0) return 'primary';
  if (layerIndex === 1) return 'secondary';
  return 'tertiary';
}

/* ── Parsers ── */

interface QuickVizCard {
  type: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function parseArch(lines: string[]): QuickVizCard | null {
  // @arch [title]
  const titleLine = lines[0];
  const title = titleLine.replace(/^[\/@]\w+\s*/, '').trim() || 'Architecture';
  const edgeLines = lines.slice(1).filter(l => l.trim());

  if (edgeLines.length === 0) return null;

  // Detect layer format: "LayerName: ModuleA, ModuleB" or "LayerName → ModuleA → ModuleB"
  const hasLayers = edgeLines.some(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return false;
    const prefix = line.slice(0, colonIdx).trim();
    // Distinguish layer name (no arrow before colon) from arrow format
    return !prefix.includes('→') && prefix.length > 0 && prefix.length < 30;
  });

  if (hasLayers) {
    // Parse as layered architecture
    const layers = edgeLines.map(line => {
      const colonIdx = line.indexOf(':');
      const layerName = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();

      // Support both "Layer: A, B" and "Layer: A → B → C" formats
      const parts = rest.includes('→')
        ? rest.split('→').map(s => s.trim()).filter(Boolean)
        : rest.split(',').map(s => s.trim()).filter(Boolean);

      return {
        name: layerName,
        modules: parts.map((name) => ({
          name,
          icon: guessIcon(name),
          color: guessLayerColor(0), // Will be overridden by layer color below
        })),
      };
    }).filter(layer => layer.modules.length > 0);

    // Apply layer-based colors: color all modules in a layer the same
    layers.forEach((layer, layerIdx) => {
      const layerColor = guessLayerColor(layerIdx);
      layer.modules.forEach(mod => {
        mod.color = layerColor;
      });
    });

    if (layers.length === 0) return null;
    return { type: 'architecture', title, icon: 'account_tree', label: 'Architecture', layers };
  }

  // Backward compat: flat format (arrows or plain names)
  const nodeSet = new Set<string>();
  const edges: Array<{ from: string; to: string }> = [];

  for (const line of edgeLines) {
    const parts = line.split('→').map(s => s.trim());
    if (parts.length >= 2) {
      const from = parts[0];
      const to = parts[parts.length - 1];
      nodeSet.add(from);
      nodeSet.add(to);
      edges.push({ from, to });
    } else if (parts.length === 1 && parts[0]) {
      nodeSet.add(parts[0]);
    }
  }

  const nodes = Array.from(nodeSet);
  const modules = nodes.map((name, i) => ({
    name,
    icon: guessIcon(name),
    color: guessModuleColor(i),
  }));

  return { type: 'architecture', title, icon: 'account_tree', label: 'Architecture', modules };
}

function parseFlow(lines: string[]): QuickVizCard | null {
  const titleLine = lines[0];
  const title = titleLine.replace(/^[\/@]\w+\s*/, '').trim() || 'Data Flow';
  const stepLines = lines.slice(1).filter(l => l.trim());

  if (stepLines.length === 0) return null;

  const steps = stepLines.map((line, i) => {
    const parts = line.split('→').map(s => s.trim());
    const endpoint = parts[parts.length - 1] || line.trim();
    return {
      endpoint,
      active: i === stepLines.length - 1,
      success: i < stepLines.length - 1,
    };
  });

  return { type: 'dataflow', title, label: 'Data Flow', steps };
}

function parseCompare(lines: string[]): QuickVizCard | null {
  const titleLine = lines[0];
  const title = titleLine.replace(/^[\/@]\w+\s*/, '').trim() || 'Comparison';
  const dataLines = lines.slice(1).filter(l => l.trim());

  if (dataLines.length === 0) return null;

  const sides = dataLines.map((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;
    const name = line.slice(0, colonIdx).trim();
    const features = line.slice(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean);
    return { name, features };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  if (sides.length === 0) return null;

  // Pad to at least 2 sides
  while (sides.length < 2) {
    sides.push({ name: '-', features: [] });
  }

  const maxRows = Math.max(...sides.map(s => s.features.length));
  const defaultIcons = ['terminal', 'bolt'];

  const compareSides = sides.slice(0, 2).map((side, i) => ({
    name: side.name,
    icon: defaultIcons[i],
    badgeVariant: i === 0 ? ('default' as const) : ('highlight' as const),
    rows: Array.from({ length: maxRows }, (_, j) => ({
      label: side.features[j] ? `Feature ${j + 1}` : '',
      value: side.features[j] || '-',
    })),
  }));

  return { type: 'comparison', title, label: 'A/B Comparison', sides: compareSides };
}

function parseTimeline(lines: string[]): QuickVizCard | null {
  const titleLine = lines[0];
  const title = titleLine.replace(/^[\/@]\w+\s*/, '').trim() || 'Timeline';
  const dataLines = lines.slice(1).filter(l => l.trim());

  if (dataLines.length === 0) return null;

  const steps = dataLines.map((line, i) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;
    const timeLabel = line.slice(0, colonIdx).trim();
    const description = line.slice(colonIdx + 1).trim();
    const status = i === dataLines.length - 1
      ? 'active' as const
      : i === 0
        ? 'completed' as const
        : 'pending' as const;
    return {
      title: timeLabel,
      description,
      status,
      icon: status === 'completed' ? 'check' : status === 'active' ? 'play_arrow' : 'schedule',
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  if (steps.length === 0) return null;

  return { type: 'timeline', title, label: 'Timeline', steps };
}

/* ── Regex-based detection + block splitting ── */

const QUICK_VIZ_RE = /^[\/@](arch|flow|compare|timeline)(?:-tech)?\b/m;

interface QuickVizBlock {
  command: string;
  fullCommand: string;
  lines: string[];
  fullText: string;
  startIndex: number;
  endIndex: number;
}

function extractBlocks(content: string): QuickVizBlock[] {
  const blocks: QuickVizBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const match = QUICK_VIZ_RE.exec(lines[i]);
    if (match) {
      const fullCommand = match[0].replace(/^[\/@]/, '');
      const command = fullCommand.replace(/-tech$/, '') as 'arch' | 'flow' | 'compare' | 'timeline';
      const startLine = i;
      const blockLines: string[] = [lines[i]];
      i++;

      // Consume subsequent lines that are part of this block (indented or continuation)
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('```') || trimmed.startsWith('@') || trimmed.startsWith('/') || trimmed.startsWith('#')) {
          break;
        }
        blockLines.push(lines[i]);
        i++;
      }

      const fullText = blockLines.join('\n');
      blocks.push({
        command,
        fullCommand,
        lines: blockLines,
        fullText,
        startIndex: startLine,
        endIndex: i,
      });
    } else {
      i++;
    }
  }

  return blocks;
}

function parseBlock(block: QuickVizBlock): QuickVizCard | null {
  const card = (() => {
    switch (block.command) {
      case 'arch': return parseArch(block.lines);
      case 'flow': return parseFlow(block.lines);
      case 'compare': return parseCompare(block.lines);
      case 'timeline': return parseTimeline(block.lines);
      default: return null;
    }
  })();
  if (card && block.fullCommand.endsWith('-tech')) {
    card.theme = 'tech';
  }
  return card;
}

/* ── Split content into text segments and viz blocks ── */

interface ContentPart {
  kind: 'text';
  text: string;
}
interface CardPart {
  kind: 'card';
  code: string;
}
type Part = ContentPart | CardPart;

function splitContent(content: string): Part[] {
  const blocks = extractBlocks(content);
  if (blocks.length === 0) return [{ kind: 'text', text: content }];

  const lines = content.split('\n');
  const parts: Part[] = [];
  let cursor = 0;

  for (const block of blocks) {
    // Text before this block
    if (cursor < block.startIndex) {
      const before = lines.slice(cursor, block.startIndex).join('\n');
      if (before.trim()) {
        parts.push({ kind: 'text', text: before });
      }
    }

    const card = parseBlock(block);
    if (card) {
      parts.push({ kind: 'card', code: JSON.stringify(card) });
    } else {
      parts.push({ kind: 'text', text: block.fullText });
    }

    cursor = block.endIndex;
  }

  // Text after last block
  if (cursor < lines.length) {
    const remaining = lines.slice(cursor).join('\n');
    if (remaining.trim()) {
      parts.push({ kind: 'text', text: remaining });
    }
  }

  return parts;
}

/* ── React component ── */

import { useMemo } from 'react';
import { VisualizationCard } from './VisualizationCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface QuickVisualParserProps {
  content: string;
}

function QuickVisualParser({ content }: QuickVisualParserProps) {
  const parts = useMemo(() => splitContent(content), [content]);

  const hasCards = parts.some(p => p.kind === 'card');
  if (!hasCards) return null;

  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === 'card') {
          return <VisualizationCard key={`qvc-${i}`} code={part.code} />;
        }
        return <MarkdownRenderer key={`qvt-${i}`} content={part.text} isNested />;
      })}
    </>
  );
}

export { QuickVisualParser, splitContent, extractBlocks, parseBlock };
