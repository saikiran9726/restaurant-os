import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Info, ChevronRight } from 'lucide-react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { formatPaiseToRupeeString, type InsightCardData } from '@restaurant-os/shared';

export interface InsightCardViewProps {
  insight: InsightCardData;
  className?: string;
}

export const InsightCardView: React.FC<InsightCardViewProps> = ({ insight, className = '' }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isPositive = insight.changePercent !== undefined && insight.changePercent >= 0;

  return (
    <>
      <div
        className={`rounded-xl bg-surface-card border border-surface-border p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-surface-border/80 transition-all ${className}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-accent/10 text-accent">
              <Info className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
              {insight.type.replace('_', ' ')}
            </span>
          </div>

          {insight.changePercent !== undefined && (
            <div
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                isPositive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {insight.changePercent}%
              </span>
            </div>
          )}
        </div>

        <div>
          <h4 className="font-bold text-body text-content-primary leading-snug">
            {insight.headline}
          </h4>
          <p className="text-xs text-content-secondary mt-1">{insight.detail}</p>
        </div>

        {insight.underlyingNumbers && (
          <div className="pt-2 border-t border-surface-border/60">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded py-0.5"
            >
              <span>Show underlying numbers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Underlying numbers drawer / sheet */}
      {insight.underlyingNumbers && (
        <Sheet
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Underlying Calculation Data"
          description={insight.headline}
          position="right"
        >
          <div className="space-y-4 pt-4">
            <p className="text-xs text-content-secondary">
              This deterministic explanation compares current performance with historical baseline
              data:
            </p>

            <div className="bg-surface-elevated rounded-xl p-4 divide-y divide-surface-border text-xs">
              <div className="py-2.5 flex items-center justify-between first:pt-0">
                <span className="text-content-secondary capitalize font-medium">
                  Current Period
                </span>
                <span className="font-bold text-content-primary">
                  {insight.underlyingNumbers.unit === 'currency'
                    ? formatPaiseToRupeeString(insight.underlyingNumbers.current)
                    : insight.underlyingNumbers.unit === 'percent'
                      ? `${insight.underlyingNumbers.current}%`
                      : insight.underlyingNumbers.current}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-content-secondary capitalize font-medium">
                  Historical Baseline
                </span>
                <span className="font-bold text-content-primary">
                  {insight.underlyingNumbers.unit === 'currency'
                    ? formatPaiseToRupeeString(insight.underlyingNumbers.baseline)
                    : insight.underlyingNumbers.unit === 'percent'
                      ? `${insight.underlyingNumbers.baseline}%`
                      : insight.underlyingNumbers.baseline}
                </span>
              </div>
              {Object.entries(insight.underlyingNumbers.details || {}).map(([key, val]) => (
                <div key={key} className="py-2.5 flex items-center justify-between last:pb-0">
                  <span className="text-content-secondary capitalize font-medium">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className="font-bold text-content-primary">
                    {typeof val === 'number' && key.toLowerCase().includes('paise')
                      ? formatPaiseToRupeeString(val)
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
};
