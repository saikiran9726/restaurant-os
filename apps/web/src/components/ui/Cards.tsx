import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import { Button } from './Button.js';

export interface KpiCardProps {
  title: string;
  value: string | number;
  changePercent?: number;
  changePeriod?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  changePercent,
  changePeriod = 'vs yesterday',
  icon,
  subtitle,
  className = '',
}) => {
  const isPositive = changePercent !== undefined && changePercent >= 0;

  return (
    <div
      className={`rounded-xl bg-surface-card border border-surface-border p-5 flex flex-col justify-between gap-3 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold uppercase tracking-wider text-content-muted">
          {title}
        </span>
        {icon && (
          <span className="text-content-secondary p-1.5 rounded-lg bg-surface-elevated">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-headline font-extrabold text-content-primary">{value}</span>

        {changePercent !== undefined && (
          <div
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {changePercent}%
            </span>
          </div>
        )}
      </div>

      {(subtitle || changePeriod) && (
        <span className="text-xs text-content-secondary">{subtitle || `${changePeriod}`}</span>
      )}
    </div>
  );
};

export interface InsightCardProps {
  tag: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  tag,
  title,
  description,
  actionText = 'View Details',
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-surface-card to-surface-elevated border border-surface-border p-5 flex flex-col justify-between gap-3 shadow-sm ${className}`}
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded">
          {tag}
        </span>
        <h3 className="font-bold text-subhead text-content-primary mt-2">{title}</h3>
        <p className="text-body text-content-secondary mt-1">{description}</p>
      </div>

      {onAction && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAction}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="!px-0 text-accent hover:text-accent-hover font-semibold"
          >
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};

export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success';

export interface AlertCardProps {
  severity?: AlertSeverity;
  title: string;
  message?: string;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const severityConfig: Record<
  AlertSeverity,
  { bg: string; border: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  danger: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    icon: AlertOctagon,
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
};

export const AlertCard: React.FC<AlertCardProps> = ({
  severity = 'info',
  title,
  message,
  onClose,
  action,
  className = '',
}) => {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 flex items-start justify-between gap-3 ${config.bg} ${config.border} ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.text}`} aria-hidden="true" />
        <div>
          <h3 className="font-bold text-body text-content-primary leading-tight">{title}</h3>
          {message && <p className="text-caption text-content-secondary mt-1">{message}</p>}
          {action && <div className="mt-2.5">{action}</div>}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="text-content-muted hover:text-content-primary p-1 rounded hover:bg-surface-elevated transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
