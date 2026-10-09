import React, { useState } from 'react';
import { Dialog } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { KeyRound, ShieldAlert } from 'lucide-react';

interface PinOverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<void> | void;
  title?: string;
  description?: string;
  isSubmitting?: boolean;
}

export const PinOverrideDialog: React.FC<PinOverrideDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Owner PIN Required',
  description = 'This action exceeds permitted staff limits and requires Owner authorization.',
  isSubmitting = false,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4 to 6 digits');
      return;
    }
    setError(null);
    try {
      await onConfirm(pin);
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Invalid PIN');
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        <div className="flex items-center justify-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 gap-2.5 text-xs font-semibold">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>Action will be recorded in the security audit trail.</span>
        </div>

        {/* Masked PIN Display */}
        <div className="flex justify-center gap-3 py-2">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const hasDigit = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-10 h-12 rounded-xl border-2 flex items-center justify-center font-mono text-xl font-black transition-all ${
                  hasDigit
                    ? 'border-accent bg-accent/20 text-content-primary'
                    : 'border-surface-border bg-surface-card text-transparent'
                }`}
              >
                {hasDigit ? '•' : ''}
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-400 text-center font-bold">{error}</p>}

        {/* Numeric Keypad for fast tablet/touch interaction */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto select-none">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-xl bg-surface-elevated hover:bg-surface-border text-title font-mono font-bold text-content-primary active:scale-95 transition-all"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-surface-elevated hover:bg-surface-border text-xs font-bold text-content-secondary active:scale-95 transition-all"
          >
            Del
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-surface-elevated hover:bg-surface-border text-title font-mono font-bold text-content-primary active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-12 rounded-xl bg-surface-elevated hover:bg-surface-border text-xs font-bold text-content-secondary active:scale-95 transition-all"
          >
            Clear
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={pin.length < 4}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            Authorize
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
