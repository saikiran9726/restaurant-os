import React, { useState } from 'react';
import type { CustomerSegment } from '@restaurant-os/shared';
import { Sparkles, Repeat, Award, Crown, Moon, AlertTriangle, HelpCircle } from 'lucide-react';

interface SegmentBadgeProps {
  segment: CustomerSegment;
  reason?: string;
  className?: string;
}

export const SegmentBadge: React.FC<SegmentBadgeProps> = ({ segment, reason, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const configs: Record<CustomerSegment, { label: string; icon: React.ReactNode; bg: string }> = {
    new: {
      label: 'New',
      icon: <Sparkles className="w-3 h-3 text-emerald-400" />,
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    returning: {
      label: 'Returning',
      icon: <Repeat className="w-3 h-3 text-cyan-400" />,
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    },
    regular: {
      label: 'Regular',
      icon: <Award className="w-3 h-3 text-indigo-400" />,
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    },
    high_value: {
      label: 'High Value',
      icon: <Crown className="w-3 h-3 text-amber-400" />,
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    inactive: {
      label: 'Inactive',
      icon: <Moon className="w-3 h-3 text-zinc-400" />,
      bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    },
    at_risk: {
      label: 'At Risk',
      icon: <AlertTriangle className="w-3 h-3 text-rose-400" />,
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    },
  };

  const current = configs[segment] || configs.new;

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-pointer select-none transition-all ${current.bg} ${className}`}
      >
        {current.icon}
        <span>{current.label}</span>
        {reason && <HelpCircle className="w-3 h-3 opacity-60 ml-0.5" />}
      </span>

      {/* Tooltip explaining why this customer was classified into this segment */}
      {showTooltip && reason && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 p-2 rounded-xl bg-zinc-950 border border-surface-border text-[11px] text-zinc-200 shadow-2xl leading-snug text-center pointer-events-none animate-fade-in">
          <div className="font-bold text-white mb-0.5">{current.label} Segment</div>
          <div className="text-zinc-400">{reason}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950" />
        </div>
      )}
    </div>
  );
};
