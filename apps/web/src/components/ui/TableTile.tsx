import React from 'react';
import { Users, Clock } from 'lucide-react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export type TableStatus = 'available' | 'occupied' | 'billing' | 'reserved';

export interface TableTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  orderCount?: number;
  billAmountPaise?: number;
  occupiedMinutes?: number;
  section?: string;
}

const tableStatusStyles: Record<
  TableStatus,
  { bg: string; border: string; badge: string; text: string; label: string }
> = {
  available: {
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'Available',
  },
  occupied: {
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'Occupied',
  },
  billing: {
    bg: 'bg-amber-500/5 hover:bg-amber-500/10',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Billing',
  },
  reserved: {
    bg: 'bg-purple-500/5 hover:bg-purple-500/10',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400',
    label: 'Reserved',
  },
};

export const TableTile: React.FC<TableTileProps> = ({
  tableNumber,
  capacity,
  status,
  orderCount = 0,
  billAmountPaise,
  occupiedMinutes,
  section,
  className = '',
  ...props
}) => {
  const config = tableStatusStyles[status];

  return (
    <button
      type="button"
      className={`rounded-xl border p-4 flex flex-col justify-between text-left transition-all active:scale-[0.98] duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-h-[120px] select-none ${config.bg} ${config.border} ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between w-full gap-2">
        <div>
          <span className="text-display font-extrabold text-content-primary leading-none block">
            {tableNumber}
          </span>
          {section && (
            <span className="text-xs text-content-muted uppercase tracking-wider block mt-1">
              {section}
            </span>
          )}
        </div>

        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${config.badge}`}
        >
          {config.label}
        </span>
      </div>

      <div className="flex items-center justify-between w-full mt-3 pt-2 border-t border-surface-border/50 text-caption text-content-secondary">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title={`Capacity: ${capacity}`}>
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{capacity}</span>
          </span>

          {occupiedMinutes !== undefined && status !== 'available' && (
            <span
              className="flex items-center gap-1 font-mono"
              title={`${occupiedMinutes}m seated`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{occupiedMinutes}m</span>
            </span>
          )}
        </div>

        <div>
          {billAmountPaise !== undefined && billAmountPaise > 0 ? (
            <span className="font-bold text-content-primary">
              {formatPaiseToRupeeString(billAmountPaise)}
            </span>
          ) : orderCount > 0 ? (
            <span>{orderCount} items</span>
          ) : null}
        </div>
      </div>
    </button>
  );
};
