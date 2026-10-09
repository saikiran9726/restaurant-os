import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { PurchaseLineEditor, type PurchaseLineDraft } from '../../components/PurchaseLineEditor.js';
import { Dialog } from '../../components/ui/Overlay.js';
import {
  formatPaiseToRupeeString,
  type InventoryItemOutput,
  type SupplierOutput,
  type PurchaseOutput,
} from '@restaurant-os/shared';
import {
  ShoppingBag,
  Plus,
  ArrowLeft,
  Calendar,
  Save,
  FileText,
  UserCheck,
  CheckCircle2,
  DollarSign,
  Clock,
  Eye,
} from 'lucide-react';

export const OwnerPurchases: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<PurchaseOutput | null>(null);

  // Form State for New Purchase
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [paidStatus, setPaidStatus] = useState<'paid' | 'unpaid'>('paid');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    {
      itemId: '',
      itemName: '',
      unit: 'kg',
      quantityStr: '50',
      unitPriceStr: '50',
      totalPriceStr: '2500',
    },
  ]);

  // Form State for Inline Supplier Creation
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');

  // Queries
  const { data: purchasesData, isLoading: isPurchasesLoading } = useQuery<{
    purchases: PurchaseOutput[];
  }>({
    queryKey: ['inventory-purchases'],
    queryFn: () => apiFetch('/inventory/purchases?limit=50'),
    refetchInterval: 15000,
  });

  const { data: itemsData } = useQuery<{ items: InventoryItemOutput[] }>({
    queryKey: ['inventory-items', false, ''],
    queryFn: () => apiFetch('/inventory/items'),
  });

  const { data: suppliersData } = useQuery<{ suppliers: SupplierOutput[] }>({
    queryKey: ['inventory-suppliers'],
    queryFn: () => apiFetch('/inventory/suppliers'),
  });

  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/inventory/suppliers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      addToast({ type: 'success', message: 'Supplier created' });
      setIsAddSupplierOpen(false);
      setSupplierId(data.supplier.id);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierNotes('');
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to create supplier: ${err.message}` });
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/inventory/purchases', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Purchase logged and stock incremented' });
      setIsNewPurchaseOpen(false);
      resetPurchaseForm();
      queryClient.invalidateQueries({ queryKey: ['inventory-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Purchase failed: ${err.message}` });
    },
  });

  const resetPurchaseForm = () => {
    setSupplierId('');
    setInvoiceRef('');
    setPurchaseNote('');
    setLines([
      {
        itemId: '',
        itemName: '',
        unit: 'kg',
        quantityStr: '50',
        unitPriceStr: '50',
        totalPriceStr: '2500',
      },
    ]);
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines
      .filter((l) => l.itemId && parseFloat(l.quantityStr) > 0)
      .map((l) => {
        const qty = parseFloat(l.quantityStr) || 0;
        const lineTotalPaise = Math.round((parseFloat(l.totalPriceStr) || 0) * 100);
        const unitPricePaise =
          Math.round((parseFloat(l.unitPriceStr) || 0) * 100) || Math.round(lineTotalPaise / qty);

        return {
          itemId: l.itemId,
          quantity: qty,
          unitPricePaise,
          lineTotalPaise,
        };
      });

    if (validLines.length === 0) {
      addToast({ type: 'danger', message: 'Please add at least one valid line item' });
      return;
    }

    createPurchaseMutation.mutate({
      supplierId: supplierId || null,
      purchaseDate,
      invoiceRef: invoiceRef || null,
      paidStatus,
      note: purchaseNote || null,
      lines: validLines,
    });
  };

  const totalPaiseCalculated = lines.reduce(
    (sum, l) => sum + Math.round((parseFloat(l.totalPriceStr) || 0) * 100),
    0,
  );

  const items = itemsData?.items || [];
  const suppliers = suppliersData?.suppliers || [];
  const purchases = purchasesData?.purchases || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/owner/inventory')}
              className="p-1 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-title font-extrabold text-content-primary">
              Purchases & Supplier Restock
            </h2>
          </div>
          <p className="text-xs text-content-secondary mt-0.5 ml-7">
            Log supplier invoices, compute weighted average cost, and track ingredient price
            movements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewPurchaseOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Record Purchase
          </Button>
        </div>
      </div>

      {/* Purchases History Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden space-y-3 p-5">
        <h3 className="font-bold text-subhead text-content-primary">Purchase Invoices History</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-content-muted">
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Invoice Ref</th>
                <th className="py-2.5 px-3 font-semibold">Supplier</th>
                <th className="py-2.5 px-3 font-semibold">Items</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total Invoice</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-content-muted">
                    No purchases recorded yet. Click "Record Purchase" to add supplier restock.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-elevated/40">
                    <td className="py-3 px-3 font-bold text-content-primary">{p.purchaseDate}</td>
                    <td className="py-3 px-3 text-content-secondary font-mono">
                      {p.invoiceRef || `#${p.id.slice(0, 8)}`}
                    </td>
                    <td className="py-3 px-3 font-medium text-content-primary">
                      {p.supplierName || 'General Supplier'}
                    </td>
                    <td className="py-3 px-3 text-content-secondary">
                      {p.lines.map((l) => `${l.quantity} ${l.itemUnit} ${l.itemName}`).join(', ')}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-content-primary">
                      {formatPaiseToRupeeString(p.totalPaise)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.paidStatus === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {p.paidStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPurchaseDetail(p)}
                        className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-card border border-surface-border text-xs font-semibold text-content-secondary hover:text-content-primary inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View Lines
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PURCHASE MODAL */}
      {isNewPurchaseOpen && (
        <Dialog
          isOpen={isNewPurchaseOpen}
          onClose={() => setIsNewPurchaseOpen(false)}
          title="Record Restock Purchase"
          size="xl"
        >
          <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
            {/* Header Form Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface-elevated p-3.5 rounded-xl border border-surface-border">
              <div>
                <label className="font-semibold text-content-primary block mb-1">Supplier</label>
                <div className="flex gap-1.5">
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-card border border-surface-border rounded-lg font-semibold"
                  >
                    <option value="">-- Direct / Walk-in --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierOpen(true)}
                    className="p-1.5 bg-surface-card border border-surface-border rounded-lg text-accent hover:bg-surface-elevated"
                    title="Add Supplier"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-content-primary block mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-card border border-surface-border rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-content-primary block mb-1">
                  Invoice Ref #
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-89"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-card border border-surface-border rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-content-primary block mb-1">
                  Payment Status
                </label>
                <select
                  value={paidStatus}
                  onChange={(e) => setPaidStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-surface-card border border-surface-border rounded-lg font-semibold"
                >
                  <option value="paid">Paid (Cash/Bank)</option>
                  <option value="unpaid">Credit / Unpaid</option>
                </select>
              </div>
            </div>

            {/* Line Items Editor */}
            <div className="space-y-2">
              <h4 className="font-bold text-body text-content-primary">Purchase Line Items</h4>
              <PurchaseLineEditor items={items} lines={lines} onChangeLines={setLines} />
            </div>

            {/* Live Total Bar */}
            <div className="flex items-center justify-between p-4 bg-accent/10 border border-accent/20 rounded-xl">
              <div>
                <span className="text-xs font-bold text-accent block">Total Purchase Invoice:</span>
                <span className="text-[11px] text-content-muted">
                  Weighted-average cost and last purchase price will update automatically
                </span>
              </div>
              <span className="text-headline font-black text-content-primary">
                {formatPaiseToRupeeString(totalPaiseCalculated)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setIsNewPurchaseOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={createPurchaseMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {createPurchaseMutation.isPending ? 'Saving...' : 'Save & Restock'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* INLINE ADD SUPPLIER MODAL */}
      {isAddSupplierOpen && (
        <Dialog
          isOpen={isAddSupplierOpen}
          onClose={() => setIsAddSupplierOpen(false)}
          title="Create New Supplier"
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSupplierMutation.mutate({
                name: newSupplierName.trim(),
                phone: newSupplierPhone.trim() || undefined,
                notes: newSupplierNotes.trim() || undefined,
              });
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Supplier Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ABC Foods, Daily Dairy"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Notes / Address
              </label>
              <textarea
                rows={2}
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Wholesale market stall #42..."
                className="w-full p-2 bg-surface-elevated border border-surface-border rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsAddSupplierOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={createSupplierMutation.isPending}
              >
                Create Supplier
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* VIEW PURCHASE DETAIL MODAL */}
      {selectedPurchaseDetail && (
        <Dialog
          isOpen={Boolean(selectedPurchaseDetail)}
          onClose={() => setSelectedPurchaseDetail(null)}
          title={`Purchase Invoice: ${selectedPurchaseDetail.invoiceRef || `#${selectedPurchaseDetail.id.slice(0, 8)}`}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-surface-elevated p-3 rounded-lg">
              <div>
                <span className="text-content-muted block">Supplier</span>
                <span className="font-bold text-content-primary">
                  {selectedPurchaseDetail.supplierName || 'Direct'}
                </span>
              </div>
              <div>
                <span className="text-content-muted block">Purchase Date</span>
                <span className="font-bold text-content-primary">
                  {selectedPurchaseDetail.purchaseDate}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-content-muted">
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Quantity</th>
                  <th className="p-2 text-right">Unit Price</th>
                  <th className="p-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {selectedPurchaseDetail.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 font-bold">{l.itemName}</td>
                    <td className="p-2 text-right font-medium">
                      {l.quantity} {l.itemUnit}
                    </td>
                    <td className="p-2 text-right">{formatPaiseToRupeeString(l.unitPricePaise)}</td>
                    <td className="p-2 text-right font-bold text-content-primary">
                      {formatPaiseToRupeeString(l.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center p-3 bg-surface-elevated rounded-lg font-bold text-body">
              <span>Total Invoice Amount</span>
              <span>{formatPaiseToRupeeString(selectedPurchaseDetail.totalPaise)}</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedPurchaseDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
