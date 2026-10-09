import React, { useState } from 'react';
import { Sheet } from '../../components/ui/Overlay.js';
import { Button } from '../../components/ui/Button.js';
import { QtyStepper } from '../../components/ui/QtyStepper.js';
import { useCartStore, type CartItem } from '../../stores/useCartStore.js';
import { ReasonSheet } from '../../components/ReasonSheet.js';
import { CustomerChip } from '../../components/CustomerChip.js';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import {
  Trash2,
  FileText,
  ShoppingBag,
  Send,
  Save,
  CheckCheck,
  Clock,
  Utensils,
  Receipt,
} from 'lucide-react';

interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSaved?: () => void;
  onOpenKotHistory?: () => void;
  onOpenBillPreview?: () => void;
}

export const CartSheet: React.FC<CartSheetProps> = ({
  isOpen,
  onClose,
  onOrderSaved,
  onOpenKotHistory,
  onOpenBillPreview,
}) => {
  const {
    items,
    tableLabel,
    type,
    guests,
    specialInstructions,
    isSaving,
    isSendingKot,
    updateItemQty,
    updateItemNote,
    removeItem,
    clearCart,
    setSpecialInstructions,
    getTotals,
    getUnsentCount,
    saveOrder,
    sendKot,
    markOrderServed,
  } = useCartStore();

  const [activeNoteLine, setActiveNoteLine] = useState<string | null>(null);
  const [cancellingItem, setCancellingItem] = useState<CartItem | null>(null);

  const totals = getTotals();
  const unsentCount = getUnsentCount();

  const handleSave = async () => {
    const orderId = await saveOrder();
    if (orderId) {
      onClose();
      onOrderSaved?.();
    }
  };

  const handleSendKot = async () => {
    const ok = await sendKot();
    if (ok) {
      onClose();
      onOrderSaved?.();
    }
  };

  const handleCancelItemWithReason = async (reason: string, managerPin?: string) => {
    if (!cancellingItem) return;
    if (cancellingItem.orderItemId) {
      // Sent item being cancelled: fires cancel diff to kitchen
      await sendKot([
        {
          orderItemId: cancellingItem.orderItemId,
          reason,
          managerPin,
        },
      ]);
    }
    removeItem(cancellingItem.id);
    setCancellingItem(null);
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={
          type === 'dine_in'
            ? `Table ${tableLabel || '—'} Order (${guests} ${guests === 1 ? 'guest' : 'guests'})`
            : 'Takeaway Order'
        }
        description={`${items.reduce((sum, i) => sum + i.qty, 0)} items total • ${unsentCount} unsent to kitchen`}
      >
        <div className="flex flex-col h-[calc(100vh-160px)] md:h-[650px]">
          {/* Customer Bar */}
          <div className="flex items-center justify-between p-2.5 mb-2.5 rounded-xl bg-surface-subtle border border-surface-border">
            <span className="text-xs font-bold text-content-secondary uppercase tracking-wider">
              Customer Info:
            </span>
            <CustomerChip />
          </div>

          {/* Top KOT Tracker quick link */}
          {items.some((i) => i.kotState !== 'unsent') && (
            <div className="flex items-center justify-between p-2.5 mb-3 rounded-xl bg-surface-card border border-surface-border">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-accent" />
                <span className="text-caption font-bold text-content-primary">
                  Kitchen Dispatch Active
                </span>
              </div>
              {onOpenKotHistory && (
                <button
                  type="button"
                  onClick={onOpenKotHistory}
                  className="text-xs text-accent font-bold hover:underline"
                >
                  View KOT History
                </button>
              )}
            </div>
          )}

          {/* Line Items List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-content-muted">
                <ShoppingBag className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-body font-medium">Cart is empty</p>
                <p className="text-caption">Tap items on the menu to add to draft</p>
              </div>
            ) : (
              items.map((line) => {
                const modPrice = line.modifiers.reduce((sum, m) => sum + m.priceDeltaPaise, 0);
                const lineTotal = (line.pricePaise + modPrice) * line.qty;
                const isSent = line.kotState !== 'unsent';
                const isModifiedDiff = line.sentQty && line.qty !== line.sentQty;

                return (
                  <div
                    key={line.id}
                    className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                      !isSent
                        ? 'bg-surface-card border-surface-border'
                        : 'bg-surface-card/60 border-surface-border/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              line.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="font-bold text-body text-content-primary">
                            {line.name}
                          </span>

                          {/* State chips */}
                          {!isSent ? (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Unsent
                            </span>
                          ) : isModifiedDiff ? (
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                              Modified (
                              {line.qty > (line.sentQty || 0)
                                ? `+${line.qty - (line.sentQty || 0)}`
                                : `-${(line.sentQty || 0) - line.qty}`}
                              )
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                line.kotState === 'ready'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : line.kotState === 'served'
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    : 'bg-surface-elevated text-content-secondary'
                              }`}
                            >
                              {line.kotState}
                            </span>
                          )}
                        </div>

                        {line.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {line.modifiers.map((m, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-surface-elevated text-content-secondary border border-surface-border font-medium"
                              >
                                {m.name}
                                {m.priceDeltaPaise > 0
                                  ? ` (+${formatPaiseToRupeeString(m.priceDeltaPaise)})`
                                  : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="font-bold text-body text-content-primary shrink-0">
                        {formatPaiseToRupeeString(lineTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <QtyStepper
                          value={line.qty}
                          onChange={(qty: number) =>
                            updateItemQty(line.itemId, qty, line.modifiers)
                          }
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (line.sentQty && line.sentQty > 0) {
                              setCancellingItem(line);
                            } else {
                              removeItem(line.id);
                            }
                          }}
                          aria-label="Remove or cancel item"
                          className="p-1.5 text-content-muted hover:text-red-500 transition-colors rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveNoteLine(activeNoteLine === line.id ? null : line.id)
                        }
                        className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {line.note ? 'Edit Note' : 'Add Note'}
                      </button>
                    </div>

                    {/* Note input toggle */}
                    {(activeNoteLine === line.id || line.note) && (
                      <input
                        type="text"
                        placeholder="Special instructions (e.g. Less spicy, no onion)..."
                        value={line.note}
                        onChange={(e) => updateItemNote(line.id, e.target.value)}
                        className="w-full text-caption px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:border-accent"
                      />
                    )}
                  </div>
                );
              })
            )}

            {/* Order-level special instruction */}
            {items.length > 0 && (
              <div className="pt-2">
                <label className="text-caption font-semibold text-content-secondary block mb-1">
                  Order Special Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Kitchen note (e.g. Serve starters first, allergy note)..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full text-caption p-2.5 rounded-xl bg-surface-card border border-surface-border text-content-primary focus:outline-none focus:border-accent resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer with totals & PRIMARY Send KOT action */}
          {items.length > 0 && (
            <div className="pt-3 border-t border-surface-border space-y-3 bg-surface-sheet">
              <div className="space-y-1 text-caption">
                <div className="flex justify-between text-content-secondary">
                  <span>Subtotal</span>
                  <span>{formatPaiseToRupeeString(totals.subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-content-secondary">
                  <span>GST & Taxes</span>
                  <span>{formatPaiseToRupeeString(totals.taxPaise)}</span>
                </div>
                <div className="flex justify-between text-title font-extrabold text-content-primary pt-1 border-t border-surface-border">
                  <span>Total</span>
                  <span>{formatPaiseToRupeeString(totals.totalPaise)}</span>
                </div>
              </div>

              {/* Action Buttons: Primary Send KOT, Secondary Save, Mark Served */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleSave}
                    isLoading={isSaving}
                    className="flex-1 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Order</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-2 flex-1 font-extrabold flex items-center justify-center gap-2"
                    onClick={handleSendKot}
                    isLoading={isSendingKot}
                    disabled={unsentCount === 0}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {unsentCount > 0 ? `Send KOT (${unsentCount})` : 'All Sent to Kitchen'}
                    </span>
                  </Button>
                </div>

                {items.some((i) => i.kotState === 'ready') && (
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full font-bold flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    onClick={markOrderServed}
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark Entire Order Served</span>
                  </Button>
                )}

                {onOpenBillPreview && items.length > 0 && (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2"
                    onClick={() => {
                      onClose();
                      onOpenBillPreview();
                    }}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Generate Bill & Pay</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* Cancellation Reason Modal */}
      {cancellingItem && (
        <ReasonSheet
          isOpen={Boolean(cancellingItem)}
          itemName={cancellingItem.name}
          isPrepared={cancellingItem.kotState === 'ready'}
          onClose={() => setCancellingItem(null)}
          onConfirm={handleCancelItemWithReason}
        />
      )}
    </>
  );
};
