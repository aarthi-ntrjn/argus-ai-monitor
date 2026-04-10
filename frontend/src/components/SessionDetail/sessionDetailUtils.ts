import type { SessionOutput } from '../../types';

const MAX_SUMMARY_LENGTH = 80;

function extractJsonPreview(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const key of ['path', 'file_path', 'command']) {
      if (typeof parsed[key] === 'string') return parsed[key] as string;
    }
    // Fall back to raw JSON truncated
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

  // Try to extract a meaningful preview from JSON content
  if (content.trimStart().startsWith('{')) {
    const preview = extractJsonPreview(content);
    if (preview) {
      return truncate(`${prefix}${preview}`, MAX_SUMMARY_LENGTH);
    }
    // JSON but no known key — use raw content truncated
    return truncate(`${prefix}${content}`, MAX_SUMMARY_LENGTH);
  }

  // Plain string content
  return truncate(`${prefix}${content}`, MAX_SUMMARY_LENGTH);
}

export function isAlwaysVisible(item: SessionOutput): boolean {
  return item.type !== 'tool_result';
}
