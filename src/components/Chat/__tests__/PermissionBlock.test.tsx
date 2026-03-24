import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionBlock } from '../PermissionBlock';

// Mock CSS modules
vi.mock('../PermissionBlock.module.css', () => ({
  default: new Proxy({}, {
    get(_, key) { return key; },
  }),
}));

describe('PermissionBlock', () => {
  const defaultProps = {
    toolName: 'Write',
    toolIcon: 'edit',
    target: '/src/app.tsx',
    onAllow: vi.fn(),
    onAllowAlways: vi.fn(),
    onDeny: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normal mode (not dangerous)', () => {
    it('renders Allow, Allow Always, and Deny buttons', () => {
      render(<PermissionBlock {...defaultProps} />);

      expect(screen.getByText('Allow')).toBeInTheDocument();
      expect(screen.getByText('Allow Always')).toBeInTheDocument();
      expect(screen.getByText('Deny')).toBeInTheDocument();
    });

    it('displays tool name and target path', () => {
      render(<PermissionBlock {...defaultProps} />);

      expect(screen.getByText('File Write Permission')).toBeInTheDocument();
      expect(screen.getByText('/src/app.tsx')).toBeInTheDocument();
    });

    it('calls onAllow when Allow is clicked', () => {
      render(<PermissionBlock {...defaultProps} />);

      fireEvent.click(screen.getByText('Allow'));
      expect(defaultProps.onAllow).toHaveBeenCalledTimes(1);
    });

    it('calls onAllowAlways when Allow Always is clicked', () => {
      render(<PermissionBlock {...defaultProps} />);

      fireEvent.click(screen.getByText('Allow Always'));
      expect(defaultProps.onAllowAlways).toHaveBeenCalledTimes(1);
    });

    it('calls onDeny when Deny is clicked', () => {
      render(<PermissionBlock {...defaultProps} />);

      fireEvent.click(screen.getByText('Deny'));
      expect(defaultProps.onDeny).toHaveBeenCalledTimes(1);
    });

    it('transitions to approved state after Allow', () => {
      render(<PermissionBlock {...defaultProps} />);

      fireEvent.click(screen.getByText('Allow'));
      expect(screen.getByText('RUNNING')).toBeInTheDocument();
    });

    it('transitions to blocked state after Deny', () => {
      render(<PermissionBlock {...defaultProps} />);

      fireEvent.click(screen.getByText('Deny'));
      expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    });
  });

  describe('dangerous mode', () => {
    const dangerousProps = {
      ...defaultProps,
      isDangerous: true,
    };

    it('shows Block button prominently', () => {
      render(<PermissionBlock {...dangerousProps} />);

      expect(screen.getByText('Block')).toBeInTheDocument();
    });

    it('shows Allow Anyway instead of Allow', () => {
      render(<PermissionBlock {...dangerousProps} />);

      expect(screen.getByText('Allow Anyway')).toBeInTheDocument();
      expect(screen.queryByText('Allow')).not.toBeInTheDocument();
    });

    it('calls onDeny when Block is clicked', () => {
      render(<PermissionBlock {...dangerousProps} />);

      fireEvent.click(screen.getByText('Block'));
      expect(dangerousProps.onDeny).toHaveBeenCalledTimes(1);
    });

    it('calls onAllow when Allow Anyway is clicked', () => {
      render(<PermissionBlock {...dangerousProps} />);

      fireEvent.click(screen.getByText('Allow Anyway'));
      expect(dangerousProps.onAllow).toHaveBeenCalledTimes(1);
    });
  });

  describe('diff preview', () => {
    it('renders diff lines with add/delete styling', () => {
      const diff = '-old line\n+new line\n context line';
      const { container } = render(<PermissionBlock {...defaultProps} detail={diff} />);

      // Diff lines are rendered with their content in spans
      expect(container.textContent).toContain('-old line');
      expect(container.textContent).toContain('+new line');
      expect(container.textContent).toContain(' context line');
      // Verify diff preview container is rendered
      expect(container.querySelector('[class="diffPreview"]')).toBeInTheDocument();
    });

    it('shows "Show more..." when diff exceeds 10 lines', () => {
      const lines = Array.from({ length: 12 }, (_, i) => `${i + 1} line`);
      const diff = lines.join('\n');
      render(<PermissionBlock {...defaultProps} detail={diff} />);

      expect(screen.getByText('Show more...')).toBeInTheDocument();
    });

    it('does not show "Show more..." when diff is 10 lines or fewer', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `${i + 1} line`);
      const diff = lines.join('\n');
      render(<PermissionBlock {...defaultProps} detail={diff} />);

      expect(screen.queryByText('Show more...')).not.toBeInTheDocument();
    });

    it('does not render diff preview when no detail is provided', () => {
      const { container } = render(<PermissionBlock {...defaultProps} />);
      // No diffLine class elements should be present
      expect(container.querySelectorAll('[class*="diffLine"]').length).toBe(0);
    });
  });

  describe('tool label variants', () => {
    it('shows "Command Execution" for EXEC tool', () => {
      render(<PermissionBlock {...defaultProps} toolName="EXEC" />);

      expect(screen.getByText('Command Execution')).toBeInTheDocument();
      // Description contains "execute" but it's split across text nodes — just verify it's in the DOM
      expect(document.querySelector('[class="description"]')!.textContent).toContain('execute');
    });

    it('shows "File Read Permission" for Read tool', () => {
      render(<PermissionBlock {...defaultProps} toolName="Read" />);

      expect(screen.getByText('File Read Permission')).toBeInTheDocument();
    });

    it('shows generic label for unknown tool', () => {
      render(<PermissionBlock {...defaultProps} toolName="CustomTool" />);

      expect(screen.getByText('CustomTool Permission')).toBeInTheDocument();
    });
  });

  describe('without onAllowAlways', () => {
    it('does not render Allow Always button when not provided', () => {
      const props = {
        ...defaultProps,
        onAllowAlways: undefined,
      };
      render(<PermissionBlock {...props} />);

      expect(screen.queryByText('Allow Always')).not.toBeInTheDocument();
    });
  });
});
