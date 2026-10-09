import React, { useState, useEffect, useRef } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { PhoneInput } from './PhoneInput.js';
import { PreferenceTags } from './PreferenceTags.js';
import { apiFetch } from '../stores/useAuthStore.js';
import { localDb } from '../db/dexie.js';
import { useCartStore } from '../stores/useCartStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import {
  normalizePhoneNumber,
  formatPaiseToRupeeString,
  type CustomerWaiterSummary,
} from '@restaurant-os/shared';
import { UserCheck, Sparkles, History, Plus, Heart, Check, X, Phone, Utensils } from 'lucide-react';

interface CustomerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerSheet: React.FC<CustomerSheetProps> = ({ isOpen, onClose }) => {
  const {
    customerId,
    customerName,
    customerPhone,
    customerPreferences,
    setCustomer,
    clearCustomer,
    addItem,
  } = useCartStore();
  const { addToast } = useToastStore();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeLookupResult, setActiveLookupResult] = useState<CustomerWaiterSummary | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Initialize or reset form state when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (customerId) {
        setPhone(customerPhone ? customerPhone.replace(/^\+91/, '') : '');
        setName(customerName || '');
        setTags(customerPreferences?.tags || []);
        setNote(customerPreferences?.note || '');
        setIsCreatingNew(false);
      } else {
        setPhone('');
        setName('');
        setTags([]);
        setNote('');
        setActiveLookupResult(null);
        setIsCreatingNew(false);
      }
    }
  }, [isOpen, customerId, customerName, customerPhone, customerPreferences]);

  // Debounced phone lookup (200ms)
  const lookupTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length !== 10) {
      setActiveLookupResult(null);
      setIsCreatingNew(false);
      return;
    }

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    lookupTimeoutRef.current = setTimeout(async () => {
      const normalized = `+91${rawDigits}`;
      setIsLoading(true);

      try {
        // 1. Try local Dexie cache first for instantaneous offline response
        const cached = await localDb.cachedCustomers.where('phone').equals(normalized).first();
        if (cached) {
          setActiveLookupResult({
            id: cached.id,
            phone: cached.phone,
            name: cached.name,
            preferences: cached.preferences,
            favouriteItems: cached.favouriteItems || [],
            lastOrder: cached.lastOrder ?? null,
            lastVisitAt: cached.lastVisitAt ?? null,
            visitCount: cached.visitCount ?? 1,
          });
          setName(cached.name || '');
          setTags(cached.preferences?.tags || []);
          setNote(cached.preferences?.note || '');
          setIsCreatingNew(false);
        }

        // 2. Fetch fresh profile from API
        if (navigator.onLine) {
          const res = await apiFetch<{ customer: CustomerWaiterSummary }>(
            `/customers/lookup?phone=${encodeURIComponent(normalized)}`,
          );
          if (res?.customer) {
            setActiveLookupResult(res.customer);
            setName(res.customer.name || '');
            setTags(res.customer.preferences?.tags || []);
            setNote(res.customer.preferences?.note || '');
            setIsCreatingNew(false);

            // Update local dexie cache
            await localDb.cachedCustomers.put({
              id: res.customer.id,
              phone: res.customer.phone,
              name: res.customer.name,
              preferences: res.customer.preferences,
              favouriteItems: res.customer.favouriteItems,
              lastOrder: res.customer.lastOrder,
              lastVisitAt: res.customer.lastVisitAt,
              visitCount: res.customer.visitCount,
              updatedAt: Date.now(),
            });
          } else {
            setActiveLookupResult(null);
            setIsCreatingNew(true);
          }
        } else if (!cached) {
          setActiveLookupResult(null);
          setIsCreatingNew(true);
        }
      } catch (err: any) {
        if (err.status === 404 || err.statusCode === 404) {
          setActiveLookupResult(null);
          setIsCreatingNew(true);
        } else {
          console.error('Customer lookup error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, [phone]);

  // Fast attach existing customer to current cart / order (1 tap)
  const handleAttachExisting = async (cust: CustomerWaiterSummary) => {
    setIsSaving(true);
    try {
      await setCustomer({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        preferences: cust.preferences,
      });

      // Update preferences/name if changed
      if (
        name !== (cust.name || '') ||
        JSON.stringify(tags) !== JSON.stringify(cust.preferences.tags) ||
        note !== (cust.preferences.note || '')
      ) {
        await apiFetch(`/customers/${cust.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim() || undefined,
            preferences: { tags, note: note.trim() },
          }),
        }).catch(() => {});
      }

      addToast({
        type: 'success',
        message: `Customer ${cust.name || cust.phone} attached to order!`,
      });
      onClose();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Failed to attach customer' });
    } finally {
      setIsSaving(false);
    }
  };

  // Create new customer and immediately attach to current order
  const handleCreateAndAttach = async () => {
    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length !== 10) {
      addToast({ type: 'warning', message: 'Enter a valid 10-digit phone number' });
      return;
    }

    setIsSaving(true);
    try {
      const normalized = `+91${rawDigits}`;
      const payload = {
        phone: normalized,
        name: name.trim() || undefined,
        preferences: { tags, note: note.trim() },
      };

      const res = await apiFetch<any>('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const savedCust = res.customer || res;
      await setCustomer({
        id: savedCust.id,
        name: savedCust.name,
        phone: savedCust.phone,
        preferences: savedCust.preferences,
      });

      // Cache locally
      await localDb.cachedCustomers.put({
        id: savedCust.id,
        phone: savedCust.phone,
        name: savedCust.name || null,
        preferences: savedCust.preferences || { tags: [], note: '' },
        favouriteItems: [],
        lastOrder: null,
        updatedAt: Date.now(),
      });

      addToast({
        type: 'success',
        message: `Customer ${savedCust.name || savedCust.phone} saved and attached!`,
      });
      onClose();
    } catch (err: any) {
      addToast({ type: 'danger', message: err.message || 'Failed to save customer' });
    } finally {
      setIsSaving(false);
    }
  };

  // 1-tap add favourite item to cart
  const handleAddFavouriteItem = (fav: {
    itemId: string;
    name: string;
    pricePaise: number;
    isVeg?: boolean;
  }) => {
    addItem({
      itemId: fav.itemId,
      name: fav.name,
      isVeg: fav.isVeg ?? true,
      pricePaise: fav.pricePaise,
    });
    addToast({
      type: 'success',
      message: `Added "${fav.name}" to cart`,
    });
  };

  // 1-tap Reorder Last order
  const handleReorderLast = (lastItems: any[]) => {
    if (!lastItems || lastItems.length === 0) return;
    for (const item of lastItems) {
      for (let i = 0; i < (item.qty || 1); i++) {
        addItem({
          itemId: item.itemId,
          name: item.name,
          isVeg: true,
          pricePaise: item.pricePaise,
          modifiers: item.modifiers || [],
        });
      }
    }
    addToast({
      type: 'success',
      message: `Added ${lastItems.length} items from previous order`,
    });
  };

  // Detach / remove customer from order
  const handleDetachCustomer = async () => {
    await clearCustomer();
    addToast({ type: 'info', message: 'Customer detached from order' });
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={customerId ? 'Customer Attached' : 'Attach Customer'}
      description="Identify customer, note dining preferences & view past favourites"
    >
      <div className="flex flex-col h-[calc(100vh-170px)] md:h-[620px] max-w-xl mx-auto overflow-y-auto px-1 pb-6 space-y-5">
        {/* Phone Entry */}
        <div>
          <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1.5">
            Customer Mobile Number
          </label>
          <PhoneInput
            value={phone}
            onChange={(val) => setPhone(val)}
            autoFocus={!customerId}
            placeholder="98765 43210"
          />
          {isLoading && (
            <p className="text-xs text-primary animate-pulse mt-1.5 flex items-center gap-1">
              <span>Searching customer records...</span>
            </p>
          )}
        </div>

        {/* If existing customer recognized */}
        {activeLookupResult && (
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-base font-bold text-content-primary">
                    {activeLookupResult.name || 'Returning Customer'}
                  </h4>
                </div>
                <p className="text-xs text-content-secondary mt-0.5">
                  {activeLookupResult.phone}
                  {activeLookupResult.visitCount
                    ? ` • ${activeLookupResult.visitCount} visits`
                    : ''}
                </p>
              </div>

              {customerId === activeLookupResult.id ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Attached
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleAttachExisting(activeLookupResult)}
                  disabled={isSaving}
                >
                  Attach to Order
                </Button>
              )}
            </div>

            {/* Favourites Section (1-Tap Add) */}
            {activeLookupResult.favouriteItems && activeLookupResult.favouriteItems.length > 0 && (
              <div className="pt-2 border-t border-surface-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-content-secondary uppercase tracking-wider mb-2">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  <span>Customer Favourites (1-Tap Add)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeLookupResult.favouriteItems.map((fav) => (
                    <button
                      key={fav.itemId}
                      type="button"
                      onClick={() => handleAddFavouriteItem(fav)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-subtle hover:bg-surface-elevated border border-surface-border transition-all text-left group"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-content-primary truncate group-hover:text-primary">
                          {fav.name}
                        </p>
                        <p className="text-[11px] text-content-muted">
                          {formatPaiseToRupeeString(fav.pricePaise)} • ordered {fav.count}x
                        </p>
                      </div>
                      <span className="flex-shrink-0 p-1.5 rounded-lg bg-surface-card border border-surface-border text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reorder Last Order Button */}
            {activeLookupResult.lastOrder && activeLookupResult.lastOrder.length > 0 && (
              <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-content-primary flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-accent" />
                    <span>Previous Order ({activeLookupResult.lastOrder.length} items)</span>
                  </div>
                  <p className="text-[11px] text-content-muted">
                    {activeLookupResult.lastOrder.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReorderLast(activeLookupResult.lastOrder!)}
                  className="whitespace-nowrap"
                >
                  Reorder Last
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Customer Details Form (Editable Name & Preferences) */}
        {(isCreatingNew || activeLookupResult || customerId) && (
          <div className="space-y-4 p-4 rounded-2xl bg-surface-card border border-surface-border">
            <div>
              <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1.5">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-surface-subtle border border-surface-border text-content-primary placeholder:text-content-muted focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1.5">
                Food & Dining Preferences
              </label>
              <PreferenceTags
                selectedTags={tags}
                onChangeTags={setTags}
                note={note}
                onChangeNote={setNote}
              />
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-surface-border flex items-center justify-between gap-3">
              {customerId ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDetachCustomer}
                    className="text-danger hover:bg-danger/10"
                  >
                    Detach Customer
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      if (activeLookupResult) {
                        handleAttachExisting(activeLookupResult);
                      } else {
                        handleCreateAndAttach();
                      }
                    }}
                    disabled={isSaving}
                  >
                    Update & Save
                  </Button>
                </>
              ) : isCreatingNew ? (
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={handleCreateAndAttach}
                  disabled={isSaving || phone.replace(/\D/g, '').length !== 10}
                >
                  Save & Attach to Order
                </Button>
              ) : activeLookupResult ? (
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => handleAttachExisting(activeLookupResult)}
                  disabled={isSaving}
                >
                  Attach to Order
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
