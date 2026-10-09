import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { Dialog } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { BillSummary } from './BillSummary.js';
import { PaymentRow } from './PaymentRow.js';
import { RefundDialog } from './RefundDialog.js';
import { PinOverrideDialog } from './PinOverrideDialog.js';
import { apiFetch } from '../stores/useAuthStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { Printer, Ban, RotateCcw, CheckCircle2, AlertCircle, Clock, History } from 'lucide-react';

interface BillDetailDialogProps {
  isOpen: boolean;
  billId: string | null;
  onClose: () => void;
  onBillUpdated?: () => void;
}

export const BillDetailDialog: React.FC<BillDetailDialogProps> = ({
  isOpen,
  billId,
  onClose,
  onBillUpdated,
}) => {
  const { addToast } = useToastStore();
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isCancelPinOpen, setIsCancelPinOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading, refetch } = useQuery<{
    bill: any;
    lines: any[];
    payments: any[];
    refunds: any[];
  }>({
    queryKey: ['bill-detail', billId],
    queryFn: () => apiFetch(`/bills/${billId}`),
    enabled: Boolean(isOpen && billId),
  });

  const bill = data?.bill;
  const lines = data?.lines || [];
  const payments = data?.payments || [];
  const refunds = data?.refunds || [];

  const confirmedPaymentsPaise = payments
    .filter((p) => p.status === 'confirmed' || p.status === 'recorded')
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const totalRefundedPaise = refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  const maxRefundablePaise = Math.max(0, confirmedPaymentsPaise - totalRefundedPaise);

  const handleConfirmUpi = async (paymentId: string) => {
    try {
      await apiFetch(`/payments/${paymentId}/confirm`, { method: 'POST' });
      addToast({ type: 'success', message: 'UPI payment confirmed by staff' });
      refetch();
      onBillUpdated?.();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Failed to confirm payment' });
    }
  };

  const handleReprintEvent = async () => {
    if (!billId) return;
    try {
      const res = await apiFetch<any>(`/bills/${billId}/reprint`, { method: 'POST' });
      addToast({
        type: 'info',
        message: `Reprint event recorded (Reprint #${res.printedCount})`,
      });
      refetch();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Reprint failed' });
    }
  };

  const handleCancelBill = async (overridePin?: string) => {
    if (!billId) return;
    const reason = cancelReason.trim() || 'Voided by manager';
    try {
      await apiFetch(`/bills/${billId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, overridePin }),
      });
      addToast({ type: 'warning', message: 'Bill has been cancelled' });
      setIsCancelPinOpen(false);
      refetch();
      onBillUpdated?.();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Failed to cancel bill' });
    }
  };

  const handleProcessRefund = async (payload: any) => {
    if (!billId) return;
    try {
      await apiFetch(`/bills/${billId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      addToast({ type: 'success', message: 'Refund recorded successfully' });
      setIsRefundOpen(false);
      refetch();
      onBillUpdated?.();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Refund failed' });
    }
  };

  if (!isOpen || !billId) return null;

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={bill ? `Bill ${bill.billNumber}` : 'Bill Details'}
        description={bill ? `Created ${new Date(bill.createdAt).toLocaleString()}` : ''}
        size="lg"
      >
        {isLoading || !bill ? (
          <div className="py-16 text-center text-content-muted">Loading bill details...</div>
        ) : (
          <div className="space-y-6 pt-2 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {/* Bill Financial Summary */}
            <BillSummary
              data={{
                id: bill.id,
                billNumber: bill.billNumber,
                status: bill.status,
                subtotalPaise: bill.subtotalPaise,
                discountPaise: bill.discountPaise,
                discountType: bill.discountType,
                discountValue: bill.discountValue,
                discountReason: bill.discountReason,
                serviceChargePaise: bill.serviceChargePaise,
                taxPaise: bill.taxPaise,
                roundOffPaise: bill.roundOffPaise,
                totalPaise: bill.totalPaise,
                lines,
                createdAt: bill.createdAt,
              }}
            />

            {/* Payments List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-body font-black uppercase tracking-wider text-content-primary">
                  Payments ({payments.length})
                </h4>
                <span className="text-xs font-mono font-bold text-content-secondary">
                  Confirmed: {formatPaiseToRupeeString(confirmedPaymentsPaise)} /{' '}
                  {formatPaiseToRupeeString(bill.totalPaise)}
                </span>
              </div>

              {payments.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-surface-border text-center text-content-muted text-xs">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <PaymentRow key={p.id} payment={p} onConfirm={() => handleConfirmUpi(p.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* Refunds Section if any */}
            {refunds.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-body font-black uppercase tracking-wider text-red-400">
                  Refunds ({refunds.length})
                </h4>
                <div className="space-y-2">
                  {refunds.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between text-body"
                    >
                      <div>
                        <span className="font-bold text-content-primary">
                          {r.method.toUpperCase()} Refund
                        </span>
                        <span className="text-xs text-content-muted block">Reason: {r.reason}</span>
                      </div>
                      <span className="font-mono font-black text-red-400 tabular-nums">
                        -{formatPaiseToRupeeString(r.amountPaise)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions Toolbar */}
            <div className="pt-4 border-t-2 border-surface-border flex flex-wrap items-center justify-between gap-3">
              {/* Left: Printing State */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Physical thermal printing arrives in Phase 8"
                  className="px-3 py-2 rounded-xl border border-surface-border bg-surface-elevated text-content-muted text-xs font-bold flex items-center gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  <span>Thermal Print (Phase 8)</span>
                </button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReprintEvent}
                  leftIcon={<History className="w-4 h-4" />}
                  className="text-xs"
                >
                  Audit Reprint #{bill.printedCount || 0}
                </Button>
              </div>

              {/* Right: Operational Actions (Refund, Cancel, Close) */}
              <div className="flex items-center gap-2">
                {bill.status === 'paid' && maxRefundablePaise > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsRefundOpen(true)}
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                  >
                    Refund
                  </Button>
                )}

                {bill.status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (bill.status === 'paid') {
                        setIsCancelPinOpen(true);
                      } else {
                        handleCancelBill();
                      }
                    }}
                    className="text-red-400 hover:bg-red-500/10"
                    leftIcon={<Ban className="w-4 h-4" />}
                  >
                    Cancel Bill
                  </Button>
                )}

                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Refund Modal */}
      {bill && (
        <RefundDialog
          isOpen={isRefundOpen}
          billId={bill.id}
          billNumber={bill.billNumber}
          maxRefundablePaise={maxRefundablePaise}
          onClose={() => setIsRefundOpen(false)}
          onSubmitRefund={handleProcessRefund}
        />
      )}

      {/* PIN Override for Cancelling Paid Bill */}
      <PinOverrideDialog
        isOpen={isCancelPinOpen}
        onClose={() => setIsCancelPinOpen(false)}
        title="Owner PIN to Cancel Paid Bill"
        description="Cancelling a settled bill requires Owner authorization."
        onConfirm={handleCancelBill}
      />
    </>
  );
};
