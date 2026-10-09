import React from 'react';
import { Sheet } from './ui/Overlay.js';
import { StatusPill } from './ui/StatusPill.js';
import { Clock, CheckCircle } from 'lucide-react';
import type { KitchenKot } from '../stores/useKitchenStore.js';

interface RecentlyServedDrawerProps {
  isOpen: boolean;
  kots: KitchenKot[];
  onClose: () => void;
}

export const RecentlyServedDrawer: React.FC<RecentlyServedDrawerProps> = ({
  isOpen,
  kots,
  onClose,
}) => {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Recently Served Orders"
      description="Cleared and served KOT orders from the last 30 minutes."
    >
      <div className="space-y-4 pt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {kots.length === 0 ? (
          <div className="py-16 text-center text-content-muted">
            <CheckCircle className="w-10 h-10 mb-2 mx-auto opacity-30 text-emerald-400" />
            <p className="text-body font-semibold">No recently served orders</p>
            <p className="text-caption">Completed and served KOTs will be archived here</p>
          </div>
        ) : (
          kots.map((kot) => (
            <div
              key={kot.id}
              className="p-4 rounded-xl bg-surface-card border border-surface-border space-y-3 opacity-80"
            >
              <div className="flex items-center justify-between border-b border-surface-border pb-2">
                <div>
                  <span className="font-mono font-black text-title text-content-primary">
                    KOT #{kot.kotNumber}
                  </span>
                  <span className="text-caption text-content-secondary ml-2">
                    {kot.tableLabel ? `Table ${kot.tableLabel}` : 'Takeaway'}
                  </span>
                </div>
                <StatusPill status="ready" label="SERVED" />
              </div>

              <div className="space-y-1">
                {kot.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-caption">
                    <span className="text-content-secondary">
                      <strong className="text-content-primary mr-1.5">{item.qty}×</strong>
                      {item.name}
                    </span>
                    <span className="text-emerald-400 text-xs">Done</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
};
