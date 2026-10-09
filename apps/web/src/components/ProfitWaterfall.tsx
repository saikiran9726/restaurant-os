import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { ArrowDown, Equal, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export interface ProfitWaterfallProps {
  revenuePaise: number;
  suppliesCostPaise: number;
  operatingExpensesPaise: number;
  estimatedProfitPaise: number;
  profitMarginPercent: number | null;
  className?: string;
}

export const ProfitWaterfall: React.FC<ProfitWaterfallProps> = ({
  revenuePaise,
  suppliesCostPaise,
  operatingExpensesPaise,
  estimatedProfitPaise,
  profitMarginPercent,
  className = '',
}) => {
  const isPositiveProfit = estimatedProfitPaise >= 0;

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-bold text-subhead text-content-primary">
            Operating Profit Breakdown
          </h3>
          <p className="text-xs text-content-secondary">
            Visual deduction from monthly net revenue to estimated operating margin
          </p>
        </div>

        {profitMarginPercent !== null && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
              isPositiveProfit
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400'
            }`}
          >
            {isPositiveProfit ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{profitMarginPercent}% Margin</span>
          </div>
        )}
      </div>

      {/* Waterfall Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
        {/* Step 1: Revenue */}
        <div className="p-4 bg-surface-elevated rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-bold">1. Monthly Net Revenue</span>
            <span className="p-1 rounded bg-accent/10 text-accent font-black">+</span>
          </div>
          <div className="mt-3">
            <span className="text-subhead font-black text-content-primary block">
              {formatPaiseToRupeeString(revenuePaise)}
            </span>
            <span className="text-[11px] text-content-muted">Net sales (excl. GST/taxes)</span>
          </div>
        </div>

        {/* Step 2: Supplies */}
        <div className="p-4 bg-surface-elevated rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-bold">2. Cost of Supplies</span>
            <span className="p-1 rounded bg-amber-500/10 text-amber-600 font-black">-</span>
          </div>
          <div className="mt-3">
            <span className="text-subhead font-black text-amber-600 dark:text-amber-400 block">
              {formatPaiseToRupeeString(suppliesCostPaise)}
            </span>
            <span className="text-[11px] text-content-muted">Ingredients & restocks</span>
          </div>
        </div>

        {/* Step 3: Operating Expenses */}
        <div className="p-4 bg-surface-elevated rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-bold">3. Operating Expenses</span>
            <span className="p-1 rounded bg-amber-500/10 text-amber-600 font-black">-</span>
          </div>
          <div className="mt-3">
            <span className="text-subhead font-black text-amber-600 dark:text-amber-400 block">
              {formatPaiseToRupeeString(operatingExpensesPaise)}
            </span>
            <span className="text-[11px] text-content-muted">Rent, wages, electricity, gas</span>
          </div>
        </div>

        {/* Step 4: Estimated Profit */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isPositiveProfit
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span
              className={
                isPositiveProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700'
              }
            >
              4. Estimated Profit
            </span>
            <Equal className="w-4 h-4 text-content-muted" />
          </div>
          <div className="mt-3">
            <span
              className={`text-headline font-black block ${
                isPositiveProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatPaiseToRupeeString(estimatedProfitPaise)}
            </span>
            <span className="text-[11px] text-content-muted">
              {profitMarginPercent !== null
                ? `${profitMarginPercent}% of Net Revenue`
                : 'Profit before taxes'}
            </span>
          </div>
        </div>
      </div>

      {/* Accessible Text Formula Summary */}
      <div className="p-3 bg-surface-elevated/50 rounded-lg text-xs text-content-secondary flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Calculation:</strong> {formatPaiseToRupeeString(revenuePaise)} (Revenue) −{' '}
          {formatPaiseToRupeeString(suppliesCostPaise)} (Supplies) −{' '}
          {formatPaiseToRupeeString(operatingExpensesPaise)} (Expenses) ={' '}
          <strong>{formatPaiseToRupeeString(estimatedProfitPaise)}</strong>
        </span>
      </div>
    </div>
  );
};
