import React from 'react';
import { Info } from 'lucide-react';

export interface EstimateBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const EstimateBadge: React.FC<EstimateBadgeProps> = ({ className = '', size = 'sm' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
      title="Management estimate based on sales, logged purchases, waste, and operating expenses. Not audited tax or legal advice."
    >
      <Info className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      <span>Management Estimate</span>
    </span>
  );
};
