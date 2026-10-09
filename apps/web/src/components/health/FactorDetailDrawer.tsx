import React from 'react';
import type { HealthFactorEvaluation } from '@restaurant-os/shared';
import { Dialog } from '../ui/Overlay.js';
import { Button } from '../ui/Button.js';
import { BookOpen, Calculator, Database, Target, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FactorDetailDrawerProps {
  factor: HealthFactorEvaluation | null;
  onClose: () => void;
}

export const FactorDetailDrawer: React.FC<FactorDetailDrawerProps> = ({ factor, onClose }) => {
  if (!factor) return null;

  return (
    <Dialog
      isOpen={!!factor}
      onClose={onClose}
      title={`${factor.name} — Evaluation Details`}
      size="lg"
    >
      <div className="space-y-4 text-xs pt-1">
        {/* Status & Points Summary Header */}
        <div className="p-4 bg-surface-elevated rounded-xl border border-surface-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-content-muted font-bold block uppercase">
              Current Metric
            </span>
            <span className="text-body font-black text-content-primary">
              {factor.currentDisplayValue}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-content-muted font-bold block uppercase">
              Configured Target
            </span>
            <span className="text-body font-black text-accent">{factor.targetDisplayValue}</span>
          </div>

          <div>
            <span className="text-[11px] text-content-muted font-bold block uppercase">
              Sub-Score
            </span>
            <span className="text-body font-black text-content-primary">
              {factor.isIncluded && factor.rawScore !== null
                ? `${factor.rawScore} / 100`
                : 'Excluded'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-content-muted font-bold block uppercase">
              Contribution
            </span>
            <span className="text-headline font-black text-emerald-600 dark:text-emerald-400">
              +{factor.contributionPoints.toFixed(1)} pts
            </span>
          </div>
        </div>

        {/* Exclusion Warning if not included */}
        {!factor.isIncluded && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Factor Excluded from Total Score</strong>
              <span className="text-[11px]">
                {factor.exclusionReason ||
                  'Insufficient historical data in the 30-day evaluation window.'}{' '}
                Its weight was redistributed proportionally across the remaining active factors.
              </span>
            </div>
          </div>
        )}

        {/* Calculation Step-by-Step */}
        <div className="p-4 bg-surface-card border border-surface-border rounded-xl space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-surface-border font-bold text-content-primary">
            <Calculator className="w-4 h-4 text-accent" />
            <h4>Mathematical Weight & Contribution Formula</h4>
          </div>

          <div className="space-y-1 text-content-secondary leading-relaxed pt-1">
            <p>
              <strong>1. Base Weight:</strong> {factor.weight}% of total 100% model.
            </p>
            {factor.isIncluded && (
              <>
                <p>
                  <strong>2. Normalized Weight:</strong> {factor.normalizedWeight}% (adjusted for
                  active factors).
                </p>
                <p className="font-mono text-[11px] bg-surface-elevated p-2 rounded">
                  Contribution Points = ({factor.rawScore} score × {factor.normalizedWeight}%
                  weight) ÷ 100 = <strong>+{factor.contributionPoints.toFixed(1)} pts</strong>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Formula Explanation */}
        <div className="p-4 bg-surface-card border border-surface-border rounded-xl space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-surface-border font-bold text-content-primary">
            <BookOpen className="w-4 h-4 text-accent" />
            <h4>Scoring Rule</h4>
          </div>
          <p className="text-content-secondary leading-relaxed pt-1">{factor.formulaExplanation}</p>
        </div>

        {/* Raw Database Inputs Summary */}
        <div className="p-4 bg-surface-card border border-surface-border rounded-xl space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-surface-border font-bold text-content-primary">
            <Database className="w-4 h-4 text-accent" />
            <h4>Raw Database Records (Verification Data)</h4>
          </div>

          <div className="bg-surface-elevated p-3 rounded-lg font-mono text-[11px] text-content-secondary space-y-1 overflow-x-auto">
            {Object.entries(factor.inputsSummary).map(([key, val]) => (
              <div
                key={key}
                className="flex justify-between gap-4 py-0.5 border-b border-surface-border/50 last:border-0"
              >
                <span className="text-content-muted">{key}:</span>
                <span className="font-bold text-content-primary">
                  {typeof val === 'number' && key.toLowerCase().includes('paise')
                    ? `₹${(val / 100).toLocaleString('en-IN')}`
                    : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-surface-border">
          <Button type="button" variant="primary" onClick={onClose} className="font-bold">
            Close Details
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
