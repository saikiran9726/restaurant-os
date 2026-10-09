import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from './ui/Button.js';
import {
  formatPaiseToRupeeString,
  calculateDenominationsTotalPaise,
  type CashDenominations,
} from '@restaurant-os/shared';

export interface CashCountFormProps {
  expectedCashPaise: number;
  actualCashPaise: number;
  onActualCashChange: (paise: number, denominations?: CashDenominations) => void;
  className?: string;
}

const DENOMINATIONS: string[] = ['500', '200', '100', '50', '20', '10', '5'];

const DENOM_LABELS: Record<string, string> = {
  '500': '₹500 Notes',
  '200': '₹200 Notes',
  '100': '₹100 Notes',
  '50': '₹50 Notes',
  '20': '₹20 Notes',
  '10': '₹10 Notes',
  '5': '₹5 Coins / Notes',
};

export const CashCountForm: React.FC<CashCountFormProps> = ({
  expectedCashPaise,
  actualCashPaise,
  onActualCashChange,
  className = '',
}) => {
  const [useDenominations, setUseDenominations] = useState(false);
  const [denoms, setDenoms] = useState<CashDenominations>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
  });

  const [directRupees, setDirectRupees] = useState<string>((actualCashPaise / 100).toString());

  const handleDenomChange = (field: string, valStr: string) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    const updated = { ...denoms, [field]: val };
    setDenoms(updated);
    const totalPaise = calculateDenominationsTotalPaise(updated);
    setDirectRupees((totalPaise / 100).toString());
    onActualCashChange(totalPaise, updated);
  };

  const handleDirectChange = (valStr: string) => {
    setDirectRupees(valStr);
    const rupees = parseFloat(valStr) || 0;
    const paise = Math.round(rupees * 100);
    onActualCashChange(paise, undefined);
  };

  return (
    <div
      className={`space-y-4 bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-bold text-subhead text-content-primary">Physical Till Cash Count</h3>
          <p className="text-xs text-content-secondary">
            Count physical notes and coins in the till drawer
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setUseDenominations(!useDenominations)}
          leftIcon={<Calculator className="w-3.5 h-3.5" />}
        >
          {useDenominations ? 'Simple Total Entry' : 'Count by Denominations'}
        </Button>
      </div>

      {useDenominations ? (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DENOMINATIONS.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-surface-border"
              >
                <label
                  htmlFor={`denom-${field}`}
                  className="text-xs font-semibold text-content-primary"
                >
                  {DENOM_LABELS[field]}
                </label>
                <div className="flex items-center gap-1.5 w-28">
                  <input
                    id={`denom-${field}`}
                    type="number"
                    min="0"
                    value={denoms[field] || ''}
                    onChange={(e) => handleDenomChange(field, e.target.value)}
                    placeholder="0"
                    className="w-full text-right px-2 py-1 bg-surface-card border border-surface-border rounded text-xs font-bold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-xl">
            <span className="text-xs font-bold text-accent">Total Calculated from Count:</span>
            <span className="text-body font-extrabold text-content-primary">
              {formatPaiseToRupeeString(calculateDenominationsTotalPaise(denoms))}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="direct-cash-input"
              className="text-xs font-semibold text-content-secondary"
            >
              Total Counted Cash in Till (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted font-bold">
                ₹
              </span>
              <input
                id="direct-cash-input"
                type="number"
                step="0.01"
                min="0"
                value={directRupees}
                onChange={(e) => handleDirectChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-subhead font-extrabold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
