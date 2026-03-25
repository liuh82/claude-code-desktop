import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionBar } from '../PermissionBar';

// Mock CSS modules
vi.mock('../PermissionBar.module.css', () => ({
  default: new Proxy({}, {
    get(_, key) { return key; },
  }),
}));

describe('PermissionBar', () => {
  const defaultProps = {
    toolName: 'WRITE',
    toolIcon: 'edit_note',
    target: '/src/app.tsx',
    onAllow: vi.fn(),
    onAllowAlways: vi.fn(),
    onDeny: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tool name, target, and buttons when pending', () => {
    render(<PermissionBar {...defaultProps} />);

    expect(screen.getByText('允许')).toBeInTheDocument();
    expect(screen.getByText('拒绝')).toBeInTheDocument();
    expect(screen.getByText('始终允许')).toBeInTheDocument();
    expect(screen.getByText('/src/app.tsx')).toBeInTheDocument();
  });

  it('calls onAllow when Allow is clicked', () => {
    render(<PermissionBar {...defaultProps} />);

    fireEvent.click(screen.getByText('允许'));
    expect(defaultProps.onAllow).toHaveBeenCalledTimes(1);
  });

  it('calls onDeny when Deny is clicked', () => {
    render(<PermissionBar {...defaultProps} />);

    fireEvent.click(screen.getByText('拒绝'));
    expect(defaultProps.onDeny).toHaveBeenCalledTimes(1);
  });

  it('shows "始终允许" button when onAllowAlways provided', () => {
    render(<PermissionBar {...defaultProps} />);

    expect(screen.getByText('始终允许')).toBeInTheDocument();
  });

  it('does not show "始终允许" button when onAllowAlways not provided', () => {
    const props = {
      ...defaultProps,
      onAllowAlways: undefined,
    };
    render(<PermissionBar {...props} />);

    expect(screen.queryByText('始终允许')).not.toBeInTheDocument();
  });

  it('calls onAllowAlways when "始终允许" is clicked', () => {
    render(<PermissionBar {...defaultProps} />);

    fireEvent.click(screen.getByText('始终允许'));
    expect(defaultProps.onAllowAlways).toHaveBeenCalledTimes(1);
  });

  describe('dangerous mode', () => {
    const dangerousProps = {
      ...defaultProps,
      toolName: 'EXEC',
      toolIcon: 'terminal',
      target: 'rm -rf /tmp/test',
      isDangerous: true,
    };

    it('shows "阻止" button for dangerous tools', () => {
      render(<PermissionBar {...dangerousProps} />);

      expect(screen.getByText('阻止')).toBeInTheDocument();
    });

    it('shows "仍然允许" instead of "允许" for dangerous tools', () => {
      render(<PermissionBar {...dangerousProps} />);

      expect(screen.getByText('仍然允许')).toBeInTheDocument();
      expect(screen.queryByText('允许')).not.toBeInTheDocument();
    });

    it('shows dangerous styling class', () => {
      const { container } = render(<PermissionBar {...dangerousProps} />);

      expect(container.querySelector('[class*="barDangerous"]')).toBeInTheDocument();
    });

    it('calls onDeny when "阻止" is clicked', () => {
      render(<PermissionBar {...dangerousProps} />);

      fireEvent.click(screen.getByText('阻止'));
      expect(dangerousProps.onDeny).toHaveBeenCalledTimes(1);
    });

    it('calls onAllow when "仍然允许" is clicked', () => {
      render(<PermissionBar {...dangerousProps} />);

      fireEvent.click(screen.getByText('仍然允许'));
      expect(dangerousProps.onAllow).toHaveBeenCalledTimes(1);
    });
  });

  describe('diff preview', () => {
    it('shows "查看变更" toggle when detail is provided', () => {
      const diff = '-old line\n+new line';
      render(<PermissionBar {...defaultProps} detail={diff} />);

      expect(screen.getByText('查看变更')).toBeInTheDocument();
    });

    it('expands diff preview when toggle is clicked', () => {
      const diff = '-old line\n+new line';
      const { container } = render(<PermissionBar {...defaultProps} detail={diff} />);

      // Initially collapsed — no diffPreview visible
      expect(container.querySelector('[class="diffPreview"]')).not.toBeInTheDocument();

      // Click toggle to expand
      fireEvent.click(screen.getByText('查看变更'));

      // Now diff lines should be visible
      expect(container.querySelector('[class="diffPreview"]')).toBeInTheDocument();
      expect(container.textContent).toContain('-old line');
      expect(container.textContent).toContain('+new line');
    });

    it('collapses diff preview when toggle is clicked again', () => {
      const diff = '-old line\n+new line';
      const { container } = render(<PermissionBar {...defaultProps} detail={diff} />);

      // Expand
      fireEvent.click(screen.getByText('查看变更'));
      expect(container.querySelector('[class="diffPreview"]')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('查看变更'));
      expect(container.querySelector('[class="diffPreview"]')).not.toBeInTheDocument();
    });

    it('does not show diff toggle when no detail is provided', () => {
      render(<PermissionBar {...defaultProps} />);

      expect(screen.queryByText('查看变更')).not.toBeInTheDocument();
    });
  });
});
