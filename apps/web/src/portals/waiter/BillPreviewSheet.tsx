import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet } from '../../components/ui/Overlay.js';
import { Button } from '../../components/ui/Button.js';
import { BillSummary } from '../../components/BillSummary.js';
import { PinOverrideDialog } from '../../components/PinOverrideDialog.js';
import { PaymentSheet } from './PaymentSheet.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Receipt, Percent, ArrowRight, Scissors, ShieldAlert } from 'lucide-react';

interface BillPreviewSheetProps {
  isOpen: boolean;
  orderId: string | null;
  tableLabel?: string | null;
  onClose: () => void;
  onOrderSettled?: () => void;
}

export const BillPreviewSheet: React.FC<BillPreviewSheetProps> = ({
  isOpen,
  orderId,
  tableLabel,
  onClose,
  onOrderSettled,
}) => {
  const { addToast } = useToastStore();
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isDiscountFormOpen, setIsDiscountFormOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Discount form inputs
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [discountReason, setDiscountReason] = useState<string>('');

  // Fetch or generate bill for order
  const { data, isLoading, refetch } = useQuery<{
    bill: any;
    lines: any[];
    payments: any[];
  }>({
    queryKey: ['order-bill-preview', orderId],
    queryFn: () =>
      apiFetch(`/orders/${orderId}/bill`, { method: 'POST', body: JSON.stringify({}) }),
    enabled: Boolean(isOpen && orderId),
  });

  const bill = data?.bill;
  const lines = data?.lines || [];

  const handleApplyDiscountSubmit = async (overridePin?: string) => {
    if (!bill) return;
    const numVal = parseFloat(discountValue);
    if (isNaN(numVal) || numVal <= 0) {
      addToast({ type: 'warning', message: 'Please enter a valid discount value' });
      return;
    }
    if (!discountReason.trim()) {
      addToast({ type: 'warning', message: 'Discount reason is required' });
      return;
    }

    try {
      await apiFetch(`/bills/${bill.id}/discount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: discountType,
          value: discountType === 'flat' ? Math.round(numVal * 100) : numVal,
          reason: discountReason.trim(),
          overridePin,
        }),
      });
      addToast({ type: 'success', message: 'Discount applied successfully' });
      setIsDiscountFormOpen(false);
      setIsPinModalOpen(false);
      refetch();
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('pin override')) {
        setIsPinModalOpen(true);
      } else {
        addToast({ type: 'danger', message: err.message || 'Failed to apply discount' });
      }
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen && !isPaymentSheetOpen}
        onClose={onClose}
        title={`Bill Preview ${tableLabel ? `• Table ${tableLabel}` : ''}`}
        description="Verify order items, apply approved discounts, and proceed to payment settlement."
      >
        <div className="space-y-5 pt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
          {isLoading || !bill ? (
            <div className="py-20 text-center text-content-muted">Computing order bill...</div>
          ) : (
            <>
              {/* Financial Bill Summary */}
              <BillSummary
                data={{
                  id: bill.id,
                  billNumber: bill.billNumber,
                  tableLabel,
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
                }}
              />

              {/* Discount Accordion / Form */}
              <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-title font-bold text-content-primary">
                    <Scissors className="w-5 h-5 text-accent" />
                    <span>Promotional / Courtesy Discount</span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDiscountFormOpen(!isDiscountFormOpen)}
                  >
                    {isDiscountFormOpen
                      ? 'Cancel'
                      : bill.discountPaise > 0
                        ? 'Edit'
                        : 'Add Discount'}
                  </Button>
                </div>

                {isDiscountFormOpen && (
                  <div className="pt-2 border-t border-surface-border space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                          discountType === 'percent'
                            ? 'bg-accent text-accent-content'
                            : 'bg-surface-elevated text-content-secondary'
                        }`}
                      >
                        Percentage (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('flat')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                          discountType === 'flat'
                            ? 'bg-accent text-accent-content'
                            : 'bg-surface-elevated text-content-secondary'
                        }`}
                      >
                        Flat Amount (₹)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-content-muted block mb-1">
                          {discountType === 'percent' ? 'Percent (0–100%)' : 'Rupees (₹)'}
                        </label>
                        <input
                          type="number"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder="e.g. 10"
                          className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-content-primary font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-content-muted block mb-1">
                          Reason *
                        </label>
                        <input
                          type="text"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="e.g. Regular guest / Promo"
                          className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-content-primary text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplyDiscountSubmit()}
                      className="w-full"
                    >
                      Update Discount
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t-2 border-surface-border flex items-center justify-between gap-3">
                <Button variant="ghost" size="lg" onClick={onClose}>
                  Back to Tables
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setIsPaymentSheetOpen(true)}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                  className="font-black uppercase tracking-wider flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Pay & Settle
                </Button>
              </div>
            </>
          )}
        </div>
      </Sheet>

      {/* Payment Settlement Sheet */}
      {bill && (
        <PaymentSheet
          isOpen={isPaymentSheetOpen}
          bill={bill}
          tableLabel={tableLabel}
          onClose={() => setIsPaymentSheetOpen(false)}
          onPaid={() => {
            setIsPaymentSheetOpen(false);
            onClose();
            onOrderSettled?.();
          }}
        />
      )}

      {/* PIN Override Modal for Discount */}
      <PinOverrideDialog
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title="Owner PIN for Discount"
        description="This discount exceeds permitted role caps. Please request Owner PIN."
        onConfirm={(pin) => handleApplyDiscountSubmit(pin)}
      />
    </>
  );
};
