import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../stores/useAuthStore.js';
import { Sheet } from './ui/Overlay.js';
import { StatusPill } from './ui/StatusPill.js';
import { Clock, CheckCircle2, Utensils } from 'lucide-react';

interface KotHistorySheetProps {
  isOpen: boolean;
  orderId: string;
  tableLabel?: string;
  onClose: () => void;
}

export const KotHistorySheet: React.FC<KotHistorySheetProps> = ({
  isOpen,
  orderId,
  tableLabel,
  onClose,
}) => {
  const { data: kotsData, isLoading } = useQuery<{ kots: any[] }>({
    queryKey: ['order-kots', orderId],
    queryFn: () => apiFetch(`/kots?orderId=${orderId}`),
    enabled: isOpen && Boolean(orderId),
    refetchInterval: 5000,
  });

  const kots = kotsData?.kots || [];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={tableLabel ? `Table ${tableLabel} KOT History` : 'Order KOT History'}
      description={`Tracking ${kots.length} KOT tickets fired to kitchen`}
    >
      <div className="space-y-4 pt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-12 text-center text-content-muted">Loading KOT tickets...</div>
        ) : kots.length === 0 ? (
          <div className="py-12 text-center text-content-muted flex flex-col items-center">
            <Utensils className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-body font-semibold">No KOTs sent yet</p>
            <p className="text-caption">Send KOT from the cart to track preparation here</p>
          </div>
        ) : (
          kots.map((kot) => (
            <div
              key={kot.id}
              className="p-4 rounded-xl bg-surface-card border border-surface-border space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-surface-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-title text-content-primary">
                    KOT #{kot.kotNumber}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated text-content-secondary uppercase font-bold">
                    {kot.type}
                  </span>
                </div>

                <StatusPill
                  status={
                    kot.status === 'ready'
                      ? 'ready'
                      : kot.status === 'served'
                        ? 'ready'
                        : 'preparing'
                  }
                  label={kot.status.toUpperCase()}
                />
              </div>

              <div className="space-y-2">
                {kot.items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-caption">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-content-primary">{item.qty}x</span>
                      <span className="text-content-primary font-medium">{item.name}</span>
                      {item.action === 'cancel' && (
                        <span className="text-[10px] text-red-500 font-bold uppercase">
                          (Cancelled)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'done' ? (
                        <span className="text-emerald-500 flex items-center gap-1 font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className="text-red-500 text-xs">Cancelled</span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1 text-xs">
                          <Clock className="w-3.5 h-3.5" /> Prep
                        </span>
                      )}
                    </div>
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
