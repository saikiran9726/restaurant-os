import React from 'react';
import { Roles } from '@restaurant-os/shared';
import { ShieldCheck, Utensils, ChefHat, Users } from 'lucide-react';

interface RoleBadgeProps {
  role: string;
  size?: 'sm' | 'md';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md' }) => {
  const normalized = role.toUpperCase();

  let colorClasses = 'bg-surface-elevated text-content-secondary border-surface-border';
  let Icon = Users;

  if (normalized === Roles.OWNER) {
    colorClasses = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    Icon = ShieldCheck;
  } else if (normalized === Roles.WAITER) {
    colorClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    Icon = Utensils;
  } else if (normalized === Roles.KITCHEN) {
    colorClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    Icon = ChefHat;
  } else if (normalized === Roles.MANAGER) {
    colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    Icon = ShieldCheck;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-caption';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-md border ${sizeClasses} ${colorClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      <span>{normalized}</span>
    </span>
  );
};
