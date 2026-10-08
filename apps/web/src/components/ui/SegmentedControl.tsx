import React, { useRef } from 'react';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel = 'View switcher',
  className = '',
}: SegmentedControlProps<T>): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'p-0.5 text-caption',
    md: 'p-1 text-body',
    lg: 'p-1.5 text-subhead',
  };

  const itemSizeClasses = {
    sm: 'h-7 px-2.5 min-h-[28px]',
    md: 'h-9 px-3.5 min-h-[36px]',
    lg: 'h-12 px-5 min-h-[48px]', // Touch target >= 48px
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else {
      return;
    }

    e.preventDefault();
    const nextOption = options[nextIndex];
    if (nextOption) {
      onChange(nextOption.value);
      const buttons = containerRef.current?.querySelectorAll('button');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-lg bg-surface-elevated border border-surface-border select-none ${sizeClasses[size]} ${className}`}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            type="button"
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              itemSizeClasses[size]
            } ${
              isSelected
                ? 'bg-accent text-accent-foreground shadow-sm font-semibold'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-card'
            }`}
          >
            {opt.icon && <span className="inline-flex shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded-full text-xs font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-surface-border text-content-primary'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  selected = false,
  onRemove,
  size = 'md',
  icon,
  children,
  className = '',
  onClick,
  ...props
}) => {
  const sizeMap = {
    sm: 'text-caption px-2 py-0.5 gap-1.5 min-h-[28px]',
    md: 'text-body px-3 py-1 gap-2 min-h-[36px]',
    lg: 'text-subhead px-4 py-2 gap-2.5 min-h-[48px]', // Touch target >= 48px
  };

  const baseStyles = `inline-flex items-center rounded-full font-medium border transition-colors duration-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    sizeMap[size]
  } ${
    selected
      ? 'bg-accent text-accent-foreground border-accent'
      : 'bg-surface-card text-content-secondary border-surface-border hover:border-surface-border-strong hover:text-content-primary'
  } ${className}`;

  if (onRemove) {
    return (
      <span className={baseStyles}>
        {icon && <span className="shrink-0">{icon}</span>}
        <button
          type="button"
          onClick={onClick}
          className="focus-visible:outline-none focus-visible:underline"
        >
          {children}
        </button>
        <button
          type="button"
          aria-label="Remove item"
          onClick={onRemove}
          className="ml-1 -mr-1 hover:opacity-80 p-0.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={baseStyles}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
