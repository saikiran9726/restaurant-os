import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export interface StockChipProps {
  status: 'ok' | 'low' | 'out';
  currentStock: number;
  reorderLevel: number;
  unit: string;
  className?: string;
}

export const StockChip: React.FC<StockChipProps> = ({
  status,
  currentStock,
  reorderLevel,
  unit,
  className = '',
}) => {
  if (status === 'out') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 ${className}`}
      >
        <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Out of Stock (0 {unit})</span>
      </span>
    );
  }

  if (status === 'low') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>
          Low ({currentStock} / &le;{reorderLevel} {unit})
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 ${className}`}
    >
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      <span>
        In Stock ({currentStock} {unit})
      </span>
    </span>
  );
};
