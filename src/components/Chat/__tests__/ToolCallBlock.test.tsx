import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallBlock } from '../ToolCallBlock';
import type { ToolCall } from '@/types/chat';

// Mock CSS modules
vi.mock('../ToolCallBlock.module.css', () => ({
  default: new Proxy({}, {
    get(_, key) { return key; },
  }),
}));

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: 'tool-1',
    name: 'ReadFile',
    status: 'completed',
    input: { file_path: '/src/app.tsx' },
    output: 'file content here',
    duration: 120,
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  describe('status display', () => {
    it('completed: shows green check icon and duration', () => {
      const tc = makeToolCall({ status: 'completed', duration: 120 });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('check_circle')).toBeInTheDocument();
      expect(screen.getByText('120ms')).toBeInTheDocument();
    });

    it('completed: shows duration in seconds when >= 1000ms', () => {
      const tc = makeToolCall({ status: 'completed', duration: 2500 });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('2.5s')).toBeInTheDocument();
    });

    it('running: shows RUNNING status text', () => {
      const tc = makeToolCall({ status: 'running' });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('RUNNING')).toBeInTheDocument();
      expect(screen.getByText('progress_activity')).toBeInTheDocument();
    });

    it('error: shows FAILED status text', () => {
      const tc = makeToolCall({ status: 'error' });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('pending: shows list_alt icon (no status text)', () => {
      const tc = makeToolCall({ status: 'pending' });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('list_alt')).toBeInTheDocument();
    });

    it('pending_permission: shows AWAITING APPROVAL', () => {
      const tc = makeToolCall({ status: 'pending_permission' });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.getByText('AWAITING APPROVAL')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();
    });
  });

  describe('tool label', () => {
    it('maps ReadFile to READ', () => {
      const tc = makeToolCall({ name: 'ReadFile' });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('READ')).toBeInTheDocument();
    });

    it('maps WriteFile to WRITE', () => {
      const tc = makeToolCall({ name: 'WriteFile' });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('WRITE')).toBeInTheDocument();
    });

    it('maps Edit to EDIT', () => {
      const tc = makeToolCall({ name: 'Edit' });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('EDIT')).toBeInTheDocument();
    });

    it('maps Bash to EXEC', () => {
      const tc = makeToolCall({ name: 'Bash', input: { command: 'ls' } });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('EXEC')).toBeInTheDocument();
    });

    it('maps unknown tool to uppercase truncated', () => {
      const tc = makeToolCall({ name: 'VeryLongToolNameHere' });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('VERYLONGTOOLNAME')).toBeInTheDocument();
    });
  });

  describe('path/summary display', () => {
    it('shows file_path from input', () => {
      const tc = makeToolCall({ input: { file_path: '/src/components/App.tsx' } });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('/src/components/App.tsx')).toBeInTheDocument();
    });

    it('shows command from input', () => {
      const tc = makeToolCall({ name: 'Bash', input: { command: 'npm run build' } });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('npm run build')).toBeInTheDocument();
    });

    it('shows query from input', () => {
      const tc = makeToolCall({ name: 'Search', input: { query: 'TODO' } });
      render(<ToolCallBlock toolCall={tc} />);
      expect(screen.getByText('TODO')).toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('collapsed: does not show input/output details', () => {
      const tc = makeToolCall({ output: 'secret output' });
      render(<ToolCallBlock toolCall={tc} />);

      expect(screen.queryByText('secret output')).not.toBeInTheDocument();
      expect(screen.queryByText('输入')).not.toBeInTheDocument();
    });

    it('clicking expands to show input/output', () => {
      const tc = makeToolCall({ input: { file_path: '/src/app.tsx' }, output: 'result' });
      render(<ToolCallBlock toolCall={tc} />);

      fireEvent.click(screen.getByText('READ'));

      expect(screen.getByText('输入')).toBeInTheDocument();
      expect(screen.getByText('result')).toBeInTheDocument();
    });

    it('clicking again collapses', () => {
      const tc = makeToolCall({ input: { file_path: '/src/app.tsx' }, output: 'result' });
      render(<ToolCallBlock toolCall={tc} />);

      // Expand
      fireEvent.click(screen.getByText('READ'));
      expect(screen.getByText('输入')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('READ'));
      expect(screen.queryByText('输入')).not.toBeInTheDocument();
    });

    it('does not show output label when no output', () => {
      const tc = makeToolCall({ output: undefined });
      render(<ToolCallBlock toolCall={tc} />);

      fireEvent.click(screen.getByText('READ'));

      expect(screen.queryByText('输出')).not.toBeInTheDocument();
    });
  });
});
