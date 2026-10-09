import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet } from '../../components/ui/Overlay.js';
import { Button } from '../../components/ui/Button.js';
import { SplitBuilder, type SplitPaymentLine } from '../../components/SplitBuilder.js';
import { PaymentRow } from '../../components/PaymentRow.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import {
  formatPaiseToRupeeString,
  calculateMaxRedeemable,
  type CustomerLoyaltyDetails,
} from '@restaurant-os/shared';
import {
  CheckCircle2,
  Receipt,
  ArrowLeft,
  Sparkles,
  QrCode,
  CreditCard,
  Printer,
  Award,
} from 'lucide-react';
import { DynamicUpiQr } from '../../components/DynamicUpiQr.js';
import { printerService } from '../../services/printer/printer-service.js';
import { PrintStatusBadge } from '../../components/PrintStatusBadge.js';
import { PointsBadge } from '../../components/PointsBadge.js';
import { TierBadge } from '../../components/TierBadge.js';
import { RedeemStepper } from '../../components/RedeemStepper.js';

interface PaymentSheetProps {
  isOpen: boolean;
  bill: any;
  tableLabel?: string | null;
  onClose: () => void;
  onPaid: () => void;
}

export const PaymentSheet: React.FC<PaymentSheetProps> = ({
  isOpen,
  bill,
  tableLabel,
  onClose,
  onPaid,
}) => {
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'upi_qr'>('methods');
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'printed' | 'failed'>(
    'idle',
  );
  const [selectedPointsToRedeem, setSelectedPointsToRedeem] = useState<number>(0);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Fetch latest bill payments
  const { data, refetch } = useQuery<{
    bill: any;
    order?: any;
    customerId?: string;
    payments: any[];
  }>({
    queryKey: ['bill-payments', bill?.id],
    queryFn: () => apiFetch(`/bills/${bill.id}`),
    enabled: Boolean(isOpen && bill?.id),
    refetchInterval: 3000,
  });

  const currentBill = data?.bill || bill;
  const customerId =
    data?.customerId || data?.order?.customerId || bill?.customerId || bill?.order?.customerId;

  // Fetch customer loyalty if attached
  const { data: loyaltyData, refetch: refetchLoyalty } = useQuery<CustomerLoyaltyDetails>({
    queryKey: ['customer-loyalty', customerId],
    queryFn: () => apiFetch(`/customers/${customerId}/loyalty`),
    enabled: Boolean(isOpen && customerId),
  });

  const maxRedeemable =
    loyaltyData?.account && loyaltyData?.settings
      ? calculateMaxRedeemable({
          pointsBalance: loyaltyData.account.pointsBalance,
          billTotalPaise: currentBill?.totalPaise || 0,
          settings: loyaltyData.settings,
          accountAgeHours: 48,
          pointsRedeemedToday: 0,
        })
      : { maxRedeemablePoints: 0, maxRedeemablePaise: 0, isEligible: false };

  const handleConfirmRedeem = async () => {
    if (selectedPointsToRedeem <= 0 || !currentBill?.id) return;
    setIsRedeeming(true);
    try {
      const res = await apiFetch<any>(`/bills/${currentBill.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointsToRedeem: selectedPointsToRedeem,
          idempotencyKey: `rdm_${currentBill.id}_${Date.now()}`,
        }),
      });

      addToast({
        type: 'success',
        message: `Applied ${selectedPointsToRedeem} points (-${formatPaiseToRupeeString(res.discountPaise || 0)}) discount!`,
      });
      setSelectedPointsToRedeem(0);
      await refetch();
      await refetchLoyalty();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Loyalty redemption failed' });
    } finally {
      setIsRedeeming(false);
    }
  };

  // Fetch receipt details including dynamic UPI QR payload
  const { data: receiptInfo } = useQuery<{
    receiptData: any;
    templateConfig: any;
  }>({
    queryKey: ['bill-receipt', bill?.id],
    queryFn: () => apiFetch(`/bills/${bill.id}/receipt`),
    enabled: Boolean(isOpen && bill?.id),
  });

  const payments = data?.payments || [];

  const confirmedPaymentsPaise = payments
    .filter((p) => p.status === 'confirmed' || p.status === 'recorded')
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const isFullySettled = confirmedPaymentsPaise >= (currentBill?.totalPaise || 0);

  const handleRecordPayment = async (line: SplitPaymentLine) => {
    setIsSubmitting(true);
    try {
      const idempotencyKey = `pay_${currentBill.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await apiFetch<any>(`/bills/${currentBill.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: line.method,
          amountPaise: line.amountPaise,
          tenderedPaise: line.tenderedPaise,
          reference: line.reference,
          idempotencyKey,
        }),
      });

      addToast({
        type: 'success',
        message: `${line.method.toUpperCase()} payment of ${formatPaiseToRupeeString(line.amountPaise)} recorded`,
      });

      await refetch();

      if (res.isFullyPaid) {
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          onPaid();
        }, 1200);
      }
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Payment recording failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintBill = async () => {
    setPrintStatus('printing');
    const result = await printerService.printBill(currentBill.id);
    if (result.success) {
      setPrintStatus('printed');
      addToast({ type: 'success', message: 'Bill printed successfully' });
      setTimeout(() => setPrintStatus('idle'), 3000);
    } else {
      setPrintStatus('failed');
      addToast({
        type: 'warning',
        message: result.error || 'Print failed. Billing unaffected.',
      });
    }
  };

  const handleConfirmUpi = async (paymentId: string) => {
    try {
      const res = await apiFetch<any>(`/payments/${paymentId}/confirm`, {
        method: 'POST',
      });
      addToast({ type: 'success', message: 'UPI payment confirmed by staff' });
      await refetch();

      if (res.isFullyPaid) {
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          onPaid();
        }, 1200);
      }
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Confirmation failed' });
    }
  };

  if (!isOpen || !bill) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Payment Settlement • ${currentBill.billNumber}`}
      description={
        tableLabel
          ? `Table ${tableLabel} • Record cash, UPI, card, or split payments.`
          : 'Takeaway Order Settlement'
      }
    >
      <div className="space-y-6 pt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {/* Top Print & Mode Toolbar */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex rounded-lg border border-surface-border p-0.5 bg-surface-subtle">
            <button
              type="button"
              onClick={() => setActiveTab('methods')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === 'methods'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Record Payment
            </button>

            {receiptInfo?.receiptData?.upiQrPayload && !isFullySettled && (
              <button
                type="button"
                onClick={() => setActiveTab('upi_qr')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                  activeTab === 'upi_qr'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                Customer UPI QR
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintBill}
              disabled={printStatus === 'printing'}
              className="text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              {printStatus === 'printing' ? 'Printing…' : 'Print Slip'}
            </Button>
          </div>
        </div>

        {/* Success Settle Overlay (250 ms check animation) */}
        {showSuccessAnimation && (
          <div className="py-16 text-center space-y-3 animate-fade-in">
            <div className="inline-flex p-4 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 shadow-2xl animate-scale-in">
              <CheckCircle2 className="w-16 h-16" />
            </div>
            <h3 className="text-2xl font-black text-content-primary">Payment Complete!</h3>
            <p className="text-body text-content-muted">
              Bill settled • Table released and marked available.
            </p>
          </div>
        )}

        {!showSuccessAnimation && (
          <>
            {/* Customer Loyalty Section */}
            {loyaltyData?.account && (
              <div className="p-3.5 rounded-2xl bg-surface-card border border-surface-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TierBadge
                      tier={loyaltyData.account.tier}
                      earnMultiplier={loyaltyData.account.tierMultiplier}
                    />
                    <PointsBadge points={loyaltyData.account.pointsBalance} />
                  </div>
                  {(currentBill.loyaltyPointsRedeemed || 0) > 0 && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Redeemed {currentBill.loyaltyPointsRedeemed} pts (-
                      {formatPaiseToRupeeString(currentBill.loyaltyDiscountPaise || 0)})
                    </span>
                  )}
                </div>

                {/* Redemption stepper if bill is unpaid and has redeemable points */}
                {!isFullySettled && maxRedeemable.maxRedeemablePoints > 0 && (
                  <div className="pt-2 border-t border-surface-border space-y-2.5">
                    <RedeemStepper
                      pointsBalance={loyaltyData.account.pointsBalance}
                      redeemPointsBlock={loyaltyData.settings.redeemPointsBlock}
                      redeemValuePaise={loyaltyData.settings.redeemValuePaise}
                      maxRedeemablePoints={maxRedeemable.maxRedeemablePoints}
                      selectedPoints={selectedPointsToRedeem}
                      onChange={setSelectedPointsToRedeem}
                      billTotalPaise={currentBill.totalPaise}
                    />
                    {selectedPointsToRedeem > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isRedeeming}
                        onClick={handleConfirmRedeem}
                        className="w-full font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isRedeeming
                          ? 'Applying Redemption…'
                          : `Confirm Redeem: -${formatPaiseToRupeeString((selectedPointsToRedeem / loyaltyData.settings.redeemPointsBlock) * loyaltyData.settings.redeemValuePaise)}`}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Split Builder Payment Form OR Customer UPI QR */}
            {!isFullySettled ? (
              activeTab === 'upi_qr' && receiptInfo?.receiptData?.upiQrPayload ? (
                <div className="space-y-4">
                  <DynamicUpiQr
                    vpa={
                      receiptInfo.receiptData.upiQrPayload.split('pa=')[1]?.split('&')[0]
                        ? decodeURIComponent(
                            receiptInfo.receiptData.upiQrPayload.split('pa=')[1]!.split('&')[0]!,
                          )
                        : 'restaurant@upi'
                    }
                    payeeName={receiptInfo.receiptData.restaurantName}
                    amountPaise={currentBill.totalPaise - confirmedPaymentsPaise}
                    billNumber={currentBill.billNumber}
                    transactionRef={currentBill.id.replace(/-/g, '').slice(0, 16)}
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full font-bold"
                    onClick={() => setActiveTab('methods')}
                  >
                    &larr; Switch to Record Staff Confirmation
                  </Button>
                </div>
              ) : (
                <SplitBuilder
                  totalBillPaise={currentBill.totalPaise}
                  alreadyPaidPaise={confirmedPaymentsPaise}
                  onSubmitPayment={handleRecordPayment}
                  isSubmitting={isSubmitting}
                />
              )
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-950/20 border-2 border-emerald-500/40 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-title font-black text-emerald-300">Full Balance Settled</h3>
                <p className="text-xs text-emerald-400/80">
                  Total of {formatPaiseToRupeeString(currentBill.totalPaise)} has been confirmed.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onPaid}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Done • Return to Floor
                </Button>
              </div>
            )}

            {/* List of Recorded Payments on this Bill */}
            {payments.length > 0 && (
              <div className="space-y-3 pt-3 border-t-2 border-surface-border">
                <div className="flex items-center justify-between text-xs font-bold text-content-secondary uppercase">
                  <span>Recorded Payments ({payments.length})</span>
                  <span>
                    Settled: {formatPaiseToRupeeString(confirmedPaymentsPaise)} /{' '}
                    {formatPaiseToRupeeString(currentBill.totalPaise)}
                  </span>
                </div>

                <div className="space-y-2">
                  {payments.map((p) => (
                    <PaymentRow key={p.id} payment={p} onConfirm={handleConfirmUpi} />
                  ))}
                </div>
              </div>
            )}

            {/* Back Button */}
            <div className="pt-4 border-t border-surface-border flex items-center justify-between">
              <Button
                variant="ghost"
                size="md"
                onClick={onClose}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Preview
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
};
