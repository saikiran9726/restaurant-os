import React from 'react';
import type { HealthFactorEvaluation } from '@restaurant-os/shared';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, ChevronRight } from 'lucide-react';

export interface FactorRowProps {
  factor: HealthFactorEvaluation;
  onSelect: (factor: HealthFactorEvaluation) => void;
  className?: string;
}

export const FactorRow: React.FC<FactorRowProps> = ({ factor, onSelect, className = '' }) => {
  const statusIcons = {
    good: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Good status" />,
    warning: (
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-label="Needs attention" />
    ),
    critical: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-label="At risk" />,
    excluded: (
      <HelpCircle className="w-4 h-4 text-content-muted shrink-0" aria-label="Factor excluded" />
    ),
  };

  const statusBadges = {
    good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
    excluded: 'bg-surface-elevated text-content-muted',
  };

  return (
    <tr
      onClick={() => onSelect(factor)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(factor);
        }
      }}
      tabIndex={0}
      role="button"
      className={`hover:bg-surface-elevated/60 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {/* Factor Name & Status */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          {statusIcons[factor.status]}
          <div>
            <span className="font-bold text-content-primary block text-xs">{factor.name}</span>
            <span className="text-[11px] text-content-secondary block">
              {factor.currentDisplayValue}
            </span>
          </div>
        </div>
      </td>

      {/* Target Value */}
      <td className="py-3.5 px-4 font-mono text-xs text-content-secondary">
        {factor.targetDisplayValue}
      </td>

      {/* Score */}
      <td className="py-3.5 px-4 text-center">
        {factor.isIncluded && factor.rawScore !== null ? (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${statusBadges[factor.status]}`}
          >
            {factor.rawScore} / 100
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-elevated text-content-muted">
            Excluded (No Data)
          </span>
        )}
      </td>

      {/* Weight & Normalized Weight */}
      <td className="py-3.5 px-4 text-center text-xs">
        {factor.isIncluded ? (
          <div>
            <span className="font-bold text-content-primary block">{factor.normalizedWeight}%</span>
            {factor.normalizedWeight !== factor.weight && (
              <span className="text-[10px] text-content-muted">base {factor.weight}%</span>
            )}
          </div>
        ) : (
          <span className="text-content-muted line-through">{factor.weight}%</span>
        )}
      </td>

      {/* Contribution Points */}
      <td className="py-3.5 px-4 text-right">
        {factor.isIncluded ? (
          <span className="text-xs font-black text-content-primary">
            +{factor.contributionPoints.toFixed(1)} pts
          </span>
        ) : (
          <span className="text-xs text-content-muted font-mono">0 pts</span>
        )}
      </td>

      {/* Drawer Action Icon */}
      <td className="py-3.5 px-3 text-right">
        <span
          className="p-1 rounded text-content-muted hover:text-content-primary inline-flex"
          aria-label="View factor details"
        >
          <ChevronRight className="w-4 h-4" />
        </span>
      </td>
    </tr>
  );
};
