import type { ReactNode } from 'react';

interface ToggleIconButtonProps {
  pressed: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}

export default function ToggleIconButton({ pressed, onToggle, label, children }: ToggleIconButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${pressed ? 'text-blue-600 hover:text-blue-800' : 'text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}
