import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { TableTile } from '../../components/ui/TableTile.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import type { TableModel } from '@restaurant-os/shared';
import { useToastStore } from '../../stores/useToastStore.js';

export const OwnerTables: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableModel | null>(null);

  // Form states
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [section, setSection] = useState('Main Floor');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: tablesList = [], isLoading } = useQuery<TableModel[]>({
    queryKey: ['tables'],
    queryFn: () => apiFetch('/tables'),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingTable) {
        return apiFetch(`/tables/${editingTable.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        return apiFetch('/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsModalOpen(false);
      addToast({
        type: 'success',
        message: editingTable ? 'Table updated' : 'Table added',
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/tables/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      addToast({ type: 'info', message: 'Table archived' });
    },
  });

  const handleOpenModal = (tbl?: TableModel) => {
    if (tbl) {
      setEditingTable(tbl);
      setLabel(tbl.label);
      setCapacity(tbl.capacity);
      setSection(tbl.section);
    } else {
      setEditingTable(null);
      setLabel(`T-${tablesList.length + 1}`);
      setCapacity(4);
      setSection('Main Floor');
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const activeTables = tablesList.filter((t) => t.active);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Floor Tables</h2>
          <p className="text-caption text-content-secondary mt-1">
            Configure dining tables, seating capacities, and sections for waiter order assignment.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Table</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-content-muted">Loading floor tables...</div>
      ) : activeTables.length === 0 ? (
        <div className="p-12 text-center text-content-muted bg-surface-card border border-surface-border rounded-2xl">
          <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No dining tables configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {activeTables.map((tbl) => (
            <div
              key={tbl.id}
              className="relative p-4 rounded-2xl border border-surface-border bg-surface-card flex flex-col items-center justify-center text-center space-y-2 group shadow-sm hover:border-accent transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex flex-col items-center justify-center font-bold text-content-primary">
                <span className="text-sm">{tbl.label}</span>
                <span className="text-[10px] text-content-muted font-normal">{tbl.capacity}p</span>
              </div>
              <span className="text-xs text-content-secondary font-medium">{tbl.section}</span>

              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleOpenModal(tbl)}
                  className="p-1 rounded bg-surface-card hover:bg-surface-elevated text-content-secondary border border-surface-border shadow-xs"
                  aria-label={`Edit ${tbl.label}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(tbl.id)}
                  className="p-1 rounded bg-surface-card hover:bg-danger/10 text-content-muted hover:text-danger border border-surface-border shadow-xs"
                  aria-label={`Archive ${tbl.label}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTable ? `Edit: ${editingTable.label}` : 'New Dining Table'}
        description="Set table numbering and seating limits."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({
              label: label.trim(),
              capacity,
              section: section.trim(),
            });
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
              Table Label <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. T-01, Rooftop-4"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Section / Area
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Main Floor, Outdoor"
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-sm text-content-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              Save Table
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default OwnerTables;
