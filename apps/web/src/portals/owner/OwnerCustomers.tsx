import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { Button } from '../../components/ui/Button.js';
import { SegmentBadge } from '../../components/SegmentBadge.js';
import { PhoneInput } from '../../components/PhoneInput.js';
import { PreferenceTags } from '../../components/PreferenceTags.js';
import { useToastStore } from '../../stores/useToastStore.js';
import {
  formatPaiseToRupeeString,
  type CustomerOwnerDetail,
  type CustomerSegment,
  type CustomerLoyaltyDetails,
} from '@restaurant-os/shared';
import {
  Users,
  Search,
  Download,
  Phone,
  Calendar,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Tag,
  Trash2,
  Edit,
  X,
  Check,
  AlertTriangle,
  History,
  Info,
  Award,
  Coins,
} from 'lucide-react';
import { PointsBadge } from '../../components/PointsBadge.js';
import { TierBadge } from '../../components/TierBadge.js';
import { LedgerTable } from '../../components/LedgerTable.js';

export const OwnerCustomers: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<CustomerSegment | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOwnerDetail | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerOwnerDetail | null>(null);
  const [anonymizingCustomer, setAnonymizingCustomer] = useState<CustomerOwnerDetail | null>(null);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editPrefNote, setEditPrefNote] = useState('');
  const [editConsent, setEditConsent] = useState(false);

  // Loyalty adjust state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState('100');
  const [adjustReason, setAdjustReason] = useState('');

  // Query customers
  const { data, isLoading } = useQuery<{
    customers: CustomerOwnerDetail[];
    total: number;
    counts: Record<string, number>;
    preferenceTags: string[];
  }>({
    queryKey: ['owner-customers', activeTab, search],
    queryFn: () =>
      apiFetch(
        `/customers?segment=${encodeURIComponent(activeTab)}&search=${encodeURIComponent(
          search,
        )}&limit=100`,
      ),
    staleTime: 10 * 1000,
  });

  // Query detailed customer for drawer
  const { data: detailData, isLoading: isDetailLoading } = useQuery<
    CustomerOwnerDetail & { recentOrders?: any[] }
  >({
    queryKey: ['owner-customer-detail', selectedCustomer?.id],
    queryFn: () => apiFetch(`/customers/${selectedCustomer!.id}`),
    enabled: !!selectedCustomer?.id,
  });

  // Query customer loyalty & ledger for drawer
  const { data: customerLoyalty, refetch: refetchCustomerLoyalty } =
    useQuery<CustomerLoyaltyDetails>({
      queryKey: ['owner-customer-loyalty', selectedCustomer?.id],
      queryFn: () => apiFetch(`/customers/${selectedCustomer!.id}/loyalty`),
      enabled: !!selectedCustomer?.id,
    });

  // Adjust points mutation
  const adjustMutation = useMutation({
    mutationFn: async (payload: { customerId: string; points: number; reason: string }) => {
      return apiFetch('/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res: any) => {
      addToast({
        type: 'success',
        message: `Points adjusted. New balance: ${res.account?.pointsBalance ?? 'updated'} pts`,
      });
      setIsAdjustModalOpen(false);
      setAdjustPoints('100');
      setAdjustReason('');
      refetchCustomerLoyalty();
      queryClient.invalidateQueries({ queryKey: ['loyalty-overview'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: err.message || 'Failed to adjust points' });
    },
  });

  // Edit mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiFetch(`/customers/${editingCustomer!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Customer updated successfully' });
      setEditingCustomer(null);
      queryClient.invalidateQueries({ queryKey: ['owner-customers'] });
      queryClient.invalidateQueries({ queryKey: ['owner-customer-detail'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: err.message || 'Failed to update customer' });
    },
  });

  // Anonymize mutation
  const anonymizeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/customers/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Customer anonymized and PII stripped' });
      setAnonymizingCustomer(null);
      if (selectedCustomer?.id === anonymizingCustomer?.id) {
        setSelectedCustomer(null);
      }
      queryClient.invalidateQueries({ queryKey: ['owner-customers'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: err.message || 'Failed to anonymize customer' });
    },
  });

  const handleOpenEdit = (c: CustomerOwnerDetail) => {
    setEditingCustomer(c);
    setEditName(c.name || '');
    setEditPhone(c.phone ? c.phone.replace(/^\+91/, '') : '');
    setEditEmail(c.email || '');
    setEditBirthday(c.birthday || '');
    setEditNotes(c.notes || '');
    setEditTags(c.preferences?.tags || []);
    setEditPrefNote(c.preferences?.note || '');
    setEditConsent(!!c.consentRecorded);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    updateMutation.mutate({
      name: editName.trim() || undefined,
      phone: editPhone ? `+91${editPhone.replace(/\D/g, '')}` : undefined,
      email: editEmail.trim() || undefined,
      birthday: editBirthday || undefined,
      notes: editNotes.trim() || undefined,
      preferences: { tags: editTags, note: editPrefNote.trim() },
      consentRecorded: editConsent,
    });
  };

  // RFC 4180 CSV Export
  const handleExportCSV = () => {
    if (!data?.customers || data.customers.length === 0) {
      addToast({ type: 'warning', message: 'No customer data to export' });
      return;
    }

    const headers = [
      'Customer ID',
      'Name',
      'Phone',
      'Email',
      'Birthday',
      'Segment',
      'Visits',
      'Total Spent (INR)',
      'Average Order Value (INR)',
      'Last Visit',
      'Preference Tags',
      'Dietary Notes',
      'Staff Notes',
    ];

    const rows = data.customers.map((c) => {
      const escape = (str: string | null | undefined) => {
        if (!str) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      return [
        escape(c.id),
        escape(c.name),
        escape(c.phone),
        escape(c.email),
        escape(c.birthday),
        escape(c.segment),
        c.visitCount,
        (c.totalSpentPaise / 100).toFixed(2),
        (c.averageOrderValuePaise / 100).toFixed(2),
        escape(c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('en-IN') : ''),
        escape(c.preferences?.tags?.join(', ')),
        escape(c.preferences?.note),
        escape(c.notes),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({ type: 'success', message: 'Customer CSV exported successfully' });
  };

  const tabs: Array<{ id: CustomerSegment | 'all'; label: string }> = [
    { id: 'all', label: 'All Customers' },
    { id: 'regular', label: 'Regulars' },
    { id: 'high_value', label: 'High Value' },
    { id: 'returning', label: 'Returning' },
    { id: 'new', label: 'New' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'at_risk', label: 'At Risk' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-bold text-content-primary flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            <span>Customers & Segments</span>
          </h2>
          <p className="text-body text-content-secondary mt-1">
            Guest directory, automated dining segments, preferences, and privacy compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-surface-border">
        {tabs.map((tab) => {
          const count = data?.counts?.[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-subtle text-content-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Search by customer name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-body rounded-xl bg-surface-card border border-surface-border text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-muted hover:text-content-primary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Customer Table */}
      <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle text-content-secondary border-b border-surface-border uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Segment</th>
                <th className="py-3 px-4 text-center">Visits</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4 text-right">AOV</th>
                <th className="py-3 px-4">Last Visit</th>
                <th className="py-3 px-4">Preferences</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-content-muted">
                    Loading customer database...
                  </td>
                </tr>
              ) : !data?.customers || data.customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-content-muted">
                    No customers found matching this criteria.
                  </td>
                </tr>
              ) : (
                data.customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className="hover:bg-surface-elevated/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-content-primary group-hover:text-primary transition-colors">
                        {c.name || 'Anonymous Guest'}
                      </div>
                      <div className="text-[11px] font-mono text-content-secondary mt-0.5">
                        {c.phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <SegmentBadge segment={c.segment} reason={c.segmentReason} />
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-content-primary">
                      {c.visitCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-content-primary">
                      {formatPaiseToRupeeString(c.totalSpentPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-content-secondary">
                      {formatPaiseToRupeeString(c.averageOrderValuePaise)}
                    </td>
                    <td className="py-3.5 px-4 text-content-secondary">
                      {c.lastVisitAt
                        ? new Date(c.lastVisitAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Never'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {c.preferences?.tags?.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-surface-subtle text-[10px] text-content-secondary font-medium"
                          >
                            {t}
                          </span>
                        ))}
                        {(c.preferences?.tags?.length || 0) > 2 && (
                          <span className="text-[10px] text-content-muted">
                            +{c.preferences.tags.length - 2}
                          </span>
                        )}
                        {!c.preferences?.tags?.length && (
                          <span className="text-[10px] text-content-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td
                      className="py-3.5 px-4 text-right space-x-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-muted hover:text-content-primary transition-colors"
                        title="Edit Customer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnonymizingCustomer(c)}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-content-muted hover:text-danger transition-colors"
                        title="Anonymize (DPDPA Right to Erasure)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface-card border-l border-surface-border h-full flex flex-col p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-title font-bold text-content-primary">
                  {selectedCustomer.name || 'Anonymous Guest'}
                </h3>
                <p className="text-caption font-mono text-content-secondary mt-0.5">
                  {selectedCustomer.phone}
                </p>
                <div className="mt-2">
                  <SegmentBadge
                    segment={selectedCustomer.segment}
                    reason={selectedCustomer.segmentReason}
                  />
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-lg hover:bg-surface-elevated text-content-muted hover:text-content-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-center">
                <p className="text-[10px] uppercase font-bold text-content-muted">Visits</p>
                <p className="text-base font-extrabold text-content-primary mt-0.5">
                  {selectedCustomer.visitCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-center">
                <p className="text-[10px] uppercase font-bold text-content-muted">Total Spent</p>
                <p className="text-sm font-extrabold font-mono text-content-primary mt-0.5">
                  {formatPaiseToRupeeString(selectedCustomer.totalSpentPaise)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-center">
                <p className="text-[10px] uppercase font-bold text-content-muted">Avg Order</p>
                <p className="text-sm font-extrabold font-mono text-content-primary mt-0.5">
                  {formatPaiseToRupeeString(selectedCustomer.averageOrderValuePaise)}
                </p>
              </div>
            </div>

            {/* Dietary Preferences */}
            <div className="space-y-2 p-3.5 rounded-xl bg-surface-subtle border border-surface-border">
              <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Food & Dining Preferences</span>
              </h4>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedCustomer.preferences?.tags?.length ? (
                  selectedCustomer.preferences.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-content-muted">No dietary preference tags recorded.</p>
                )}
              </div>
              {selectedCustomer.preferences?.note && (
                <p className="text-xs text-content-secondary mt-1 bg-surface-card p-2 rounded-lg border border-surface-border">
                  <span className="font-bold text-content-primary">Special note: </span>
                  {selectedCustomer.preferences.note}
                </p>
              )}
            </div>

            {/* Loyalty Account & Ledger */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <span>Loyalty & Rewards</span>
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdjustModalOpen(true)}
                  className="text-[11px] py-0.5 px-2 h-7"
                >
                  <Coins className="w-3 h-3 mr-1 text-amber-400" />
                  Adjust Points
                </Button>
              </div>

              {customerLoyalty?.account ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TierBadge
                        tier={customerLoyalty.account.tier}
                        earnMultiplier={customerLoyalty.account.tierMultiplier}
                      />
                      <PointsBadge points={customerLoyalty.account.pointsBalance} />
                    </div>
                    <div className="text-right text-[11px]">
                      <span className="text-content-muted block">Lifetime</span>
                      <span className="font-mono font-bold text-content-primary">
                        {customerLoyalty.account.lifetimePoints.toLocaleString('en-IN')} pts
                      </span>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">
                      Transaction Ledger History
                    </span>
                    <LedgerTable
                      transactions={customerLoyalty.transactions}
                      className="max-h-52 overflow-y-auto"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-content-muted">No loyalty activity yet.</p>
              )}
            </div>

            {/* Favourites list */}
            {detailData?.favouriteItems && detailData.favouriteItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Top Favourites</span>
                </h4>
                <div className="space-y-1.5">
                  {detailData.favouriteItems.map((fav) => (
                    <div
                      key={fav.itemId}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-subtle text-xs"
                    >
                      <span className="font-bold text-content-primary">{fav.name}</span>
                      <span className="text-content-muted">Ordered {fav.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-content-secondary" />
                <span>Recent Orders</span>
              </h4>
              {isDetailLoading ? (
                <p className="text-xs text-content-muted">Loading history...</p>
              ) : !detailData?.recentOrders || detailData.recentOrders.length === 0 ? (
                <p className="text-xs text-content-muted">No completed orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailData.recentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-content-primary uppercase font-mono text-[11px]">
                          #{ord.id.slice(0, 8)} • {ord.type}
                        </div>
                        <p className="text-[10px] text-content-muted mt-0.5">
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-content-primary">
                        {formatPaiseToRupeeString(ord.totalPaise)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-surface-border flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(selectedCustomer)}
                className="w-1/2"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                <span>Edit Profile</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnonymizingCustomer(selectedCustomer)}
                className="w-1/2 text-danger hover:bg-danger/10"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>Anonymize</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-title font-bold text-content-primary">Edit Customer Profile</h3>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-content-muted hover:text-content-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Phone (10 Digits)
                  </label>
                  <PhoneInput value={editPhone} onChange={setEditPhone} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Birthday (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={editBirthday}
                    onChange={(e) => setEditBirthday(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Food Preferences
                </label>
                <PreferenceTags
                  selectedTags={editTags}
                  onChangeTags={setEditTags}
                  note={editPrefNote}
                  onChangeNote={setEditPrefNote}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Staff Notes (Internal only)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="VIP regular, prefers corner booth..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={editConsent}
                  onChange={(e) => setEditConsent(e.target.checked)}
                  className="rounded border-surface-border text-primary focus:ring-accent"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-content-secondary">
                  Customer consented to storage of dining preferences (DPDPA 2023)
                </label>
              </div>

              <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Anonymize Confirmation Modal */}
      {anonymizingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-title font-bold text-content-primary">
                Anonymize Customer Data?
              </h3>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              In compliance with India's <strong>DPDPA 2023 Right to Erasure</strong>, all
              personally identifiable information (name, phone number, email, preferences, and staff
              notes) will be permanently erased.
            </p>
            <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs text-content-muted">
              Historical revenue, bill totals, and order item counts will be preserved for sales tax
              and accounting records.
            </div>

            <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setAnonymizingCustomer(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-danger hover:bg-danger/90 text-white"
                onClick={() => anonymizeMutation.mutate(anonymizingCustomer.id)}
                disabled={anonymizeMutation.isPending}
              >
                Confirm Anonymization
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Customer Loyalty Points Modal */}
      {isAdjustModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-title font-bold text-content-primary">
                  Adjust Points • {selectedCustomer.name || 'Guest'}
                </h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-content-muted hover:text-content-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const pts = parseInt(adjustPoints, 10);
                if (isNaN(pts) || pts === 0) {
                  addToast({
                    type: 'warning',
                    message: 'Enter a valid non-zero points adjustment',
                  });
                  return;
                }
                if (!adjustReason.trim() || adjustReason.trim().length < 3) {
                  addToast({
                    type: 'warning',
                    message: 'Specific reason (min 3 chars) is mandatory',
                  });
                  return;
                }
                adjustMutation.mutate({
                  customerId: selectedCustomer.id,
                  points: pts,
                  reason: adjustReason.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Points Adjustment (+ to credit, - to debit)
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                />
                <span className="text-[10px] text-content-muted mt-0.5 block">
                  Current Balance: {customerLoyalty?.account?.pointsBalance ?? 0} pts
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Reason (Mandatory Audit Trail)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. VIP goodwill bonus, service compensation"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={adjustMutation.isPending}
                >
                  {adjustMutation.isPending ? 'Adjusting…' : 'Apply Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default OwnerCustomers;
