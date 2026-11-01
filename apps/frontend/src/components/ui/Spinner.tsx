export interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ label = 'Loading...', size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  }[size];

  return (
    <div role="status" className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-indigo-600 ${sizeClasses}`}
        aria-hidden="true"
      />
      {label && <span className="text-xs text-slate-500 font-medium">{label}</span>}
    </div>
  );
}

