import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button.js';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  position?: 'bottom' | 'right';
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  position = 'bottom',
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles =
    position === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl animate-in slide-in-from-bottom duration-sheet'
      : 'inset-y-0 right-0 w-full max-w-md rounded-l-2xl animate-in slide-in-from-right duration-sheet';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
      aria-describedby={description ? 'sheet-description' : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        className={`relative z-10 flex flex-col bg-surface-card border border-surface-border p-6 shadow-2xl overflow-y-auto ${positionStyles} ${className}`}
      >
        <div className="flex items-start justify-between pb-4 border-b border-surface-border">
          <div>
            {title && (
              <h2 id="sheet-title" className="text-title font-bold text-content-primary">
                {title}
              </h2>
            )}
            {description && (
              <p id="sheet-description" className="text-caption text-content-secondary mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Close sheet" variant="ghost" size="md" onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="pt-4 flex-1">{children}</div>
      </div>
    </div>
  );
};

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className = '',
  size = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[size];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full ${sizeStyles} rounded-xl bg-surface-card border border-surface-border p-6 shadow-2xl transition-all ${className}`}
      >
        <div className="flex items-start justify-between pb-3">
          <div>
            <h3 id="dialog-title" className="text-title font-bold text-content-primary">
              {title}
            </h3>
            {description && (
              <p id="dialog-description" className="text-caption text-content-secondary mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Close dialog" variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="py-4">{children}</div>

        {footer && (
          <div className="pt-4 flex justify-end gap-3 border-t border-surface-border">{footer}</div>
        )}
      </div>
    </div>
  );
};
