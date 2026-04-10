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

export function isAlwaysVisible(item: SessionOutput): boolean {
  return item.type !== 'tool_result';
}

export type DisplayItem =
  | { kind: 'single'; item: SessionOutput }
  | { kind: 'tool_pair'; toolUse: SessionOutput; toolResult: SessionOutput };

/**
 * In focused mode, pairs tool_use and tool_result by toolCallId into a single display row.
 * Orphaned tool_results (no matching tool_use) are dropped.
 * tool_use items whose result has not yet arrived are shown as singles.
 * In verbose mode, returns all items as individual rows.
 */
export function buildDisplayItems(items: SessionOutput[], focused: boolean): DisplayItem[] {
  if (!focused) {
    return items.map(item => ({ kind: 'single', item }));
  }

  // Build a map of toolCallId -> tool_use for O(1) lookup
  const toolUseById = new Map<string, SessionOutput>();
  for (const item of items) {
    if (item.type === 'tool_use' && item.toolCallId) {
      toolUseById.set(item.toolCallId, item);
    }
  }

  // Track which tool_use items have been consumed by a pairing
  const pairedToolUseIds = new Set<string>();
  const pairs = new Map<string, SessionOutput>(); // toolCallId -> tool_result

  for (const item of items) {
    if (item.type === 'tool_result' && item.toolCallId && toolUseById.has(item.toolCallId)) {
      pairs.set(item.toolCallId, item);
      pairedToolUseIds.add(item.toolCallId);
    }
  }

  const result: DisplayItem[] = [];
  for (const item of items) {
    if (item.type === 'tool_use') {
      if (item.toolCallId && pairedToolUseIds.has(item.toolCallId)) {
        result.push({ kind: 'tool_pair', toolUse: item, toolResult: pairs.get(item.toolCallId)! });
      } else {
        result.push({ kind: 'single', item });
      }
    } else if (item.type === 'tool_result') {
      // Paired ones are emitted with their tool_use above; orphans are dropped
    } else {
      result.push({ kind: 'single', item });
    }
  }
  return result;
}
