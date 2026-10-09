import React from 'react';
import { AgeBadge } from './AgeBadge.js';
import { StatusPill } from './ui/StatusPill.js';
import { Button } from './ui/Button.js';
import { BellRing, Check, Eye, AlertCircle } from 'lucide-react';
import type { KitchenKot, KitchenItem, TextSize } from '../stores/useKitchenStore.js';

interface KotCardProps {
  kot: KitchenKot;
  textSize?: TextSize;
  onMarkSeen: (kotId: string) => void;
  onToggleItemDone: (kotId: string, itemId: string) => void;
  onMarkStatus: (kotId: string, status: 'new' | 'preparing' | 'ready' | 'served') => void;
}

export const KotCard: React.FC<KotCardProps> = ({
  kot,
  textSize = 'L',
  onMarkSeen,
  onToggleItemDone,
  onMarkStatus,
}) => {
  const isUpdated = kot.type === 'modified' || (kot.seenAt === null && kot.status === 'new');
  const allItemsDone = kot.items
    .filter((i: KitchenItem) => i.action !== 'cancel' && i.status !== 'cancelled')
    .every((i: KitchenItem) => i.status === 'done');

  // Text size scaling: M = normal, L = +25%, XL = +50%
  const sizeClasses = {
    M: {
      kotNum: 'text-2xl',
      itemQty: 'text-xl',
      itemName: 'text-base',
      itemRow: 'min-h-[52px]',
    },
    L: {
      kotNum: 'text-3xl',
      itemQty: 'text-2xl',
      itemName: 'text-lg',
      itemRow: 'min-h-[64px]',
    },
    XL: {
      kotNum: 'text-4xl',
      itemQty: 'text-3xl',
      itemName: 'text-xl',
      itemRow: 'min-h-[76px]',
    },
  }[textSize];

  return (
    <article
      className="rounded-2xl border-2 border-surface-border bg-surface-card flex flex-col justify-between shadow-xl overflow-hidden select-none transition-all duration-180 hover:border-surface-border-strong"
      role="region"
      aria-label={`KOT #${kot.kotNumber}`}
    >
      {/* Updated / Modified Alert Banner */}
      {kot.type === 'modified' && !kot.seenAt && (
        <div className="bg-amber-500 text-black px-4 py-2 font-black text-caption flex items-center justify-between">
          <div className="flex items-center gap-1.5 uppercase tracking-wider">
            <BellRing className="w-4 h-4 animate-bounce shrink-0" />
            <span>ORDER MODIFIED / UPDATED</span>
          </div>
          <button
            type="button"
            onClick={() => onMarkSeen(kot.id)}
            className="px-2.5 py-0.5 rounded bg-black text-amber-400 font-extrabold text-xs uppercase hover:bg-neutral-900"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Card Header */}
      <header
        onClick={() => kot.status === 'new' && onMarkSeen(kot.id)}
        className="p-4 bg-surface-elevated border-b-2 border-surface-border flex items-center justify-between cursor-pointer hover:bg-surface-elevated/80 transition-colors"
      >
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono font-black text-content-primary tracking-tight leading-none ${sizeClasses.kotNum}`}
            >
              #{kot.kotNumber}
            </span>
            <span className="font-extrabold text-title text-accent">
              {kot.tableLabel ? `T-${kot.tableLabel}` : 'Takeaway'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs uppercase font-extrabold px-1.5 py-0.2 rounded bg-surface-border text-content-secondary">
              {kot.type}
            </span>
            <span className="text-xs text-content-muted">
              {new Date(kot.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <AgeBadge createdAt={kot.createdAt} />
          <StatusPill status={kot.status} size="sm" />
        </div>
      </header>

      {/* Item Rows (Large >= 64px touch targets) */}
      <div className="p-3 flex-1 divide-y divide-surface-border/60">
        {kot.items.map((item: KitchenItem) => {
          const isCancelled = item.action === 'cancel' || item.status === 'cancelled';
          const isDone = item.status === 'done';
          const isNew = item.action === 'add' && kot.type !== 'new';

          return (
            <div
              key={item.id}
              onClick={() => !isCancelled && onToggleItemDone(kot.id, item.id)}
              className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                sizeClasses.itemRow
              } ${
                isCancelled
                  ? 'opacity-50 line-through bg-red-950/20 cursor-not-allowed'
                  : isDone
                    ? 'bg-emerald-950/30 text-emerald-300'
                    : 'hover:bg-surface-elevated active:bg-surface-elevated/60'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span
                  className={`font-mono font-black min-w-[36px] ${sizeClasses.itemQty} ${
                    isDone ? 'text-emerald-400' : 'text-accent'
                  }`}
                >
                  {item.qty}×
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-bold text-content-primary ${sizeClasses.itemName} ${
                        isDone ? 'line-through text-content-muted' : ''
                      }`}
                    >
                      {item.name}
                    </span>

                    {isNew && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        ＋NEW
                      </span>
                    )}

                    {isCancelled && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-red-500 text-white">
                        ✕ CANCELLED {item.cancelledReason ? `(${item.cancelledReason})` : ''}
                      </span>
                    )}

                    {isCancelled && isDone && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-black">
                        ALREADY MADE
                      </span>
                    )}
                  </div>

                  {/* Modifiers bold on 2nd line */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-caption font-bold text-content-secondary mt-0.5">
                      {item.modifiers.map((m: { name: string }) => m.name).join(' • ')}
                    </div>
                  )}

                  {/* Special Item Instruction boxed */}
                  {item.noteSnapshot && (
                    <div className="mt-1 text-xs px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 inline-block font-semibold">
                      Note: {item.noteSnapshot}
                    </div>
                  )}
                </div>
              </div>

              {/* Checkbox trigger button */}
              <button
                type="button"
                disabled={isCancelled}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleItemDone(kot.id, item.id);
                }}
                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                  isDone
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-surface-border bg-surface-card hover:border-accent text-transparent'
                }`}
                aria-label={`Mark ${item.name} done`}
              >
                <Check className={`w-6 h-6 stroke-[3] ${isDone ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Card Actions Footer */}
      <footer className="p-3 bg-surface-elevated border-t-2 border-surface-border flex items-center justify-between gap-3">
        {kot.status === 'new' ? (
          <Button
            variant="secondary"
            size="lg"
            className="w-full font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            onClick={() => onMarkSeen(kot.id)}
          >
            <Eye className="w-5 h-5" />
            <span>Start Preparing</span>
          </Button>
        ) : kot.status === 'ready' || allItemsDone ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2"
            onClick={() => onMarkStatus(kot.id, 'served')}
          >
            <Check className="w-5 h-5" />
            <span>Bump / Mark Served</span>
          </Button>
        ) : (
          <div className="flex items-center justify-between w-full text-caption text-content-muted font-bold px-1">
            <span>Tap items to complete</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkStatus(kot.id, 'ready')}
              className="text-emerald-400 font-extrabold hover:underline"
            >
              Mark All Ready
            </Button>
          </div>
        )}
      </footer>
    </article>
  );
};
