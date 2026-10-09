import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export interface PricePoint {
  date: string;
  pricePaise: number;
}

export interface PriceTrendMiniProps {
  prices: PricePoint[];
  unit: string;
  className?: string;
}

export const PriceTrendMini: React.FC<PriceTrendMiniProps> = ({ prices, unit, className = '' }) => {
  if (prices.length === 0) {
    return <span className="text-xs text-content-muted">No purchase history</span>;
  }

  const maxPrice = Math.max(...prices.map((p) => p.pricePaise), 1);
  const latestPrice = prices[0]?.pricePaise || 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-bold text-content-primary">
          {formatPaiseToRupeeString(latestPrice)} / {unit}
        </span>
        <span className="text-[11px] text-content-muted">Last purchase ({prices[0]?.date})</span>
      </div>

      {/* Mini Sparkline Bars */}
      <div className="h-10 flex items-end gap-1.5 pt-1">
        {[...prices].reverse().map((p, idx) => {
          const heightPct = Math.max(15, Math.round((p.pricePaise / maxPrice) * 100));
          return (
            <div
              key={idx}
              className="flex-1 min-w-[8px] bg-accent/20 hover:bg-accent rounded-t transition-all group relative cursor-pointer"
              style={{ height: `${heightPct}%` }}
            >
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-overlay text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-sm">
                {p.date}: {formatPaiseToRupeeString(p.pricePaise)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
