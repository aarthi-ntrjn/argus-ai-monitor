import { useEffect, useRef } from 'react';
import type { SessionOutput } from '../../types';

interface Props {
  sessionId: string;
  items: SessionOutput[];
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  message: { label: 'MSG', color: 'bg-blue-100 text-blue-700' },
  tool_use: { label: 'TOOL', color: 'bg-purple-100 text-purple-700' },
  tool_result: { label: 'RESULT', color: 'bg-green-100 text-green-700' },
  error: { label: 'ERR', color: 'bg-red-100 text-red-700' },
  status_change: { label: 'STATUS', color: 'bg-yellow-100 text-yellow-700' },
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

export default function SessionDetail({ items }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        No output yet. Waiting for session activity...
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[600px] p-4 space-y-2 font-mono text-sm">
      {items.map((item) => {
        const typeInfo = TYPE_LABELS[item.type] ?? { label: item.type.toUpperCase(), color: 'bg-gray-100 text-gray-700' };
        return (
          <div key={item.id} className="flex gap-3 items-start">
            <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5 w-20 shrink-0">
              {formatTime(item.timestamp)}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0 ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {item.toolName && (
              <span className="text-xs text-purple-600 whitespace-nowrap shrink-0">[{item.toolName}]</span>
            )}
            <span className="text-gray-800 break-all">{item.content}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
