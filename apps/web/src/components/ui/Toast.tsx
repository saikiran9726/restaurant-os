import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../../stores/useToastStore.js';

const toastIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertOctagon,
};

const toastColors = {
  info: 'bg-surface-elevated text-blue-500 border-blue-500/30',
  success: 'bg-surface-elevated text-emerald-500 border-emerald-500/30',
  warning: 'bg-surface-elevated text-amber-500 border-amber-500/30',
  danger: 'bg-surface-elevated text-red-500 border-red-500/30',
};

export const ToastEntry: React.FC<{ toast: ToastItem }> = ({ toast }) => {
  const { removeToast } = useToastStore();
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.durationMs ?? 3000);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
    } else {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(
        () => {
          removeToast(toast.id);
        },
        Math.max(remainingTimeRef.current, 500),
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.id, removeToast]);

  const Icon = toastIcons[toast.type || 'info'];
  const colorClass = toastColors[toast.type || 'info'];

  return (
    <div
      role="status"
      aria-live="polite"
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={`flex items-center justify-between gap-3 p-4 rounded-xl border shadow-xl transition-all duration-toast select-none ${colorClass}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span className="text-body font-medium text-content-primary">{toast.message}</span>
      </div>

      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="text-content-muted hover:text-content-primary p-1 rounded transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-auto"
    >
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} />
      ))}
    </aside>
  );
};
