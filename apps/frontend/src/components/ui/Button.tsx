import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, children, className = '', disabled, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const sizeClasses = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-xs sm:text-sm px-3.5 py-2 gap-2',
      lg: 'text-sm sm:text-base px-4 py-2.5 gap-2.5',
    }[size];

    const variantClasses = {
      primary:
        'bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs border border-transparent',
      secondary:
        'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs hover:border-slate-400',
      danger:
        'bg-red-600 hover:bg-red-700 text-white shadow-xs border border-transparent',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-700 border border-transparent',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

