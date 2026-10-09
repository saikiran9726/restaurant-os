import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export interface MismatchBannerProps {
  expectedCashPaise: number;
  actualCashPaise: number;
  differencePaise: number;
  tolerancePaise: number;
  isMismatch: boolean;
  mismatchNote: string;
  onMismatchNoteChange: (note: string) => void;
  className?: string;
}

export const MismatchBanner: React.FC<MismatchBannerProps> = ({
  expectedCashPaise,
  actualCashPaise,
  differencePaise,
  tolerancePaise,
  isMismatch,
  mismatchNote,
  onMismatchNoteChange,
  className = '',
}) => {
  const isShort = differencePaise < 0;
  const absDiff = Math.abs(differencePaise);

  if (!isMismatch) {
    return (
      <div
        className={`p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs ${className}`}
      >
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Cash balanced! Count matches expected cash ({formatPaiseToRupeeString(actualCashPaise)})
            within ₹{(tolerancePaise / 100).toFixed(2)} tolerance.
          </span>
        </div>
        <span className="font-bold text-emerald-600 dark:text-emerald-300">Δ ₹0.00</span>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-body text-red-700 dark:text-red-400">
              Cash Discrepancy Detected ({isShort ? 'Shortage' : 'Surplus'})
            </h4>
            <p className="text-xs text-content-secondary mt-0.5">
              Expected till balance is{' '}
              <strong className="text-content-primary">
                {formatPaiseToRupeeString(expectedCashPaise)}
              </strong>
              , but counted cash is{' '}
              <strong className="text-content-primary">
                {formatPaiseToRupeeString(actualCashPaise)}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-semibold text-content-muted block">Difference</span>
          <span className="text-subhead font-black text-red-600 dark:text-red-400">
            {isShort ? '-' : '+'}
            {formatPaiseToRupeeString(absDiff)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <label
          htmlFor="mismatch-explanation"
          className="text-xs font-bold text-content-primary flex items-center gap-1"
        >
          <span>Mandatory Explanation Note *</span>
          <span className="text-red-500 text-[11px]">(required to close with discrepancy)</span>
        </label>
        <textarea
          id="mismatch-explanation"
          rows={2}
          value={mismatchNote}
          onChange={(e) => onMismatchNoteChange(e.target.value)}
          placeholder="e.g. ₹500 paid for urgent vendor ice delivery (slip missing) or coin shortage..."
          className="w-full p-2.5 bg-surface-card border border-red-300 dark:border-red-800 rounded-lg text-xs text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          required
        />
      </div>
    </div>
  );
};
