import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { localDb } from '../../db/dexie.js';
import { TableTile, type TableStatus } from '../../components/ui/TableTile.js';
import { SegmentedControl } from '../../components/ui/SegmentedControl.js';
import { Button } from '../../components/ui/Button.js';
import { GuestCountSheet } from '../../components/GuestCountSheet.js';
import { POSView } from './POSView.js';
import { useCartStore } from '../../stores/useCartStore.js';
import type { TableModel } from '@restaurant-os/shared';
import { ShoppingBag, RefreshCw } from 'lucide-react';

export const WaiterHome: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [isPOSOpen, setIsPOSOpen] = useState(false);
  const [selectedTableForGuests, setSelectedTableForGuests] = useState<
    (TableModel & { status?: string }) | null
  >(null);

  const { initNewOrder } = useCartStore();

  // Query tables (caches to localDb for offline operation)
  const {
    data: tables = [],
    refetch,
    isFetching,
  } = useQuery<Array<TableModel & { status?: string }>>({
    queryKey: ['waiter-tables'],
    queryFn: async () => {
      try {
        const res = await apiFetch<Array<TableModel & { status?: string }>>('/tables');
        await localDb.floorTables.bulkPut(res);
        return res;
      } catch (err) {
        const local = await localDb.floorTables.toArray();
        return local;
      }
    },
    staleTime: 10 * 1000,
  });

  const activeTables = tables.filter((t) => t.active);

  // Sections
  const sections = ['All', ...Array.from(new Set(activeTables.map((t) => t.section || 'Main')))];

  const filtered =
    selectedSection === 'All'
      ? activeTables
      : activeTables.filter((t) => (t.section || 'Main') === selectedSection);

  // Table tap handler: opens guest count sheet
  const handleTableClick = (table: TableModel) => {
    setSelectedTableForGuests(table);
  };

  // Guest count confirmation -> opens POS view for that table
  const handleConfirmGuests = (guestCount: number) => {
    if (!selectedTableForGuests) return;
    initNewOrder({
      tableId: selectedTableForGuests.id,
      tableLabel: selectedTableForGuests.label,
      type: 'dine_in',
      guests: guestCount,
    });
    setSelectedTableForGuests(null);
    setIsPOSOpen(true);
  };

  // Takeaway button -> opens POS view with no table
  const handleTakeawayClick = () => {
    initNewOrder({
      tableId: null,
      tableLabel: null,
      type: 'takeaway',
      guests: 1,
    });
    setIsPOSOpen(true);
  };

  if (isPOSOpen) {
    return <POSView onBackToTables={() => setIsPOSOpen(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-bold text-content-primary">Floor Tables</h2>
          <p className="text-caption text-content-secondary">
            Select a table to start ordering, or take a quick takeaway order.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={handleTakeawayClick}
            className="flex items-center gap-2 font-bold"
          >
            <ShoppingBag className="w-4 h-4 text-accent" />
            <span>Takeaway Order</span>
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={() => refetch()}
            aria-label="Refresh floor status"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Section Filter */}
      {sections.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <SegmentedControl
            value={selectedSection}
            onChange={(val) => setSelectedSection(val)}
            options={sections.map((s) => ({ value: s, label: s }))}
            size="md"
          />
        </div>
      )}

      {/* Grid of Tables */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((table) => {
          // Map DB status to TableTile status format
          let mappedStatus: TableStatus = 'available';
          if (
            table.status === 'occupied' ||
            table.status === 'ordering' ||
            table.status === 'preparing'
          ) {
            mappedStatus = 'occupied';
          } else if (table.status === 'payment_pending' || table.status === 'ready') {
            mappedStatus = 'billing';
          }

          return (
            <TableTile
              key={table.id}
              tableNumber={table.label}
              capacity={table.capacity}
              status={mappedStatus}
              section={table.section || undefined}
              onClick={() => handleTableClick(table)}
            />
          );
        })}
      </div>

      {/* Guest Count Sheet */}
      {selectedTableForGuests && (
        <GuestCountSheet
          isOpen={Boolean(selectedTableForGuests)}
          tableLabel={selectedTableForGuests.label}
          defaultGuests={2}
          onClose={() => setSelectedTableForGuests(null)}
          onConfirm={handleConfirmGuests}
        />
      )}
    </div>
  );
};
