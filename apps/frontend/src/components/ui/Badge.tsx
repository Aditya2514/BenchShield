import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'neutral'
    | 'verified'
    | 'candidate'
    | 'rejected'
    | 'needs_review'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
  icon?: React.ReactNode;
}

export function Badge({
  variant = 'neutral',
  icon,
  children,
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-300',
    verified: 'bg-red-50 text-red-800 border-red-300',
    candidate: 'bg-amber-50 text-amber-900 border-amber-300',
    rejected: 'bg-slate-100 text-slate-600 border-slate-300',
    needs_review: 'bg-purple-50 text-purple-800 border-purple-300',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    warning: 'bg-amber-50 text-amber-900 border-amber-300',
    danger: 'bg-red-50 text-red-800 border-red-300',
    info: 'bg-sky-50 text-sky-800 border-sky-300',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

