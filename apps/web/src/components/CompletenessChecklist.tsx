import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { MonthCompletenessChecklist } from '@restaurant-os/shared';

export interface CompletenessChecklistProps {
  checklist: MonthCompletenessChecklist;
  className?: string;
}

export const CompletenessChecklist: React.FC<CompletenessChecklistProps> = ({
  checklist,
  className = '',
}) => {
  const isComplete = checklist.completenessPercent === 100;

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-bold text-subhead text-content-primary">
            Data Completeness Indicator
          </h3>
          <p className="text-xs text-content-secondary">
            Evaluation accuracy depends on closed shifts, supplier invoices, and key overhead
            entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-body font-black text-content-primary">
            {checklist.completenessPercent}%
          </span>
          <div className="w-20 h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isComplete
                  ? 'bg-emerald-500'
                  : checklist.completenessPercent >= 70
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${checklist.completenessPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Closed Days */}
        <div className="p-3 bg-surface-elevated rounded-lg flex items-center gap-2.5">
          {checklist.isAllDaysClosed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <span className="font-bold text-content-primary block">
              {checklist.closedDaysCount} / {checklist.daysInMonth} Days Closed
            </span>
            <span className="text-[11px] text-content-muted">
              {checklist.isAllDaysClosed
                ? 'All days reconciled'
                : `${checklist.unclosedDaysCount} unclosed shifts`}
            </span>
          </div>
        </div>

        {/* Rent Entry */}
        <div className="p-3 bg-surface-elevated rounded-lg flex items-center gap-2.5">
          {checklist.hasRentExpense ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <span className="font-bold text-content-primary block">Rent Expense</span>
            <span className="text-[11px] text-content-muted">
              {checklist.hasRentExpense ? 'Facility lease recorded' : 'Missing rent entry'}
            </span>
          </div>
        </div>

        {/* Salaries Entry */}
        <div className="p-3 bg-surface-elevated rounded-lg flex items-center gap-2.5">
          {checklist.hasSalariesExpense ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <div>
            <span className="font-bold text-content-primary block">Salaries & Wages</span>
            <span className="text-[11px] text-content-muted">
              {checklist.hasSalariesExpense ? 'Staff payroll logged' : 'Missing salary entry'}
            </span>
          </div>
        </div>

        {/* Physical Counts */}
        <div className="p-3 bg-surface-elevated rounded-lg flex items-center gap-2.5">
          {checklist.hasClosingStockCount ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-content-muted shrink-0" />
          )}
          <div>
            <span className="font-bold text-content-primary block">Closing Stock Count</span>
            <span className="text-[11px] text-content-muted">
              {checklist.hasClosingStockCount ? 'Month-end count done' : 'Using purchase method'}
            </span>
          </div>
        </div>
      </div>

      {checklist.missingItems.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <strong className="block mb-1">Recommended for complete financial review:</strong>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {checklist.missingItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
