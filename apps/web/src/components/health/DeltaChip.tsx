import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface DeltaChipProps {
  delta: number | null; // e.g. +4, -6, 0
  className?: string;
  label?: string;
}

export const DeltaChip: React.FC<DeltaChipProps> = ({
  delta,
  className = '',
  label = 'vs last snapshot',
}) => {
  if (delta === null) return null;

  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isZero = delta === 0;

  const formattedDelta = isPositive ? `+${delta}` : `${delta}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${
        isPositive
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : isNegative
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
            : 'bg-surface-elevated text-content-muted border-surface-border'
      } ${className}`}
      title={`${formattedDelta} points ${label}`}
    >
      {isPositive && <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
      {isNegative && <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
      {isZero && <Minus className="w-3.5 h-3.5" aria-hidden="true" />}
      <span>{formattedDelta} pts</span>
      {label && <span className="font-normal opacity-75">{label}</span>}
    </span>
  );
};
