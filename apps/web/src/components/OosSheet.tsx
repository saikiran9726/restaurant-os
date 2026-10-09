import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { apiFetch } from '../stores/useAuthStore.js';
import { useOutboxStore } from '../stores/useOutboxStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { Search, Ban, CheckCircle, AlertCircle } from 'lucide-react';

interface OosSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OosSheet: React.FC<OosSheetProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: menuData, refetch } = useQuery<{ items: any[] }>({
    queryKey: ['kitchen-menu-oos'],
    queryFn: () => apiFetch('/menu'),
    enabled: isOpen,
  });

  const allItems = menuData?.items || [];
  const outOfStockItems = allItems.filter((i) => !i.available);

  const filtered = allItems.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = i.name.toLowerCase().includes(q);
    const aliasMatch = (i.aliases || []).some((a: string) => a.toLowerCase().includes(q));
    return nameMatch || aliasMatch;
  });

  const handleMarkOos = async (itemId: string, name: string) => {
    const reason = reasonInput.trim() || 'Kitchen out of stock';
    try {
      await useOutboxStore.getState().enqueue('menu.oos', {
        itemId,
        available: false,
        reason,
      });

      useToastStore.getState().addToast({
        type: 'warning',
        message: `${name} marked OUT OF STOCK`,
      });

      setSelectedItemId(null);
      setReasonInput('');
      refetch();
    } catch (err: any) {
      useToastStore.getState().addToast({
        type: 'danger',
        message: err.message || 'Failed to update stock status',
      });
    }
  };

  const handleBackInStock = async (itemId: string, name: string) => {
    try {
      await useOutboxStore.getState().enqueue('menu.oos', {
        itemId,
        available: true,
      });

      useToastStore.getState().addToast({
        type: 'success',
        message: `${name} back in stock`,
      });

      refetch();
    } catch (err: any) {
      useToastStore.getState().addToast({
        type: 'danger',
        message: err.message || 'Failed to update stock status',
      });
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="86 List • Out of Stock Control"
      description="Mark items unavailable across waiter POS terminals instantly."
    >
      <div className="space-y-5 pt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {/* Active Out of stock summary banner */}
        {outOfStockItems.length > 0 && (
          <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/40 text-red-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-body text-red-200">
              <Ban className="w-5 h-5 text-red-400" />
              <span>Currently 86'd ({outOfStockItems.length} items)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {outOfStockItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleBackInStock(item.id, item.name)}
                  className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-emerald-950 border border-red-500/60 hover:border-emerald-500 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                  title="Click to mark back in stock"
                >
                  <span>{item.name}</span>
                  <span className="text-[10px] text-emerald-400 underline ml-1">Restore</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Search dish to 86 / restore..."
            value={search}
            onChange={(e) => setSearchQuerySafe(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface-card border border-surface-border text-title text-content-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Items List */}
        <div className="space-y-2.5">
          {filtered.slice(0, 30).map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                !item.available
                  ? 'bg-red-950/20 border-red-500/40'
                  : 'bg-surface-card border-surface-border'
              }`}
            >
              <div>
                <span className="font-bold text-body text-content-primary block">{item.name}</span>
                <span className="text-xs text-content-muted">
                  {!item.available ? `86'd: ${item.oosReason || 'Out of stock'}` : 'In Stock'}
                </span>
              </div>

              {item.available ? (
                <div className="flex items-center gap-2">
                  {selectedItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Reason (optional)..."
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleMarkOos(item.id, item.name)}
                      >
                        Confirm 86
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedItemId(item.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold"
                    >
                      Mark 86 (Out)
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleBackInStock(item.id, item.name)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Back in Stock
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );

  function setSearchQuerySafe(val: string) {
    setSearch(val);
  }
};
