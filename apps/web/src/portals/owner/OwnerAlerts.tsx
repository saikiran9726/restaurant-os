import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { ActionAlertCard } from '../../components/alerts-insights/ActionAlertCard.js';
import { AllClearState } from '../../components/alerts-insights/AllClearState.js';
import { Button } from '../../components/ui/Button.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { AlertCircle, Sliders, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AlertOutput } from '@restaurant-os/shared';

export const OwnerAlerts: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'open' | 'resolved' | 'snoozed' | 'all'>('open');

  const { data: alerts = [], isLoading } = useQuery<AlertOutput[]>({
    queryKey: ['alerts', activeTab === 'all' ? undefined : activeTab],
    queryFn: () => apiFetch(activeTab === 'all' ? '/alerts' : `/alerts?status=${activeTab}`),
  });

  const ackMutation = useMutation({
    mutationFn: ({ alertId, note }: { alertId: string; note: string }) =>
      apiFetch(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      addToast({ message: 'Alert acknowledged and resolved', type: 'success' });
    },
    onError: (err: any) => {
      addToast({ message: err.message || 'Failed to acknowledge alert', type: 'danger' });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ alertId, duration }: { alertId: string; duration: '1d' | '7d' }) =>
      apiFetch(`/alerts/${alertId}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ duration }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      addToast({ message: 'Alert snoozed', type: 'info' });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason: string }) =>
      apiFetch(`/alerts/${alertId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      addToast({ message: 'Alert dismissed', type: 'info' });
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <span>Attention Required</span>
          </h2>
          <p className="text-caption text-content-secondary mt-0.5">
            Operational issues requiring action: cash mismatches, low stock, high expenses, payment
            gaps, and margin drops.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          leftIcon={<Sliders className="w-4 h-4" />}
          onClick={() => navigate('/owner/alerts/settings')}
        >
          Configure Thresholds
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border gap-6">
        {(['open', 'snoozed', 'resolved', 'all'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-content-muted hover:text-content-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Alert Cards List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-content-muted">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        activeTab === 'open' ? (
          <AllClearState />
        ) : (
          <div className="p-8 text-center text-sm text-content-muted rounded-xl bg-surface-card border border-surface-border">
            No {activeTab} alerts found.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <ActionAlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={async (alertId, note) => {
                await ackMutation.mutateAsync({ alertId, note });
              }}
              onSnooze={async (alertId, duration) => {
                await snoozeMutation.mutateAsync({ alertId, duration });
              }}
              onDismiss={async (alertId, reason) => {
                await dismissMutation.mutateAsync({ alertId, reason });
              }}
              onNavigateAction={(url) => navigate(url)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
