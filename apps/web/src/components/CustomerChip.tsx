import React, { useState } from 'react';
import { useCartStore } from '../stores/useCartStore.js';
import { CustomerSheet } from './CustomerSheet.js';
import { User, UserCheck, Tag, Plus } from 'lucide-react';

interface CustomerChipProps {
  className?: string;
}

export const CustomerChip: React.FC<CustomerChipProps> = ({ className = '' }) => {
  const { customerId, customerName, customerPhone, customerPreferences } = useCartStore();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const displayPhone = customerPhone ? customerPhone.replace(/^\+91/, '') : '';
  const firstTag = customerPreferences?.tags?.[0];

  return (
    <>
      {customerId ? (
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all shadow-sm ${className}`}
          aria-label="Edit customer"
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate max-w-[120px]">{customerName || displayPhone}</span>
          {firstTag && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[10px] text-emerald-300">
              <Tag className="w-2.5 h-2.5" />
              {firstTag}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-subtle hover:bg-surface-elevated border border-surface-border text-content-secondary hover:text-content-primary text-xs font-bold transition-all ${className}`}
          aria-label="Add customer"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          <span>Add Customer</span>
        </button>
      )}

      <CustomerSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </>
  );
};
