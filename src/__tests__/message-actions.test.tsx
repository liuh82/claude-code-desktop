import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock CSS modules
vi.mock('../components/Chat/MessageActions.module.css', () => ({
  default: new Proxy({}, { get(_, key) { return key; } }),
}));

vi.mock('../stores/useChatStore', () => ({
  useChatStore: vi.fn(),
}));

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' }),
  },
}));

vi.mock('../components/Chat/MermaidBlock.module.css', () => ({
  default: new Proxy({}, { get(_, key) { return key; } }),
}));

describe('MessageActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Copy button for all messages', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="Hello world"
        messageId="msg-1"
        isUserMessage={false}
      />
    );

    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('renders Regenerate button for assistant messages', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="AI response"
        messageId="msg-2"
        isUserMessage={false}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('does not render Regenerate button for user messages', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="User message"
        messageId="msg-3"
        isUserMessage={true}
      />
    );

    expect(screen.queryByText('Regenerate')).not.toBeInTheDocument();
  });

  it('renders Edit button for user messages', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="User message"
        messageId="msg-4"
        isUserMessage={true}
        onEditAndResend={vi.fn()}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('copies content to clipboard when Copy is clicked', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="Copy this text"
        messageId="msg-5"
        isUserMessage={false}
      />
    );

    fireEvent.click(screen.getByText('Copy'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy this text');
  });

  it('shows Copied state after copy', async () => {
    vi.useFakeTimers();
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="Copy this text"
        messageId="msg-6"
        isUserMessage={false}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('calls onRegenerate when Regenerate is clicked', async () => {
    const onRegenerate = vi.fn();
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="AI response"
        messageId="msg-7"
        isUserMessage={false}
        onRegenerate={onRegenerate}
      />
    );

    fireEvent.click(screen.getByText('Regenerate'));

    expect(onRegenerate).toHaveBeenCalledWith('msg-7');
  });

  it('enters edit mode when Edit is clicked', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="User message"
        messageId="msg-8"
        isUserMessage={true}
      />
    );

    fireEvent.click(screen.getByText('Edit'));

    // Should show a textarea for editing
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('User message');
  });

  it('calls onEditAndResend with new content on submit', async () => {
    const onEditAndResend = vi.fn();
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="Original"
        messageId="msg-9"
        isUserMessage={true}
        onEditAndResend={onEditAndResend}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));

    // Change text
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Modified message' } });

    // Click submit (the send button icon)
    const buttons = screen.getAllByRole('button');
    // Find the submit button (first one is the send button)
    fireEvent.click(buttons[0]);

    expect(onEditAndResend).toHaveBeenCalledWith('msg-9', 'Modified message');
  });

  it('exits edit mode on cancel', async () => {
    const { MessageActions } = await import('../components/Chat/MessageActions');

    render(
      <MessageActions
        messageContent="User message"
        messageId="msg-10"
        isUserMessage={true}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    // Click cancel (second button is cancel)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    // Should be back to normal mode — no textarea
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
