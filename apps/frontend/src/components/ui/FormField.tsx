import React from 'react';

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode | ((props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode);
  className?: string;
}

export function FormField({
  id: explicitId,
  label,
  required,
  helperText,
  error,
  children,
  className = '',
}: FormFieldProps) {
  const generatedId = React.useId();
  const id = explicitId || generatedId;
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-xs sm:text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      {typeof children === 'function'
        ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })
        : children}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
