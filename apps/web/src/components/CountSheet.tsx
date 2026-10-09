import React, { useState } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import {
  formatPaiseToRupeeString,
  calculateStockCountVariance,
  type InventoryItemOutput,
} from '@restaurant-os/shared';
import { CheckCircle2, AlertTriangle, AlertCircle, Calculator } from 'lucide-react';

export interface CountItemRow {
  item: InventoryItemOutput;
  countedStockStr: string;
}

export interface CountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItemOutput[];
  onSubmitCounts: (
    counts: Array<{ itemId: string; countedStock: number }>,
    note?: string,
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const CountSheet: React.FC<CountSheetProps> = ({
  isOpen,
  onClose,
  items,
  onSubmitCounts,
  isSubmitting = false,
}) => {
  const [rows, setRows] = useState<CountItemRow[]>(() =>
    items.map((it) => ({ item: it, countedStockStr: it.currentStock.toString() })),
  );
  const [note, setNote] = useState('');

  // Update a counted row value
  const handleCountChange = (itemId: string, valStr: string) => {
    setRows((prev) =>
      prev.map((r) => (r.item.id === itemId ? { ...r, countedStockStr: valStr } : r)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = rows.map((r) => ({
      itemId: r.item.id,
      countedStock: parseFloat(r.countedStockStr) || 0,
    }));
    await onSubmitCounts(payload, note || undefined);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Count & Audit"
      description="Enter physical verified stock. Implied usage and variances are derived automatically."
      position="right"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
        <div className="space-y-1">
          <label htmlFor="count-audit-note" className="font-semibold text-content-primary">
            Count Audit Note (Optional)
          </label>
          <input
            id="count-audit-note"
            type="text"
            placeholder="e.g. Weekly Sunday night audit"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs"
          />
        </div>

        <div className="overflow-x-auto max-h-[60vh] border border-surface-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-card border-b border-surface-border z-10">
              <tr className="text-content-muted">
                <th className="py-2.5 px-3 font-semibold">Ingredient</th>
                <th className="py-2.5 px-3 font-semibold text-right">System Stock</th>
                <th className="py-2.5 px-3 font-semibold w-32 text-right">Counted Stock</th>
                <th className="py-2.5 px-3 font-semibold text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map(({ item, countedStockStr }) => {
                const counted = parseFloat(countedStockStr) || 0;
                const { variance, isShortage, isSurplus } = calculateStockCountVariance({
                  previousStock: item.currentStock,
                  countedStock: counted,
                });

                return (
                  <tr key={item.id} className="hover:bg-surface-elevated/40">
                    <td className="py-2 px-3">
                      <span className="font-bold text-content-primary block">{item.name}</span>
                      <span className="text-[11px] text-content-muted">
                        {item.category} • {item.unit}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right font-medium text-content-secondary">
                      {item.currentStock} {item.unit}
                    </td>

                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={countedStockStr}
                          onChange={(e) => handleCountChange(item.id, e.target.value)}
                          className="w-24 px-2 py-1 bg-surface-elevated border border-surface-border rounded text-right font-bold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <span className="text-content-muted text-[11px] font-semibold w-6 text-left">
                          {item.unit}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-right">
                      {variance === 0 ? (
                        <span className="text-emerald-600 font-bold">Matched</span>
                      ) : (
                        <span
                          className={`font-black ${isShortage ? 'text-red-600' : 'text-blue-600'}`}
                        >
                          {variance > 0 ? `+${variance}` : variance} {item.unit}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-surface-border">
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={isSubmitting}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            {isSubmitting ? 'Recording...' : 'Commit Stock Counts'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
