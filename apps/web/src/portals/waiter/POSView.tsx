import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { localDb } from '../../db/dexie.js';
import { useCartStore } from '../../stores/useCartStore.js';
import { SegmentedControl } from '../../components/ui/SegmentedControl.js';
import { VegMark } from '../../components/ui/VegMark.js';
import { QtyStepper } from '../../components/ui/QtyStepper.js';
import { Button } from '../../components/ui/Button.js';
import { CartSheet } from './CartSheet.js';
import { KotHistorySheet } from '../../components/KotHistorySheet.js';
import { BillPreviewSheet } from './BillPreviewSheet.js';
import { CustomerChip } from '../../components/CustomerChip.js';
import {
  formatPaiseToRupeeString,
  type FrequentItemOutput,
  type RecentOrderOutput,
} from '@restaurant-os/shared';
import {
  Search,
  Flame,
  Sparkles,
  History,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

interface ModifierOption {
  id: string;
  name: string;
  priceDeltaPaise: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: ModifierOption[];
}

interface MenuItemData {
  id: string;
  categoryId: string;
  name: string;
  aliases: string[];
  isVeg: boolean;
  pricePaise: number;
  taxRateBp: number;
  available: boolean;
  modifierGroups?: ModifierGroup[];
}

interface CategoryData {
  id: string;
  name: string;
  sortOrder: number;
}

interface POSViewProps {
  onBackToTables: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onBackToTables }) => {
  const {
    items: cartItems,
    tableLabel,
    type,
    guests,
    addItem,
    updateItemQty,
    repeatOrder,
    getTotals,
  } = useCartStore();

  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON-VEG'>(() => {
    return (localStorage.getItem('waiter_pos_diet_filter') as any) || 'ALL';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [isKotHistoryOpen, setIsKotHistoryOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [activeModItem, setActiveModItem] = useState<MenuItemData | null>(null);
  const [selectedMods, setSelectedMods] = useState<ModifierOption[]>([]);

  // 120ms debounce for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Save diet filter choice
  const handleDietChange = (val: string) => {
    setDietFilter(val as any);
    localStorage.setItem('waiter_pos_diet_filter', val);
  };

  // Queries
  const { data: menuData, isLoading: isMenuLoading } = useQuery<{
    categories: CategoryData[];
    items: MenuItemData[];
  }>({
    queryKey: ['waiter-menu'],
    queryFn: async () => {
      try {
        const res = await apiFetch<any>('/menu');
        // Cache to dexie
        if (res.categories) await localDb.categories.bulkPut(res.categories);
        if (res.items) await localDb.menu.bulkPut(res.items);
        return res;
      } catch (err) {
        // Fallback to local Dexie
        const cachedCategories = await localDb.categories.toArray();
        const cachedItems = await localDb.menu.toArray();
        return { categories: cachedCategories as any, items: cachedItems as any };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: frequentItems = [] } = useQuery<FrequentItemOutput[]>({
    queryKey: ['frequent-items'],
    queryFn: () => apiFetch('/menu/frequent'),
    staleTime: 60 * 1000,
  });

  const { data: popularToday = [] } = useQuery<FrequentItemOutput[]>({
    queryKey: ['popular-today'],
    queryFn: () => apiFetch('/menu/popular-today'),
    staleTime: 60 * 1000,
  });

  const { data: recentOrders = [] } = useQuery<RecentOrderOutput[]>({
    queryKey: ['recent-orders'],
    queryFn: () => apiFetch('/orders/recent'),
    staleTime: 30 * 1000,
  });

  const categories = menuData?.categories || [];
  const allItems = menuData?.items || [];

  // Client-side instant filter: Diet + Category + Search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Diet filter
      if (dietFilter === 'VEG' && !item.isVeg) return false;
      if (dietFilter === 'NON-VEG' && item.isVeg) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) return false;

      // Search query (names & aliases)
      if (debouncedQuery) {
        const q = debouncedQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const aliasMatch = (item.aliases || []).some((a) => a.toLowerCase().includes(q));
        if (!nameMatch && !aliasMatch) return false;
      }

      return true;
    });
  }, [allItems, dietFilter, selectedCategory, debouncedQuery]);

  // Compute item count map in cart for quick QtyStepper rendering
  const itemQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cartItems) {
      map.set(c.itemId, (map.get(c.itemId) || 0) + c.qty);
    }
    return map;
  }, [cartItems]);

  const totals = getTotals();
  const totalCartQty = cartItems.reduce((sum, i) => sum + i.qty, 0);

  const handleItemClick = (item: MenuItemData) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setActiveModItem(item);
      setSelectedMods([]);
      return;
    }
    addItem({
      itemId: item.id,
      name: item.name,
      isVeg: item.isVeg,
      pricePaise: item.pricePaise,
      taxRateBp: item.taxRateBp,
    });
  };

  const handleConfirmModifiers = () => {
    if (!activeModItem) return;
    addItem({
      itemId: activeModItem.id,
      name: activeModItem.name,
      isVeg: activeModItem.isVeg,
      pricePaise: activeModItem.pricePaise,
      taxRateBp: activeModItem.taxRateBp,
      modifiers: selectedMods,
    });
    setActiveModItem(null);
    setSelectedMods([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header / Context bar */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBackToTables} className="px-2">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="hidden sm:inline">Tables</span>
          </Button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-title text-content-primary">
                {type === 'dine_in' ? `Table ${tableLabel || '—'}` : 'Takeaway'}
              </span>
              {type === 'dine_in' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-content-secondary font-medium">
                  {guests} Guests
                </span>
              )}
              <CustomerChip />
            </div>
          </div>
        </div>

        {/* Tablet Cart Summary Button */}
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCartSheetOpen(true)}
          className="relative flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Cart ({totalCartQty})</span>
          {totalCartQty > 0 && (
            <span className="font-mono ml-1 font-bold">
              • {formatPaiseToRupeeString(totals.totalPaise)}
            </span>
          )}
        </Button>
      </div>

      {/* Search & Diet Toggle Bar */}
      <div className="py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
        {/* Search input with 120ms debounce */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Search dish or alias (e.g. Biryani, Butter Chicken)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-body rounded-xl bg-surface-card border border-surface-border text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-muted hover:text-content-primary"
            >
              Clear
            </button>
          )}
        </div>

        {/* ALL / VEG / NON-VEG Segmented Control */}
        <SegmentedControl
          value={dietFilter}
          onChange={handleDietChange}
          options={[
            { value: 'ALL', label: 'ALL' },
            { value: 'VEG', label: 'VEG' },
            { value: 'NON-VEG', label: 'NON-VEG' },
          ]}
          size="md"
        />
      </div>

      {/* Main Content Layout (Menu on Left, Tablet Cart on Right if screen wide) */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left: Quick Rows + Categories + Menu Items */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {/* Quick Rows: Frequent Orders (hidden if empty) */}
          {!debouncedQuery && frequentItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-caption font-bold text-content-secondary uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Frequent Orders (Top 8)</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {frequentItems.map((fi) => {
                  const currentQty = itemQtyMap.get(fi.itemId) || 0;
                  return (
                    <button
                      key={fi.itemId}
                      type="button"
                      onClick={() => {
                        const original = allItems.find((i) => i.id === fi.itemId);
                        if (original) handleItemClick(original);
                      }}
                      className="shrink-0 flex items-center gap-2 p-2.5 rounded-xl bg-surface-card border border-surface-border hover:border-accent active:scale-95 transition-all text-left shadow-sm min-w-[150px]"
                    >
                      <VegMark type={fi.isVeg ? 'veg' : 'nonveg'} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-caption font-bold text-content-primary truncate">
                          {fi.name}
                        </p>
                        <p className="text-xs text-content-secondary font-mono">
                          {formatPaiseToRupeeString(fi.pricePaise)}
                        </p>
                      </div>
                      {currentQty > 0 && (
                        <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                          {currentQty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Rows: Popular Today (hidden if empty) */}
          {!debouncedQuery && popularToday.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-caption font-bold text-content-secondary uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Popular Today</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {popularToday.map((pt) => {
                  const currentQty = itemQtyMap.get(pt.itemId) || 0;
                  return (
                    <button
                      key={pt.itemId}
                      type="button"
                      onClick={() => {
                        const original = allItems.find((i) => i.id === pt.itemId);
                        if (original) handleItemClick(original);
                      }}
                      className="shrink-0 flex items-center gap-2 p-2.5 rounded-xl bg-surface-card border border-surface-border hover:border-accent active:scale-95 transition-all text-left shadow-sm min-w-[150px]"
                    >
                      <VegMark type={pt.isVeg ? 'veg' : 'nonveg'} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-caption font-bold text-content-primary truncate">
                          {pt.name}
                        </p>
                        <p className="text-xs text-content-secondary font-mono">
                          {formatPaiseToRupeeString(pt.pricePaise)}
                        </p>
                      </div>
                      {currentQty > 0 && (
                        <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                          {currentQty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Rows: Recent Orders with 1-tap reorder */}
          {!debouncedQuery && recentOrders.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-caption font-bold text-content-secondary uppercase tracking-wider">
                <History className="w-4 h-4 text-blue-500" />
                <span>Recent Orders (1-Tap Reorder)</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {recentOrders.slice(0, 5).map((ro) => (
                  <div
                    key={ro.id}
                    className="shrink-0 p-3 rounded-xl bg-surface-card border border-surface-border flex flex-col justify-between shadow-sm min-w-[200px]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-content-muted mb-1">
                        <span>{ro.tableLabel ? `T-${ro.tableLabel}` : 'Takeaway'}</span>
                        <span className="font-mono font-bold text-content-primary">
                          {formatPaiseToRupeeString(ro.totalPaise)}
                        </span>
                      </div>
                      <p className="text-caption text-content-secondary line-clamp-1 mb-2">
                        {ro.itemSummary}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => repeatOrder(ro)}
                      className="w-full text-xs"
                    >
                      Repeat Order
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Chips Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-caption shrink-0 transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-surface-card text-content-secondary border border-surface-border hover:bg-surface-elevated'
              }`}
            >
              All Items ({allItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-caption shrink-0 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'bg-surface-card text-content-secondary border border-surface-border hover:bg-surface-elevated'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-24 lg:pb-6">
            {filteredItems.map((item) => {
              const currentQty = itemQtyMap.get(item.id) || 0;
              const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;

              return (
                <div
                  key={item.id}
                  onClick={() => !currentQty && item.available && handleItemClick(item)}
                  className={`rounded-2xl border p-3.5 flex flex-col justify-between bg-surface-card hover:border-surface-border-strong transition-all shadow-sm select-none ${
                    !item.available
                      ? 'opacity-60 bg-surface-elevated/40 cursor-not-allowed border-dashed'
                      : !currentQty
                        ? 'cursor-pointer active:scale-[0.98]'
                        : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <VegMark type={item.isVeg ? 'veg' : 'nonveg'} size="sm" />
                        <h4 className="font-bold text-body text-content-primary line-clamp-1">
                          {item.name}
                        </h4>
                      </div>
                      {!item.available ? (
                        <span className="text-[10px] uppercase font-bold text-red-500 px-1.5 py-0.5 rounded bg-red-500/10 shrink-0">
                          Out of stock
                        </span>
                      ) : hasModifiers ? (
                        <span className="text-[10px] uppercase font-bold text-accent px-1.5 py-0.5 rounded bg-accent/10 shrink-0">
                          Custom
                        </span>
                      ) : null}
                    </div>

                    {item.aliases && item.aliases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.aliases.slice(0, 2).map((alias, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1 py-0.2 rounded bg-surface-elevated text-content-muted"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-border/50">
                    <span className="font-bold text-body text-content-primary">
                      {formatPaiseToRupeeString(item.pricePaise)}
                    </span>

                    {!item.available ? (
                      <span className="text-xs text-red-500 font-semibold">Unavailable</span>
                    ) : currentQty > 0 ? (
                      <QtyStepper
                        value={currentQty}
                        onChange={(qty) => updateItemQty(item.id, qty)}
                        size="sm"
                        ariaLabel={`Quantity for ${item.name}`}
                      />
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane: Persistent Desktop/Tablet Cart Column */}
        <div className="hidden lg:flex flex-col w-80 bg-surface-card border border-surface-border rounded-2xl p-4 shadow-sm h-full">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <span className="font-bold text-body text-content-primary">Current Order</span>
            <span className="text-xs text-content-muted">{totalCartQty} items</span>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-content-muted">
                <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-caption">No items added yet</p>
              </div>
            ) : (
              cartItems.map((line) => (
                <div
                  key={line.id}
                  className="p-2.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          line.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <p className="font-bold text-caption text-content-primary truncate">
                        {line.name}
                      </p>
                    </div>
                    {line.modifiers.length > 0 && (
                      <p className="text-[10px] text-content-muted truncate">
                        {line.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <QtyStepper
                      value={line.qty}
                      onChange={(qty) => updateItemQty(line.itemId, qty, line.modifiers)}
                      size="sm"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-surface-border space-y-2">
            <div className="flex justify-between text-caption text-content-secondary">
              <span>Subtotal</span>
              <span>{formatPaiseToRupeeString(totals.subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-caption text-content-secondary">
              <span>Taxes</span>
              <span>{formatPaiseToRupeeString(totals.taxPaise)}</span>
            </div>
            <div className="flex justify-between font-bold text-body text-content-primary pt-1 border-t border-surface-border">
              <span>Total</span>
              <span>{formatPaiseToRupeeString(totals.totalPaise)}</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-2"
              disabled={cartItems.length === 0}
              onClick={() => setIsCartSheetOpen(true)}
            >
              Review & Save Order
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Cart Bar */}
      {totalCartQty > 0 && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 p-3 bg-surface-card/95 backdrop-blur-md border-t border-surface-border z-20 shadow-xl">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div>
              <span className="text-xs text-content-muted block">{totalCartQty} items added</span>
              <span className="font-extrabold text-title text-content-primary">
                {formatPaiseToRupeeString(totals.totalPaise)}
              </span>
            </div>

            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-2 font-bold px-5"
              onClick={() => setIsCartSheetOpen(true)}
            >
              <span>View Cart</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Cart Sheet */}
      <CartSheet
        isOpen={isCartSheetOpen}
        onClose={() => setIsCartSheetOpen(false)}
        onOpenKotHistory={() => {
          setIsCartSheetOpen(false);
          setIsKotHistoryOpen(true);
        }}
        onOpenBillPreview={() => {
          setIsCartSheetOpen(false);
          setIsBillPreviewOpen(true);
        }}
        onOrderSaved={() => {
          setIsCartSheetOpen(false);
          onBackToTables();
        }}
      />

      {/* Bill Preview & Settlement Sheet */}
      <BillPreviewSheet
        isOpen={isBillPreviewOpen}
        orderId={useCartStore.getState().orderId}
        tableLabel={tableLabel || undefined}
        onClose={() => setIsBillPreviewOpen(false)}
        onOrderSettled={() => {
          setIsBillPreviewOpen(false);
          onBackToTables();
        }}
      />

      {/* KOT History Sheet */}
      <KotHistorySheet
        isOpen={isKotHistoryOpen}
        orderId={useCartStore.getState().orderId}
        tableLabel={tableLabel || undefined}
        onClose={() => setIsKotHistoryOpen(false)}
      />

      {/* Modifier Selection Modal / Dialog */}
      {activeModItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="font-bold text-title text-content-primary">{activeModItem.name}</h3>
                <span className="text-caption text-content-muted">Choose your options</span>
              </div>
              <button
                onClick={() => setActiveModItem(null)}
                className="text-content-muted hover:text-content-primary font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {activeModItem.modifierGroups?.map((group) => (
                <div key={group.id} className="space-y-2">
                  <span className="text-caption font-bold text-content-secondary uppercase block">
                    {group.name}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {group.modifiers.map((mod) => {
                      const isSelected = selectedMods.some((m) => m.id === mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMods((prev) => prev.filter((m) => m.id !== mod.id));
                            } else {
                              setSelectedMods((prev) => [...prev, mod]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left font-medium text-caption transition-all ${
                            isSelected
                              ? 'bg-accent/15 border-accent text-accent font-bold'
                              : 'bg-surface-elevated border-surface-border text-content-primary hover:border-surface-border-strong'
                          }`}
                        >
                          <div>{mod.name}</div>
                          {mod.priceDeltaPaise > 0 && (
                            <div className="text-xs text-content-muted">
                              +{formatPaiseToRupeeString(mod.priceDeltaPaise)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-surface-border flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setActiveModItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleConfirmModifiers}>
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
