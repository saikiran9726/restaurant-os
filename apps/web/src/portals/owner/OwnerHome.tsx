import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { KpiCard, InsightCard, AlertCard } from '../../components/ui/Cards.js';
import { DataTable, type Column } from '../../components/ui/DataTable.js';
import { StatusPill, type OrderStatus } from '../../components/ui/StatusPill.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { ActionAlertCard } from '../../components/alerts-insights/ActionAlertCard.js';
import { BusinessInsightCard } from '../../components/alerts-insights/BusinessInsightCard.js';
import { AllClearState } from '../../components/alerts-insights/AllClearState.js';
import {
  formatPaiseToRupeeString,
  type HealthScoreResult,
  type AlertOutput,
  type InsightOutput,
} from '@restaurant-os/shared';
import {
  DollarSign,
  Utensils,
  Users,
  Clock,
  Download,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useToastStore } from '../../stores/useToastStore.js';

interface RecentOrderRow {
  id: string;
  orderNum: string;
  table: string;
  server: string;
  itemsCount: number;
  totalPaise: number;
  status: OrderStatus;
  time: string;
}

const mockOrders: RecentOrderRow[] = [
  {
    id: '1',
    orderNum: '#ORD-2041',
    table: 'T-02',
    server: 'Rahul S.',
    itemsCount: 4,
    totalPaise: 145000,
    status: 'preparing',
    time: '12:42 PM',
  },
  {
    id: '2',
    orderNum: '#ORD-2040',
    table: 'T-07',
    server: 'Priya K.',
    itemsCount: 6,
    totalPaise: 540000,
    status: 'late',
    time: '12:35 PM',
  },
  {
    id: '3',
    orderNum: '#ORD-2039',
    table: 'T-03',
    server: 'Rahul S.',
    itemsCount: 5,
    totalPaise: 290000,
    status: 'ready',
    time: '12:28 PM',
  },
  {
    id: '4',
    orderNum: '#ORD-2038',
    table: 'T-01',
    server: 'Kiran M.',
    itemsCount: 2,
    totalPaise: 68000,
    status: 'new',
    time: '12:20 PM',
  },
  {
    id: '5',
    orderNum: '#ORD-2037',
    table: 'T-06',
    server: 'Priya K.',
    itemsCount: 3,
    totalPaise: 98000,
    status: 'ready',
    time: '12:15 PM',
  },
];

export const OwnerHome: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [sortCol, setSortCol] = useState('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: healthData } = useQuery<HealthScoreResult>({
    queryKey: ['health-score'],
    queryFn: () => apiFetch('/health-score'),
    staleTime: 60000,
  });

  const { data: openAlerts = [], refetch: refetchAlerts } = useQuery<AlertOutput[]>({
    queryKey: ['alerts', 'open'],
    queryFn: () => apiFetch('/alerts?status=open'),
    staleTime: 30000,
  });

  const { data: businessInsights = [], refetch: refetchInsights } = useQuery<InsightOutput[]>({
    queryKey: ['insights'],
    queryFn: () => apiFetch('/insights'),
    staleTime: 60000,
  });

  const handleAcknowledgeAlert = async (alertId: string, note: string) => {
    try {
      await apiFetch(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      addToast({ message: 'Alert acknowledged and resolved', type: 'success' });
      refetchAlerts();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to acknowledge alert', type: 'danger' });
    }
  };

  const handleSnoozeAlert = async (alertId: string, duration: '1d' | '7d') => {
    try {
      await apiFetch(`/alerts/${alertId}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ duration }),
      });
      addToast({ message: 'Alert snoozed', type: 'info' });
      refetchAlerts();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to snooze alert', type: 'danger' });
    }
  };

  const handleDismissAlert = async (alertId: string, reason: string) => {
    try {
      await apiFetch(`/alerts/${alertId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      addToast({ message: 'Alert dismissed', type: 'info' });
      refetchAlerts();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to dismiss alert', type: 'danger' });
    }
  };

  const handleDismissInsight = async (insightId: string) => {
    try {
      await apiFetch(`/insights/${insightId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ dismissed: true }),
      });
      addToast({ message: 'Insight dismissed', type: 'info' });
      refetchInsights();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to dismiss insight', type: 'danger' });
    }
  };

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  };

  const columns: Column<RecentOrderRow>[] = [
    { key: 'orderNum', header: 'Order ID', sortable: true },
    { key: 'table', header: 'Table', sortable: true },
    { key: 'server', header: 'Server' },
    { key: 'itemsCount', header: 'Items', align: 'center' },
    {
      key: 'totalPaise',
      header: 'Total Bill',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-content-primary">
          {formatPaiseToRupeeString(row.totalPaise)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusPill status={row.status} size="sm" />,
    },
    { key: 'time', header: 'Time', align: 'right', sortable: true },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Business Pulse</h2>
          <p className="text-caption text-content-secondary">
            Real-time financial performance and table occupancy across all dining sections.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={() => setIsExportOpen(true)}
        >
          Export Report
        </Button>
      </div>

      {/* ATTENTION REQUIRED (Action-Only Alerts) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="text-subhead font-extrabold text-content-primary">ATTENTION REQUIRED</h3>
            {openAlerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-500 text-white shadow-sm">
                {openAlerts.length}
              </span>
            )}
          </div>

          {openAlerts.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="text-xs font-bold text-accent hover:underline"
            >
              {showAllAlerts ? 'Show less (5)' : `Show all (${openAlerts.length})`}
            </button>
          )}
        </div>

        {openAlerts.length === 0 ? (
          <AllClearState />
        ) : (
          <div className="space-y-3">
            {(showAllAlerts ? openAlerts : openAlerts.slice(0, 5)).map((alert) => (
              <ActionAlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledgeAlert}
                onSnooze={handleSnoozeAlert}
                onDismiss={handleDismissAlert}
                onNavigateAction={(url) => navigate(url)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Compact Health Score Card */}
      {healthData && healthData.overallScore !== null && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-headline font-black ${
                  healthData.scoreBand === 'strong'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : healthData.scoreBand === 'stable'
                      ? 'text-blue-600 dark:text-blue-400'
                      : healthData.scoreBand === 'needs_attention'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                }`}
              >
                {healthData.overallScore}
              </span>
              <span className="text-xs text-content-muted font-bold">/ 100</span>
            </div>

            <div className="border-l border-surface-border pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-content-primary">
                  Restaurant Health Score
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-surface-elevated text-content-secondary border border-surface-border">
                  {healthData.scoreBand.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-content-secondary mt-0.5">
                {healthData.reasonsForChange.length > 0
                  ? healthData.reasonsForChange[0]!.explanation
                  : `Evaluated across ${healthData.factorsUsedCount} operational factors.`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/owner/health')}
            className="text-xs font-bold text-accent flex items-center gap-1 shrink-0 hover:bg-accent/10"
          >
            <span>View Health Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Today's Revenue"
          value="₹1,24,850"
          changePercent={18.4}
          changePeriod="vs same time yesterday"
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
        />
        <KpiCard
          title="Active Occupancy"
          value="18 / 24"
          subtitle="75% floor capacity utilized"
          icon={<Users className="w-5 h-5 text-blue-500" />}
        />
        <KpiCard
          title="Avg Ticket Size"
          value="₹1,820"
          changePercent={4.2}
          changePeriod="vs last week"
          icon={<Utensils className="w-5 h-5 text-purple-500" />}
        />
        <KpiCard
          title="Table Turn Time"
          value="42 min"
          changePercent={-8.1}
          changePeriod="faster service"
          icon={<Clock className="w-5 h-5 text-amber-500" />}
        />
      </div>

      {/* Business Insights (Max 6, Ranked by Materiality, Evidence Backed) */}
      {businessInsights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="text-subhead font-extrabold text-content-primary">
                Daily Business Insights
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/owner/insights')}
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>View All Insights</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {businessInsights.map((insight) => (
              <BusinessInsightCard
                key={insight.id}
                insight={insight}
                onDismiss={handleDismissInsight}
              />
            ))}
          </div>
        </section>
      )}

      {/* Real-time Order Log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-subhead font-bold text-content-primary">Recent Floor Activity</h3>
          <span className="text-caption text-content-muted">5 latest orders</span>
        </div>

        <DataTable
          columns={columns}
          data={mockOrders}
          keyExtractor={(r) => r.id}
          sortColumn={sortCol}
          sortDirection={sortDir}
          onSort={handleSort}
        />
      </div>

      {/* Export Report Dialog Modal */}
      <Dialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Export Performance Report"
        description="Select format and date range for your financial audit export."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setIsExportOpen(false);
                addToast({ message: 'CSV report download started', type: 'success' });
              }}
            >
              Download CSV
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <p className="text-body text-content-secondary">
            Reports include itemized sales, waiter speed metrics, and gross margins in compliance
            with local tax standards.
          </p>
          <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border text-caption font-mono">
            Date range: Today (08 Oct 2026) • All 3 Sessions (Lunch, High-Tea, Dinner)
          </div>
        </div>
      </Dialog>
    </div>
  );
};
