import type { ToolCall } from '@/types/chat';

export interface PermissionInfo {
  toolName: string;
  toolIcon: string;
  target: string;
  isDangerous: boolean;
}

function resolvePermissionInfo(name: string, input: Record<string, unknown>): PermissionInfo {
  if (name === 'ReadFile' || name === 'Read') {
    return { toolName: 'READ', toolIcon: 'description', target: String(input.file_path || ''), isDangerous: false };
  }
  if (name === 'WriteFile' || name === 'Write' || name === 'Edit') {
    return { toolName: 'WRITE', toolIcon: 'edit_note', target: String(input.file_path || ''), isDangerous: false };
  }
  if (name === 'ExecuteCommand' || name === 'Bash' || name === 'Shell') {
    return { toolName: 'EXEC', toolIcon: 'terminal', target: String(input.command || ''), isDangerous: true };
  }
  return { toolName: name.toUpperCase(), toolIcon: 'security', target: '', isDangerous: false };
}

/** Get permission info from a ToolCall object. */
export function getPermissionInfo(toolCall: ToolCall): PermissionInfo;

/** Get permission info from name + input tuple. */
export function getPermissionInfo(name: string, input: Record<string, unknown>): PermissionInfo;

export function getPermissionInfo(toolOrName: ToolCall | string, input?: Record<string, unknown>): PermissionInfo {
  if (typeof toolOrName === 'string') {
    return resolvePermissionInfo(toolOrName, input ?? {});
  }
  return resolvePermissionInfo(toolOrName.name, toolOrName.input);
}
