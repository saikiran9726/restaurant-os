import React from 'react';

export type DietType = 'veg' | 'nonveg';

export interface VegMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: DietType;
  size?: 'sm' | 'md' | 'lg';
}

export const VegMark: React.FC<VegMarkProps> = ({
  type,
  size = 'md',
  className = '',
  ...props
}) => {
  const isVeg = type === 'veg';

  const sizeClasses = {
    sm: 'w-4 h-4 p-[2px]',
    md: 'w-5 h-5 p-[3px]',
    lg: 'w-6 h-6 p-[3.5px]',
  };

  const label = isVeg ? 'Vegetarian' : 'Non-Vegetarian';

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-[3px] border-2 shrink-0 ${
        isVeg ? 'border-veg bg-veg-bg text-veg' : 'border-nonveg bg-nonveg-bg text-nonveg'
      } ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isVeg ? (
        // Round circle for vegetarian
        <span className="w-full h-full rounded-full bg-veg shrink-0" aria-hidden="true" />
      ) : (
        // Distinctive triangle for non-vegetarian (not color-only, compliant with food labelling)
        <svg viewBox="0 0 10 10" className="w-full h-full fill-nonveg shrink-0" aria-hidden="true">
          <polygon points="5,1 9.5,8.5 0.5,8.5" />
        </svg>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
};
