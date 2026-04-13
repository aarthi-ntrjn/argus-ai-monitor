import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses = 'transition-colors focus-visible:outline-none focus-visible:ring-1';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-400 text-white rounded hover:bg-blue-700 focus-visible:bg-blue-700 disabled:opacity-40 focus-visible:ring-blue-400',
  danger: 'bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus-visible:ring-red-400',
  ghost: 'text-gray-600 hover:text-gray-800 disabled:opacity-50 focus-visible:ring-blue-400',
  outline: 'text-gray-500 border border-gray-300 rounded hover:border-blue-400 hover:text-blue-700 focus-visible:border-blue-400 focus-visible:text-blue-700 disabled:opacity-50 focus-visible:ring-blue-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-2 py-1',
  md: 'text-xs px-3 py-1.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
