import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { Button } from './ui/Button.js';
import { Banknote, QrCode, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface PaymentItem {
  id: string;
  method: 'cash' | 'upi' | 'card';
  amountPaise: number;
  tenderedPaise?: number | null;
  changePaise?: number | null;
  status: 'recorded' | 'pending_confirmation' | 'confirmed' | 'failed' | 'reversed';
  reference?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
}

interface PaymentRowProps {
  payment: PaymentItem;
  onConfirm?: (paymentId: string) => void;
  isConfirming?: boolean;
}

export const PaymentRow: React.FC<PaymentRowProps> = ({
  payment,
  onConfirm,
  isConfirming = false,
}) => {
  const methodIcon = {
    cash: <Banknote className="w-5 h-5 text-emerald-400" />,
    upi: <QrCode className="w-5 h-5 text-purple-400" />,
    card: <CreditCard className="w-5 h-5 text-blue-400" />,
  }[payment.method];

  const methodLabel = {
    cash: 'Cash Payment',
    upi: 'UPI Transfer',
    card: 'Card (External Terminal)',
  }[payment.method];

  const isPendingUpi = payment.status === 'pending_confirmation';

  return (
    <div
      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
        isPendingUpi
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
          : 'bg-surface-card border-surface-border text-content-primary'
      }`}
    >
      {/* Left: Method Icon & Details */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border shrink-0 mt-0.5">
          {methodIcon}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-body text-content-primary">{methodLabel}</span>
            <span className="text-xl font-mono font-black text-content-primary tabular-nums">
              {formatPaiseToRupeeString(payment.amountPaise)}
            </span>
          </div>

          {/* Subtitle Details: Cash Tendered & Change, or Card / UPI Reference */}
          <div className="text-xs text-content-muted mt-0.5 space-x-2">
            {payment.method === 'cash' && payment.tenderedPaise && (
              <span>
                Tendered: {formatPaiseToRupeeString(payment.tenderedPaise)}
                {payment.changePaise !== undefined &&
                  payment.changePaise !== null &&
                  payment.changePaise > 0 && (
                    <strong className="text-emerald-400 ml-1">
                      (Change: {formatPaiseToRupeeString(payment.changePaise)})
                    </strong>
                  )}
              </span>
            )}

            {payment.reference && <span>Ref / Code: {payment.reference}</span>}

            <span>
              {new Date(payment.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Status Pill & Confirm Button */}
      <div className="flex items-center gap-3 justify-end shrink-0">
        {payment.status === 'confirmed' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed by staff</span>
          </span>
        )}

        {isPendingUpi && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Confirmation</span>
            </span>

            {onConfirm && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onConfirm(payment.id)}
                isLoading={isConfirming}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Payment Received
              </Button>
            )}
          </div>
        )}

        {payment.status === 'failed' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        )}
      </div>
    </div>
  );
};
