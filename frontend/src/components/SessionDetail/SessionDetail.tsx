import { useEffect, useRef } from 'react';
import type { SessionOutput } from '../../types';

interface Props {
  sessionId: string;
  items: SessionOutput[];
  dark?: boolean;
}

const TYPE_LABELS: Record<string, { label: string; light: string; dark: string }> = {
  message:       { label: 'MSG',    light: 'bg-blue-100 text-blue-700',   dark: 'bg-blue-900 text-blue-300' },
  tool_use:      { label: 'TOOL',   light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-900 text-purple-300' },
  tool_result:   { label: 'RESULT', light: 'bg-green-100 text-green-700', dark: 'bg-green-900 text-green-300' },
  error:         { label: 'ERR',    light: 'bg-red-100 text-red-700',     dark: 'bg-red-900 text-red-300' },
  status_change: { label: 'STATUS', light: 'bg-yellow-100 text-yellow-700', dark: 'bg-yellow-900 text-yellow-300' },
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

export default function SessionDetail({ items, dark = false }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className={`p-8 text-center ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        No output yet. Waiting for session activity...
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto max-h-[600px] p-4 space-y-2 font-mono text-sm ${dark ? 'bg-gray-900' : ''}`}>
      {items.map((item) => {
        const typeInfo = TYPE_LABELS[item.type] ?? {
          label: item.type.toUpperCase(),
          light: 'bg-gray-100 text-gray-700',
          dark: 'bg-gray-700 text-gray-300',
        };
        const badgeColor = dark ? typeInfo.dark : typeInfo.light;
        return (
          <div key={item.id} className="flex gap-3 items-start">
            <span className={`text-xs whitespace-nowrap mt-0.5 w-20 shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatTime(item.timestamp)}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0 ${badgeColor}`}>
              {typeInfo.label}
            </span>
            {item.toolName && (
              <span className={`text-xs whitespace-nowrap shrink-0 ${dark ? 'text-purple-400' : 'text-purple-600'}`}>[{item.toolName}]</span>
            )}
            <span className={`break-all ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{item.content}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
