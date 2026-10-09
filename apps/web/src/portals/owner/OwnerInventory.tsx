import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { StockChip } from '../../components/StockChip.js';
import { CountSheet } from '../../components/CountSheet.js';
import { MovementTable } from '../../components/MovementTable.js';
import { PriceTrendMini } from '../../components/PriceTrendMini.js';
import { Dialog } from '../../components/ui/Overlay.js';
import {
  formatPaiseToRupeeString,
  type InventoryItemOutput,
  type SupplierOutput,
  type CreateInventoryItemInput,
  type RecordUsageInput,
  type RecordWasteInput,
} from '@restaurant-os/shared';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Upload,
  CalendarCheck,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Sliders,
  Users,
  Eye,
  History,
  FileSpreadsheet,
} from 'lucide-react';

export const OwnerInventory: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'reorder' | 'suppliers'>('inventory');

  // Modals & Sheets State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCountSheetOpen, setIsCountSheetOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);

  // Add Item Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState<string>('kg');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemStock, setNewItemStock] = useState('0');
  const [newItemReorder, setNewItemReorder] = useState('5');
  const [newItemCost, setNewItemCost] = useState('0');

  // Usage Form State
  const [usageItemId, setUsageItemId] = useState('');
  const [usageQtyStr, setUsageQtyStr] = useState('1');
  const [usageReason, setUsageReason] = useState('Kitchen prep');

  // Waste Form State
  const [wasteItemId, setWasteItemId] = useState('');
  const [wasteQtyStr, setWasteQtyStr] = useState('1');
  const [wasteReason, setWasteReason] = useState<
    'spoilage' | 'spillage' | 'expired' | 'returned' | 'other'
  >('spoilage');
  const [wasteNote, setWasteNote] = useState('');

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  // Queries
  const { data: itemsData, isLoading: isItemsLoading } = useQuery<{ items: InventoryItemOutput[] }>(
    {
      queryKey: ['inventory-items', lowStockFilter, search],
      queryFn: () =>
        apiFetch(
          `/inventory/items?lowStockOnly=${lowStockFilter}&search=${encodeURIComponent(search)}`,
        ),
      refetchInterval: 15000,
    },
  );

  const { data: reorderData } = useQuery<{ reorderItems: InventoryItemOutput[] }>({
    queryKey: ['inventory-reorder'],
    queryFn: () => apiFetch('/inventory/reorder'),
    enabled: activeTab === 'reorder',
  });

  const { data: suppliersData } = useQuery<{ suppliers: SupplierOutput[] }>({
    queryKey: ['inventory-suppliers'],
    queryFn: () => apiFetch('/inventory/suppliers'),
    enabled: activeTab === 'suppliers',
  });

  const { data: itemDetailData, isLoading: isDetailLoading } = useQuery<{
    item: InventoryItemOutput;
    recentMovements: any[];
    purchaseHistory: any[];
  }>({
    queryKey: ['inventory-item-detail', selectedDetailItemId],
    queryFn: () => apiFetch(`/inventory/items/${selectedDetailItemId}`),
    enabled: Boolean(selectedDetailItemId),
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: (body: CreateInventoryItemInput) =>
      apiFetch('/inventory/items', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Inventory item added' });
      setIsAddItemOpen(false);
      resetAddItemForm();
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to add item: ${err.message}` });
    },
  });

  const usageMutation = useMutation({
    mutationFn: (body: RecordUsageInput) =>
      apiFetch('/inventory/usage', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Stock usage recorded' });
      setIsUsageModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to record usage: ${err.message}` });
    },
  });

  const wasteMutation = useMutation({
    mutationFn: (body: RecordWasteInput) =>
      apiFetch('/inventory/waste', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Stock waste recorded' });
      setIsWasteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to record waste: ${err.message}` });
    },
  });

  const stockCountMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/inventory/stock-count', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Physical stock counts committed' });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Stock count failed: ${err.message}` });
    },
  });

  const csvImportMutation = useMutation({
    mutationFn: (rows: any[]) =>
      apiFetch('/inventory/import-csv', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    onSuccess: (data: any) => {
      addToast({
        type: 'success',
        message: `Imported ${data.importedCount} items successfully!`,
      });
      setIsCsvImportOpen(false);
      setCsvText('');
      setCsvPreviewRows([]);
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `CSV import failed: ${err.message}` });
    },
  });

  const resetAddItemForm = () => {
    setNewItemName('');
    setNewItemUnit('kg');
    setNewItemCategory('General');
    setNewItemStock('0');
    setNewItemReorder('5');
    setNewItemCost('0');
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addItemMutation.mutate({
      name: newItemName.trim(),
      unit: newItemUnit as any,
      category: newItemCategory.trim() || 'General',
      currentStock: parseFloat(newItemStock) || 0,
      reorderLevel: parseFloat(newItemReorder) || 0,
      initialCostPaisePerUnit: Math.round((parseFloat(newItemCost) || 0) * 100),
    });
  };

  const handleParseCsv = () => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) {
      addToast({ type: 'danger', message: 'Please provide CSV data with a header and rows' });
      return;
    }

    const parsed = [];
    // Format: name,unit,category,currentStock,reorderLevel,costPricePerUnit
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const [
        name,
        unit = 'kg',
        category = 'General',
        currentStock = '0',
        reorderLevel = '0',
        costPricePerUnit = '0',
      ] = line.split(',').map((s) => s.trim());

      if (name) {
        parsed.push({
          name,
          unit,
          category,
          currentStock: parseFloat(currentStock) || 0,
          reorderLevel: parseFloat(reorderLevel) || 0,
          costPricePerUnit: parseFloat(costPricePerUnit) || 0,
        });
      }
    }
    setCsvPreviewRows(parsed);
  };

  const items = itemsData?.items || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title font-extrabold text-content-primary">
              Stock & Inventory Control
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">
              Single-Unit Precision
            </span>
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            Lightweight ingredient tracking, purchase history, and real consumption derived from
            physical counts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCsvImportOpen(true)}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            Import CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCountSheetOpen(true)}
            leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
          >
            Audit Stock Count
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/owner/purchases')}
            leftIcon={<History className="w-3.5 h-3.5" />}
          >
            Purchases & Restock
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddItemOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border">
        {[
          { id: 'inventory', label: `All Items (${items.length})` },
          { id: 'reorder', label: 'Reorder List (Low / Out)' },
          { id: 'suppliers', label: 'Suppliers Directory' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL INVENTORY ITEMS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-surface-border p-3 rounded-xl">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter ingredients by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setLowStockFilter(!lowStockFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lowStockFilter
                    ? 'bg-amber-500 text-white'
                    : 'bg-surface-elevated border border-surface-border text-content-secondary hover:text-content-primary'
                }`}
              >
                Low Stock Only
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUsageModalOpen(true)}
                leftIcon={<Sliders className="w-3.5 h-3.5" />}
              >
                Log Usage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWasteModalOpen(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
              >
                Log Waste
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-content-muted">
                    <th className="py-3 px-4 font-semibold">Ingredient</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Stock Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Last Purchase Price</th>
                    <th className="py-3 px-4 font-semibold text-right">Avg Cost (Est.)</th>
                    <th className="py-3 px-4 font-semibold">Last Supplier</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-content-muted">
                        No ingredients found. Click "Add Ingredient" or "Import CSV" to start.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-elevated/40">
                        <td className="py-3 px-4 font-bold text-content-primary">{item.name}</td>
                        <td className="py-3 px-4 text-content-secondary">{item.category}</td>
                        <td className="py-3 px-4">
                          <StockChip
                            status={item.status}
                            currentStock={item.currentStock}
                            reorderLevel={item.reorderLevel}
                            unit={item.unit}
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-content-primary">
                          {item.lastPurchasePricePaisePerUnit > 0
                            ? `${formatPaiseToRupeeString(item.lastPurchasePricePaisePerUnit)} / ${item.unit}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-content-secondary">
                          {item.avgCostPaisePerUnit > 0
                            ? `${formatPaiseToRupeeString(item.avgCostPaisePerUnit)} / ${item.unit}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-content-muted">
                          {item.lastSupplierName || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItemId(item.id)}
                            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-card border border-surface-border text-xs font-semibold text-content-secondary hover:text-content-primary inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REORDER LIST */}
      {activeTab === 'reorder' && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-subhead text-content-primary">Restock Recommendations</h3>
            <p className="text-xs text-content-secondary">
              Items currently at or below their configured minimum reorder threshold
            </p>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-content-muted">
                    <th className="py-2.5 px-3 font-semibold">Item</th>
                    <th className="py-2.5 px-3 font-semibold">Stock</th>
                    <th className="py-2.5 px-3 font-semibold">Reorder Threshold</th>
                    <th className="py-2.5 px-3 font-semibold">Last Supplier</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Last Price</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {(reorderData?.reorderItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-emerald-600 font-bold">
                        All stock levels are currently healthy!
                      </td>
                    </tr>
                  ) : (
                    reorderData?.reorderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-elevated/40">
                        <td className="py-3 px-3 font-bold text-content-primary">{item.name}</td>
                        <td className="py-3 px-3">
                          <StockChip
                            status={item.status}
                            currentStock={item.currentStock}
                            reorderLevel={item.reorderLevel}
                            unit={item.unit}
                          />
                        </td>
                        <td className="py-3 px-3 text-content-secondary">
                          {item.reorderLevel} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-content-primary">
                          {item.lastSupplierName || 'No supplier on record'}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-content-primary">
                          {formatPaiseToRupeeString(item.lastPurchasePricePaisePerUnit)} /{' '}
                          {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate('/owner/purchases')}
                            leftIcon={<ShoppingBag className="w-3 h-3" />}
                          >
                            Restock
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-subhead text-content-primary">
              Suppliers Directory & Spend History
            </h3>
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-content-muted">
                    <th className="py-2.5 px-3 font-semibold">Supplier Name</th>
                    <th className="py-2.5 px-3 font-semibold">Phone Contact</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Invoices</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lifetime Spend</th>
                    <th className="py-2.5 px-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {(suppliersData?.suppliers || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-content-muted">
                        No suppliers added yet. Add a purchase to record your first supplier.
                      </td>
                    </tr>
                  ) : (
                    suppliersData?.suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-surface-elevated/40">
                        <td className="py-3 px-3 font-bold text-content-primary">{sup.name}</td>
                        <td className="py-3 px-3 text-content-secondary">{sup.phone || '—'}</td>
                        <td className="py-3 px-3 text-right text-content-secondary font-medium">
                          {sup.totalPurchasesCount || 0}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-content-primary">
                          {formatPaiseToRupeeString(sup.totalSpendPaise || 0)}
                        </td>
                        <td className="py-3 px-3 text-content-muted truncate max-w-xs">
                          {sup.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ITEM DETAIL MODAL */}
      {selectedDetailItemId && itemDetailData && (
        <Dialog
          isOpen={Boolean(selectedDetailItemId)}
          onClose={() => setSelectedDetailItemId(null)}
          title={`Ingredient Detail: ${itemDetailData.item.name}`}
          size="lg"
        >
          <div className="space-y-5 text-xs">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Current Stock</span>
                <span className="text-subhead font-black text-content-primary mt-1 block">
                  {itemDetailData.item.currentStock} {itemDetailData.item.unit}
                </span>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Reorder Level</span>
                <span className="text-subhead font-bold text-content-primary mt-1 block">
                  {itemDetailData.item.reorderLevel} {itemDetailData.item.unit}
                </span>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Last Purchase Price</span>
                <span className="text-subhead font-bold text-content-primary mt-1 block">
                  {formatPaiseToRupeeString(itemDetailData.item.lastPurchasePricePaisePerUnit)}
                </span>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Avg Cost (Estimate)</span>
                <span className="text-subhead font-bold text-emerald-600 mt-1 block">
                  {formatPaiseToRupeeString(itemDetailData.item.avgCostPaisePerUnit)}
                </span>
              </div>
            </div>

            {/* Price Sparkline */}
            {itemDetailData.purchaseHistory.length > 0 && (
              <div className="p-4 bg-surface-elevated rounded-xl">
                <h4 className="font-bold text-content-primary mb-2">Price Trend History</h4>
                <PriceTrendMini
                  unit={itemDetailData.item.unit}
                  prices={itemDetailData.purchaseHistory.map((p) => ({
                    date: p.purchaseDate,
                    pricePaise: p.unitPricePaise,
                  }))}
                />
              </div>
            )}

            {/* Movement Ledger */}
            <div>
              <h4 className="font-bold text-content-primary mb-2">Recent Movement Ledger</h4>
              <MovementTable movements={itemDetailData.recentMovements} />
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedDetailItemId(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ADD INGREDIENT MODAL */}
      {isAddItemOpen && (
        <Dialog
          isOpen={isAddItemOpen}
          onClose={() => setIsAddItemOpen(false)}
          title="Add New Ingredient / Supply Item"
          size="md"
        >
          <form onSubmit={handleAddItemSubmit} className="space-y-4 text-xs">
            <div>
              <label
                htmlFor="new-item-name"
                className="font-semibold text-content-primary block mb-1"
              >
                Ingredient Name *
              </label>
              <input
                id="new-item-name"
                type="text"
                required
                placeholder="e.g. Basmati Rice, Buffalo Milk"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-item-unit"
                  className="font-semibold text-content-primary block mb-1"
                >
                  Unit of Measure *
                </label>
                <select
                  id="new-item-unit"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
                >
                  <option value="kg">kg (Kilograms)</option>
                  <option value="g">g (Grams)</option>
                  <option value="L">L (Litres)</option>
                  <option value="ml">ml (Millilitres)</option>
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="packet">packet (Packets)</option>
                  <option value="dozen">dozen (Dozens)</option>
                  <option value="custom">custom</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-item-category"
                  className="font-semibold text-content-primary block mb-1"
                >
                  Category
                </label>
                <input
                  id="new-item-category"
                  type="text"
                  placeholder="Grains, Dairy, Produce..."
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="new-item-stock"
                  className="font-semibold text-content-primary block mb-1"
                >
                  Initial Stock
                </label>
                <input
                  id="new-item-stock"
                  type="number"
                  step="0.001"
                  min="0"
                  value={newItemStock}
                  onChange={(e) => setNewItemStock(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
                />
              </div>

              <div>
                <label
                  htmlFor="new-item-reorder"
                  className="font-semibold text-content-primary block mb-1"
                >
                  Reorder Level
                </label>
                <input
                  id="new-item-reorder"
                  type="number"
                  step="0.001"
                  min="0"
                  value={newItemReorder}
                  onChange={(e) => setNewItemReorder(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="new-item-cost"
                  className="font-semibold text-content-primary block mb-1"
                >
                  Cost / Unit (₹)
                </label>
                <input
                  id="new-item-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsAddItemOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={addItemMutation.isPending}
              >
                Save Ingredient
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* RECORD USAGE MODAL */}
      {isUsageModalOpen && (
        <Dialog
          isOpen={isUsageModalOpen}
          onClose={() => setIsUsageModalOpen(false)}
          title="Record Manual Stock Usage"
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              usageMutation.mutate({
                itemId: usageItemId,
                quantity: parseFloat(usageQtyStr) || 0,
                reason: usageReason,
              });
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label
                htmlFor="usage-item-select"
                className="font-semibold text-content-primary block mb-1"
              >
                Select Ingredient *
              </label>
              <select
                id="usage-item-select"
                required
                value={usageItemId}
                onChange={(e) => setUsageItemId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
              >
                <option value="">-- Choose Ingredient --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.currentStock} {it.unit} in stock)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="usage-qty" className="font-semibold text-content-primary block mb-1">
                Used Quantity *
              </label>
              <input
                id="usage-qty"
                type="number"
                step="0.001"
                min="0.001"
                required
                value={usageQtyStr}
                onChange={(e) => setUsageQtyStr(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
              />
            </div>

            <div>
              <label
                htmlFor="usage-reason"
                className="font-semibold text-content-primary block mb-1"
              >
                Reason
              </label>
              <input
                id="usage-reason"
                type="text"
                value={usageReason}
                onChange={(e) => setUsageReason(e.target.value)}
                placeholder="Kitchen prep, bulk sauce batch..."
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={usageMutation.isPending}>
                Deduct Usage
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* RECORD WASTE MODAL */}
      {isWasteModalOpen && (
        <Dialog
          isOpen={isWasteModalOpen}
          onClose={() => setIsWasteModalOpen(false)}
          title="Record Stock Waste & Spoilage"
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              wasteMutation.mutate({
                itemId: wasteItemId,
                quantity: parseFloat(wasteQtyStr) || 0,
                reason: wasteReason,
                note: wasteNote || undefined,
              });
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label
                htmlFor="waste-item-select"
                className="font-semibold text-content-primary block mb-1"
              >
                Select Ingredient *
              </label>
              <select
                id="waste-item-select"
                required
                value={wasteItemId}
                onChange={(e) => setWasteItemId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
              >
                <option value="">-- Choose Ingredient --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.currentStock} {it.unit} in stock)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="waste-qty" className="font-semibold text-content-primary block mb-1">
                Wasted Quantity *
              </label>
              <input
                id="waste-qty"
                type="number"
                step="0.001"
                min="0.001"
                required
                value={wasteQtyStr}
                onChange={(e) => setWasteQtyStr(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
              />
            </div>

            <div>
              <label
                htmlFor="waste-reason"
                className="font-semibold text-content-primary block mb-1"
              >
                Waste Reason *
              </label>
              <select
                id="waste-reason"
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
              >
                <option value="spoilage">Spoilage / Rotten</option>
                <option value="spillage">Spillage / Dropped</option>
                <option value="expired">Expired Date</option>
                <option value="returned">Customer Return</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="waste-note" className="font-semibold text-content-primary block mb-1">
                Explanation Note
              </label>
              <input
                id="waste-note"
                type="text"
                value={wasteNote}
                onChange={(e) => setWasteNote(e.target.value)}
                placeholder="e.g. Fridge temperature fluctuation overnight"
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsWasteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={wasteMutation.isPending}>
                Log Waste
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PHYSICAL STOCK COUNT SHEET */}
      {isCountSheetOpen && (
        <CountSheet
          isOpen={isCountSheetOpen}
          onClose={() => setIsCountSheetOpen(false)}
          items={items}
          onSubmitCounts={async (counts, note) => {
            await stockCountMutation.mutateAsync({ counts, note });
          }}
          isSubmitting={stockCountMutation.isPending}
        />
      )}

      {/* CSV IMPORT MODAL */}
      {isCsvImportOpen && (
        <Dialog
          isOpen={isCsvImportOpen}
          onClose={() => setIsCsvImportOpen(false)}
          title="CSV Opening Stock Import"
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <p className="text-content-secondary">
              Paste comma-separated items with opening stock and reorder levels. Format:
              <code className="block mt-1 p-2 bg-surface-elevated rounded font-mono text-[11px]">
                name,unit,category,currentStock,reorderLevel,costPricePerUnit
                <br />
                Basmati Rice,kg,Grains,50,10,50
                <br />
                Buffalo Milk,L,Dairy,20,5,60
              </code>
            </p>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV rows here..."
              className="w-full p-2.5 bg-surface-elevated border border-surface-border rounded-lg font-mono text-xs"
            />

            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handleParseCsv}>
                Preview Rows
              </Button>

              {csvPreviewRows.length > 0 && (
                <span className="font-bold text-accent">{csvPreviewRows.length} rows parsed</span>
              )}
            </div>

            {csvPreviewRows.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-surface-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="p-2 font-semibold">Name</th>
                      <th className="p-2 font-semibold">Unit</th>
                      <th className="p-2 font-semibold">Category</th>
                      <th className="p-2 font-semibold">Stock</th>
                      <th className="p-2 font-semibold">Reorder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {csvPreviewRows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-bold">{r.name}</td>
                        <td className="p-2">{r.unit}</td>
                        <td className="p-2">{r.category}</td>
                        <td className="p-2">{r.currentStock}</td>
                        <td className="p-2">{r.reorderLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button variant="secondary" size="sm" onClick={() => setIsCsvImportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={csvPreviewRows.length === 0 || csvImportMutation.isPending}
                onClick={() => csvImportMutation.mutate(csvPreviewRows)}
              >
                {csvImportMutation.isPending ? 'Importing...' : 'Commit CSV Import'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
