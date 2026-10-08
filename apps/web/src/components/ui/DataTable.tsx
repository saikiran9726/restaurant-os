import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'No records found',
  className = '',
}: DataTableProps<T>): React.JSX.Element {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-surface-border bg-surface-card ${className}`}
    >
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Data Table</caption>
        <thead>
          <tr className="border-b border-surface-border bg-surface-elevated text-xs font-bold uppercase tracking-wider text-content-muted">
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`p-3.5 ${alignClass} ${col.className || ''}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1.5 hover:text-content-primary focus-visible:outline-none focus-visible:underline"
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border text-body text-content-primary">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-content-muted text-body">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-surface-canvas/50 transition-colors">
                {columns.map((col) => {
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                  return (
                    <td key={col.key} className={`p-3.5 ${alignClass} ${col.className || ''}`}>
                      {col.render
                        ? col.render(row)
                        : (row as Record<string, unknown>)[col.key]?.toString() || '-'}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
