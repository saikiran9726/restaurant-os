import React, { useState, useEffect } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { PriceInput } from './PriceInput.js';
import { ChipInput } from './ChipInput.js';
import { VegMark } from './ui/VegMark.js';
import type { MenuItem, MenuCategory, ModifierGroup } from '@restaurant-os/shared';

interface ItemEditorProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null; // null means create new
  categories: MenuCategory[];
  modifierGroups: ModifierGroup[];
  onSave: (data: {
    categoryId: string;
    name: string;
    aliases: string[];
    isVeg: boolean;
    pricePaise: number;
    available: boolean;
    modifierGroupIds: string[];
    version?: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({
  isOpen,
  onClose,
  item,
  categories,
  modifierGroups,
  onSave,
  isLoading = false,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [pricePaise, setPricePaise] = useState(0);
  const [available, setAvailable] = useState(true);
  const [selectedModGroupIds, setSelectedModGroupIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setCategoryId(item.categoryId);
      setName(item.name);
      setAliases(item.aliases || []);
      setIsVeg(item.isVeg);
      setPricePaise(item.pricePaise || 0);
      setAvailable(item.available);
      setSelectedModGroupIds(item.modifierGroupIds || []);
      setIsDirty(false);
    } else {
      setCategoryId(categories[0]?.id || '');
      setName('');
      setAliases([]);
      setIsVeg(true);
      setPricePaise(0);
      setAvailable(true);
      setSelectedModGroupIds([]);
      setIsDirty(false);
    }
    setError(null);
  }, [item, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    try {
      await onSave({
        categoryId,
        name: name.trim(),
        aliases,
        isVeg,
        pricePaise,
        available,
        modifierGroupIds: selectedModGroupIds,
        version: item?.version,
      });
      setIsDirty(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    }
  };

  const toggleModGroup = (id: string) => {
    setIsDirty(true);
    setSelectedModGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => {
        if (isDirty && !window.confirm('You have unsaved changes. Discard?')) {
          return;
        }
        onClose();
      }}
      title={item ? `Edit: ${item.name}` : 'New Menu Item'}
      description="Configure menu item details, pricing, aliases, and modifiers."
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2 pb-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Item Name */}
        <div>
          <label className="block text-caption font-semibold text-content-secondary mb-1.5">
            Item Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            placeholder="e.g. Hyderabadi Dum Biryani"
            className="w-full h-11 px-3.5 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
            required
          />
        </div>

        {/* Category & Diet Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1.5">
              Category <span className="text-danger">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setIsDirty(true);
              }}
              className="w-full h-11 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1.5">
              Food Type
            </label>
            <div className="flex items-center gap-2 h-11">
              <button
                type="button"
                onClick={() => {
                  setIsVeg(true);
                  setIsDirty(true);
                }}
                className={`flex-1 h-full rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-colors ${
                  isVeg
                    ? 'bg-veg/10 border-veg text-veg'
                    : 'border-surface-border text-content-secondary hover:bg-surface-elevated'
                }`}
              >
                <VegMark type="veg" size="sm" />
                <span>VEG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsVeg(false);
                  setIsDirty(true);
                }}
                className={`flex-1 h-full rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-colors ${
                  !isVeg
                    ? 'bg-nonveg/10 border-nonveg text-nonveg'
                    : 'border-surface-border text-content-secondary hover:bg-surface-elevated'
                }`}
              >
                <VegMark type="nonveg" size="sm" />
                <span>NON-VEG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Price Input in Rupees, saved in paise */}
        <PriceInput
          label="Base Price (INR)"
          paise={pricePaise}
          onChange={(newPaise) => {
            setPricePaise(newPaise);
            setIsDirty(true);
          }}
          required
        />

        {/* Search Aliases */}
        <ChipInput
          chips={aliases}
          onChange={(newAliases) => {
            setAliases(newAliases);
            setIsDirty(true);
          }}
        />

        {/* Availability Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-border bg-surface-elevated">
          <div>
            <p className="text-sm font-bold text-content-primary">Available for Ordering</p>
            <p className="text-xs text-content-secondary">
              Turn off if currently Out-Of-Stock (OOS)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={available}
            onClick={() => {
              setAvailable(!available);
              setIsDirty(true);
            }}
            className={`w-12 h-6 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              available ? 'bg-accent' : 'bg-surface-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                available ? 'translate-x-6.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Modifier Groups Assignment */}
        {modifierGroups.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <label className="block text-caption font-semibold text-content-secondary">
              Applicable Modifier Groups
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {modifierGroups.map((group) => {
                const isSelected = selectedModGroupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-elevated cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModGroup(group.id)}
                      className="rounded text-accent focus:ring-accent w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-content-primary">{group.name}</span>
                      <span className="text-content-muted ml-2">
                        ({group.options.length} options)
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {item ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
