import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

