import React from 'react';
import type { HealthScoreReasonForChange } from '@restaurant-os/shared';
import { TrendingUp, TrendingDown, History, Check } from 'lucide-react';

export interface ReasonListProps {
  reasons: HealthScoreReasonForChange[];
  className?: string;
}

export const ReasonList: React.FC<ReasonListProps> = ({ reasons, className = '' }) => {
  if (reasons.length === 0) {
    return (
      <div
        className={`p-4 bg-surface-card border border-surface-border rounded-xl text-xs text-content-secondary flex items-center gap-2.5 ${className}`}
      >
        <History className="w-4 h-4 text-content-muted" />
        <span>
          No previous snapshot exists yet for comparison, or factor metrics were unchanged from the
          prior snapshot.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-subhead text-content-primary">Why the Score Changed</h3>
        </div>
        <span className="text-xs text-content-muted">Ranked factor impact</span>
      </div>

      <div className="divide-y divide-surface-border">
        {reasons.map((reason) => {
          const isPositive = reason.deltaPoints > 0;
          return (
            <div
              key={reason.factorId}
              className="py-2.5 flex items-start gap-3 text-xs first:pt-1 last:pb-1"
            >
              <span
                className={`p-1.5 rounded-lg shrink-0 ${
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-content-primary">{reason.factorName}</span>
                  <span
                    className={`font-black text-[11px] ${
                      isPositive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isPositive ? `+${reason.deltaPoints}` : `${reason.deltaPoints}`} pts
                  </span>
                </div>
                <p className="text-content-secondary mt-0.5 text-[11px] leading-relaxed">
                  {reason.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
