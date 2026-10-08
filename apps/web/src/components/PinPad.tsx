import React from 'react';
import { Delete } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

interface PinPadProps {
  pin: string;
  onChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({
  pin,
  onChange,
  onSubmit,
  maxLength = 4,
  disabled = false,
}) => {
  const reducedMotion = useReducedMotion();

  const handleDigit = (digit: string) => {
    if (disabled || pin.length >= maxLength) return;
    const nextPin = pin + digit;
    onChange(nextPin);

    // Haptic feedback if supported
    if (!reducedMotion && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // Ignore haptics errors
      }
    }

    // Auto-submit on reaching max length
    if (nextPin.length === maxLength) {
      onSubmit(nextPin);
    }
  };

  const handleDelete = () => {
    if (disabled || pin.length === 0) return;
    onChange(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-xs mx-auto select-none" role="group" aria-label="PIN entry pad">
      {/* Visual PIN Dots */}
      <div
        className="flex justify-center items-center gap-4 my-6"
        aria-label={`PIN entered: ${pin.length} of ${maxLength} digits`}
      >
        {Array.from({ length: maxLength }).map((_, idx) => (
          <div
            key={idx}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              idx < pin.length
                ? 'bg-accent border-accent scale-110'
                : 'border-surface-border bg-surface-elevated'
            }`}
          />
        ))}
      </div>

      {/* 3x4 Touch Grid */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(num)}
            className="h-16 text-2xl font-bold rounded-2xl bg-surface-card hover:bg-surface-elevated active:bg-accent/15 active:scale-95 border border-surface-border text-content-primary shadow-sm flex items-center justify-center transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={num}
          >
            {num}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleClear}
          className="h-16 text-sm font-semibold rounded-2xl bg-surface-card hover:bg-surface-elevated active:scale-95 border border-surface-border text-content-secondary shadow-sm flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Clear all digits"
        >
          Clear
        </button>

        {/* '0' Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-16 text-2xl font-bold rounded-2xl bg-surface-card hover:bg-surface-elevated active:bg-accent/15 active:scale-95 border border-surface-border text-content-primary shadow-sm flex items-center justify-center transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="0"
        >
          0
        </button>

        {/* Backspace / Delete Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-surface-card hover:bg-surface-elevated active:scale-95 border border-surface-border text-content-secondary shadow-sm flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Delete last digit"
        >
          <Delete className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
