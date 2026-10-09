import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import type { InsightOutput } from '@restaurant-os/shared';

interface BusinessInsightCardProps {
  insight: InsightOutput;
  onDismiss?: (insightId: string) => Promise<void>;
}

export const BusinessInsightCard: React.FC<BusinessInsightCardProps> = ({ insight, onDismiss }) => {
  const [showEvidence, setShowEvidence] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setDismissing(true);
    try {
      await onDismiss(insight.id);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 mt-0.5 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-elevated text-content-secondary border border-surface-border">
                {insight.period} insight
              </span>
              <span className="text-xs font-semibold text-content-muted">
                Score: {insight.materialityScore}
              </span>
            </div>

            <p className="text-body text-content-primary font-medium leading-relaxed">
              {insight.text}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            disabled={dismissing}
            onClick={handleDismiss}
            title="Dismiss insight"
            className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-muted hover:text-content-secondary transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expandable "Show numbers" Evidence view */}
      {insight.evidence && (
        <div className="mt-3 pt-2 border-t border-surface-border/50">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <span>{showEvidence ? 'Hide numbers' : 'Show numbers (evidence)'}</span>
            {showEvidence ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showEvidence && (
            <div className="mt-2.5 p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-1.5 font-medium">
                <span className="text-content-secondary">{insight.evidence.metricName}</span>
                <span className="text-content-primary font-bold">
                  Current: {insight.evidence.currentValue}
                  {insight.evidence.previousValue && ` (Prev: ${insight.evidence.previousValue})`}
                </span>
              </div>

              {insight.evidence.difference && (
                <div className="text-content-secondary">
                  <strong>Variance: </strong>
                  <span className="font-mono text-content-primary">
                    {insight.evidence.difference}
                  </span>
                </div>
              )}

              {insight.evidence.details && Object.keys(insight.evidence.details).length > 0 && (
                <div className="pt-1">
                  <div className="font-semibold text-content-muted text-[11px] mb-1">
                    Factor Breakdown:
                  </div>
                  <pre className="text-[11px] font-mono bg-surface-card p-2 rounded border border-surface-border overflow-x-auto text-content-secondary">
                    {JSON.stringify(insight.evidence.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
