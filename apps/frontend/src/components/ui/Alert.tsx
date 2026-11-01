import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'warning' | 'danger' | 'success' | 'info';
  title?: string;
  icon?: React.ReactNode;
  role?: string;
}

export function Alert({
  variant = 'info',
  title,
  icon,
  role = 'alert',
  children,
  className = '',
  ...props
}: AlertProps) {
  const variantStyles = {
    warning: {
      container: 'bg-amber-50 border-amber-300 text-amber-900',
      title: 'text-amber-950',
      defaultIcon: <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />,
    },
    danger: {
      container: 'bg-red-50 border-red-300 text-red-900',
      title: 'text-red-950',
      defaultIcon: <AlertOctagon className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />,
    },
    success: {
      container: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      title: 'text-emerald-950',
      defaultIcon: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />,
    },
    info: {
      container: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      title: 'text-indigo-950',
      defaultIcon: <Info className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" aria-hidden="true" />,
    },
  }[variant];

  return (
    <div
      role={role}
      className={`p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${variantStyles.container} ${className}`}
      {...props}
    >
      {icon ?? variantStyles.defaultIcon}
      <div className="flex-1 space-y-1">
        {title && <h4 className={`font-semibold tracking-tight ${variantStyles.title}`}>{title}</h4>}
        <div className="text-xs sm:text-sm opacity-95">{children}</div>
      </div>
    </div>
  );
}
