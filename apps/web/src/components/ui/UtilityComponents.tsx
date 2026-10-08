import React from 'react';
import { Wifi, WifiOff, RefreshCw, Check } from 'lucide-react';
import { Button } from './Button.js';

export type BannerVariant = 'offline' | 'online' | 'sync' | 'warning';

export interface BannerProps {
  variant?: BannerVariant;
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'offline',
  message,
  actionText,
  onAction,
  className = '',
}) => {
  const variantStyles: Record<BannerVariant, { bg: string; icon: React.ReactNode; text: string }> =
    {
      offline: {
        bg: 'bg-red-600 text-white',
        icon: <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />,
        text: 'text-white',
      },
      online: {
        bg: 'bg-emerald-600 text-white',
        icon: <Wifi className="w-4 h-4 shrink-0" aria-hidden="true" />,
        text: 'text-white',
      },
      sync: {
        bg: 'bg-blue-600 text-white',
        icon: <RefreshCw className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />,
        text: 'text-white',
      },
      warning: {
        bg: 'bg-amber-600 text-white',
        icon: <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />,
        text: 'text-white',
      },
    };

  const current = variantStyles[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-2 px-4 flex items-center justify-between text-caption font-semibold select-none shadow-md ${current.bg} ${className}`}
    >
      <div className="flex items-center gap-2 mx-auto">
        {current.icon}
        <span>{message}</span>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="ml-3 underline hover:no-underline font-bold text-white text-xs"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-surface-border bg-surface-canvas/50 ${className}`}
    >
      {icon && (
        <div className="p-4 rounded-full bg-surface-elevated text-content-muted mb-4">{icon}</div>
      )}
      <h3 className="text-subhead font-bold text-content-primary mb-1">{title}</h3>
      {description && (
        <p className="text-caption text-content-secondary max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      role="status"
      aria-label="Loading..."
      className={`animate-pulse bg-surface-border/60 ${variantClasses[variant]} ${className}`}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        ...style,
      }}
      {...props}
    >
      <span className="sr-only">Loading content...</span>
    </div>
  );
};

export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isUpcoming = idx > currentStep;

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${idx !== steps.length - 1 ? "pr-8 sm:pr-12 after:content-[''] after:absolute after:top-4 after:left-1/2 after:w-full after:h-0.5 after:bg-surface-border after:-z-10" : ''}`}
            >
              <button
                type="button"
                disabled={!onStepClick || isUpcoming}
                onClick={() => onStepClick?.(idx)}
                className="flex items-center gap-2 group text-left focus-visible:outline-none focus-visible:underline disabled:cursor-default"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-caption transition-colors ${
                    isCompleted
                      ? 'bg-accent text-accent-foreground'
                      : isCurrent
                        ? 'border-2 border-accent text-accent bg-surface-card'
                        : 'bg-surface-elevated text-content-muted border border-surface-border'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="hidden sm:inline-block">
                  <span
                    className={`block text-caption font-semibold ${
                      isCurrent
                        ? 'text-accent'
                        : isCompleted
                          ? 'text-content-primary'
                          : 'text-content-muted'
                    }`}
                  >
                    {step.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
