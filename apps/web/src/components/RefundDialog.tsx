import React, { useState } from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { Dialog } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { MoneyInput } from './MoneyInput.js';
import { SegmentedControl } from './ui/SegmentedControl.js';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface RefundDialogProps {
  isOpen: boolean;
  billId: string;
  billNumber: string;
  maxRefundablePaise: number;
  onClose: () => void;
  onSubmitRefund: (payload: {
    amountPaise: number;
    method: 'cash' | 'upi' | 'card';
    reason: string;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const RefundDialog: React.FC<RefundDialogProps> = ({
  isOpen,
  billId,
  billNumber,
  maxRefundablePaise,
  onClose,
  onSubmitRefund,
  isSubmitting = false,
}) => {
  const [amountPaise, setAmountPaise] = useState<number>(maxRefundablePaise);
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setAmountPaise(maxRefundablePaise);
  }, [maxRefundablePaise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaise <= 0) {
      setError('Refund amount must be greater than zero');
      return;
    }
    if (amountPaise > maxRefundablePaise) {
      setError(`Refund amount cannot exceed ${formatPaiseToRupeeString(maxRefundablePaise)}`);
      return;
    }
    if (reason.trim().length < 3) {
      setError('Please provide a specific reason for refund (minimum 3 characters)');
      return;
    }

    try {
      await onSubmitRefund({
        amountPaise,
        method,
        reason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Refund processing failed');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Issue Refund • ${billNumber}`}
      description="Record a customer refund. All refunds are logged to the security audit trail."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            Maximum refundable on this bill:{' '}
            <strong>{formatPaiseToRupeeString(maxRefundablePaise)}</strong>
          </span>
        </div>

        {/* Refund Amount */}
        <MoneyInput
          label="Refund Amount"
          valuePaise={amountPaise}
          onChangePaise={(val) => {
            setAmountPaise(val);
            setError(null);
          }}
          maxPaise={maxRefundablePaise}
          exactAmountPaise={maxRefundablePaise}
        />

        {/* Refund Method */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
            Refund Payout Method
          </label>
          <SegmentedControl
            value={method}
            onChange={(m) => setMethod(m as typeof method)}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI Payout' },
              { value: 'card', label: 'Card Reversal' },
            ]}
          />
        </div>

        {/* Reason Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
            Reason For Refund *
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Order cancelled, quality dispute, accidental overcharge..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-surface-border text-body text-content-primary focus:outline-none focus:border-accent"
          />
        </div>

        {error && (
          <p className="text-xs font-bold text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/30">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Confirm Refund ({formatPaiseToRupeeString(amountPaise)})
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
