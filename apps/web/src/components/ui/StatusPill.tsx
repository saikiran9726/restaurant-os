import React from 'react';
import { Sparkles, Flame, CheckCircle2, ClockAlert, AlertOctagon } from 'lucide-react';

export type OrderStatus =
  | 'new'
  | 'preparing'
  | 'ready'
  | 'late'
  | 'overdue'
  | 'served'
  | 'cancelled'
  | 'paid'
  | 'unpaid'
  | 'partially_paid'
  | 'refunded'
  | 'confirmed'
  | 'pending_confirmation'
  | 'recorded'
  | 'failed'
  | 'draft';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OrderStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  OrderStatus,
  {
    defaultLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    styles: string;
  }
> = {
  new: {
    defaultLabel: 'New',
    icon: Sparkles,
    styles: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  preparing: {
    defaultLabel: 'Preparing',
    icon: Flame,
    styles: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  ready: {
    defaultLabel: 'Ready',
    icon: CheckCircle2,
    styles: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  served: {
    defaultLabel: 'Served',
    icon: CheckCircle2,
    styles: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
  },
  cancelled: {
    defaultLabel: 'Cancelled',
    icon: AlertOctagon,
    styles: 'bg-red-950/40 text-red-400 border-red-500/30',
  },
  paid: {
    defaultLabel: 'Paid',
    icon: CheckCircle2,
    styles: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  unpaid: {
    defaultLabel: 'Unpaid',
    icon: ClockAlert,
    styles: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  partially_paid: {
    defaultLabel: 'Partially Paid',
    icon: ClockAlert,
    styles: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  refunded: {
    defaultLabel: 'Refunded',
    icon: AlertOctagon,
    styles: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  confirmed: {
    defaultLabel: 'Confirmed',
    icon: CheckCircle2,
    styles: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  pending_confirmation: {
    defaultLabel: 'Pending Confirmation',
    icon: ClockAlert,
    styles: 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse',
  },
  recorded: {
    defaultLabel: 'Recorded',
    icon: Sparkles,
    styles: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  failed: {
    defaultLabel: 'Failed',
    icon: AlertOctagon,
    styles: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  draft: {
    defaultLabel: 'Draft',
    icon: Sparkles,
    styles: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  },
  late: {
    defaultLabel: 'Delayed',
    icon: ClockAlert,
    styles: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  overdue: {
    defaultLabel: 'Overdue',
    icon: AlertOctagon,
    styles: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse',
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  size = 'md',
  className = '',
  ...props
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  const displayLabel = label || config.defaultLabel;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-caption px-2.5 py-1 gap-1.5',
    lg: 'text-body px-3.5 py-1.5 gap-2 font-medium',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      role="status"
      className={`inline-flex items-center font-semibold rounded-full border border-solid select-none tracking-wide ${config.styles} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      <Icon className={`${iconSizes[size]} shrink-0`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
};
