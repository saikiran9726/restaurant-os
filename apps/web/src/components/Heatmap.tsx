import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export interface HourlyBucket {
  hour: number;
  salesPaise: number;
  ordersCount: number;
}

export interface HeatmapProps {
  data: HourlyBucket[];
  title?: string;
  className?: string;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  data,
  title = '24-Hour Sales Heatmap',
  className = '',
}) => {
  const maxSales = Math.max(...data.map((d) => d.salesPaise), 1);

  // Formatter for hour 0-23
  const formatHourLabel = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour} ${period}`;
  };

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-bold text-subhead text-content-primary">{title}</h3>
          <span className="text-xs text-content-secondary">
            Identify peak rush hours and kitchen load patterns
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-content-muted">
          <span>Low</span>
          <div className="flex gap-0.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-accent/15" />
            <span className="w-2.5 h-2.5 rounded-xs bg-accent/40" />
            <span className="w-2.5 h-2.5 rounded-xs bg-accent/70" />
            <span className="w-2.5 h-2.5 rounded-xs bg-accent" />
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="pt-4 grid grid-cols-6 sm:grid-cols-12 gap-2">
        {data.map((bucket) => {
          const ratio = bucket.salesPaise / maxSales;
          let intensityClass = 'bg-surface-elevated text-content-muted';
          if (ratio > 0.75) intensityClass = 'bg-accent text-accent-foreground font-bold';
          else if (ratio > 0.45)
            intensityClass = 'bg-accent/70 text-accent-foreground font-semibold';
          else if (ratio > 0.15) intensityClass = 'bg-accent/35 text-content-primary';
          else if (ratio > 0) intensityClass = 'bg-accent/15 text-content-primary';

          return (
            <div
              key={bucket.hour}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border border-surface-border/50 transition-transform hover:scale-105 group relative cursor-default ${intensityClass}`}
            >
              {/* Tooltip */}
              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-surface-overlay text-white text-[10px] font-semibold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                {formatHourLabel(bucket.hour)}: {formatPaiseToRupeeString(bucket.salesPaise)} (
                {bucket.ordersCount} orders)
              </div>

              <span className="text-[10px] uppercase tracking-wider">
                {formatHourLabel(bucket.hour)}
              </span>
              <span className="text-xs mt-0.5 font-bold">{bucket.ordersCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
