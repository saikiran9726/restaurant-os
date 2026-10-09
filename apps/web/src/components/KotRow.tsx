import React, { useState } from 'react';
import { AgeBadge } from './AgeBadge.js';
import { StatusPill } from './ui/StatusPill.js';
import { Button } from './ui/Button.js';
import { ChevronDown, ChevronUp, Check, Eye, BellRing } from 'lucide-react';
import type { KitchenKot, KitchenItem, TextSize } from '../stores/useKitchenStore.js';

interface KotRowProps {
  kot: KitchenKot;
  textSize?: TextSize;
  onMarkSeen: (kotId: string) => void;
  onToggleItemDone: (kotId: string, itemId: string) => void;
  onMarkStatus: (kotId: string, status: 'new' | 'preparing' | 'ready' | 'served') => void;
}

export const KotRow: React.FC<KotRowProps> = ({
  kot,
  textSize = 'L',
  onMarkSeen,
  onToggleItemDone,
  onMarkStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeItems = kot.items.filter((i) => i.action !== 'cancel' && i.status !== 'cancelled');
  const allItemsDone = activeItems.length > 0 && activeItems.every((i) => i.status === 'done');
  const totalItemCount = activeItems.reduce((acc, i) => acc + i.qty, 0);

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        isExpanded
          ? 'bg-surface-card border-accent shadow-xl'
          : 'bg-surface-elevated/70 border-surface-border hover:border-surface-border-strong hover:bg-surface-elevated'
      }`}
    >
      {/* Rush Mode Dense Row Header - Max 52px height for 14 rows on 1080p */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="px-4 py-2.5 flex items-center justify-between gap-4 cursor-pointer select-none min-h-[50px]"
      >
        {/* Left: KOT Number & Table */}
        <div className="flex items-center gap-3 min-w-[160px]">
          <span className="font-mono font-black text-xl text-content-primary tracking-tight">
            #{kot.kotNumber}
          </span>
          <span className="font-extrabold text-title text-accent">
            {kot.tableLabel ? `T-${kot.tableLabel}` : 'Takeaway'}
          </span>
          {kot.type === 'modified' && !kot.seenAt && (
            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-black animate-pulse">
              UPDATED
            </span>
          )}
        </div>

        {/* Center: Elapsed Timer & Item summary */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          <AgeBadge createdAt={kot.createdAt} />
          <span className="font-mono font-bold text-caption text-content-secondary hidden sm:inline">
            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Right: Status Pill & Accordion chevron */}
        <div className="flex items-center gap-3 min-w-[140px] justify-end">
          <StatusPill status={kot.status} size="sm" />
          <span className="text-content-muted p-1">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </span>
        </div>
      </div>

      {/* Expanded Inline Details */}
      {isExpanded && (
        <div className="border-t-2 border-surface-border bg-surface-card p-4 space-y-4">
          {/* Modified Alert Notice */}
          {kot.type === 'modified' && !kot.seenAt && (
            <div className="bg-amber-500 text-black px-3 py-1.5 rounded-lg font-black text-caption flex items-center justify-between">
              <div className="flex items-center gap-1.5 uppercase tracking-wider">
                <BellRing className="w-4 h-4 shrink-0" />
                <span>ORDER MODIFIED / UPDATED</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkSeen(kot.id);
                }}
                className="px-2 py-0.5 rounded bg-black text-amber-400 font-extrabold text-xs uppercase hover:bg-neutral-900"
              >
                Acknowledge
              </button>
            </div>
          )}

          {/* Item Checklist (>= 64px touch targets) */}
          <div className="divide-y divide-surface-border/60">
            {kot.items.map((item: KitchenItem) => {
              const isCancelled = item.action === 'cancel' || item.status === 'cancelled';
              const isDone = item.status === 'done';
              const isNew = item.action === 'add' && kot.type !== 'new';

              return (
                <div
                  key={item.id}
                  onClick={() => !isCancelled && onToggleItemDone(kot.id, item.id)}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer min-h-[64px] transition-colors ${
                    isCancelled
                      ? 'opacity-50 line-through bg-red-950/20 cursor-not-allowed'
                      : isDone
                        ? 'bg-emerald-950/30 text-emerald-300'
                        : 'hover:bg-surface-elevated active:bg-surface-elevated/60'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={`font-mono font-black text-2xl min-w-[36px] ${
                        isDone ? 'text-emerald-400' : 'text-accent'
                      }`}
                    >
                      {item.qty}×
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-lg text-content-primary ${
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

                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-caption font-bold text-content-secondary mt-0.5">
                          {item.modifiers.map((m: { name: string }) => m.name).join(' • ')}
                        </div>
                      )}

                      {item.noteSnapshot && (
                        <div className="mt-1 text-xs px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 inline-block font-semibold">
                          Note: {item.noteSnapshot}
                        </div>
                      )}
                    </div>
                  </div>

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
                    <Check
                      className={`w-6 h-6 stroke-[3] ${isDone ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-end gap-3">
            {kot.status === 'new' ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => onMarkSeen(kot.id)}
                leftIcon={<Eye className="w-4 h-4" />}
                className="font-bold uppercase tracking-wider"
              >
                Start Preparing
              </Button>
            ) : kot.status === 'ready' || allItemsDone ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => onMarkStatus(kot.id, 'served')}
                leftIcon={<Check className="w-4 h-4" />}
                className="font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Bump / Mark Served
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onClick={() => onMarkStatus(kot.id, 'ready')}
                className="font-bold text-emerald-400"
              >
                Mark Ready
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
