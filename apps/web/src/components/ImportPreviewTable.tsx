import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { CsvImportRowResult } from '@restaurant-os/shared';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

interface ImportPreviewTableProps {
  rows: CsvImportRowResult[];
}

export const ImportPreviewTable: React.FC<ImportPreviewTableProps> = ({ rows }) => {
  return (
    <div className="border border-surface-border rounded-xl overflow-hidden bg-surface-card max-h-96 overflow-y-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-surface-elevated border-b border-surface-border sticky top-0 font-bold text-content-secondary uppercase">
          <tr>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Row</th>
            <th className="py-2.5 px-3">Category</th>
            <th className="py-2.5 px-3">Item Name</th>
            <th className="py-2.5 px-3">Type</th>
            <th className="py-2.5 px-3">Price</th>
            <th className="py-2.5 px-3">Aliases</th>
            <th className="py-2.5 px-3">Errors</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border font-mono">
          {rows.map((row) => (
            <tr
              key={row.rowNumber}
              className={row.isValid ? 'hover:bg-surface-elevated/40' : 'bg-danger/5'}
            >
              <td className="py-2.5 px-3 whitespace-nowrap">
                {row.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger" />
                )}
              </td>
              <td className="py-2.5 px-3 font-semibold">{row.rowNumber}</td>
              <td className="py-2.5 px-3">{row.data.category}</td>
              <td className="py-2.5 px-3 font-bold">{row.data.name}</td>
              <td className="py-2.5 px-3">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    row.data.isVeg
                      ? 'bg-veg/10 text-veg border border-veg/20'
                      : 'bg-nonveg/10 text-nonveg border border-nonveg/20'
                  }`}
                >
                  {row.data.isVeg ? 'VEG' : 'NON-VEG'}
                </span>
              </td>
              <td className="py-2.5 px-3">{formatPaiseToRupeeString(row.data.pricePaise)}</td>
              <td className="py-2.5 px-3 text-content-muted">
                {row.data.aliases.length > 0 ? row.data.aliases.join(', ') : '—'}
              </td>
              <td className="py-2.5 px-3 text-danger font-sans">
                {row.errors.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{row.errors.join('; ')}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
