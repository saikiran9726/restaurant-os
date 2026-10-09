import React from 'react';
import { Calendar } from 'lucide-react';

export type RangePreset = 'today' | 'yesterday' | 'weekly' | 'monthly' | 'custom';

export interface RangePickerProps {
  preset: RangePreset;
  onPresetChange: (preset: RangePreset) => void;
  startDate: string;
  endDate: string;
  onCustomRangeChange?: (startDate: string, endDate: string) => void;
  className?: string;
}

export const RangePicker: React.FC<RangePickerProps> = ({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onCustomRangeChange,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 bg-surface-card border border-surface-border p-1.5 rounded-xl ${className}`}
    >
      <div className="flex items-center gap-1">
        {(['today', 'yesterday', 'weekly', 'monthly'] as RangePreset[]).map((p) => {
          const isActive = preset === p;
          const label =
            p === 'today'
              ? 'Today'
              : p === 'yesterday'
                ? 'Yesterday'
                : p === 'weekly'
                  ? 'Last 7 Days'
                  : 'Last 30 Days';

          return (
            <button
              key={p}
              type="button"
              onClick={() => onPresetChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-surface-border mx-1 hidden sm:block" />

      {/* Custom Range */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => onPresetChange('custom')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            preset === 'custom'
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Custom</span>
        </button>

        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onCustomRangeChange?.(e.target.value, endDate)}
              className="px-2 py-1 bg-surface-elevated border border-surface-border rounded-md text-content-primary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Start Date"
            />
            <span className="text-content-muted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onCustomRangeChange?.(startDate, e.target.value)}
              className="px-2 py-1 bg-surface-elevated border border-surface-border rounded-md text-content-primary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="End Date"
            />
          </div>
        )}
      </div>
    </div>
  );
};
