import React from 'react';
import { rupeesToPaise, paiseToRupees } from '@restaurant-os/shared';

interface PriceInputProps {
  id?: string;
  label?: string;
  paise: number;
  onChange: (paise: number) => void;
  error?: string;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const PriceInput: React.FC<PriceInputProps> = ({
  id = 'price-input',
  label = 'Price',
  paise,
  onChange,
  error,
  min = 0,
  max,
  required = false,
  disabled = false,
  className = '',
}) => {
  const rupees = paiseToRupees(paise);

  const handleRupeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(0);
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(Math.max(0, rupeesToPaise(num)));
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-caption font-semibold text-content-secondary">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-content-secondary font-bold">
          <span>₹</span>
        </div>
        <input
          id={id}
          type="number"
          step="0.50"
          min={min}
          max={max}
          disabled={disabled}
          value={rupees === 0 ? '' : rupees}
          onChange={handleRupeeChange}
          placeholder="0.00"
          className={`w-full h-11 pl-8 pr-3.5 rounded-lg border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent font-mono text-sm ${
            error ? 'border-danger focus-visible:ring-danger' : 'border-surface-border'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  );
};
