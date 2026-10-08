import React, { useState } from 'react';
import { TableTile, type TableStatus } from '../../components/ui/TableTile.js';
import { SegmentedControl } from '../../components/ui/SegmentedControl.js';
import { Sheet } from '../../components/ui/Overlay.js';
import { Button } from '../../components/ui/Button.js';
import { QtyStepper, ItemCard } from '../../components/ui/QtyStepper.js';
import { StatusPill } from '../../components/ui/StatusPill.js';
import { useToastStore } from '../../stores/useToastStore.js';

interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  section: string;
  orderCount?: number;
  billAmountPaise?: number;
  occupiedMinutes?: number;
}

const mockTables: TableData[] = [
  { id: '1', number: 'T-01', capacity: 2, status: 'available', section: 'Indoor' },
  {
    id: '2',
    number: 'T-02',
    capacity: 4,
    status: 'occupied',
    section: 'Indoor',
    orderCount: 3,
    billAmountPaise: 145000,
    occupiedMinutes: 24,
  },
  {
    id: '3',
    number: 'T-03',
    capacity: 4,
    status: 'billing',
    section: 'Indoor',
    orderCount: 5,
    billAmountPaise: 290000,
    occupiedMinutes: 52,
  },
  { id: '4', number: 'T-04', capacity: 6, status: 'available', section: 'Indoor' },
  { id: '5', number: 'T-05', capacity: 2, status: 'reserved', section: 'Terrace' },
  {
    id: '6',
    number: 'T-06',
    capacity: 4,
    status: 'occupied',
    section: 'Terrace',
    orderCount: 2,
    billAmountPaise: 98000,
    occupiedMinutes: 14,
  },
  {
    id: '7',
    number: 'T-07',
    capacity: 8,
    status: 'occupied',
    section: 'VIP',
    orderCount: 7,
    billAmountPaise: 540000,
    occupiedMinutes: 40,
  },
  { id: '8', number: 'T-08', capacity: 4, status: 'available', section: 'VIP' },
];

export const WaiterHome: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<'All' | 'Indoor' | 'Terrace' | 'VIP'>(
    'All',
  );
  const [activeTable, setActiveTable] = useState<TableData | null>(null);
  const [dishQty, setDishQty] = useState(1);
  const { addToast } = useToastStore();

  const filtered =
    selectedSection === 'All'
      ? mockTables
      : mockTables.filter((t) => t.section === selectedSection);

  const handleOrderSubmit = () => {
    addToast({
      message: `Added items to Table ${activeTable?.number}`,
      type: 'success',
    });
    setActiveTable(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-bold text-content-primary">Floor Tables</h2>
          <p className="text-caption text-content-secondary">
            Select a table to take orders, punch KOT, or process billing.
          </p>
        </div>

        <SegmentedControl
          value={selectedSection}
          onChange={(val) => setSelectedSection(val as typeof selectedSection)}
          options={[
            { value: 'All', label: 'All (8)' },
            { value: 'Indoor', label: 'Indoor' },
            { value: 'Terrace', label: 'Terrace' },
            { value: 'VIP', label: 'VIP' },
          ]}
          size="md"
        />
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((table) => (
          <TableTile
            key={table.id}
            tableNumber={table.number}
            capacity={table.capacity}
            status={table.status}
            section={table.section}
            orderCount={table.orderCount}
            billAmountPaise={table.billAmountPaise}
            occupiedMinutes={table.occupiedMinutes}
            onClick={() => setActiveTable(table)}
          />
        ))}
      </div>

      {/* Table Detail Sheet */}
      <Sheet
        isOpen={Boolean(activeTable)}
        onClose={() => setActiveTable(null)}
        title={activeTable ? `Table ${activeTable.number} Overview` : ''}
        description={
          activeTable
            ? `Section: ${activeTable.section} • Capacity: ${activeTable.capacity} guests`
            : ''
        }
      >
        {activeTable && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-elevated border border-surface-border">
              <div>
                <span className="text-caption text-content-muted block">Current Status</span>
                <span className="text-body font-bold text-content-primary uppercase">
                  {activeTable.status}
                </span>
              </div>
              <StatusPill
                status={activeTable.status === 'occupied' ? 'preparing' : 'ready'}
                label={activeTable.status === 'occupied' ? 'Dining Active' : 'Ready'}
              />
            </div>

            <div>
              <h4 className="text-body font-bold text-content-primary mb-3">Quick Add Item</h4>
              <ItemCard
                id="paneer-tikka"
                name="Paneer Tikka Masala"
                pricePaise={34000}
                diet="veg"
                category="Main"
                quantity={dishQty}
                onQuantityChange={setDishQty}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-surface-border">
              <div>
                <span className="text-xs text-content-muted block">Quantity</span>
                <QtyStepper value={dishQty} onChange={setDishQty} size="md" />
              </div>

              <Button variant="primary" size="lg" onClick={handleOrderSubmit}>
                Confirm Order
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};
