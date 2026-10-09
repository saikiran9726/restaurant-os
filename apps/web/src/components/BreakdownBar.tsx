import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export interface BreakdownSegment {
  id: string;
  label: string;
  amountPaise: number;
  count?: number;
  colorClass?: string;
}

export interface BreakdownBarProps {
  title: string;
  segments: BreakdownSegment[];
  totalAmountPaise?: number;
  className?: string;
}

const DEFAULT_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
];

export const BreakdownBar: React.FC<BreakdownBarProps> = ({
  title,
  segments,
  totalAmountPaise,
  className = '',
}) => {
  const sum = totalAmountPaise ?? segments.reduce((acc, s) => acc + s.amountPaise, 0);

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <h3 className="font-bold text-subhead text-content-primary">{title}</h3>
        <span className="text-xs font-bold text-content-primary">
          {formatPaiseToRupeeString(sum)}
        </span>
      </div>

      {sum === 0 ? (
        <div className="py-6 text-center text-xs text-content-muted">
          No transactions recorded in this period
        </div>
      ) : (
        <div className="pt-4 space-y-4">
          {/* Stacked Bar */}
          <div className="h-4 w-full flex rounded-full overflow-hidden bg-surface-elevated">
            {segments.map((seg, idx) => {
              if (seg.amountPaise <= 0) return null;
              const pct = (seg.amountPaise / sum) * 100;
              const color = seg.colorClass || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <div
                  key={seg.id}
                  style={{ width: `${pct}%` }}
                  className={`${color} h-full transition-all duration-300 relative group`}
                  title={`${seg.label}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            {segments.map((seg, idx) => {
              const pct = sum > 0 ? ((seg.amountPaise / sum) * 100).toFixed(1) : '0';
              const color = seg.colorClass || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <div key={seg.id} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-content-secondary font-medium truncate">
                        {seg.label}
                      </span>
                      <span className="font-bold text-content-primary ml-1">{pct}%</span>
                    </div>
                    <div className="text-[11px] text-content-muted flex items-center justify-between">
                      <span>{formatPaiseToRupeeString(seg.amountPaise)}</span>
                      {seg.count !== undefined && <span>({seg.count})</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
