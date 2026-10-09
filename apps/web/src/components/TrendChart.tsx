import React, { useState } from 'react';
import { Table, BarChart2 } from 'lucide-react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';

export interface TrendDataPoint {
  date: string;
  label: string;
  netSalesPaise: number;
  ordersCount: number;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  className?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title = 'Sales Trend',
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const maxSales = Math.max(...data.map((d) => d.netSalesPaise), 1);
  const totalSales = data.reduce((sum, d) => sum + d.netSalesPaise, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.ordersCount, 0);

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-surface-border">
        <div>
          <h3 className="font-bold text-subhead text-content-primary">{title}</h3>
          <span className="text-xs text-content-secondary">
            Total {formatPaiseToRupeeString(totalSales)} across {totalOrders} orders
          </span>
        </div>

        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-surface-border">
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              viewMode === 'chart'
                ? 'bg-surface-card text-content-primary shadow-xs'
                : 'text-content-muted hover:text-content-primary'
            }`}
            aria-label="View as Chart"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              viewMode === 'table'
                ? 'bg-surface-card text-content-primary shadow-xs'
                : 'text-content-muted hover:text-content-primary'
            }`}
            aria-label="View as Data Table"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="pt-6">
          <div className="h-52 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-6 pt-2">
            {data.map((point) => {
              const heightPct = Math.max(4, Math.round((point.netSalesPaise / maxSales) * 100));
              return (
                <div
                  key={point.date}
                  className="flex-1 min-w-[28px] max-w-[56px] flex flex-col items-center gap-2 group relative"
                >
                  {/* Tooltip on hover/focus */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-surface-overlay text-white text-[11px] font-semibold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                    {formatPaiseToRupeeString(point.netSalesPaise)} ({point.ordersCount} orders)
                  </div>

                  {/* Bar */}
                  <div className="w-full flex items-end justify-center h-40 bg-surface-elevated/40 rounded-t-md p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-accent hover:bg-accent/90 rounded-t transition-all duration-300"
                    />
                  </div>

                  {/* Label */}
                  <span className="text-[10px] sm:text-xs font-medium text-content-muted truncate max-w-full">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="sr-only">
            {data
              .map(
                (d) =>
                  `${d.label}: ${formatPaiseToRupeeString(d.netSalesPaise)}, ${d.ordersCount} orders.`,
              )
              .join(' ')}
          </div>
        </div>
      ) : (
        <div className="pt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-content-muted">
                <th className="py-2 px-3 font-semibold">Date</th>
                <th className="py-2 px-3 font-semibold text-right">Orders</th>
                <th className="py-2 px-3 font-semibold text-right">Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {data.map((point) => (
                <tr key={point.date} className="hover:bg-surface-elevated/50">
                  <td className="py-2.5 px-3 font-medium text-content-primary">
                    {point.label} ({point.date})
                  </td>
                  <td className="py-2.5 px-3 text-right text-content-secondary">
                    {point.ordersCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-content-primary">
                    {formatPaiseToRupeeString(point.netSalesPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
