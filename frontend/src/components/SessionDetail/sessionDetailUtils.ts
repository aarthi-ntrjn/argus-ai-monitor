import type { SessionOutput } from '../../types';

const MAX_SUMMARY_LENGTH = 80;

function extractJsonPreview(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const key of ['path', 'file_path', 'command']) {
      if (typeof parsed[key] === 'string') return parsed[key] as string;
    }
    return null;
  } catch {
    return null;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

export function summariseToolUse(item: SessionOutput): string {
  const { toolName, content } = item;
  const prefix = toolName ? `${toolName}: ` : '';

  if (!content) return toolName ?? '';

  if (content.trimStart().startsWith('{')) {
    const preview = extractJsonPreview(content);
    if (preview) return truncate(`${prefix}${preview}`, MAX_SUMMARY_LENGTH);
    return truncate(`${prefix}${content}`, MAX_SUMMARY_LENGTH);
  }

  return truncate(`${prefix}${content}`, MAX_SUMMARY_LENGTH);
}

export function fullToolUseText(item: SessionOutput): string {
  const { toolName, content } = item;
  const prefix = toolName ? `${toolName}: ` : '';

  if (!content) return toolName ?? '';

  if (content.trimStart().startsWith('{')) {
    const preview = extractJsonPreview(content);
    if (preview) return `${prefix}${preview}`;
    return `${prefix}${content}`;
  }

  return `${prefix}${content}`;
}

export function isAlwaysVisible(item: SessionOutput): boolean {
  return item.type !== 'tool_result';
}

export type ToolGroupItem =
  | { kind: 'tool_pair'; toolUse: SessionOutput; toolResult: SessionOutput }
  | { kind: 'single'; item: SessionOutput };

export type DisplayItem =
  | { kind: 'single'; item: SessionOutput }
  | { kind: 'tool_pair'; toolUse: SessionOutput; toolResult: SessionOutput }
  | { kind: 'tool_group'; groupItems: ToolGroupItem[] };

/**
 * In focused mode, pairs tool_use and tool_result into a single display row
 * by matching toolCallId. Orphaned tool_results are dropped. tool_use items
 * whose result has not yet arrived are shown as singles.
 * In verbose mode, returns all items as individual rows.
 */
export function buildDisplayItems(items: SessionOutput[], focused: boolean): DisplayItem[] {
  if (!focused) {
    return items.map(item => ({ kind: 'single', item }));
  }

  const toolUseById = new Map<string, SessionOutput>();
  for (const item of items) {
    if (item.type === 'tool_use' && item.toolCallId) {
      toolUseById.set(item.toolCallId, item);
    }
  }

  const pairedResultIds = new Map<string, SessionOutput>(); // toolCallId -> tool_result
  for (const item of items) {
    if (item.type === 'tool_result' && item.toolCallId && toolUseById.has(item.toolCallId)) {
      pairedResultIds.set(item.toolCallId, item);
    }
  }

  const result: DisplayItem[] = [];
  for (const item of items) {
    if (item.type === 'tool_use') {
      if (item.toolCallId && pairedResultIds.has(item.toolCallId)) {
        result.push({ kind: 'tool_pair', toolUse: item, toolResult: pairedResultIds.get(item.toolCallId)! });
      } else {
        result.push({ kind: 'single', item });
      }
    } else if (item.type === 'tool_result') {
      // Orphaned or already consumed — drop in focused mode
    } else {
      result.push({ kind: 'single', item });
    }
  }
  return groupConsecutiveToolPairs(result);
}

/**
 * Groups runs of consecutive tool_pair items into a tool_group.
 * Empty assistant message singles are silently skipped (no display value).
 * Non-empty assistant messages and user messages break a group — they are
 * emitted as standalone singles between separate groups.
 */
function groupConsecutiveToolPairs(items: DisplayItem[]): DisplayItem[] {
  const result: DisplayItem[] = [];
  let i = 0;

  while (i < items.length) {
    const cur = items[i];

    // Skip empty assistant messages entirely — they carry no display value.
    if (cur.kind === 'single' && cur.item.type === 'message' &&
        cur.item.role === 'assistant' && !cur.item.content?.trim()) {
      i++;
      continue;
    }

    if (cur.kind !== 'tool_pair') {
      result.push(cur);
      i++;
      continue;
    }

    // Start a group — collect consecutive tool_pairs, skipping empty assistant messages.
    const groupItems: ToolGroupItem[] = [];

    while (i < items.length) {
      const item = items[i];
      if (item.kind === 'tool_pair') {
        groupItems.push(item);
        i++;
      } else if (item.kind === 'single' && item.item.type === 'message' &&
                 item.item.role === 'assistant' && !item.item.content?.trim()) {
        // Empty assistant message inside a group — skip silently.
        i++;
      } else {
        // Any other item (non-empty message, user message, status, error) breaks the group.
        break;
      }
    }

    result.push({ kind: 'tool_group', groupItems });
  }

  return result;
}
