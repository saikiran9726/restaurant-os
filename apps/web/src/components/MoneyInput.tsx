import React from 'react';
import { paiseToRupees, rupeesToPaise, formatPaiseToRupeeString } from '@restaurant-os/shared';

interface MoneyInputProps {
  valuePaise: number;
  onChangePaise: (paise: number) => void;
  minPaise?: number;
  maxPaise?: number;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  quickButtons?: number[]; // In rupees, e.g. [100, 500, 2000]
  exactAmountPaise?: number;
  className?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  valuePaise,
  onChangePaise,
  minPaise = 0,
  maxPaise,
  label,
  placeholder = '0.00',
  autoFocus = false,
  disabled = false,
  quickButtons = [100, 500, 2000],
  exactAmountPaise,
  className = '',
}) => {
  const displayRupees = valuePaise > 0 ? (valuePaise / 100).toString() : '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChangePaise(0);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      const paise = Math.round(parsed * 100);
      if (maxPaise !== undefined && paise > maxPaise) {
        onChangePaise(maxPaise);
      } else {
        onChangePaise(paise);
      }
    }
  };

  const handleQuickAdd = (rupeeIncrement: number) => {
    const incrementPaise = rupeeIncrement * 100;
    const nextPaise = valuePaise + incrementPaise;
    if (maxPaise !== undefined && nextPaise > maxPaise) {
      onChangePaise(maxPaise);
    } else {
      onChangePaise(nextPaise);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-body font-bold text-content-secondary uppercase tracking-wider text-xs">
          {label}
        </label>
      )}

      {/* Main Large Numeric Input */}
      <div className="relative flex items-center">
        <span className="absolute left-4 text-2xl font-black text-content-muted select-none pointer-events-none">
          ₹
        </span>
        <input
          type="number"
          step="any"
          min={minPaise / 100}
          max={maxPaise !== undefined ? maxPaise / 100 : undefined}
          value={displayRupees}
          onChange={handleInputChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-3.5 text-2xl font-mono font-black rounded-xl bg-surface-card border-2 border-surface-border text-content-primary focus:outline-none focus:border-accent tabular-nums disabled:opacity-50"
        />
      </div>

      {/* Quick Action & Increment Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {exactAmountPaise !== undefined && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChangePaise(exactAmountPaise)}
            className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs uppercase transition-colors"
          >
            Exact: {formatPaiseToRupeeString(exactAmountPaise)}
          </button>
        )}

        {quickButtons.map((rupeeVal) => (
          <button
            key={rupeeVal}
            type="button"
            disabled={disabled}
            onClick={() => handleQuickAdd(rupeeVal)}
            className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-border border border-surface-border text-content-secondary hover:text-content-primary font-mono text-xs font-bold transition-colors"
          >
            +₹{rupeeVal}
          </button>
        ))}

        {valuePaise > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChangePaise(0)}
            className="px-2.5 py-1.5 rounded-lg text-content-muted hover:text-red-400 text-xs font-semibold ml-auto transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
