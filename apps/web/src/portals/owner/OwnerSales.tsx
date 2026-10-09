import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { KpiCard } from '../../components/ui/Cards.js';
import { RangePicker, type RangePreset } from '../../components/RangePicker.js';
import { TrendChart } from '../../components/TrendChart.js';
import { Heatmap } from '../../components/Heatmap.js';
import { BreakdownBar } from '../../components/BreakdownBar.js';
import { InsightCardView } from '../../components/InsightCardView.js';
import {
  formatPaiseToRupeeString,
  type SalesReportResponse,
  type ItemsReportResponse,
  type CustomerAnalyticsResponse,
} from '@restaurant-os/shared';
import {
  TrendingUp,
  Receipt,
  Users,
  Coins,
  ShieldCheck,
  AlertCircle,
  Download,
  CalendarCheck,
  Sparkles,
  Clock,
  Award,
} from 'lucide-react';

export const OwnerSales: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [preset, setPreset] = useState<RangePreset>('today');
  const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]!);

  // Compute effective start and end dates based on preset
  const getEffectiveDates = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const d = toYmd(today);
      return { start: d, end: d };
    }
    if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = toYmd(y);
      return { start: d, end: d };
    }
    if (preset === 'weekly') {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      return { start: toYmd(w), end: toYmd(today) };
    }
    if (preset === 'monthly') {
      const m = new Date(today);
      m.setDate(m.getDate() - 29);
      return { start: toYmd(m), end: toYmd(today) };
    }
    return { start: customStart, end: customEnd };
  };

  const { start: effectiveStart, end: effectiveEnd } = getEffectiveDates();

  // Queries
  const {
    data: salesData,
    isLoading: isSalesLoading,
    error: salesError,
  } = useQuery<SalesReportResponse>({
    queryKey: ['owner-sales-report', preset, effectiveStart, effectiveEnd],
    queryFn: () =>
      apiFetch(
        `/reports/sales?range=${preset}&startDate=${effectiveStart}&endDate=${effectiveEnd}`,
      ),
    refetchInterval: 30000,
  });

  const { data: itemsData } = useQuery<ItemsReportResponse>({
    queryKey: ['owner-items-report', effectiveStart, effectiveEnd],
    queryFn: () =>
      apiFetch(`/reports/items?startDate=${effectiveStart}&endDate=${effectiveEnd}&limit=10`),
  });

  const { data: customerData } = useQuery<CustomerAnalyticsResponse>({
    queryKey: ['owner-cust-report', effectiveStart, effectiveEnd],
    queryFn: () =>
      apiFetch(`/reports/customers?startDate=${effectiveStart}&endDate=${effectiveEnd}`),
  });

  const handleExportCsv = () => {
    if (!salesData) return;
    const rows = [
      ['Date', 'Orders', 'Net Sales (₹)'],
      ...salesData.chartData.map((t) => [
        t.date,
        t.ordersCount,
        (t.netSalesPaise / 100).toFixed(2),
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales-report-${effectiveStart}-to-${effectiveEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', message: 'Sales CSV exported successfully' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Range Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title font-extrabold text-content-primary">Sales Analytics</h2>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">
              Business Date Aware
            </span>
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            Real-time explained financial performance reconciled with verified till balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangePicker
            preset={preset}
            onPresetChange={setPreset}
            startDate={customStart}
            endDate={customEnd}
            onCustomRangeChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!salesData}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/owner/close-day')}
            leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
            className="shadow-sm"
          >
            Close Business Day
          </Button>
        </div>
      </div>

      {salesError ? (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="font-bold text-content-primary">Failed to load sales report</h3>
          <p className="text-xs text-content-secondary mt-1">
            Ensure you have report.read permissions and the server is running.
          </p>
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Net Sales"
          value={formatPaiseToRupeeString(salesData?.kpis.netSalesPaise || 0)}
          subtitle={`Gross: ${formatPaiseToRupeeString(salesData?.kpis.grossSalesPaise || 0)}`}
          icon={<Coins className="w-4 h-4" />}
        />
        <KpiCard
          title="Bills Count"
          value={salesData?.kpis.billsCount || 0}
          subtitle={`${salesData?.kpis.ordersCount || 0} kitchen orders`}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KpiCard
          title="Average Order (AOV)"
          value={formatPaiseToRupeeString(salesData?.kpis.aovPaise || 0)}
          subtitle="Net sales per bill"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiCard
          title="Taxes (GST)"
          value={formatPaiseToRupeeString(salesData?.kpis.taxCollectedPaise || 0)}
          subtitle="Collected SGST/CGST"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Discounts Given"
          value={formatPaiseToRupeeString(salesData?.kpis.discountsPaise || 0)}
          subtitle={`Refunds: ${formatPaiseToRupeeString(salesData?.kpis.refundsPaise || 0)}`}
          icon={<Coins className="w-4 h-4" />}
        />
        <KpiCard
          title="Cancelled Bills"
          value={salesData?.kpis.cancelledBillsCount || 0}
          subtitle="Zeroed out transactions"
          icon={<AlertCircle className="w-4 h-4" />}
        />
      </div>

      {/* Deterministic Explained Insights Section */}
      {salesData?.insights && salesData.insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-subhead text-content-primary">
              Deterministic Insights & Performance Drivers
            </h3>
            <span className="text-[11px] text-content-muted">
              (Compared against 4-week weekday averages & historical baselines)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {salesData.insights.map((insight, idx) => (
              <InsightCardView key={idx} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Trend Chart (with Data Table Toggle) */}
      <TrendChart
        title={`Sales Over Time (${salesData?.chartData.length || 0} intervals)`}
        data={(salesData?.chartData || []).map((t) => ({
          date: t.date,
          label: t.label,
          netSalesPaise: t.netSalesPaise,
          ordersCount: t.ordersCount,
        }))}
      />

      {/* 24-Hour Sales Heatmap */}
      <Heatmap
        title="24-Hour Rush Intensity Heatmap"
        data={(salesData?.hourlyHeatmap || []).map((h) => ({
          hour: h.hour,
          salesPaise: h.netSalesPaise,
          ordersCount: h.ordersCount,
        }))}
      />

      {/* Breakdowns Row (Payment Methods & Dine-in vs Takeaway) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownBar
          title="Payment Method Breakdown"
          segments={(salesData?.paymentMix || []).map((p) => ({
            id: p.method,
            label: p.method.toUpperCase(),
            amountPaise: p.amountPaise,
            count: p.count,
            colorClass:
              p.method === 'cash'
                ? 'bg-emerald-500'
                : p.method === 'upi'
                  ? 'bg-blue-500'
                  : 'bg-purple-500',
          }))}
        />

        <BreakdownBar
          title="Order Type Breakdown (Dine-in vs Takeaway)"
          segments={(salesData?.orderTypes || []).map((ot) => ({
            id: ot.type,
            label: ot.type === 'dine_in' ? 'Dine-In' : 'Takeaway / Parcel',
            amountPaise: ot.netSalesPaise,
            count: ot.ordersCount,
            colorClass: ot.type === 'dine_in' ? 'bg-amber-500' : 'bg-cyan-500',
          }))}
        />
      </div>

      {/* Categories Breakdown */}
      {salesData?.categories && salesData.categories.length > 0 && (
        <BreakdownBar
          title="Revenue by Category Mix"
          segments={salesData.categories.map((cat) => ({
            id: cat.categoryId,
            label: cat.categoryName,
            amountPaise: cat.revenuePaise,
            count: cat.quantity,
          }))}
        />
      )}

      {/* Best & Worst Menu Performers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Performers */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-subhead text-content-primary">Top 10 Performers</h3>
            </div>
            <span className="text-xs text-content-secondary">By Total Revenue</span>
          </div>

          <div className="divide-y divide-surface-border pt-2 text-xs">
            {(itemsData?.bestSellers || []).length === 0 ? (
              <div className="py-6 text-center text-content-muted">No item data recorded yet</div>
            ) : (
              (itemsData?.bestSellers || []).map((item, idx) => (
                <div key={item.itemId} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-content-muted w-4">{idx + 1}.</span>
                    <div>
                      <span className="font-semibold text-content-primary">{item.itemName}</span>
                      <span className="text-[11px] text-content-muted block">
                        {item.categoryName} • {item.quantitySold} ordered
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-content-primary">
                    {formatPaiseToRupeeString(item.revenuePaise)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Worst Performers (with 7-day age guard) */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-subhead text-content-primary">Bottom 10 Performers</h3>
            </div>
            <span className="text-[11px] text-content-muted">Excluded if &lt; 7 days on menu</span>
          </div>

          <div className="divide-y divide-surface-border pt-2 text-xs">
            {(itemsData?.worstPerformers || []).length === 0 ? (
              <div className="py-6 text-center text-content-muted">
                No items eligible (all items active &gt; 7 days or zero items)
              </div>
            ) : (
              (itemsData?.worstPerformers || []).map((item, idx) => (
                <div key={item.itemId} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-content-muted w-4">{idx + 1}.</span>
                    <div>
                      <span className="font-semibold text-content-primary">{item.itemName}</span>
                      <span className="text-[11px] text-content-muted block">
                        {item.categoryName} • {item.daysOnMenu}d on menu • {item.quantitySold}{' '}
                        ordered
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-content-secondary">
                    {formatPaiseToRupeeString(item.revenuePaise)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Customer & Loyalty Snapshot */}
      {customerData && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-subhead text-content-primary">
                Customer & Loyalty Dynamics
              </h3>
            </div>
            <span className="text-xs text-content-secondary">Period Retention & Enrollment</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-surface-elevated rounded-lg">
              <span className="text-content-muted block">Total Guests Seen</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {customerData.totalCustomersSeen}
              </span>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <span className="text-content-muted block">New Guests Enrolled</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {customerData.newCustomersCount}
              </span>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <span className="text-content-muted block">Repeat Guests</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {customerData.returningCustomersCount} ({customerData.returningSharePercent}%)
              </span>
            </div>
            <div className="p-3 bg-surface-elevated rounded-lg">
              <span className="text-content-muted block">Loyalty Points Redeemed</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {customerData.totalLoyaltyPointsRedeemed} pts (
                {formatPaiseToRupeeString(customerData.totalLoyaltyDiscountPaise)})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
