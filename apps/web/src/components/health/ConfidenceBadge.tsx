import React from 'react';
import type { HealthConfidence } from '@restaurant-os/shared';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

export interface ConfidenceBadgeProps {
  confidence: HealthConfidence;
  factorsUsedCount: number;
  totalFactorsCount?: number;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  factorsUsedCount,
  totalFactorsCount = 8,
  className = '',
}) => {
  const config = {
    high: {
      label: 'High Confidence',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      icon: ShieldCheck,
      tooltip:
        'Based on 7+ active operational factors with 14+ days of closed register sales data.',
    },
    medium: {
      label: 'Medium Confidence',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      icon: ShieldAlert,
      tooltip:
        'Based on 5–6 operational factors with 7+ days of sales. Additional closed days will increase accuracy.',
    },
    low: {
      label: 'Low Confidence',
      badgeClass: 'bg-surface-elevated text-content-muted border-surface-border',
      icon: Shield,
      tooltip:
        'Limited operational data available. Missing factors have been excluded and weights renormalised.',
    },
  }[confidence];

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 text-xs ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border ${config.badgeClass}`}
        title={config.tooltip}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{config.label}</span>
      </span>

      <span className="text-content-secondary font-medium">
        Based on <strong className="text-content-primary">{factorsUsedCount}</strong> of{' '}
        {totalFactorsCount} factors
      </span>
    </div>
  );
};
