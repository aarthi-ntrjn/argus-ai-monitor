import { type ChangeEvent } from 'react';

interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({ checked = false, onChange, label, className = '', 'aria-label': ariaLabel }: CheckboxProps) {
  const handleClick = () => {
    if (!onChange) return;
    const syntheticEvent = { target: { checked: !checked } } as ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  const checkbox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      onClick={handleClick}
      className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors cursor-pointer
        focus-visible:outline-none focus-visible:border-blue-400 focus-visible:bg-blue-100
        ${checked ? 'bg-white border-blue-400 text-blue-400' : 'border-gray-300 bg-white hover:border-blue-400'}
        ${className}`}
    >
      {checked && (
        <svg aria-hidden="true" viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
          <path d="M1.5 5.5l2.5 2.5 4.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );

  if (!label) return checkbox;

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none" onClick={e => e.preventDefault()}>
      {checkbox}
      <span onClick={handleClick} className="min-w-0 break-words">{label}</span>
    </label>
  );
}
