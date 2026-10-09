import React, { useState } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { Users, Minus, Plus } from 'lucide-react';

interface GuestCountSheetProps {
  isOpen: boolean;
  tableLabel: string;
  defaultGuests?: number;
  onClose: () => void;
  onConfirm: (guestCount: number) => void;
}

export const GuestCountSheet: React.FC<GuestCountSheetProps> = ({
  isOpen,
  tableLabel,
  defaultGuests = 2,
  onClose,
  onConfirm,
}) => {
  const [guests, setGuests] = useState(defaultGuests);

  // Quick picker chips
  const quickCounts = [1, 2, 3, 4, 6, 8];

  const handleConfirm = () => {
    onConfirm(guests);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Table ${tableLabel} Seating`}
      description="Select number of guests to start order"
    >
      <div className="space-y-6 pt-2">
        <div className="flex flex-col items-center justify-center p-6 bg-surface-elevated rounded-2xl border border-surface-border">
          <div className="flex items-center gap-2 text-content-secondary mb-3">
            <Users className="w-5 h-5 text-accent" />
            <span className="text-body font-semibold">Guest Count</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              disabled={guests <= 1}
              aria-label="Decrease guest count"
              className="w-12 h-12 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center text-content-primary hover:bg-surface-canvas active:scale-95 disabled:opacity-40 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>

            <span className="text-4xl font-extrabold font-mono text-content-primary min-w-[3rem] text-center">
              {guests}
            </span>

            <button
              type="button"
              onClick={() => setGuests((g) => Math.min(50, g + 1))}
              disabled={guests >= 50}
              aria-label="Increase guest count"
              className="w-12 h-12 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center text-content-primary hover:bg-surface-canvas active:scale-95 disabled:opacity-40 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Quick count chips for 1-tap select */}
        <div>
          <span className="text-caption text-content-muted block mb-2">Quick Select</span>
          <div className="grid grid-cols-6 gap-2">
            {quickCounts.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setGuests(count)}
                className={`py-2 rounded-lg font-bold text-caption border transition-all ${
                  guests === count
                    ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                    : 'bg-surface-card text-content-secondary border-surface-border hover:bg-surface-elevated'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-surface-border flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" size="lg" onClick={handleConfirm}>
            Start Order ({guests} {guests === 1 ? 'Guest' : 'Guests'})
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
