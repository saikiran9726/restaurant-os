import React, { useState } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { AlertTriangle, Key } from 'lucide-react';

interface ReasonSheetProps {
  isOpen: boolean;
  itemName: string;
  isPrepared?: boolean;
  onClose: () => void;
  onConfirm: (reason: string, managerPin?: string) => void;
}

const QUICK_REASONS = [
  'Customer changed mind',
  'Ordered by mistake',
  'Wait time too long',
  'Table cancelled / left',
  'Food preparation issue',
];

export const ReasonSheet: React.FC<ReasonSheetProps> = ({
  isOpen,
  itemName,
  isPrepared = false,
  onClose,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState(QUICK_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [managerPin, setManagerPin] = useState('');

  const finalReason = customReason.trim() || selectedReason;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalReason) return;
    onConfirm(finalReason, isPrepared ? managerPin : undefined);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel "${itemName}"`}
      description="Select reason for cancellation after sending to kitchen."
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {isPrepared && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="text-caption">
              <span className="font-bold block">Item Already Prepared</span>
              Kitchen has completed this item. An Owner or Manager PIN is required to proceed with
              cancellation.
            </div>
          </div>
        )}

        <div>
          <label className="text-caption font-semibold text-content-secondary block mb-2">
            Quick Reason
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setSelectedReason(reason);
                  setCustomReason('');
                }}
                className={`p-2.5 rounded-xl border text-left text-caption font-medium transition-all ${
                  selectedReason === reason && !customReason
                    ? 'bg-accent/15 border-accent text-accent font-bold'
                    : 'bg-surface-elevated border-surface-border text-content-secondary hover:bg-surface-canvas'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-caption font-semibold text-content-secondary block mb-1">
            Or Custom Reason
          </label>
          <input
            type="text"
            placeholder="Type cancellation note..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            className="w-full text-body px-3.5 py-2.5 rounded-xl bg-surface-card border border-surface-border text-content-primary focus:outline-none focus:border-accent"
          />
        </div>

        {isPrepared && (
          <div>
            <label className="text-caption font-semibold text-content-secondary flex items-center gap-1.5 mb-1">
              <Key className="w-4 h-4 text-accent" />
              <span>Manager PIN (4-6 digits)</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              className="w-full text-title font-mono tracking-widest text-center px-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-content-primary focus:outline-none focus:border-accent"
              required
            />
          </div>
        )}

        <div className="pt-3 border-t border-surface-border flex gap-3">
          <Button variant="ghost" className="flex-1" type="button" onClick={onClose}>
            Back
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            size="lg"
            type="submit"
            disabled={!finalReason || (isPrepared && !managerPin)}
          >
            Confirm Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
