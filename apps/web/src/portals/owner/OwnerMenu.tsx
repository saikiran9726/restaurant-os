import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  UtensilsCrossed,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  Search,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { VegMark } from '../../components/ui/VegMark.js';
import { ItemEditor } from '../../components/ItemEditor.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { ImportPreviewTable } from '../../components/ImportPreviewTable.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import type {
  MenuItem,
  MenuCategory,
  ModifierGroup,
  CsvImportPreviewResponse,
} from '@restaurant-os/shared';
import { useToastStore } from '../../stores/useToastStore.js';

export const OwnerMenu: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Dialogs
  const [isSampleConfirmOpen, setIsSampleConfirmOpen] = useState(false);
  const [isClearSampleConfirmOpen, setIsClearSampleConfirmOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<CsvImportPreviewResponse | null>(null);

  // Fetch menu
  const { data: menuData, isLoading } = useQuery<{
    categories: MenuCategory[];
    items: MenuItem[];
  }>({
    queryKey: ['menu'],
    queryFn: () => apiFetch('/menu'),
  });

  // Fetch modifier groups
  const { data: modifierGroups = [] } = useQuery<ModifierGroup[]>({
    queryKey: ['modifier-groups'],
    queryFn: () => apiFetch('/modifier-groups'),
  });

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesCategory =
      activeCategoryFilter === 'all' || item.categoryId === activeCategoryFilter;
    const matchesQuery =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  // Save Item Mutation (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedItem) {
        return apiFetch(`/menu/items/${selectedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        return apiFetch('/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      addToast({
        type: 'success',
        message: selectedItem ? 'Menu item updated' : 'Menu item created',
      });
      setIsEditorOpen(false);
      setSelectedItem(null);
    },
    onError: (err: Error) => {
      addToast({ type: 'danger', message: err.message });
    },
  });

  // Toggle Availability Mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      apiFetch(`/menu/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  // Bulk Veg Toggle
  const bulkVegMutation = useMutation({
    mutationFn: (isVeg: boolean) =>
      apiFetch('/menu/items/bulk-veg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedItemIds, isVeg }),
      }),
    onSuccess: (_, isVeg) => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setSelectedItemIds([]);
      addToast({
        type: 'success',
        message: `Updated items to ${isVeg ? 'VEG' : 'NON-VEG'}`,
      });
    },
  });

  // Deactivate item
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/menu/items/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      addToast({ type: 'info', message: 'Item archived' });
    },
  });

  // Load Sample Menu
  const loadSampleMutation = useMutation({
    mutationFn: () =>
      apiFetch('/menu/seed-sample', {
        method: 'POST',
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setIsSampleConfirmOpen(false);
      addToast({ type: 'success', message: data.message });
    },
  });

  // Clear Sample Menu
  const clearSampleMutation = useMutation({
    mutationFn: () =>
      apiFetch('/menu/clear-sample', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setIsClearSampleConfirmOpen(false);
      addToast({ type: 'info', message: 'Sample menu items removed' });
    },
  });

  // CSV Import Dry Run (Preview)
  const previewImportMutation = useMutation({
    mutationFn: (csvContent: string) =>
      apiFetch<CsvImportPreviewResponse>('/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, dryRun: true }),
      }),
    onSuccess: (res) => {
      setImportPreview(res);
    },
    onError: (err: Error) => {
      addToast({ type: 'danger', message: `Import parse error: ${err.message}` });
    },
  });

  // CSV Import Commit
  const commitImportMutation = useMutation({
    mutationFn: (csvContent: string) =>
      apiFetch('/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, dryRun: false }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setIsImportModalOpen(false);
      setImportPreview(null);
      setImportCsvText('');
      addToast({
        type: 'success',
        message: `Successfully imported ${res.importedCount} menu items!`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'danger', message: err.message });
    },
  });

  // Export to CSV
  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = 'category,name,veg/non-veg,price,aliases,modifier groups\n';
    const rows = items
      .map((item) => {
        const cat = categories.find((c) => c.id === item.categoryId)?.name || '';
        const price = (item.pricePaise / 100).toFixed(2);
        const aliases = (item.aliases || []).join(';');
        return `"${cat}","${item.name}","${item.isVeg ? 'veg' : 'non-veg'}","${price}","${aliases}",""`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `restaurant_menu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasSampleData = categories.some((c) => c.name.toLowerCase().includes('(sample)'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sample Data Banner */}
      {hasSampleData && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                Sample data active (edit or clear freely)
              </p>
              <p className="text-xs text-content-secondary">
                This is starter data for configuration testing and is not representative of your
                real restaurant facts.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsClearSampleConfirmOpen(true)}
            className="text-danger hover:bg-danger/10 text-xs shrink-0"
          >
            Clear Sample Set
          </Button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Menu Catalogue</h2>
          <p className="text-caption text-content-secondary mt-1">
            Configure dishes, prices, veg/non-veg flags, search aliases, and modifiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Load Sample Button */}
          {!hasSampleData && items.length === 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsSampleConfirmOpen(true)}
              className="flex items-center gap-2 text-accent"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Sample Menu</span>
            </Button>
          )}

          {/* Import / Export */}
          <Button
            variant="ghost"
            size="md"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>

          {/* New Item */}
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setSelectedItem(null);
              setIsEditorOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </Button>
        </div>
      </div>

      {/* Toolbar: Category tabs, Search, Bulk Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-surface-card border border-surface-border rounded-2xl">
        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 max-w-full">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              activeCategoryFilter === 'all'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-secondary hover:bg-surface-elevated'
            }`}
          >
            All Items ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                activeCategoryFilter === c.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-content-secondary hover:bg-surface-elevated'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or alias..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-surface-border bg-surface-elevated text-xs text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Bulk action bar if items selected */}
      {selectedItemIds.length > 0 && (
        <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between text-xs">
          <span className="font-semibold text-content-secondary">
            {selectedItemIds.length} items selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkVegMutation.mutate(true)}
              className="text-veg"
            >
              Set as VEG
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkVegMutation.mutate(false)}
              className="text-nonveg"
            >
              Set as NON-VEG
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItemIds([])}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Menu Item Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-content-muted">Loading menu items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-content-muted">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">No items match your filter.</p>
            {categories.length === 0 && (
              <p className="text-xs mt-1">
                Please create categories or load sample menu data first.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-surface-elevated border-b border-surface-border text-xs font-bold text-content-secondary uppercase">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all items"
                      checked={
                        selectedItemIds.length > 0 &&
                        selectedItemIds.length === filteredItems.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItemIds(filteredItems.map((i) => i.id));
                        } else {
                          setSelectedItemIds([]);
                        }
                      }}
                      className="rounded text-accent focus:ring-accent"
                    />
                  </th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Modifiers</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredItems.map((item) => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-surface-elevated/40 transition-colors ${
                        !item.available ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={isChecked}
                          onChange={() => {
                            setSelectedItemIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((i) => i !== item.id)
                                : [...prev, item.id],
                            );
                          }}
                          className="rounded text-accent focus:ring-accent"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <VegMark type={item.isVeg ? 'veg' : 'nonveg'} size="sm" />
                          <div>
                            <span className="font-bold text-content-primary block">
                              {item.name}
                            </span>
                            {item.aliases.length > 0 && (
                              <span className="text-xs text-content-muted">
                                {item.aliases.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-content-secondary">
                        {categories.find((c) => c.id === item.categoryId)?.name || '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-content-primary">
                        {formatPaiseToRupeeString(item.pricePaise)}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleAvailabilityMutation.mutate({
                              id: item.id,
                              available: !item.available,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                            item.available
                              ? 'bg-success/10 text-success hover:bg-success/20'
                              : 'bg-danger/10 text-danger hover:bg-danger/20'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.available ? 'bg-success' : 'bg-danger'
                            }`}
                          />
                          <span>{item.available ? 'Available' : 'Out of Stock'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-content-muted">
                        {(item.modifierGroupIds || []).length > 0
                          ? `${(item.modifierGroupIds || []).length} groups`
                          : 'None'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsEditorOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-surface-elevated text-content-secondary hover:text-content-primary focus-visible:outline-none"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="p-1.5 rounded hover:bg-danger/10 text-content-muted hover:text-danger focus-visible:outline-none"
                            aria-label={`Archive ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ITEM EDITOR SHEET */}
      <ItemEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        categories={categories}
        modifierGroups={modifierGroups}
        onSave={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        isLoading={saveMutation.isPending}
      />

      {/* SAMPLE DATA CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isSampleConfirmOpen}
        onClose={() => setIsSampleConfirmOpen(false)}
        onConfirm={() => loadSampleMutation.mutate()}
        title="Load Sample Indian Restaurant Menu?"
        description="This will insert sample categories (Biryani, Starters, Main Course, Breads, etc.) and dishes labelled as sample data for testing. You can edit or delete this sample set anytime."
        confirmLabel="Load Sample Menu"
        variant="primary"
        isLoading={loadSampleMutation.isPending}
      />

      {/* CLEAR SAMPLE DATA CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isClearSampleConfirmOpen}
        onClose={() => setIsClearSampleConfirmOpen(false)}
        onConfirm={() => clearSampleMutation.mutate()}
        title="Clear All Sample Menu Data?"
        description="This will permanently delete all categories and items marked as sample data in one single action."
        confirmLabel="Delete Sample Data"
        variant="danger"
        isLoading={clearSampleMutation.isPending}
      />

      {/* CSV IMPORT DIALOG */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportPreview(null);
          setImportCsvText('');
        }}
        title="Import Menu via CSV"
        description="Upload or paste CSV menu rows. Format: category, name, veg/non-veg, price (INR), aliases (semicolon-separated), modifier groups"
      >
        <div className="space-y-4 pt-2">
          {!importPreview ? (
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1.5">
                Paste CSV Content
              </label>
              <textarea
                rows={8}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="category,name,veg/non-veg,price,aliases,modifier groups&#10;Biryani,Mutton Biryani,non-veg,360,biriyani;gosht biryani,&#10;Breads,Butter Naan,veg,60,naan,"
                className="w-full p-3 rounded-lg border border-surface-border bg-surface-elevated font-mono text-xs text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <div className="flex justify-between items-center pt-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const sampleCsv = `category,name,veg/non-veg,price,aliases,modifier groups\nBiryani,Chicken Biryani,non-veg,300,biryani;briyani,\nStarters,Paneer Tikka,veg,240,paneer kabab,\nBreads,Garlic Naan,veg,70,naan,`;
                    setImportCsvText(sampleCsv);
                  }}
                >
                  Load Example Template
                </Button>
                <Button
                  variant="primary"
                  onClick={() => previewImportMutation.mutate(importCsvText)}
                  disabled={!importCsvText.trim()}
                  isLoading={previewImportMutation.isPending}
                >
                  Parse & Preview
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold p-3 rounded-lg bg-surface-elevated border border-surface-border">
                <span>Total: {importPreview.totalRows}</span>
                <span className="text-success">Valid: {importPreview.validRows}</span>
                <span className="text-danger">Invalid: {importPreview.invalidRows}</span>
              </div>

              <ImportPreviewTable rows={importPreview.preview} />

              <div className="flex items-center justify-between pt-3">
                <Button variant="ghost" onClick={() => setImportPreview(null)}>
                  Back to Editor
                </Button>
                <Button
                  variant="primary"
                  disabled={importPreview.validRows === 0}
                  isLoading={commitImportMutation.isPending}
                  onClick={() => commitImportMutation.mutate(importCsvText)}
                >
                  Confirm & Import {importPreview.validRows} Items
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default OwnerMenu;
