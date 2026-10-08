import React from 'react';
import { Clock } from 'lucide-react';

export type TimerSeverity = 'normal' | 'warning' | 'late' | 'overdue';

export interface TimerBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  state?: TimerSeverity;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function formatSecondsToMMSS(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const remainingSeconds = absSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(remainingSeconds).padStart(2, '0');

  return `${isNegative ? '-' : ''}${mm}:${ss}`;
}

const severityClasses: Record<TimerSeverity, string> = {
  normal: 'bg-surface-elevated text-content-primary border-surface-border',
  warning: 'bg-amber-500/15 text-amber-500 border-amber-500/40 font-bold',
  late: 'bg-orange-500/15 text-orange-500 border-orange-500/40 font-bold',
  overdue: 'bg-red-500/20 text-red-500 border-red-500/50 font-extrabold animate-pulse',
};

export const TimerBadge: React.FC<TimerBadgeProps> = ({
  seconds,
  state = 'normal',
  size = 'md',
  showIcon = true,
  className = '',
  ...props
}) => {
  const formatted = formatSecondsToMMSS(seconds);

  const sizeClasses = {
    sm: 'text-caption px-2 py-0.5 gap-1',
    md: 'text-body px-2.5 py-1 gap-1.5',
    lg: 'text-subhead px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      role="timer"
      aria-label={`Elapsed time: ${formatted}, status: ${state}`}
      className={`inline-flex items-center font-mono rounded-md border tracking-wider select-none ${severityClasses[state]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {showIcon && <Clock className={`${iconSizes[size]} shrink-0`} aria-hidden="true" />}
      <span>{formatted}</span>
    </span>
  );
};
