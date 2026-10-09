import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export interface FormulaPanelProps {
  suppliesMethod: 'consumption' | 'purchases';
  suppliesMethodReason: string;
  className?: string;
}

export const FormulaPanel: React.FC<FormulaPanelProps> = ({
  suppliesMethod,
  suppliesMethodReason,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`bg-surface-elevated/70 border border-surface-border rounded-xl p-4 text-xs ${className}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 font-bold text-content-primary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded py-0.5"
        >
          <BookOpen className="w-4 h-4 text-accent" />
          <span>How this was calculated (Accounting formulas & assumptions)</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <span className="text-[11px] font-bold text-accent px-2 py-0.5 rounded bg-accent/10">
          Method: {suppliesMethod.toUpperCase()}
        </span>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-surface-border space-y-3 animate-in fade-in duration-200 text-content-secondary">
          <div>
            <h4 className="font-bold text-content-primary mb-0.5">1. Revenue (Net Sales)</h4>
            <p className="text-[11px]">
              Computed strictly as gross menu sales minus discounts and refunds. Excludes collected
              GST/VAT and service charges (which represent pass-through liabilities, not restaurant
              income).
            </p>
          </div>

          <div>
            <h4 className="font-bold text-content-primary mb-0.5">
              2. Cost of Supplies (Ingredients & Materials)
            </h4>
            <p className="text-[11px] mb-1">{suppliesMethodReason}</p>
            <p className="text-[11px]">
              Waste and spoilage logged through the inventory module are tracked separately and
              included within ingredient consumption (never double-counted).
            </p>
          </div>

          <div>
            <h4 className="font-bold text-content-primary mb-0.5">3. Operating Expenses</h4>
            <p className="text-[11px]">
              Sum of all expenses categorized with{' '}
              <code className="px-1 py-0.5 bg-surface-card rounded text-[10px]">
                countsAsOperating = true
              </code>{' '}
              (e.g. Rent, Staff Salaries, Power, Gas, Maintenance, Transport). Direct kitchen supply
              cash payouts logged at day close are excluded to prevent double-counting against
              supply purchases.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-content-primary mb-0.5">4. Operating Profit Margin</h4>
            <p className="text-[11px] font-mono bg-surface-card p-2 rounded border border-surface-border inline-block">
              Profit Margin % = (Estimated Operating Profit ÷ Net Revenue) × 100
            </p>
          </div>

          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Management Notice:</strong> All figures presented herein represent internal
            management operational estimates based on entered invoices, register counts, and daily
            closing logs. This report does not constitute audited financial statements or official
            tax returns.
          </div>
        </div>
      )}
    </div>
  );
};
