import type { ReactNode } from 'react';

interface SectionHeadingProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeading({ children, className = '' }: SectionHeadingProps) {
  return (
    <p className={`text-xs font-semibold text-gray-500 uppercase tracking-wide${className ? ` ${className}` : ''}`}>
      {children}
    </p>
  );
}
