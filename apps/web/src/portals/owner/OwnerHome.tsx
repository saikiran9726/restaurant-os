import React, { useState } from 'react';
import { KpiCard, InsightCard, AlertCard } from '../../components/ui/Cards.js';
import { DataTable, type Column } from '../../components/ui/DataTable.js';
import { StatusPill, type OrderStatus } from '../../components/ui/StatusPill.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { DollarSign, Utensils, Users, Clock, Download } from 'lucide-react';
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
  const { addToast } = useToastStore();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [sortCol, setSortCol] = useState('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

      {/* Critical Alert Notice if late orders spike */}
      <AlertCard
        severity="warning"
        title="Kitchen Delay Alert on Table 07"
        message="Order #ORD-2040 has exceeded the 15-minute preparation threshold by 6 minutes."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => addToast({ message: 'Kitchen manager notified', type: 'info' })}
          >
            Notify Kitchen
          </Button>
        }
      />

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

      {/* AI / Heuristic Insight Card */}
      <InsightCard
        tag="Revenue Optimization"
        title="High Beverage Attachment Opportunity in Terrace Section"
        description="Terrace tables average 38% longer dwell time but 22% lower beverage re-orders. Training servers to prompt dessert & drink refills at the 30-minute mark can yield ~₹8,400 added daily revenue."
        actionText="Apply Shift Briefing Note"
        onAction={() =>
          addToast({ message: 'Shift note queued for floor briefing', type: 'success' })
        }
      />

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
