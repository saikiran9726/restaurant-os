import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/UtilityComponents.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { QrCode, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export const OwnerPaymentsView: React.FC = () => {
  const { addToast } = useToastStore();

  const { data, isLoading, refetch } = useQuery<{
    pendingPayments: Array<{
      id: string;
      billId: string;
      billNumber: string;
      method: string;
      amountPaise: number;
      status: string;
      reference?: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ['owner-pending-payments'],
    queryFn: () => apiFetch('/payments/pending'),
    refetchInterval: 5000,
  });

  const pendingList = data?.pendingPayments || [];
  const totalPendingPaise = pendingList.reduce((sum, p) => sum + p.amountPaise, 0);

  const handleConfirm = async (paymentId: string) => {
    try {
      await apiFetch(`/payments/${paymentId}/confirm`, { method: 'POST' });
      addToast({ type: 'success', message: 'Payment confirmed successfully' });
      refetch();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Confirmation failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview KPI Header */}
      <div className="p-6 rounded-2xl bg-surface-card border-2 border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shrink-0">
            <QrCode className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-title font-black text-content-primary uppercase tracking-wide">
              Pending UPI Confirmations
            </h2>
            <p className="text-body text-content-muted">
              Verify digital payments received via external QR / UPI accounts.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
            Awaiting Verification ({pendingList.length})
          </span>
          <span className="text-3xl font-mono font-black text-amber-400 tabular-nums">
            {formatPaiseToRupeeString(totalPendingPaise)}
          </span>
        </div>
      </div>

      {/* List of Pending Payments */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-surface-elevated" />
          ))}
        </div>
      ) : pendingList.length === 0 ? (
        <div className="py-24 text-center rounded-2xl border-2 border-dashed border-surface-border bg-surface-card/40">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-title font-black text-content-primary uppercase">
            All Payments Reconciled
          </h3>
          <p className="text-body text-content-muted mt-1">
            No pending UPI or unverified transfers awaiting confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.map((payment) => (
            <div
              key={payment.id}
              className="p-5 rounded-2xl bg-surface-card border-2 border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 shrink-0 mt-0.5">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-title text-content-primary">
                      {payment.billNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs uppercase">
                      UPI Transfer
                    </span>
                  </div>
                  <span className="text-xs text-content-muted block mt-1">
                    Received at{' '}
                    {new Date(payment.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    {payment.reference ? `• Ref: ${payment.reference}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <span className="text-2xl font-mono font-black text-accent tabular-nums">
                  {formatPaiseToRupeeString(payment.amountPaise)}
                </span>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleConfirm(payment.id)}
                  leftIcon={<CheckCircle2 className="w-5 h-5" />}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider"
                >
                  Confirm Received
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
