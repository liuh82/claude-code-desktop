import { describe, it, expect } from 'vitest';
import { resolveApiUrl } from '../claude-direct';

describe('resolveApiUrl', () => {
  it('appends /v1/messages to bare domain', () => {
    expect(resolveApiUrl('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1/messages',
    );
  });

  it('appends /v1/messages to third-party base path', () => {
    expect(resolveApiUrl('https://open.bigmodel.cn/api/anthropic')).toBe(
      'https://open.bigmodel.cn/api/anthropic/v1/messages',
    );
  });

  it('strips trailing slash before appending', () => {
    expect(resolveApiUrl('https://open.bigmodel.cn/api/anthropic/')).toBe(
      'https://open.bigmodel.cn/api/anthropic/v1/messages',
    );
  });

  it('returns as-is when URL already ends with /messages', () => {
    expect(resolveApiUrl('https://proxy.com/v1/messages')).toBe(
      'https://proxy.com/v1/messages',
    );
  });

  it('appends /messages when URL ends with /v1', () => {
    expect(resolveApiUrl('https://openrouter.ai/api/v1')).toBe(
      'https://openrouter.ai/api/v1/messages',
    );
  });

  it('strips trailing slash after /v1 before appending /messages', () => {
    expect(resolveApiUrl('https://proxy.com/v1/')).toBe(
      'https://proxy.com/v1/messages',
    );
  });
});
