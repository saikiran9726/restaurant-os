import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-all active:scale-[0.98] duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent shadow-sm',
      secondary:
        'bg-surface-elevated text-content-primary border border-surface-border hover:bg-surface-canvas focus-visible:ring-accent',
      outline:
        'border border-surface-border-strong text-content-primary bg-transparent hover:bg-surface-elevated focus-visible:ring-accent',
      ghost:
        'text-content-secondary hover:text-content-primary hover:bg-surface-elevated focus-visible:ring-accent',
      danger:
        'bg-danger text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-danger shadow-sm',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-caption gap-1.5 min-h-[32px]',
      md: 'h-10 px-4 text-body gap-2 min-h-[40px]',
      lg: 'h-12 px-5 text-subhead gap-2.5 min-h-[48px]', // Touch target >= 48px
      xl: 'h-14 px-6 text-title gap-3 min-h-[56px]', // Kitchen touch target
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'secondary',
      size = 'lg',
      isLoading = false,
      disabled,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const sizeMap: Record<NonNullable<IconButtonProps['size']>, string> = {
      sm: 'w-8 h-8 p-1 min-w-[32px] min-h-[32px]',
      md: 'w-10 h-10 p-2 min-w-[40px] min-h-[40px]',
      lg: 'w-12 h-12 p-3 min-w-[48px] min-h-[48px]', // 48px touch target
      xl: 'w-14 h-14 p-3.5 min-w-[56px] min-h-[56px]',
    };

    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
      secondary:
        'bg-surface-elevated text-content-primary border border-surface-border hover:bg-surface-canvas',
      outline: 'border border-surface-border-strong text-content-primary hover:bg-surface-elevated',
      ghost: 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated',
      danger: 'bg-danger text-white hover:bg-red-700',
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center rounded-md transition-all active:scale-95 duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeMap[size]} ${className}`}
        {...props}
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
