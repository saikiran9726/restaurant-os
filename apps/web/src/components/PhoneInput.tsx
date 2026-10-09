import React from 'react';
import { Phone, X } from 'lucide-react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = '98765 43210',
  autoFocus = false,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits
    const raw = e.target.value.replace(/\D/g, '');
    // Limit to 10 digits
    const truncated = raw.slice(0, 10);
    onChange(truncated);
  };

  const formattedDisplay = () => {
    if (value.length <= 5) return value;
    return `${value.slice(0, 5)} ${value.slice(5)}`;
  };

  return (
    <div
      className={`relative flex items-center rounded-xl bg-surface-subtle border border-surface-border focus-within:border-primary transition-colors ${className}`}
    >
      {/* Prefix Badge */}
      <div className="flex items-center gap-1 px-3 py-2 border-r border-surface-border text-xs font-bold text-content-secondary select-none">
        <Phone className="w-3.5 h-3.5 text-primary" />
        <span>+91</span>
      </div>

      {/* Digits Input */}
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={11}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={formattedDisplay()}
        onChange={handleChange}
        className="w-full px-3 py-2.5 bg-transparent text-content-primary text-base font-mono font-bold tracking-wider placeholder:text-content-muted placeholder:font-normal focus:outline-none"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="p-2 text-content-muted hover:text-content-primary"
          aria-label="Clear phone"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
