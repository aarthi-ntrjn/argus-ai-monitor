import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  colorClass?: string;
  icon?: ReactNode;
  title?: string;
}

export default function Badge({ children, colorClass = 'bg-gray-100 text-gray-500', icon, title }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${colorClass}`}
      title={title}
    >
      {icon}
      {children}
    </span>
  );
}
