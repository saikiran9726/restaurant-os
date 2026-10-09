import React from 'react';
import { Crown, Shield, Award } from 'lucide-react';

interface TierBadgeProps {
  tier: string;
  multiplier?: number;
  earnMultiplier?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  multiplier,
  earnMultiplier,
  className = '',
  size = 'md',
}) => {
  const effectiveMultiplier = multiplier ?? earnMultiplier;
  const normalized = tier.toLowerCase();

  let colors = 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  let Icon = Shield;

  if (normalized.includes('gold')) {
    colors = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    Icon = Award;
  } else if (normalized.includes('platinum')) {
    colors = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    Icon = Crown;
  }

  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold select-none ${colors} ${
        isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
      aria-label={`${tier} tier loyalty`}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{tier}</span>
      {effectiveMultiplier && effectiveMultiplier > 1 && (
        <span className="opacity-75 font-mono text-[10px]">({effectiveMultiplier}x)</span>
      )}
    </span>
  );
};
