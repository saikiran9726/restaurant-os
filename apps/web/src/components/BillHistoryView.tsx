import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { StatusPill } from './ui/StatusPill.js';
import { BillDetailDialog } from './BillDetailDialog.js';
import { Skeleton } from './ui/UtilityComponents.js';
import { apiFetch } from '../stores/useAuthStore.js';
import { Search, Calendar, Receipt, Filter } from 'lucide-react';

export const BillHistoryView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    bills: any[];
    limit: number;
    offset: number;
  }>({
    queryKey: ['bill-history', statusFilter, dateFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');
      return apiFetch(`/bills?${params.toString()}`);
    },
  });

  const bills = data?.bills || [];

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill # (e.g. B-20261008-0001)..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-body text-content-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-surface-card border border-surface-border text-xs text-content-primary focus:outline-none focus:border-accent"
            />
          </div>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs text-content-muted hover:text-content-primary underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex flex-wrap gap-2">
        {['all', 'paid', 'unpaid', 'partially_paid', 'cancelled', 'refunded'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-colors ${
              statusFilter === status
                ? 'bg-accent text-accent-content'
                : 'bg-surface-elevated text-content-secondary hover:text-content-primary border border-surface-border'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Bills List / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl bg-surface-elevated" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border-2 border-dashed border-surface-border bg-surface-card/40">
          <Receipt className="w-12 h-12 text-content-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-title font-black text-content-primary uppercase">No Bills Found</h3>
          <p className="text-body text-content-muted mt-1">
            No bills match your active filters or date selection.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-surface-border rounded-2xl border border-surface-border bg-surface-card overflow-hidden shadow-lg">
          {bills.map((bill) => (
            <div
              key={bill.id}
              onClick={() => setSelectedBillId(bill.id)}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-elevated/70 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-surface-elevated border border-surface-border shrink-0">
                  <Receipt className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-title text-content-primary">
                      {bill.billNumber}
                    </span>
                    <StatusPill status={bill.status} size="sm" />
                  </div>
                  <span className="text-xs text-content-muted block mt-0.5">
                    {new Date(bill.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    •{' '}
                    {new Date(bill.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <div className="text-right">
                  <span className="font-mono font-black text-xl text-content-primary block tabular-nums">
                    {formatPaiseToRupeeString(bill.totalPaise)}
                  </span>
                  {bill.discountPaise > 0 && (
                    <span className="text-[11px] text-emerald-400 font-bold block">
                      Saved {formatPaiseToRupeeString(bill.discountPaise)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bill Detail Modal */}
      <BillDetailDialog
        isOpen={Boolean(selectedBillId)}
        billId={selectedBillId}
        onClose={() => setSelectedBillId(null)}
        onBillUpdated={() => refetch()}
      />
    </div>
  );
};
