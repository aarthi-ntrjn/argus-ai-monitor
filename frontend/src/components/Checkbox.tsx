import { forwardRef, type InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const inputId = id ?? (label ? `cb-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    const input = (
      <input
        ref={ref}
        type="checkbox"
        id={inputId}
        className={`h-4 w-4 rounded-sm border border-gray-300 text-blue-400 cursor-pointer
          focus:ring-1 focus:ring-blue-400 focus:ring-offset-0
          checked:border-blue-400 checked:bg-blue-400
          ${className}`}
        {...props}
      />
    );

    if (!label) return input;

    return (
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        {input}
        {label}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
