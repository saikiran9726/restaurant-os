import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface ChipInputProps {
  label?: string;
  placeholder?: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  helperText?: string;
}

export const ChipInput: React.FC<ChipInputProps> = ({
  label = 'Search Aliases',
  placeholder = 'Type alias and press Enter or comma',
  chips,
  onChange,
  helperText = 'Common abbreviations, misspellings, or regional terms (e.g., "pbm", "butter chicken")',
}) => {
  const [inputValue, setInputValue] = useState('');

  const addChip = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && !chips.map((c) => c.toLowerCase()).includes(trimmed)) {
      onChange([...chips, trimmed]);
    }
    setInputValue('');
  };

  const removeChip = (indexToRemove: number) => {
    onChange(chips.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-caption font-semibold text-content-secondary">{label}</label>
      )}

      <div className="min-h-11 p-2 rounded-lg border border-surface-border bg-surface-elevated flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
        {chips.map((chip, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-semibold"
          >
            <span>{chip}</span>
            <button
              type="button"
              onClick={() => removeChip(idx)}
              className="p-0.5 rounded-full hover:bg-accent/20 text-accent focus-visible:outline-none"
              aria-label={`Remove alias ${chip}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="flex-1 min-w-[140px] flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addChip(inputValue);
            }}
            placeholder={chips.length === 0 ? placeholder : 'Add another...'}
            className="w-full bg-transparent text-content-primary text-sm focus:outline-none px-1"
          />
        </div>
      </div>

      {helperText && <p className="text-xs text-content-muted">{helperText}</p>}
    </div>
  );
};
