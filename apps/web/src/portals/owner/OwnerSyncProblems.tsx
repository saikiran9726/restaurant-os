import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { useToastStore } from '../../stores/useToastStore.js';
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  CheckCircle2,
  FileQuestion,
  HelpCircle,
} from 'lucide-react';
import type { DeadLetterCommandItem, ConflictReviewItem } from '@restaurant-os/shared';

export const OwnerSyncProblems: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'dead_letters' | 'conflicts'>('dead_letters');

  const [selectedDeadLetter, setSelectedDeadLetter] = useState<DeadLetterCommandItem | null>(null);
  const [discardReason, setDiscardReason] = useState('');
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

  const [selectedConflict, setSelectedConflict] = useState<ConflictReviewItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const { data: deadLetters = [], isLoading: loadingDL } = useQuery<DeadLetterCommandItem[]>({
    queryKey: ['dead-letters'],
    queryFn: () => apiFetch('/sync/dead-letter'),
  });

  const { data: conflicts = [], isLoading: loadingConflicts } = useQuery<ConflictReviewItem[]>({
    queryKey: ['conflicts'],
    queryFn: () => apiFetch('/sync/conflicts'),
  });

  const discardMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/sync/dead-letter/${id}/discard`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-letters'] });
      setIsDiscardModalOpen(false);
      setDiscardReason('');
      addToast({ message: 'Command discarded and audit logged', type: 'info' });
    },
    onError: (err: any) => {
      addToast({ message: err.message || 'Failed to discard command', type: 'danger' });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiFetch(`/sync/conflicts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNote: note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflicts'] });
      setIsResolveModalOpen(false);
      setResolutionNote('');
      addToast({ message: 'Conflict review resolved', type: 'success' });
    },
    onError: (err: any) => {
      addToast({ message: err.message || 'Failed to resolve conflict', type: 'danger' });
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-title font-extrabold text-content-primary flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <span>Sync Status & Conflict Reviews</span>
        </h2>
        <p className="text-caption text-content-secondary mt-0.5">
          Inspect poison commands in the dead-letter queue and resolve operational collisions (e.g.
          concurrent table orders, duplicate payments).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('dead_letters')}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'dead_letters'
              ? 'border-accent text-accent'
              : 'border-transparent text-content-muted hover:text-content-secondary'
          }`}
        >
          <span>Dead-Letter Queue</span>
          {deadLetters.filter((d) => d.status === 'dead_letter').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-500 text-white">
              {deadLetters.filter((d) => d.status === 'dead_letter').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('conflicts')}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'conflicts'
              ? 'border-accent text-accent'
              : 'border-transparent text-content-muted hover:text-content-secondary'
          }`}
        >
          <span>Conflict Reviews</span>
          {conflicts.filter((c) => c.status === 'pending').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
              {conflicts.filter((c) => c.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Dead Letters */}
      {activeTab === 'dead_letters' && (
        <div className="space-y-4">
          {deadLetters.length === 0 ? (
            <div className="rounded-xl border border-surface-border bg-surface-card p-8 text-center text-sm text-content-muted">
              No poison commands in dead-letter queue. All commands synced cleanly.
            </div>
          ) : (
            deadLetters.map((dl) => (
              <div
                key={dl.id}
                className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-elevated text-content-secondary border border-surface-border">
                      {dl.type}
                    </span>
                    <span className="text-xs font-mono text-content-muted">
                      Device: {dl.deviceId}
                    </span>
                    <span className="text-xs font-bold text-red-500 capitalize">{dl.status}</span>
                  </div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    Error: {dl.errorMessage}
                  </p>
                  <p className="text-[11px] text-content-muted">
                    Attempts: {dl.attempts} • Created: {new Date(dl.createdAt).toLocaleString()}
                  </p>
                </div>

                {dl.status === 'dead_letter' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-danger hover:bg-danger/10 shrink-0"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedDeadLetter(dl);
                      setIsDiscardModalOpen(true);
                    }}
                  >
                    Discard Command
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Conflicts */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          {conflicts.length === 0 ? (
            <div className="rounded-xl border border-surface-border bg-surface-card p-8 text-center text-sm text-content-muted">
              No pending conflict reviews.
            </div>
          ) : (
            conflicts.map((c) => (
              <div
                key={c.id}
                className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        c.severity === 'critical'
                          ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {c.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-bold capitalize text-content-secondary">
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-content-primary">
                    {c.details?.message || `Collision detected for reference ${c.referenceId}`}
                  </p>

                  <pre className="text-[11px] font-mono p-2 rounded bg-surface-elevated text-content-secondary overflow-x-auto">
                    {JSON.stringify(c.details, null, 2)}
                  </pre>
                </div>

                {c.status === 'pending' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setSelectedConflict(c);
                      setIsResolveModalOpen(true);
                    }}
                  >
                    Resolve Conflict
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Discard Dead Letter Modal */}
      <Dialog
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        title="Discard Poison Command"
        description="Provide a reason why this command cannot be replayed. This action will be audited."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setIsDiscardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={discardReason.trim().length < 3 || discardMutation.isPending}
              onClick={() => {
                if (selectedDeadLetter) {
                  discardMutation.mutate({
                    id: selectedDeadLetter.id,
                    reason: discardReason.trim(),
                  });
                }
              }}
            >
              Confirm Discard
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <label className="text-xs font-bold text-content-primary">Audit Reason *</label>
          <input
            type="text"
            value={discardReason}
            onChange={(e) => setDiscardReason(e.target.value)}
            placeholder="e.g., Deleted menu item referenced from stale device cart."
            className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </Dialog>

      {/* Resolve Conflict Modal */}
      <Dialog
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Resolve Conflict Review"
        description="Record resolution notes for accounting and audit integrity."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setIsResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={resolutionNote.trim().length < 3 || resolveConflictMutation.isPending}
              onClick={() => {
                if (selectedConflict) {
                  resolveConflictMutation.mutate({
                    id: selectedConflict.id,
                    note: resolutionNote.trim(),
                  });
                }
              }}
            >
              Confirm Resolution
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <label className="text-xs font-bold text-content-primary">Resolution Note *</label>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="e.g., Table collision verified: orders split between T2-A and T2-B."
            className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </Dialog>
    </div>
  );
};
