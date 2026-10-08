import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { VegMark, type DietType } from './VegMark.js';
import { Button } from './Button.js';

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  disabled?: boolean;
}

export const QtyStepper: React.FC<QtyStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  ariaLabel = 'Quantity',
  disabled = false,
}) => {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  const btnSize = {
    sm: 'w-8 h-8 min-w-[32px] min-h-[32px]',
    md: 'w-10 h-10 min-w-[40px] min-h-[40px]',
    lg: 'w-12 h-12 min-w-[48px] min-h-[48px]', // 48px touch target
  };

  const textClass = {
    sm: 'text-caption min-w-[24px]',
    md: 'text-body font-bold min-w-[32px]',
    lg: 'text-title font-bold min-w-[40px]',
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-lg bg-surface-elevated border border-surface-border p-0.5 select-none"
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={`inline-flex items-center justify-center rounded-md text-content-primary hover:bg-surface-canvas active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none ${btnSize[size]}`}
      >
        <Minus className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>

      <span aria-live="polite" className={`text-center font-mono ${textClass[size]}`}>
        {value}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={`inline-flex items-center justify-center rounded-md text-content-primary hover:bg-surface-canvas active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none ${btnSize[size]}`}
      >
        <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
};

export interface ItemCardProps {
  id: string;
  name: string;
  pricePaise: number;
  diet: DietType;
  category?: string;
  description?: string;
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  onAdd?: () => void;
  className?: string;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  name,
  pricePaise,
  diet,
  category,
  description,
  quantity = 0,
  onQuantityChange,
  onAdd,
  className = '',
}) => {
  return (
    <div
      className={`rounded-lg bg-surface-card border border-surface-border p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-surface-border-strong transition-colors ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <VegMark type={diet} size="sm" />
            <h3 className="font-semibold text-body text-content-primary line-clamp-1">{name}</h3>
          </div>
          {category && (
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-content-muted border border-surface-border uppercase font-medium">
              {category}
            </span>
          )}
        </div>

        {description && (
          <p className="text-caption text-content-secondary line-clamp-2">{description}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-border/50">
        <span className="font-bold text-subhead text-content-primary">
          {formatPaiseToRupeeString(pricePaise)}
        </span>

        {quantity > 0 && onQuantityChange ? (
          <QtyStepper
            value={quantity}
            onChange={onQuantityChange}
            size="sm"
            ariaLabel={`Quantity for ${name}`}
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAdd || (() => onQuantityChange?.(1))}
            aria-label={`Add ${name} to order`}
          >
            Add
          </Button>
        )}
      </div>
    </div>
  );
};
