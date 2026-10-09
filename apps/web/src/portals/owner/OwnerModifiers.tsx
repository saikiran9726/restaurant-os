import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { PriceInput } from '../../components/PriceInput.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import type { ModifierGroup, ModifierOption } from '@restaurant-os/shared';
import { useToastStore } from '../../stores/useToastStore.js';

export const OwnerModifiers: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minSelections, setMinSelections] = useState(0);
  const [maxSelections, setMaxSelections] = useState(1);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery<ModifierGroup[]>({
    queryKey: ['modifier-groups'],
    queryFn: () => apiFetch('/modifier-groups'),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingGroup) {
        return apiFetch(`/modifier-groups/${editingGroup.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        return apiFetch('/modifier-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] });
      setIsModalOpen(false);
      addToast({
        type: 'success',
        message: editingGroup ? 'Modifier group updated' : 'Modifier group created',
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/modifier-groups/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] });
      addToast({ type: 'info', message: 'Modifier group archived' });
    },
  });

  const handleOpenModal = (group?: ModifierGroup) => {
    if (group) {
      setEditingGroup(group);
      setName(group.name);
      setDescription(group.description || '');
      setMinSelections(group.minSelections);
      setMaxSelections(group.maxSelections);
      setOptions(group.options || []);
    } else {
      setEditingGroup(null);
      setName('');
      setDescription('');
      setMinSelections(0);
      setMaxSelections(1);
      setOptions([
        { name: 'Mild', priceDeltaPaise: 0, sortOrder: 0 },
        { name: 'Medium Spicy', priceDeltaPaise: 0, sortOrder: 1 },
      ]);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { name: '', priceDeltaPaise: 0, sortOrder: prev.length }]);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, field: keyof ModifierOption, val: any) => {
    setOptions((prev) => prev.map((opt, i) => (i === idx ? { ...opt, [field]: val } : opt)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Group name is required');
      return;
    }
    const validOptions = options.filter((o) => o.name.trim().length > 0);
    if (validOptions.length === 0) {
      setFormError('At least one option is required in this group');
      return;
    }

    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      minSelections,
      maxSelections,
      options: validOptions,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Modifier Groups</h2>
          <p className="text-caption text-content-secondary mt-1">
            Configure custom options like Spice Level, Cooking Temperature, or Add-on Cheese/Extra
            Gravy.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Modifier Group</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-content-muted">Loading modifier groups...</div>
      ) : groups.length === 0 ? (
        <div className="p-12 text-center text-content-muted bg-surface-card border border-surface-border rounded-2xl">
          <Sliders className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No modifier groups created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-5 rounded-2xl border border-surface-border bg-surface-card shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-content-primary">{group.name}</h3>
                  <span className="text-xs text-content-muted block">
                    {group.minSelections === 0 ? 'Optional' : 'Required'} • Max{' '}
                    {group.maxSelections}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(group)}
                    className="p-1.5 rounded hover:bg-surface-elevated text-content-secondary"
                    aria-label="Edit group"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(group.id)}
                    className="p-1.5 rounded hover:bg-danger/10 text-content-muted hover:text-danger"
                    aria-label="Archive group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-xs text-content-secondary">{group.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-border">
                {group.options.map((opt) => (
                  <span
                    key={opt.id || opt.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-elevated border border-surface-border text-xs text-content-primary"
                  >
                    <span>{opt.name}</span>
                    {opt.priceDeltaPaise > 0 && (
                      <span className="font-mono font-bold text-accent">
                        +{formatPaiseToRupeeString(opt.priceDeltaPaise)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGroup ? `Edit: ${editingGroup.name}` : 'New Modifier Group'}
        description="Define options and price adjustments for customized items."
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Group Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spice Level, Extra Toppings"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Min Selections
              </label>
              <input
                type="number"
                min="0"
                value={minSelections}
                onChange={(e) => setMinSelections(parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Max Selections
              </label>
              <input
                type="number"
                min="1"
                value={maxSelections}
                onChange={(e) => setMaxSelections(parseInt(e.target.value) || 1)}
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary font-mono"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <div className="flex items-center justify-between">
              <label className="text-caption font-semibold text-content-secondary">
                Options & Extra Charges
              </label>
              <button
                type="button"
                onClick={addOption}
                className="text-xs text-accent font-bold hover:underline"
              >
                + Add Option
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => updateOption(idx, 'name', e.target.value)}
                    placeholder="Option name"
                    className="flex-1 h-9 px-3 rounded-lg border border-surface-border bg-surface-elevated text-xs text-content-primary"
                    required
                  />
                  <div className="w-32">
                    <PriceInput
                      paise={opt.priceDeltaPaise}
                      onChange={(newPaise) => updateOption(idx, 'priceDeltaPaise', newPaise)}
                      className="text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="p-1 rounded hover:bg-danger/10 text-content-muted hover:text-danger"
                    aria-label="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              Save Group
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default OwnerModifiers;
