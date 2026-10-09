import React from 'react';
import { formatPaiseToRupeeString, type StockMovementOutput } from '@restaurant-os/shared';
import { ArrowDownLeft, ArrowUpRight, Trash2, Sliders, CheckCircle2 } from 'lucide-react';

export interface MovementTableProps {
  movements: StockMovementOutput[];
  className?: string;
}

export const MovementTable: React.FC<MovementTableProps> = ({ movements, className = '' }) => {
  const getBadge = (type: StockMovementOutput['type']) => {
    switch (type) {
      case 'purchase':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
            <ArrowDownLeft className="w-3 h-3" /> Restock
          </span>
        );
      case 'usage':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md">
            <ArrowUpRight className="w-3 h-3" /> Usage
          </span>
        );
      case 'waste':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-md">
            <Trash2 className="w-3 h-3" /> Waste
          </span>
        );
      case 'stock_count':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3" /> Stock Count
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">
            <Sliders className="w-3 h-3" /> Adjustment
          </span>
        );
    }
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-surface-border text-content-muted">
            <th className="py-2.5 px-3 font-semibold">Date</th>
            <th className="py-2.5 px-3 font-semibold">Type</th>
            <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
            <th className="py-2.5 px-3 font-semibold">Reason / Note</th>
            <th className="py-2.5 px-3 font-semibold text-right">Unit Cost (Est.)</th>
            <th className="py-2.5 px-3 font-semibold">Logged By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50">
          {movements.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-content-muted">
                No movements recorded yet
              </td>
            </tr>
          ) : (
            movements.map((m) => {
              const isPositive = m.quantity > 0;
              return (
                <tr key={m.id} className="hover:bg-surface-elevated/40">
                  <td className="py-2.5 px-3 font-medium text-content-primary">{m.movementDate}</td>
                  <td className="py-2.5 px-3">{getBadge(m.type)}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-content-primary'}`}
                  >
                    {isPositive ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-content-secondary max-w-xs truncate">
                    {m.reason}
                  </td>
                  <td className="py-2.5 px-3 text-right text-content-secondary">
                    {formatPaiseToRupeeString(m.costSnapshotPaisePerUnit)}
                  </td>
                  <td className="py-2.5 px-3 text-content-muted">{m.createdByName || 'Staff'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
