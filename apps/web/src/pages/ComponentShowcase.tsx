import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Bell, Heart, Sun, Moon } from 'lucide-react';
import {
  Button,
  IconButton,
  VegMark,
  StatusPill,
  TimerBadge,
  SegmentedControl,
  Chip,
  QtyStepper,
  ItemCard,
  TableTile,
  KpiCard,
  InsightCard,
  AlertCard,
  DataTable,
  Sheet,
  Dialog,
  Banner,
  EmptyState,
  Skeleton,
  Stepper,
} from '../components/ui/index.js';
import { useToastStore } from '../stores/useToastStore.js';
import { useThemeStore } from '../stores/useThemeStore.js';

export const ComponentShowcase: React.FC = () => {
  const { addToast } = useToastStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();

  // Component demo state
  const [btnLoading, setBtnLoading] = useState(false);
  const [segVal, setSegVal] = useState<'A' | 'B' | 'C'>('A');
  const [chipSelected, setChipSelected] = useState(true);
  const [qty, setQty] = useState(2);
  const [activeStep, setActiveStep] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-surface-border bg-surface-card flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary"
            aria-label="Back to Portal Hub"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-title font-extrabold text-content-primary">
              Design System Showcase
            </h1>
            <span className="text-xs text-content-muted">
              Interactive Component Library • /dev/components
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            leftIcon={
              resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
            }
          >
            {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-12" role="main">
        {/* Intro */}
        <section aria-labelledby="tokens-heading" className="space-y-4">
          <h2 id="tokens-heading" className="text-headline font-extrabold text-content-primary">
            Design Tokens & Principles
          </h2>
          <p className="text-body text-content-secondary max-w-3xl">
            Built on a 4-pt spacing grid, 8px/12px border radii, WCAG AA compliant contrast, and
            high-visibility touch targets (&ge; 48px). Currency is calculated in integer paise.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                Accent Token
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-5 h-5 rounded-full bg-accent" />
                <span className="font-mono text-caption">#0f766e (Deep Teal)</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                Type Scale
              </span>
              <span className="font-mono text-caption mt-2 block">14 / 16 / 18 / 22 / 28 / 40</span>
            </div>
            <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">Motion</span>
              <span className="font-mono text-caption mt-2 block">Press 80ms • Sheet 200ms</span>
            </div>
            <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                Kitchen Scale
              </span>
              <span className="font-mono text-caption mt-2 block">+25% High Contrast</span>
            </div>
          </div>
        </section>

        {/* 1. Buttons */}
        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2
            id="buttons-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            1. Buttons & IconButtons (S / M / L / XL)
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="primary">
              Small (32px)
            </Button>
            <Button size="md" variant="primary">
              Medium (40px)
            </Button>
            <Button size="lg" variant="primary">
              Large (48px Touch)
            </Button>
            <Button size="xl" variant="primary">
              Extra Large (56px)
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>
              Danger
            </Button>
            <Button
              variant="primary"
              isLoading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 1500);
              }}
            >
              {btnLoading ? 'Saving...' : 'Click for Loading State'}
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <IconButton aria-label="Favorite" variant="secondary" size="md">
              <Heart className="w-5 h-5 text-red-500" />
            </IconButton>
            <IconButton aria-label="Add item" variant="primary" size="lg">
              <Plus className="w-5 h-5" />
            </IconButton>
            <IconButton aria-label="Notification" variant="outline" size="lg">
              <Bell className="w-5 h-5" />
            </IconButton>
          </div>
        </section>

        {/* 2. Status Pills & Food Identity */}
        <section aria-labelledby="status-heading" className="space-y-4">
          <h2
            id="status-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            2. StatusPills & VegMarks (Color + Shape Accessible)
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status="new" />
            <StatusPill status="preparing" />
            <StatusPill status="ready" />
            <StatusPill status="late" />
            <StatusPill status="overdue" />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <VegMark type="veg" size="lg" />
              <span className="text-body font-semibold">Vegetarian (Square + Circle Dot)</span>
            </div>
            <div className="flex items-center gap-2">
              <VegMark type="nonveg" size="lg" />
              <span className="text-body font-semibold">
                Non-Vegetarian (Square + Distinct Triangle)
              </span>
            </div>
          </div>
        </section>

        {/* 3. Timer Badges */}
        <section aria-labelledby="timer-heading" className="space-y-4">
          <h2
            id="timer-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            3. TimerBadge (mm:ss Format & Severity States)
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <TimerBadge seconds={185} state="normal" size="lg" />
            <TimerBadge seconds={540} state="warning" size="lg" />
            <TimerBadge seconds={870} state="late" size="lg" />
            <TimerBadge seconds={1340} state="overdue" size="lg" />
          </div>
        </section>

        {/* 4. Controls: SegmentedControl, Chips, Stepper, QtyStepper */}
        <section aria-labelledby="controls-heading" className="space-y-4">
          <h2
            id="controls-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            4. Interactive Controls & Steppers
          </h2>
          <div className="space-y-4">
            <div>
              <span className="text-caption text-content-muted block mb-2">Segmented Control</span>
              <SegmentedControl
                value={segVal}
                onChange={(v) => setSegVal(v as typeof segVal)}
                options={[
                  { value: 'A', label: 'Dine-In', badge: 12 },
                  { value: 'B', label: 'Takeaway', badge: 4 },
                  { value: 'C', label: 'Delivery' },
                ]}
                size="md"
              />
            </div>

            <div className="flex items-center gap-3">
              <Chip selected={chipSelected} onClick={() => setChipSelected(!chipSelected)}>
                Filter: Main Courses
              </Chip>
              <Chip
                selected={false}
                onRemove={() => addToast({ message: 'Chip removed', type: 'info' })}
              >
                North Indian
              </Chip>
            </div>

            <div>
              <span className="text-caption text-content-muted block mb-2">
                Quantity Stepper (&ge; 48px touch)
              </span>
              <QtyStepper value={qty} onChange={setQty} size="lg" />
            </div>

            <div className="pt-2">
              <span className="text-caption text-content-muted block mb-3">Workflow Stepper</span>
              <Stepper
                currentStep={activeStep}
                onStepClick={setActiveStep}
                steps={[
                  { id: 1, title: 'Select Table' },
                  { id: 2, title: 'Punch KOT' },
                  { id: 3, title: 'Bill Settlement' },
                ]}
              />
            </div>
          </div>
        </section>

        {/* 5. Food Item & Table Cards */}
        <section aria-labelledby="cards-heading" className="space-y-4">
          <h2
            id="cards-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            5. Domain Cards (ItemCard & TableTile)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ItemCard
              id="item-demo"
              name="Chicken Dum Biryani (Hyderabadi)"
              pricePaise={38000}
              diet="nonveg"
              category="Biryani"
              description="Slow-cooked fragrant basmati rice with marinated chicken pieces and saffron."
              quantity={qty}
              onQuantityChange={setQty}
            />

            <TableTile
              tableNumber="T-09"
              capacity={4}
              status="occupied"
              section="Terrace"
              orderCount={3}
              billAmountPaise={184000}
              occupiedMinutes={35}
            />
          </div>
        </section>

        {/* 6. Executive & Alert Cards */}
        <section aria-labelledby="executive-heading" className="space-y-4">
          <h2
            id="executive-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            6. KPI, Insight & Alert Cards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard title="Daily Volume" value="₹84,200" changePercent={12.5} />
            <AlertCard
              severity="danger"
              title="Low Inventory Warning"
              message="Paneer stock below threshold for evening service."
            />
          </div>

          <InsightCard
            tag="Staff Efficiency"
            title="Fastest KOT Dispatch Recorded by Server Priya"
            description="Table turnaround dropped from 48 mins to 36 mins on Terrace section."
            actionText="Acknowledge in Shift Log"
            onAction={() => addToast({ message: 'Saved to shift log', type: 'success' })}
          />

          <div className="pt-4">
            <span className="text-caption font-bold text-content-muted block mb-3 uppercase">
              Accessible Data Table Demo
            </span>
            <DataTable
              columns={[
                { key: 'item', header: 'Menu Item' },
                { key: 'category', header: 'Category' },
                { key: 'orders', header: 'Orders Today', align: 'center' },
                { key: 'revenue', header: 'Revenue', align: 'right' },
              ]}
              data={[
                {
                  id: '1',
                  item: 'Butter Chicken',
                  category: 'Main',
                  orders: 42,
                  revenue: '₹19,320',
                },
                { id: '2', item: 'Dal Makhani', category: 'Main', orders: 38, revenue: '₹10,640' },
                { id: '3', item: 'Garlic Naan', category: 'Breads', orders: 95, revenue: '₹6,650' },
              ]}
              keyExtractor={(r) => r.id}
            />
          </div>
        </section>

        {/* 7. Banners, Skeletons & Empty States */}
        <section aria-labelledby="system-elements-heading" className="space-y-4">
          <h2
            id="system-elements-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            7. Banners, Skeletons & Empty State
          </h2>
          <Banner variant="offline" message="Offline Mode (Changes will queue locally)" />
          <Banner variant="sync" message="Syncing offline orders to database..." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border space-y-3">
              <span className="text-caption font-bold text-content-muted block">
                Skeleton Shimmer
              </span>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="rectangular" height={80} />
            </div>

            <EmptyState
              title="No Reservations Yet"
              description="Bookings for this evening will appear here once guest calls arrive."
              action={{
                label: 'Create Manual Booking',
                onClick: () => addToast({ message: 'Opening reservation modal', type: 'info' }),
              }}
            />
          </div>
        </section>

        {/* 8. Overlays & Toasts */}
        <section aria-labelledby="overlays-heading" className="space-y-4">
          <h2
            id="overlays-heading"
            className="text-title font-bold text-content-primary pb-2 border-b border-surface-border"
          >
            8. Overlays: Sheet, Dialog & Toast Notifications
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              Open Bottom Sheet
            </Button>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Open Dialog Modal
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                addToast({
                  message: 'Order #ORD-1044 placed successfully!',
                  type: 'success',
                })
              }
            >
              Trigger Success Toast (3s Auto-Dismiss)
            </Button>
          </div>

          {/* Interactive Sheet Demo */}
          <Sheet
            isOpen={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Slide-over Drawer"
            description="Accessible drawer sheet closing on Escape key or backdrop click with 200ms ease-out motion."
          >
            <div className="space-y-4 py-2">
              <p className="text-body text-content-secondary">
                Sheets are ideal for waiter order pads, modifier selection, and mobile-friendly
                detail views.
              </p>
              <Button variant="primary" className="w-full" onClick={() => setSheetOpen(false)}>
                Done
              </Button>
            </div>
          </Sheet>

          {/* Interactive Dialog Demo */}
          <Dialog
            isOpen={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Confirm Void Action"
            description="Are you sure you want to cancel KOT #102?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDialogOpen(false);
                    addToast({ message: 'Ticket voided', type: 'danger' });
                  }}
                >
                  Void Ticket
                </Button>
              </>
            }
          >
            <p className="text-body text-content-secondary">
              Voided tickets require manager override notes for audit compliance.
            </p>
          </Dialog>
        </section>
      </main>
    </div>
  );
};

export default ComponentShowcase;
