import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { Button } from '../../components/ui/Button.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Sliders, Save, RotateCcw } from 'lucide-react';
import {
  DEFAULT_ALERT_SETTINGS,
  type AlertSettingsOutput,
  type UpdateAlertSettingsInput,
} from '@restaurant-os/shared';

export const OwnerAlertSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const { data: settings, isLoading } = useQuery<AlertSettingsOutput>({
    queryKey: ['alert-settings'],
    queryFn: () => apiFetch('/alert-settings'),
  });

  const [formState, setFormState] = useState<Partial<UpdateAlertSettingsInput>>({});
  const [saving, setSaving] = useState(false);

  // Sync initial settings into state
  const current = {
    ...settings,
    ...formState,
  };

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateAlertSettingsInput) =>
      apiFetch('/alert-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-settings'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      addToast({ message: 'Alert threshold settings saved', type: 'success' });
      setFormState({});
    },
    onError: (err: any) => {
      addToast({ message: err.message || 'Failed to update settings', type: 'danger' });
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMutation.mutateAsync(current as UpdateAlertSettingsInput);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !settings) {
    return <div className="p-8 text-center text-sm text-content-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary flex items-center gap-2">
            <Sliders className="w-6 h-6 text-accent" />
            <span>Alert Thresholds & Configuration</span>
          </h2>
          <p className="text-caption text-content-secondary mt-0.5">
            Configure sensitivity parameters and enable/disable specific operational alerts and
            business insights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setFormState(DEFAULT_ALERT_SETTINGS)}
          >
            Reset Defaults
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={saving}
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Thresholds Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-6">
        <h3 className="text-subhead font-bold text-content-primary border-b border-surface-border pb-3">
          Alert Sensitivity Thresholds
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cash Mismatch Tolerance */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                Cash Mismatch Tolerance
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Drawer gaps within this tolerance will not trigger a critical alert.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-content-muted">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="10"
                value={Math.round((current.cashMismatchTolerancePaise ?? 5000) / 100)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    cashMismatchTolerancePaise: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full text-sm pl-8 pr-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
              />
            </div>
          </div>

          {/* High Expense Multiplier */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                High Expense Multiplier
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Flags single expenses greater than N × trailing 3-month category average.
            </p>
            <input
              type="number"
              step="0.1"
              min="1.1"
              max="5.0"
              value={current.highExpenseMultiplier ?? 1.5}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  highExpenseMultiplier: parseFloat(e.target.value) || 1.5,
                })
              }
              className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* High Expense Minimum Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                High Expense Min Amount
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Small expenses below this amount are never flagged, even if percentage is high.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-content-muted">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="500"
                value={Math.round((current.highExpenseMinAmountPaise ?? 500000) / 100)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    highExpenseMinAmountPaise: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full text-sm pl-8 pr-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
              />
            </div>
          </div>

          {/* UPI Pending Timeout */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                UPI Pending Timeout (Hours)
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Pending UPI requests older than this duration require settlement.
            </p>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="48"
              value={current.upiPendingTimeoutHours ?? 2.0}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  upiPendingTimeoutHours: parseFloat(e.target.value) || 2.0,
                })
              }
              className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Profit Decline Points Threshold */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                Profit Margin Decline Threshold
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Alerts if monthly operating margin drops by more than N percentage points.
            </p>
            <input
              type="number"
              step="0.5"
              min="1.0"
              max="50.0"
              value={current.profitDeclinePointsThreshold ?? 5.0}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  profitDeclinePointsThreshold: parseFloat(e.target.value) || 5.0,
                })
              }
              className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Regular Customer Inactive Days */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-primary">
                Regular Customer Inactive Days
              </label>
              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                ASSUMPTION
              </span>
            </div>
            <p className="text-[11px] text-content-secondary">
              Generates insight when regular diners have not returned after this many days.
            </p>
            <input
              type="number"
              min="7"
              max="180"
              value={current.regularCustomerInactiveDays ?? 30}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  regularCustomerInactiveDays: parseInt(e.target.value, 10) || 30,
                })
              }
              className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* Enabled Alerts Toggles */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-subhead font-bold text-content-primary border-b border-surface-border pb-3">
          Active Alert Triggers
        </h3>

        <div className="space-y-3">
          {(
            [
              {
                key: 'cash_mismatch',
                label: 'Cash Drawer Mismatch',
                desc: 'Alert when closed day has difference > tolerance',
              },
              {
                key: 'low_stock',
                label: 'Low Stock Level',
                desc: 'Grouped alert for items at or below reorder level',
              },
              {
                key: 'high_expense',
                label: 'High Expense Spike',
                desc: 'Alert when expense is 1.5x 3-month category average',
              },
              {
                key: 'payment_reconciliation',
                label: 'Payment Reconciliation',
                desc: 'Alert on stale pending UPIs or partial day-close bills',
              },
              {
                key: 'profit_decline',
                label: 'Operating Margin Drop',
                desc: 'Alert when month margin falls by > threshold points',
              },
            ] as const
          ).map((item) => {
            const isChecked = current.enabledAlerts?.[item.key] ?? true;
            return (
              <label
                key={item.key}
                className="flex items-start gap-3 p-3 rounded-lg border border-surface-border/50 hover:bg-surface-elevated/40 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      enabledAlerts: {
                        ...(current.enabledAlerts as any),
                        [item.key]: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-accent focus:ring-accent"
                />
                <div>
                  <span className="text-xs font-bold text-content-primary">{item.label}</span>
                  <p className="text-[11px] text-content-secondary">{item.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};
