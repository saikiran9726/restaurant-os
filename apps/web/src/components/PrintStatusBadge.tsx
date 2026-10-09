import React from 'react';
import { Printer, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface PrintStatusBadgeProps {
  status: 'queued' | 'printing' | 'printed' | 'failed';
  className?: string;
  onClick?: () => void;
}

export const PrintStatusBadge: React.FC<PrintStatusBadgeProps> = ({
  status,
  className = '',
  onClick,
}) => {
  const configs = {
    queued: {
      label: 'Queued',
      icon: <Printer className="w-3.5 h-3.5 text-blue-400" />,
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
    printing: {
      label: 'Printing…',
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />,
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    printed: {
      label: 'Printed ✓',
      icon: <Check className="w-3.5 h-3.5 text-emerald-400" />,
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    failed: {
      label: 'Print Failed',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 cursor-pointer hover:bg-rose-500/20',
    },
  }[status];

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${configs.bg} ${className}`}
    >
      {configs.icon}
      <span>{configs.label}</span>
    </span>
  );
};
