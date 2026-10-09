import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderPlus, Eye, EyeOff, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { EditableList } from '../../components/EditableList.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import type { MenuCategory } from '@restaurant-os/shared';
import { useToastStore } from '../../stores/useToastStore.js';

export const OwnerCategories: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<MenuCategory[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (editingCategory) {
        return apiFetch(`/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        return apiFetch('/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setEditingCategory(null);
      addToast({
        type: 'success',
        message: editingCategory ? 'Category renamed' : 'Category added',
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (categoryIds: string[]) =>
      apiFetch('/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  const handleOpenModal = (cat?: MenuCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setName(cat.name);
      setDescription(cat.description || '');
    } else {
      setEditingCategory(null);
      setName('');
      setDescription('');
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleReorder = (newItems: MenuCategory[]) => {
    reorderMutation.mutate(newItems.map((c) => c.id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Menu Categories</h2>
          <p className="text-caption text-content-secondary mt-1">
            Organize dishes into sections. Reorder sequence with up/down arrows or toggle
            visibility.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-content-muted">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="p-12 text-center text-content-muted bg-surface-card border border-surface-border rounded-2xl">
          <FolderPlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No menu categories yet.</p>
        </div>
      ) : (
        <EditableList
          items={categories}
          keyExtractor={(c) => c.id}
          onReorder={handleReorder}
          renderItem={(cat) => (
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="min-w-0">
                <span
                  className={`font-bold block text-sm ${
                    cat.active ? 'text-content-primary' : 'text-content-muted line-through'
                  }`}
                >
                  {cat.name}
                </span>
                {cat.description && (
                  <span className="text-xs text-content-secondary truncate block">
                    {cat.description}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActiveMutation.mutate({ id: cat.id, active: !cat.active })}
                  className="p-1.5 rounded hover:bg-surface-elevated text-content-secondary"
                  aria-label={cat.active ? 'Hide category' : 'Show category'}
                >
                  {cat.active ? (
                    <Eye className="w-4 h-4 text-success" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-content-muted" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenModal(cat)}
                  className="p-1.5 rounded hover:bg-surface-elevated text-content-secondary"
                  aria-label="Edit category"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        />
      )}

      {/* Add / Edit Category Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Rename Category' : 'Create Category'}
        description="Categories determine the groupings shown on waiter tablets and KDS screens."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({ name: name.trim(), description: description.trim() });
          }}
          className="space-y-4 pt-2"
        >
          {formError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Starters, Biryani, Beverages"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingCategory ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default OwnerCategories;
