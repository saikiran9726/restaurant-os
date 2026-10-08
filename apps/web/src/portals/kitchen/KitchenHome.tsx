import React, { useState } from 'react';
import { TimerBadge, type TimerSeverity } from '../../components/ui/TimerBadge.js';
import { StatusPill } from '../../components/ui/StatusPill.js';
import { VegMark } from '../../components/ui/VegMark.js';
import { Button } from '../../components/ui/Button.js';
import { SegmentedControl } from '../../components/ui/SegmentedControl.js';
import { useKitchenStore } from '../../stores/useKitchenStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface TicketItem {
  id: string;
  name: string;
  qty: number;
  diet: 'veg' | 'nonveg';
  notes?: string;
}

interface KitchenTicket {
  id: string;
  ticketNumber: string;
  tableNumber: string;
  waiterName: string;
  elapsedSeconds: number;
  severity: TimerSeverity;
  status: 'new' | 'preparing' | 'late' | 'overdue';
  items: TicketItem[];
}

const mockTickets: KitchenTicket[] = [
  {
    id: 'k-101',
    ticketNumber: '#101',
    tableNumber: 'T-02',
    waiterName: 'Rahul S.',
    elapsedSeconds: 245, // 04:05
    severity: 'normal',
    status: 'preparing',
    items: [
      { id: '1', name: 'Butter Chicken', qty: 1, diet: 'nonveg', notes: 'Medium spice' },
      { id: '2', name: 'Garlic Naan', qty: 2, diet: 'veg' },
      { id: '3', name: 'Jeera Rice', qty: 1, diet: 'veg' },
    ],
  },
  {
    id: 'k-102',
    ticketNumber: '#102',
    tableNumber: 'T-07',
    waiterName: 'Priya K.',
    elapsedSeconds: 840, // 14:00
    severity: 'late',
    status: 'late',
    items: [
      { id: '4', name: 'Paneer Tikka Platter', qty: 2, diet: 'veg', notes: 'Extra mint chutney' },
      { id: '5', name: 'Dal Makhani', qty: 1, diet: 'veg' },
      { id: '6', name: 'Tandoori Roti', qty: 4, diet: 'veg' },
    ],
  },
  {
    id: 'k-103',
    ticketNumber: '#103',
    tableNumber: 'T-06',
    waiterName: 'Rahul S.',
    elapsedSeconds: 1320, // 22:00
    severity: 'overdue',
    status: 'overdue',
    items: [
      { id: '7', name: 'Chicken Biryani', qty: 2, diet: 'nonveg', notes: 'Double mirchi salan' },
      { id: '8', name: 'Raita', qty: 2, diet: 'veg' },
    ],
  },
];

export const KitchenHome: React.FC = () => {
  const { rushMode } = useKitchenStore();
  const { addToast } = useToastStore();
  const [tickets, setTickets] = useState(mockTickets);
  const [station, setStation] = useState<'All' | 'Grill' | 'Curry' | 'Breads'>('All');

  const handleBump = (ticketId: string, ticketNumber: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    addToast({
      message: `Ticket ${ticketNumber} bumped / completed!`,
      type: 'success',
    });
  };

  return (
    <div className="space-y-6">
      {/* Rush Mode Banner */}
      {rushMode && (
        <div
          role="alert"
          className="rounded-xl bg-red-600/20 border-2 border-red-500 p-4 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" aria-hidden="true" />
            <div>
              <span className="text-title font-black uppercase tracking-wider block">
                Rush Mode Priority Active
              </span>
              <span className="text-body text-red-200">
                Prep stations focused on fast-track appetizers and immediate batch items.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Station Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SegmentedControl
          value={station}
          onChange={(val) => setStation(val as typeof station)}
          options={[
            { value: 'All', label: 'All Stations' },
            { value: 'Grill', label: 'Tandoor & Grill' },
            { value: 'Curry', label: 'Main Curries' },
            { value: 'Breads', label: 'Breads & Rice' },
          ]}
          size="lg"
        />

        <div className="text-right">
          <span className="text-caption font-bold text-content-muted uppercase">
            Active Tickets:
          </span>{' '}
          <span className="text-title font-mono font-black text-content-primary">
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Ticket Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            className="rounded-2xl border-2 border-surface-border bg-surface-card flex flex-col justify-between shadow-xl overflow-hidden select-none"
          >
            {/* Ticket Header */}
            <div className="p-4 bg-surface-elevated border-b-2 border-surface-border flex items-center justify-between">
              <div>
                <span className="text-title font-black text-content-primary">
                  {ticket.ticketNumber} • {ticket.tableNumber}
                </span>
                <span className="text-caption text-content-muted block">
                  Server: {ticket.waiterName}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <TimerBadge seconds={ticket.elapsedSeconds} state={ticket.severity} size="lg" />
              </div>
            </div>

            {/* Ticket Items */}
            <div className="p-5 flex-1 divide-y divide-surface-border/60">
              {ticket.items.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <span className="text-title font-black text-accent min-w-[32px]">
                    {item.qty}×
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <VegMark type={item.diet} size="sm" />
                      <span className="text-body font-bold text-content-primary">{item.name}</span>
                    </div>
                    {item.notes && (
                      <span className="inline-block mt-1 text-caption text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                        Note: {item.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ticket Actions (>= 48px touch target) */}
            <div className="p-4 bg-surface-elevated/50 border-t-2 border-surface-border flex items-center justify-between gap-3">
              <StatusPill status={ticket.status} size="lg" />

              <Button
                variant="primary"
                size="lg"
                onClick={() => handleBump(ticket.id, ticket.ticketNumber)}
                leftIcon={<CheckCircle className="w-5 h-5" />}
                className="font-bold flex-1"
              >
                Bump Order
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
