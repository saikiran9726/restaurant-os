import React, { useState } from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { MoneyInput } from './MoneyInput.js';
import { SegmentedControl } from './ui/SegmentedControl.js';
import { Button } from './ui/Button.js';
import { Banknote, QrCode, CreditCard, PlusCircle, AlertCircle } from 'lucide-react';

export interface SplitPaymentLine {
  method: 'cash' | 'upi' | 'card';
  amountPaise: number;
  tenderedPaise?: number;
  reference?: string;
}

interface SplitBuilderProps {
  totalBillPaise: number;
  alreadyPaidPaise: number;
  onSubmitPayment: (payment: SplitPaymentLine) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const SplitBuilder: React.FC<SplitBuilderProps> = ({
  totalBillPaise,
  alreadyPaidPaise,
  onSubmitPayment,
  isSubmitting = false,
}) => {
  const remainingPaise = Math.max(0, totalBillPaise - alreadyPaidPaise);

  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [amountPaise, setAmountPaise] = useState<number>(remainingPaise);
  const [tenderedPaise, setTenderedPaise] = useState<number>(remainingPaise);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync amount with remaining balance if remaining changes
  React.useEffect(() => {
    if (amountPaise > remainingPaise || amountPaise === 0) {
      setAmountPaise(remainingPaise);
      setTenderedPaise(remainingPaise);
    }
  }, [remainingPaise]);

  const handleMethodChange = (newMethod: string) => {
    setMethod(newMethod as typeof method);
    setError(null);
  };

  const handleAmountChange = (newAmountPaise: number) => {
    setAmountPaise(newAmountPaise);
    if (method === 'cash') {
      setTenderedPaise(Math.max(newAmountPaise, tenderedPaise));
    }
    setError(null);
  };

  const cashChangePaise =
    method === 'cash' && tenderedPaise >= amountPaise ? tenderedPaise - amountPaise : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaise <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }
    if (method !== 'cash' && amountPaise > remainingPaise) {
      setError(
        `Cannot charge more than remaining balance (${formatPaiseToRupeeString(remainingPaise)})`,
      );
      return;
    }
    if (method === 'cash' && tenderedPaise < amountPaise) {
      setError('Tendered cash cannot be less than payment amount');
      return;
    }

    try {
      await onSubmitPayment({
        method,
        amountPaise,
        tenderedPaise: method === 'cash' ? tenderedPaise : undefined,
        reference: reference.trim() || undefined,
      });
      setReference('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border-2 border-surface-border bg-surface-card p-5"
    >
      {/* Live Balance Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated border border-surface-border">
        <div>
          <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
            Remaining Due
          </span>
          <span className="text-2xl font-mono font-black text-accent tabular-nums">
            {formatPaiseToRupeeString(remainingPaise)}
          </span>
        </div>

        <div className="text-right text-xs text-content-secondary space-y-0.5">
          <div>Total: {formatPaiseToRupeeString(totalBillPaise)}</div>
          <div>Settled: {formatPaiseToRupeeString(alreadyPaidPaise)}</div>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
          Select Payment Method
        </label>
        <SegmentedControl
          value={method}
          onChange={handleMethodChange}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
            { value: 'card', label: 'Card' },
          ]}
          size="lg"
        />
      </div>

      {/* Amount Input */}
      <MoneyInput
        label="Amount To Pay"
        valuePaise={amountPaise}
        onChangePaise={handleAmountChange}
        maxPaise={method === 'cash' ? undefined : remainingPaise}
        exactAmountPaise={remainingPaise}
        placeholder="Enter split amount..."
      />

      {/* Cash Tendered & Change */}
      {method === 'cash' && (
        <div className="space-y-3 p-4 rounded-xl bg-surface-elevated/70 border border-surface-border">
          <MoneyInput
            label="Cash Tendered (From Customer)"
            valuePaise={tenderedPaise}
            onChangePaise={(val) => setTenderedPaise(val)}
            minPaise={amountPaise}
            exactAmountPaise={amountPaise}
            quickButtons={[100, 500, 2000]}
          />

          <div className="flex items-center justify-between pt-2 border-t border-surface-border">
            <span className="text-body font-bold text-content-secondary">Change Due:</span>
            <span
              className={`text-xl font-mono font-black tabular-nums ${
                cashChangePaise > 0 ? 'text-emerald-400' : 'text-content-muted'
              }`}
            >
              {formatPaiseToRupeeString(cashChangePaise)}
            </span>
          </div>
        </div>
      )}

      {/* UPI Notice */}
      {method === 'upi' && (
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <QrCode className="w-4 h-4" />
            <span>UPI Payment Verification</span>
          </div>
          <p>
            UPI starts as <strong>Pending Confirmation</strong> until floor/counter staff verifies
            funds in bank app.
          </p>
        </div>
      )}

      {/* Card / UPI Reference Optional Input */}
      {(method === 'card' || method === 'upi') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
            {method === 'card'
              ? 'Approval Code / Card Last 4 (Optional)'
              : 'UPI Transaction ID (Optional)'}
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={method === 'card' ? 'e.g. 8492' : 'e.g. UPI/10492850'}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-body text-content-primary focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        disabled={amountPaise <= 0}
        leftIcon={<PlusCircle className="w-5 h-5" />}
        className="w-full font-black uppercase tracking-wider"
      >
        Record {formatPaiseToRupeeString(amountPaise)} ({method.toUpperCase()})
      </Button>
    </form>
  );
};
