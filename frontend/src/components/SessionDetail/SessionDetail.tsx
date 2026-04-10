import { useEffect, useRef, useMemo, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionOutput, OutputDisplayMode } from '../../types';
import { summariseToolUse, fullToolUseText, buildDisplayItems } from './sessionDetailUtils';

interface Props {
  sessionId: string;
  items: SessionOutput[];
  dark?: boolean;
  className?: string;
  displayMode?: OutputDisplayMode;
}

type BadgeStyle = { label: string; light: string; dark: string };

const TYPE_LABELS: Record<string, BadgeStyle> = {
  tool_use:      { label: 'TOOL',   light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-900 text-purple-300' },
  tool_result:   { label: 'RESULT', light: 'bg-green-100 text-green-700',   dark: 'bg-green-900 text-green-300' },
  error:         { label: 'ERR',    light: 'bg-red-100 text-red-700',       dark: 'bg-red-900 text-red-300' },
  status_change: { label: 'STATUS', light: 'bg-yellow-100 text-yellow-700', dark: 'bg-yellow-900 text-yellow-300' },
};

const ROLE_LABELS: Record<string, BadgeStyle> = {
  user:      { label: 'YOU', light: 'bg-gray-100 text-gray-600', dark: 'bg-gray-700 text-gray-300' },
  assistant: { label: 'AI',  light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900 text-blue-300' },
};

function getBadge(item: SessionOutput): BadgeStyle {
  if (item.type === 'message') {
    return ROLE_LABELS[item.role ?? ''] ?? { label: 'MSG', light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900 text-blue-300' };
  }
  return TYPE_LABELS[item.type] ?? { label: item.type.toUpperCase(), light: 'bg-gray-100 text-gray-700', dark: 'bg-gray-700 text-gray-300' };
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function SessionDetail({ items, dark = false, className, displayMode = 'focused' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedFullIds, setExpandedFullIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function expandFull(id: string) {
    setExpandedFullIds(prev => new Set(prev).add(id));
  }

  const markdownComponents = useMemo<Components>(() => ({
    p: ({ children }) => <p className="my-0 leading-snug whitespace-pre-wrap">{children}</p>,
    code: ({ children, className: cn }) => {
      const isBlock = cn?.includes('language-');
      return isBlock
        ? <code className={`block text-xs p-2 rounded my-1 overflow-x-auto ${dark ? 'bg-gray-800 text-green-300' : 'bg-gray-100 text-gray-800'} ${cn ?? ''}`}>{children}</code>
        : <code className={`text-xs px-1 rounded ${dark ? 'bg-gray-800 text-green-300' : 'bg-gray-100 text-gray-800'}`}>{children}</code>;
    },
    pre: ({ children }) => <pre className="my-1 overflow-x-auto">{children}</pre>,
    ul: ({ children }) => <ul className="list-disc list-inside my-0.5 space-y-0">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside my-0.5 space-y-0">{children}</ol>,
    li: ({ children }) => <li className="text-xs leading-snug">{children}</li>,
    h1: ({ children }) => <h1 className="text-xs font-bold my-0.5 uppercase tracking-wide">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xs font-bold my-0.5">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xs font-semibold my-0.5">{children}</h3>,
    blockquote: ({ children }) => <blockquote className={`border-l-2 pl-2 my-0.5 ${dark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-600'}`}>{children}</blockquote>,
    a: ({ children, href }) => <a href={href} className={`underline ${dark ? 'text-blue-400' : 'text-blue-600'}`}>{children}</a>,
  }), [dark]);

  const displayItems = useMemo(
    () => buildDisplayItems(items, displayMode === 'focused'),
    [items, displayMode],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className={`p-8 text-center min-h-full ${dark ? 'bg-gray-900 text-gray-400' : 'text-gray-500'}`}>
        No output yet. Waiting for session activity...
      </div>
    );
  }

  function renderBadgeCol(item: SessionOutput) {
    const typeInfo = getBadge(item);
    const badgeColor = dark ? typeInfo.dark : typeInfo.light;
    return (
      <div className="flex flex-col gap-0.5 w-24 shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap self-start ${badgeColor}`}>
          {typeInfo.label}
        </span>
        {item.toolName && (
          <span className={`text-xs truncate ${dark ? 'text-purple-400' : 'text-purple-600'}`}>[{item.toolName}]</span>
        )}
        <span className={`text-[10px] whitespace-nowrap ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
          {formatTime(item.timestamp)}
        </span>
      </div>
    );
  }

  function renderContent(item: SessionOutput) {
    const isFocused = displayMode === 'focused';
    const isExpanded = expandedIds.has(item.id);
    const isToolUse = item.type === 'tool_use';

    if (item.type === 'message') {
      return (
        <div className={`max-w-none break-words leading-snug ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {item.content}
          </ReactMarkdown>
        </div>
      );
    }

    if (isToolUse && !isExpanded) {
      return (
        <div className="flex items-center gap-2">
          <span className={`break-words ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{summariseToolUse(item)}</span>
          <button
            aria-label="Show details"
            onClick={() => toggleExpand(item.id)}
            className={`text-xs underline shrink-0 ${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            show details
          </button>
        </div>
      );
    }

    const MAX_LINES = 40;
    const lines = item.content.split('\n');
    const isTruncatable = !isFocused && item.type === 'tool_result' && lines.length > MAX_LINES;
    const isFullyExpanded = expandedFullIds.has(item.id);
    const displayContent = isTruncatable && !isFullyExpanded
      ? lines.slice(0, MAX_LINES).join('\n')
      : item.content;

    return (
      <div>
        <span className={`min-w-0 break-words whitespace-pre-wrap ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{displayContent}</span>
        {isTruncatable && !isFullyExpanded && (
          <button
            aria-label="Show more"
            onClick={() => expandFull(item.id)}
            className={`block text-xs underline mt-1 ${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            show more
          </button>
        )}
        {(isToolUse || (isFocused && item.type === 'tool_result')) && isExpanded && (
          <button
            aria-label="Hide details"
            onClick={() => toggleExpand(item.id)}
            className={`block text-xs underline mt-1 ${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            hide
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto p-4 space-y-1 font-mono text-xs min-h-full ${dark ? 'bg-gray-900' : ''} ${className ?? ''}`}>
      {displayItems.map((di) => {
        if (di.kind === 'tool_pair') {
          const { toolUse, toolResult } = di;
          const isExpanded = expandedIds.has(toolUse.id);
          const typeInfo = getBadge(toolUse);
          const badgeColor = dark ? typeInfo.dark : typeInfo.light;
          return (
            <div key={toolUse.id} className="flex gap-3 items-start">
              <div className="flex flex-col gap-0.5 w-24 shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap self-start ${badgeColor}`}>
                  {typeInfo.label}
                </span>
                {toolUse.toolName && (
                  <span className={`text-xs truncate ${dark ? 'text-purple-400' : 'text-purple-600'}`}>[{toolUse.toolName}]</span>
                )}
                <span className={`text-[10px] whitespace-nowrap ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatTime(toolUse.timestamp)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`break-words ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {isExpanded ? fullToolUseText(toolUse) : summariseToolUse(toolUse)}
                  </span>
                  <button
                    aria-label={isExpanded ? 'Hide result' : 'Show result'}
                    onClick={() => toggleExpand(toolUse.id)}
                    className={`text-xs underline shrink-0 ${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {isExpanded ? 'hide result' : 'show result'}
                  </button>
                </div>
                {isExpanded && (
                  <div className={`mt-1 whitespace-pre-wrap break-words ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {toolResult.content}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const { item } = di;
        return (
          <div key={item.id} className="flex gap-3 items-start">
            {renderBadgeCol(item)}
            <div className="min-w-0 flex-1">
              {renderContent(item)}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
