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

export type DisplayItem =
  | { kind: 'single'; item: SessionOutput }
  | { kind: 'tool_pair'; toolUse: SessionOutput; toolResult: SessionOutput };

/**
 * In focused mode, pairs tool_use and tool_result into a single display row.
 * Pairing strategy:
 *  1. ID-based: match tool_use.toolCallId with tool_result.toolCallId (deterministic, for new data)
 *  2. Positional fallback: for items with null toolCallId, pair adjacent tool_use + tool_result
 * Orphaned tool_results (no matching tool_use) are dropped.
 * tool_use items whose result has not yet arrived are shown as singles.
 * In verbose mode, returns all items as individual rows.
 */
export function buildDisplayItems(items: SessionOutput[], focused: boolean): DisplayItem[] {
  if (!focused) {
    return items.map(item => ({ kind: 'single', item }));
  }

  // Pass 1: ID-based pairing for items that have toolCallId
  const toolUseById = new Map<string, SessionOutput>();
  for (const item of items) {
    if (item.type === 'tool_use' && item.toolCallId) {
      toolUseById.set(item.toolCallId, item);
    }
  }

  const idPairedToolUseIds = new Set<string>();
  const idPairs = new Map<string, SessionOutput>(); // toolCallId -> tool_result

  for (const item of items) {
    if (item.type === 'tool_result' && item.toolCallId && toolUseById.has(item.toolCallId)) {
      idPairs.set(item.toolCallId, item);
      idPairedToolUseIds.add(item.toolCallId);
    }
  }

  // Pass 2: positional fallback for null-ID items — mark which indices are positionally paired
  const positionalPairs = new Map<number, number>(); // toolUse index -> toolResult index
  const positionallyConsumed = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === 'tool_use' && !item.toolCallId && !idPairedToolUseIds.has(item.toolCallId ?? '')) {
      // Look for the next tool_result with null toolCallId that hasn't been consumed
      for (let j = i + 1; j < items.length; j++) {
        if (positionallyConsumed.has(j)) continue;
        const next = items[j];
        if (next.type === 'tool_result' && !next.toolCallId) {
          positionalPairs.set(i, j);
          positionallyConsumed.add(j);
          break;
        }
        // Stop looking past another tool_use or non-tool item
        if (next.type !== 'tool_result') break;
      }
    }
  }

  const result: DisplayItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === 'tool_use') {
      if (item.toolCallId && idPairedToolUseIds.has(item.toolCallId)) {
        result.push({ kind: 'tool_pair', toolUse: item, toolResult: idPairs.get(item.toolCallId)! });
      } else if (positionalPairs.has(i)) {
        result.push({ kind: 'tool_pair', toolUse: item, toolResult: items[positionalPairs.get(i)!] });
      } else {
        result.push({ kind: 'single', item });
      }
    } else if (item.type === 'tool_result') {
      if (!positionallyConsumed.has(i) && !idPairs.has(item.toolCallId ?? '')) {
        // Unpaired orphan — drop in focused mode
      }
    } else {
      result.push({ kind: 'single', item });
    }
  }
  return result;
}
