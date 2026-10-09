import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useKitchenStore, type KitchenKot } from '../../stores/useKitchenStore.js';
import { KotCard } from '../../components/KotCard.js';
import { KotRow } from '../../components/KotRow.js';
import { OosSheet } from '../../components/OosSheet.js';
import { RecentlyServedDrawer } from '../../components/RecentlyServedDrawer.js';
import { SegmentedControl } from '../../components/ui/SegmentedControl.js';
import { Skeleton } from '../../components/ui/UtilityComponents.js';
import { AlertTriangle, CheckCircle2, ChefHat, Flame, Clock, Sparkles, Layers } from 'lucide-react';

export const KitchenHome: React.FC = () => {
  const {
    kots,
    recentlyServed,
    rushMode,
    textSize,
    isLoading,
    criticalThresholdMinutes,
    fetchKitchenState,
    markKotSeen,
    toggleItemDone,
    setKotStatus,
    isOosOpen,
    isRecentlyServedOpen,
    setOosOpen,
    setRecentlyServedOpen,
    requestWakeLock,
  } = useKitchenStore();

  const [selectedKotId, setSelectedKotId] = useState<string | null>(null);
  const [rushFilter, setRushFilter] = useState<'all' | 'new' | 'preparing' | 'ready'>('all');

  // Initial load and screen wake lock
  useEffect(() => {
    fetchKitchenState();
    requestWakeLock();
  }, [fetchKitchenState, requestWakeLock]);

  // Periodic poll fallback every 15 seconds to ensure sync if socket disconnects
  useEffect(() => {
    const interval = setInterval(() => {
      fetchKitchenState();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchKitchenState]);

  // Helper to calculate elapsed minutes
  const getElapsedMinutes = useCallback((createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }, []);

  // Sort helper: Overdue pinned to top, followed by oldest first
  const sortKots = useCallback(
    (list: KitchenKot[]) => {
      return [...list].sort((a, b) => {
        const aOverdue = getElapsedMinutes(a.createdAt) >= criticalThresholdMinutes;
        const bOverdue = getElapsedMinutes(b.createdAt) >= criticalThresholdMinutes;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
    [getElapsedMinutes, criticalThresholdMinutes],
  );

  // Group active KOTs into columns
  const newKots = useMemo(() => sortKots(kots.filter((k) => k.status === 'new')), [kots, sortKots]);

  const preparingKots = useMemo(
    () => sortKots(kots.filter((k) => k.status === 'preparing')),
    [kots, sortKots],
  );

  const readyKots = useMemo(
    () => sortKots(kots.filter((k) => k.status === 'ready')),
    [kots, sortKots],
  );

  // Filtered list for Rush Mode
  const rushKots = useMemo(() => {
    let filtered = kots.filter((k) => k.status !== 'served' && k.status !== 'cancelled');
    if (rushFilter !== 'all') {
      filtered = filtered.filter((k) => k.status === rushFilter);
    }
    return sortKots(filtered);
  }, [kots, rushFilter, sortKots]);

  // All ordered visible KOTs for keyboard navigation
  const visibleKots = useMemo(() => {
    if (rushMode) return rushKots;
    return [...newKots, ...preparingKots, ...readyKots];
  }, [rushMode, rushKots, newKots, preparingKots, readyKots]);

  // Sync selected ID if selected card disappears
  useEffect(() => {
    if (visibleKots.length === 0) {
      setSelectedKotId(null);
    } else if (!selectedKotId || !visibleKots.some((k) => k.id === selectedKotId)) {
      setSelectedKotId(visibleKots[0]?.id ?? null);
    }
  }, [visibleKots, selectedKotId]);

  // Keyboard navigation (J / K / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or sheet
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || isOosOpen || isRecentlyServedOpen) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (visibleKots.length === 0) return;
        const currentIndex = visibleKots.findIndex((k) => k.id === selectedKotId);
        const nextIndex = currentIndex < visibleKots.length - 1 ? currentIndex + 1 : 0;
        const target = visibleKots[nextIndex];
        if (target) setSelectedKotId(target.id);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (visibleKots.length === 0) return;
        const currentIndex = visibleKots.findIndex((k) => k.id === selectedKotId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleKots.length - 1;
        const target = visibleKots[prevIndex];
        if (target) setSelectedKotId(target.id);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (!selectedKotId) return;
        const current = visibleKots.find((k) => k.id === selectedKotId);
        if (!current) return;

        if (current.status === 'new') {
          markKotSeen(current.id);
        } else if (current.status === 'preparing') {
          // Toggle first incomplete item
          const firstIncomplete = current.items.find(
            (i) => i.action !== 'cancel' && i.status !== 'cancelled' && i.status !== 'done',
          );
          if (firstIncomplete) {
            toggleItemDone(current.id, firstIncomplete.id);
          } else {
            setKotStatus(current.id, 'ready');
          }
        } else if (current.status === 'ready') {
          setKotStatus(current.id, 'served');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    visibleKots,
    selectedKotId,
    isOosOpen,
    isRecentlyServedOpen,
    markKotSeen,
    toggleItemDone,
    setKotStatus,
  ]);

  if (isLoading && kots.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((col) => (
            <div key={col} className="space-y-4">
              <Skeleton className="h-12 w-full rounded-xl bg-surface-elevated" />
              <Skeleton className="h-64 w-full rounded-2xl bg-surface-elevated" />
              <Skeleton className="h-64 w-full rounded-2xl bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rush Mode Banner */}
      {rushMode && (
        <div
          role="alert"
          className="rounded-2xl bg-gradient-to-r from-red-900/60 via-red-950/80 to-surface-card border-2 border-red-500 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-2xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-600/30 border border-red-500/50">
              <AlertTriangle className="w-7 h-7 text-red-400 animate-pulse shrink-0" />
            </div>
            <div>
              <span className="text-title font-black uppercase tracking-wider block">
                Rush Mode Priority Display
              </span>
              <span className="text-body text-red-200">
                Dense high-density layout enabled (up to 14 rows glanceable). Fast-track batch
                preparation.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SegmentedControl
              value={rushFilter}
              onChange={(val) => setRushFilter(val as typeof rushFilter)}
              options={[
                { value: 'all', label: `All (${kots.length})` },
                { value: 'new', label: `New (${newKots.length})` },
                { value: 'preparing', label: `Prep (${preparingKots.length})` },
                { value: 'ready', label: `Ready (${readyKots.length})` },
              ]}
              size="md"
            />
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="hidden lg:flex items-center justify-between px-4 py-2 rounded-xl bg-surface-elevated/60 border border-surface-border text-xs text-content-muted font-mono select-none">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-content-primary font-bold">
              J
            </kbd>{' '}
            Next Ticket
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-content-primary font-bold">
              K
            </kbd>{' '}
            Prev Ticket
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-content-primary font-bold">
              Space
            </kbd>{' '}
            Advance / Bump Selected
          </span>
        </div>
        <div className="flex items-center gap-2 text-content-secondary">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span>Overdue items pinned to top</span>
        </div>
      </div>

      {/* Main Board View: 3 Columns OR Rush Mode Dense List */}
      {rushMode ? (
        /* Rush Mode Dense Single-Line Rows */
        <div className="space-y-2">
          {rushKots.length === 0 ? (
            <div className="py-24 text-center rounded-2xl border-2 border-dashed border-surface-border bg-surface-card/50">
              <ChefHat className="w-16 h-16 mx-auto text-content-muted mb-4 opacity-40" />
              <h3 className="text-headline font-black text-content-primary uppercase">
                All Orders Cleared
              </h3>
              <p className="text-body text-content-muted mt-1">
                No active kitchen tickets in this view.
              </p>
            </div>
          ) : (
            rushKots.map((kot) => (
              <div
                key={kot.id}
                onClick={() => setSelectedKotId(kot.id)}
                className={`transition-all ${
                  selectedKotId === kot.id ? 'ring-2 ring-accent rounded-xl' : ''
                }`}
              >
                <KotRow
                  kot={kot}
                  textSize={textSize}
                  onMarkSeen={markKotSeen}
                  onToggleItemDone={toggleItemDone}
                  onMarkStatus={setKotStatus}
                />
              </div>
            ))
          )}
        </div>
      ) : (
        /* Standard 3-Column Board: NEW | PREPARING | READY */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1: NEW */}
          <section
            className="flex flex-col rounded-2xl bg-surface-elevated/40 border-2 border-surface-border p-4 space-y-4"
            aria-label="New KOTs"
          >
            <div className="flex items-center justify-between border-b-2 border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                <h2 className="text-title font-black uppercase tracking-wider text-content-primary">
                  New Orders
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-black text-body">
                {newKots.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[300px]">
              {newKots.length === 0 ? (
                <div className="py-16 text-center text-content-muted select-none">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-400" />
                  <p className="text-body font-bold">No new orders waiting</p>
                </div>
              ) : (
                newKots.map((kot) => {
                  const isOverdue = getElapsedMinutes(kot.createdAt) >= criticalThresholdMinutes;
                  return (
                    <div
                      key={kot.id}
                      onClick={() => setSelectedKotId(kot.id)}
                      className={`transition-all ${
                        selectedKotId === kot.id ? 'ring-4 ring-accent rounded-2xl' : ''
                      } ${isOverdue ? 'border-2 border-red-500 rounded-2xl' : ''}`}
                    >
                      <KotCard
                        kot={kot}
                        textSize={textSize}
                        onMarkSeen={markKotSeen}
                        onToggleItemDone={toggleItemDone}
                        onMarkStatus={setKotStatus}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Column 2: PREPARING */}
          <section
            className="flex flex-col rounded-2xl bg-surface-elevated/40 border-2 border-surface-border p-4 space-y-4"
            aria-label="Preparing KOTs"
          >
            <div className="flex items-center justify-between border-b-2 border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                <h2 className="text-title font-black uppercase tracking-wider text-content-primary">
                  Preparing
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-black text-body">
                {preparingKots.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[300px]">
              {preparingKots.length === 0 ? (
                <div className="py-16 text-center text-content-muted select-none">
                  <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
                  <p className="text-body font-bold">Station clear</p>
                </div>
              ) : (
                preparingKots.map((kot) => {
                  const isOverdue = getElapsedMinutes(kot.createdAt) >= criticalThresholdMinutes;
                  return (
                    <div
                      key={kot.id}
                      onClick={() => setSelectedKotId(kot.id)}
                      className={`transition-all ${
                        selectedKotId === kot.id ? 'ring-4 ring-accent rounded-2xl' : ''
                      } ${isOverdue ? 'border-2 border-red-500 rounded-2xl' : ''}`}
                    >
                      <KotCard
                        kot={kot}
                        textSize={textSize}
                        onMarkSeen={markKotSeen}
                        onToggleItemDone={toggleItemDone}
                        onMarkStatus={setKotStatus}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Column 3: READY */}
          <section
            className="flex flex-col rounded-2xl bg-surface-elevated/40 border-2 border-surface-border p-4 space-y-4"
            aria-label="Ready KOTs"
          >
            <div className="flex items-center justify-between border-b-2 border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <h2 className="text-title font-black uppercase tracking-wider text-content-primary">
                  Ready to Serve
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-black text-body">
                {readyKots.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[300px]">
              {readyKots.length === 0 ? (
                <div className="py-16 text-center text-content-muted select-none">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
                  <p className="text-body font-bold">No orders waiting pickup</p>
                </div>
              ) : (
                readyKots.map((kot) => {
                  const isOverdue = getElapsedMinutes(kot.createdAt) >= criticalThresholdMinutes;
                  return (
                    <div
                      key={kot.id}
                      onClick={() => setSelectedKotId(kot.id)}
                      className={`transition-all ${
                        selectedKotId === kot.id ? 'ring-4 ring-accent rounded-2xl' : ''
                      } ${isOverdue ? 'border-2 border-red-500 rounded-2xl' : ''}`}
                    >
                      <KotCard
                        kot={kot}
                        textSize={textSize}
                        onMarkSeen={markKotSeen}
                        onToggleItemDone={toggleItemDone}
                        onMarkStatus={setKotStatus}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* 86 List (Out of stock) Drawer */}
      <OosSheet isOpen={isOosOpen} onClose={() => setOosOpen(false)} />

      {/* Recently Served History Drawer */}
      <RecentlyServedDrawer
        isOpen={isRecentlyServedOpen}
        kots={recentlyServed}
        onClose={() => setRecentlyServedOpen(false)}
      />
    </div>
  );
};
