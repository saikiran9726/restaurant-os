import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const AllClearState: React.FC = () => {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-body font-bold text-content-primary">
            All Clear — No Operational Gaps Detected
          </h4>
          <p className="text-caption text-content-secondary mt-0.5">
            Cash drawer, inventory thresholds, payment confirmations, and margins are fully
            reconciled.
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10">
        <ShieldCheck className="w-4 h-4" />
        <span>Monitoring Active</span>
      </div>
    </div>
  );
};
