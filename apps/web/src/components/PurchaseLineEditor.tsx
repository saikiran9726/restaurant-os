import React from 'react';
import { Trash2 } from 'lucide-react';
import { ItemTypeahead } from './ItemTypeahead.js';
import {
  calculateLinePricing,
  formatPaiseToRupeeString,
  type InventoryItemOutput,
} from '@restaurant-os/shared';

export interface PurchaseLineDraft {
  itemId: string;
  itemName: string;
  unit: string;
  quantityStr: string;
  unitPriceStr: string;
  totalPriceStr: string;
}

export interface PurchaseLineEditorProps {
  items: InventoryItemOutput[];
  lines: PurchaseLineDraft[];
  onChangeLines: (lines: PurchaseLineDraft[]) => void;
  onEnterNextLine?: () => void;
  className?: string;
}

export const PurchaseLineEditor: React.FC<PurchaseLineEditorProps> = ({
  items,
  lines,
  onChangeLines,
  onEnterNextLine,
  className = '',
}) => {
  const updateLine = (index: number, patch: Partial<PurchaseLineDraft>) => {
    const updated = [...lines];
    const current = { ...updated[index]!, ...patch };

    // Bidirectional price recalculation:
    // If totalPriceStr changed -> compute unit price
    // If unitPriceStr or quantityStr changed -> compute total price
    const qty = parseFloat(current.quantityStr) || 0;

    if ('totalPriceStr' in patch && patch.totalPriceStr !== undefined) {
      const totRupees = parseFloat(patch.totalPriceStr) || 0;
      const totPaise = Math.round(totRupees * 100);
      const { unitPricePaise } = calculateLinePricing({
        quantity: qty,
        lineTotalPaise: totPaise,
      });
      current.unitPriceStr = qty > 0 ? (unitPricePaise / 100).toFixed(2) : current.unitPriceStr;
    } else if (('unitPriceStr' in patch || 'quantityStr' in patch) && current.unitPriceStr !== '') {
      const uRupees = parseFloat(current.unitPriceStr) || 0;
      const uPaise = Math.round(uRupees * 100);
      const { lineTotalPaise } = calculateLinePricing({
        quantity: qty,
        unitPricePaise: uPaise,
      });
      current.totalPriceStr = (lineTotalPaise / 100).toFixed(2);
    }

    updated[index] = current;
    onChangeLines(updated);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      // Clear line instead of removing if last line
      onChangeLines([
        {
          itemId: '',
          itemName: '',
          unit: 'kg',
          quantityStr: '1',
          unitPriceStr: '',
          totalPriceStr: '',
        },
      ]);
      return;
    }
    onChangeLines(lines.filter((_, i) => i !== index));
  };

  const addLine = () => {
    onChangeLines([
      ...lines,
      {
        itemId: '',
        itemName: '',
        unit: 'kg',
        quantityStr: '1',
        unitPriceStr: '',
        totalPriceStr: '',
      },
    ]);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-surface-border text-content-muted">
              <th className="py-2 px-2 font-semibold min-w-[220px]">Item / Ingredient</th>
              <th className="py-2 px-2 font-semibold w-28">Quantity</th>
              <th className="py-2 px-2 font-semibold w-32">Unit Price (₹)</th>
              <th className="py-2 px-2 font-semibold w-32">Total Price (₹)</th>
              <th className="py-2 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/50">
            {lines.map((line, idx) => (
              <tr key={idx} className="group hover:bg-surface-elevated/40">
                <td className="py-2 px-2">
                  <ItemTypeahead
                    items={items}
                    selectedItemId={line.itemId || null}
                    onSelectItem={(it) => {
                      updateLine(idx, {
                        itemId: it.id,
                        itemName: it.name,
                        unit: it.unit,
                      });
                    }}
                  />
                </td>

                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={line.quantityStr}
                      onChange={(e) => updateLine(idx, { quantityStr: e.target.value })}
                      placeholder="Qty"
                      className="w-full px-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-right font-semibold"
                    />
                    <span className="text-[11px] text-content-muted font-bold min-w-[24px]">
                      {line.unit}
                    </span>
                  </div>
                </td>

                <td className="py-2 px-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unitPriceStr}
                      onChange={(e) => updateLine(idx, { unitPriceStr: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-right font-semibold"
                    />
                  </div>
                </td>

                <td className="py-2 px-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.totalPriceStr}
                      onChange={(e) => updateLine(idx, { totalPriceStr: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLine();
                          onEnterNextLine?.();
                        }
                      }}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-right font-bold text-accent"
                    />
                  </div>
                </td>

                <td className="py-2 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1 rounded text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="text-xs font-semibold text-accent hover:text-accent-hover hover:underline inline-flex items-center gap-1 pt-1"
      >
        + Add another line (or press Enter in Total Price)
      </button>
    </div>
  );
};
