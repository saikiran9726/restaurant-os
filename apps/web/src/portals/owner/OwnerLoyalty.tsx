import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { KpiCard } from '../../components/ui/Cards.js';
import { SettingsExampleCalculator } from '../../components/SettingsExampleCalculator.js';
import {
  formatPaiseToRupeeString,
  type LoyaltySettings,
  type LoyaltyOverviewSummary,
  type LoyaltyTier,
} from '@restaurant-os/shared';
import {
  Award,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
  Percent,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Sliders,
  DollarSign,
  Gift,
  HelpCircle,
  X,
  UserCheck,
} from 'lucide-react';

export const OwnerLoyalty: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  // Queries
  const { data: overview, isLoading: isOverviewLoading } = useQuery<LoyaltyOverviewSummary>({
    queryKey: ['loyalty-overview'],
    queryFn: () => apiFetch('/loyalty/overview'),
    refetchInterval: 10000,
  });

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery<LoyaltySettings>({
    queryKey: ['loyalty-settings'],
    queryFn: () => apiFetch('/loyalty/settings'),
  });

  // Local settings form state
  const [formData, setFormData] = useState<LoyaltySettings | null>(null);

  // Manual Adjust Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustCustomerId, setAdjustCustomerId] = useState('');
  const [adjustCustomerSearch, setAdjustCustomerSearch] = useState('');
  const [adjustPoints, setAdjustPoints] = useState<string>('100');
  const [adjustReason, setAdjustReason] = useState('');

  // Sync settings when fetched
  useEffect(() => {
    if (settingsData && !formData) {
      setFormData(settingsData);
    }
  }, [settingsData, formData]);

  // Query customers for adjust modal
  const { data: customerSearchData } = useQuery<{ customers: any[] }>({
    queryKey: ['customer-search-adjust', adjustCustomerSearch],
    queryFn: () =>
      apiFetch(`/customers?search=${encodeURIComponent(adjustCustomerSearch)}&limit=5`),
    enabled: isAdjustModalOpen && adjustCustomerSearch.length >= 2,
  });

  // Settings update mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: LoyaltySettings) => {
      return apiFetch<LoyaltySettings>('/loyalty/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updated) => {
      setFormData(updated as LoyaltySettings);
      addToast({ type: 'success', message: 'Loyalty configuration saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['loyalty-settings'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-overview'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: err.message || 'Failed to update loyalty settings' });
    },
  });

  // Manual adjust mutation
  const adjustMutation = useMutation({
    mutationFn: async (payload: { customerId: string; points: number; reason: string }) => {
      return apiFetch('/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res: any) => {
      addToast({
        type: 'success',
        message: `Points adjusted. New balance: ${res.account?.pointsBalance ?? 'updated'} pts`,
      });
      setIsAdjustModalOpen(false);
      setAdjustCustomerId('');
      setAdjustCustomerSearch('');
      setAdjustPoints('100');
      setAdjustReason('');
      queryClient.invalidateQueries({ queryKey: ['loyalty-overview'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: err.message || 'Failed to adjust points' });
    },
  });

  if (isOverviewLoading || isSettingsLoading || !formData) {
    return (
      <div className="py-20 text-center text-content-muted">
        Loading Loyalty Program configurations...
      </div>
    );
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate tiers strictly ascending
    if (formData.tiers && formData.tiers.length > 1) {
      for (let i = 1; i < formData.tiers.length; i++) {
        if (formData.tiers[i]!.thresholdSpendPaise <= formData.tiers[i - 1]!.thresholdSpendPaise) {
          addToast({
            type: 'warning',
            message: 'Tier spend thresholds must be in strictly ascending order',
          });
          return;
        }
      }
    }

    updateSettingsMutation.mutate(formData);
  };

  const handleTierChange = (index: number, field: keyof LoyaltyTier, value: any) => {
    const newTiers = [...(formData.tiers || [])];
    newTiers[index] = { ...newTiers[index]!, [field]: value };
    setFormData({ ...formData, tiers: newTiers });
  };

  const handleAddTier = () => {
    if ((formData.tiers || []).length >= 3) {
      addToast({
        type: 'warning',
        message: 'Maximum of 3 tiers allowed (e.g. Silver, Gold, Platinum)',
      });
      return;
    }
    const lastThreshold =
      formData.tiers && formData.tiers.length > 0
        ? formData.tiers[formData.tiers.length - 1]!.thresholdSpendPaise + 1000000
        : 500000;

    const newTier: LoyaltyTier = {
      name: `Tier ${(formData.tiers?.length || 0) + 1}`,
      thresholdSpendPaise: lastThreshold,
      earnMultiplier: 1.25,
    };
    setFormData({ ...formData, tiers: [...(formData.tiers || []), newTier] });
  };

  const handleRemoveTier = (index: number) => {
    const newTiers = formData.tiers.filter((_, i) => i !== index);
    setFormData({ ...formData, tiers: newTiers });
  };

  const handleOpenAdjustModal = (customer?: any) => {
    if (customer) {
      setAdjustCustomerId(customer.id);
      setAdjustCustomerSearch(`${customer.name || 'Guest'} (${customer.phone})`);
    }
    setIsAdjustModalOpen(true);
  };

  const handlePerformAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) {
      addToast({ type: 'warning', message: 'Please enter a non-zero points adjustment value' });
      return;
    }
    if (!adjustCustomerId) {
      addToast({ type: 'warning', message: 'Please select a valid customer' });
      return;
    }
    if (!adjustReason.trim() || adjustReason.trim().length < 3) {
      addToast({
        type: 'warning',
        message: 'A specific reason (minimum 3 characters) is required',
      });
      return;
    }

    adjustMutation.mutate({
      customerId: adjustCustomerId,
      points: pts,
      reason: adjustReason.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-display font-black text-content-primary flex items-center gap-2.5">
            <Award className="w-8 h-8 text-primary" />
            <span>Loyalty & Rewards Program</span>
          </h2>
          <p className="text-body text-content-secondary mt-1">
            Configure earn rules, redemption ratios, tier multipliers, and monitor financial
            liability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => handleOpenAdjustModal()}
            leftIcon={<Coins className="w-4 h-4 text-amber-400" />}
          >
            Manual Adjust Points
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {updateSettingsMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Active Points"
          value={(overview?.totalActivePoints || 0).toLocaleString('en-IN')}
          subtitle="In circulation"
          icon={<Coins className="w-5 h-5 text-amber-400" />}
        />
        <KpiCard
          title="Est. Liability"
          value={formatPaiseToRupeeString(overview?.estimatedLiabilityPaise || 0)}
          subtitle="Outstanding ₹ value"
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
        />
        <KpiCard
          title="Points Issued"
          value={(overview?.totalPointsIssued || 0).toLocaleString('en-IN')}
          subtitle="Earn & bonuses"
          icon={<Sparkles className="w-5 h-5 text-accent" />}
        />
        <KpiCard
          title="Points Redeemed"
          value={(overview?.totalPointsRedeemed || 0).toLocaleString('en-IN')}
          subtitle="Customer discounts"
          icon={<RotateCcw className="w-5 h-5 text-primary" />}
        />
        <KpiCard
          title="Redemption Rate"
          value={`${overview?.redemptionRatePercent || 0}%`}
          subtitle="Redeemed / Issued"
          icon={<Percent className="w-5 h-5 text-info" />}
        />
        <KpiCard
          title="Reconciliation"
          value={overview?.mismatchesDetected === 0 ? '100% Match' : 'Discrepancy'}
          subtitle={
            overview?.mismatchesDetected === 0 ? 'Ledger matches accounts' : 'Audit review needed'
          }
          icon={
            overview?.mismatchesDetected === 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            )
          }
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Rule Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* 1. Earn Rules */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h3 className="text-title font-bold text-content-primary">Earn Rules</h3>
                </div>
                <span className="text-xs text-content-muted">Spend-based points allocation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Spend Block (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-content-muted">₹</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.round((formData.spendPaisePerBlock || 10000) / 100)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          spendPaisePerBlock:
                            Math.max(1, parseInt(e.target.value || '1', 10)) * 100,
                        })
                      }
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Customer earns points for every unit of this spend
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Points Earned per Block
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.pointsPerBlock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pointsPerBlock: Math.max(1, parseInt(e.target.value || '1', 10)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                  />
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Base points (e.g. 5 pts per ₹100 spend = 5% rebate)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Points Expiry (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty for never"
                    value={formData.pointsExpiryDays ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pointsExpiryDays: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono"
                  />
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Optional expiry duration (empty = points do not expire)
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <input
                    type="checkbox"
                    id="earnDiscounted"
                    checked={formData.earnOnDiscountedAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, earnOnDiscountedAmount: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-primary focus:ring-accent border-surface-border bg-surface-subtle"
                  />
                  <label
                    htmlFor="earnDiscounted"
                    className="text-xs text-content-primary font-medium cursor-pointer"
                  >
                    Earn on discounted amount
                    <span className="text-[10px] text-content-muted block">
                      When checked, points calculate after manual discounts are subtracted
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 2. Redemption Rules & Anti-Abuse */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-title font-bold text-content-primary">
                    Redemption & Anti-Abuse Rules
                  </h3>
                </div>
                <span className="text-xs text-content-muted">Block conversion & limits</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Redeem Points Block
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    value={formData.redeemPointsBlock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        redeemPointsBlock: Math.max(10, parseInt(e.target.value || '10', 10)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                  />
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Points required per discount step (default: 500 pts)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Discount Value per Block (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-content-muted">₹</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.round((formData.redeemValuePaise || 5000) / 100)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          redeemValuePaise: Math.max(1, parseInt(e.target.value || '1', 10)) * 100,
                        })
                      }
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Rupee discount value granted per points block (default: ₹50)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Min Points to Redeem
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minRedeemPoints}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minRedeemPoints: Math.max(0, parseInt(e.target.value || '0', 10)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Max % of Bill
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.maxRedeemPercentOfBill}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxRedeemPercentOfBill: Math.min(
                            100,
                            Math.max(1, parseInt(e.target.value || '1', 10)),
                          ),
                        })
                      }
                      className="w-full pr-7 pl-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-content-muted">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                    Daily Cap (Points)
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={formData.perDayRedeemCapPoints}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        perDayRedeemCapPoints: Math.max(100, parseInt(e.target.value || '100', 10)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  New Account Cooldown (Hours)
                </label>
                <div className="max-w-xs">
                  <input
                    type="number"
                    min="0"
                    max="168"
                    value={formData.newAccountCooldownHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        newAccountCooldownHours: Math.max(0, parseInt(e.target.value || '0', 10)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono"
                  />
                  <span className="text-[10px] text-content-muted mt-0.5 block">
                    Blocks redemption for new phone numbers within this window (anti-abuse)
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Tiers & Earn Multipliers */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-accent" />
                  <h3 className="text-title font-bold text-content-primary">
                    Tier Multipliers (Max 3)
                  </h3>
                </div>
                {(formData.tiers || []).length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTier}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Tier
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {(formData.tiers || []).map((tier, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-content-muted uppercase">
                        Tier Name
                      </label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface-card border border-surface-border text-content-primary font-bold focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-content-muted uppercase">
                        Threshold Spend (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-content-muted">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={Math.round((tier.thresholdSpendPaise || 0) / 100)}
                          onChange={(e) =>
                            handleTierChange(
                              idx,
                              'thresholdSpendPaise',
                              Math.max(0, parseInt(e.target.value || '0', 10)) * 100,
                            )
                          }
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs rounded-lg bg-surface-card border border-surface-border text-content-primary font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-content-muted uppercase">
                        Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="1.0"
                        max="5.0"
                        value={tier.earnMultiplier}
                        onChange={(e) =>
                          handleTierChange(idx, 'earnMultiplier', parseFloat(e.target.value || '1'))
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface-card border border-surface-border text-content-primary font-mono font-bold focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                          title="Remove tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Bonus Rewards */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-accent" />
                  <h3 className="text-title font-bold text-content-primary">
                    Milestone Bonus Rewards
                  </h3>
                </div>
                <span className="text-xs text-content-muted">Visit & celebratory bonuses</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content-primary">
                      Visit Frequency Bonus
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(formData.visitReward?.enabled)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visitReward: {
                            enabled: e.target.checked,
                            everyNVisits: formData.visitReward?.everyNVisits ?? 5,
                            bonusPoints: formData.visitReward?.bonusPoints ?? 100,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-primary focus:ring-accent border-surface-border bg-surface-card"
                    />
                  </div>
                  {formData.visitReward?.enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <label className="block text-[10px] text-content-muted uppercase">
                          Every N Visits
                        </label>
                        <input
                          type="number"
                          min="2"
                          value={formData.visitReward.everyNVisits}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              visitReward: {
                                ...formData.visitReward!,
                                everyNVisits: parseInt(e.target.value || '2', 10),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded bg-surface-card border border-surface-border font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-content-muted uppercase">
                          Bonus Points
                        </label>
                        <input
                          type="number"
                          min="10"
                          value={formData.visitReward.bonusPoints}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              visitReward: {
                                ...formData.visitReward!,
                                bonusPoints: parseInt(e.target.value || '10', 10),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded bg-surface-card border border-surface-border font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content-primary">Birthday Reward</span>
                    <input
                      type="checkbox"
                      checked={formData.birthdayReward?.enabled || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          birthdayReward: {
                            enabled: e.target.checked,
                            bonusPoints: formData.birthdayReward?.bonusPoints ?? 200,
                            minDaysRegistered: formData.birthdayReward?.minDaysRegistered ?? 30,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-primary focus:ring-accent border-surface-border bg-surface-card"
                    />
                  </div>
                  {formData.birthdayReward?.enabled && (
                    <div className="pt-2">
                      <label className="block text-[10px] text-content-muted uppercase">
                        Bonus Points
                      </label>
                      <input
                        type="number"
                        min="10"
                        value={formData.birthdayReward.bonusPoints}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            birthdayReward: {
                              ...formData.birthdayReward!,
                              bonusPoints: parseInt(e.target.value || '10', 10),
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs rounded bg-surface-card border border-surface-border font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={updateSettingsMutation.isPending}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {updateSettingsMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column (1 span): Live Example Calculator & Ledger Invariants */}
        <div className="space-y-6">
          <SettingsExampleCalculator settings={formData} />

          {/* Anti-Abuse System Rules Documentation */}
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-content-primary font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Built-in Anti-Abuse Guards</span>
            </div>

            <ul className="space-y-2 text-xs text-content-secondary list-disc pl-4">
              <li>
                <strong className="text-content-primary">Append-only Ledger:</strong> Points
                transactions are never overwritten or deleted.
              </li>
              <li>
                <strong className="text-content-primary">24h Cooldown:</strong> Newly registered
                customer profiles cannot redeem immediately.
              </li>
              <li>
                <strong className="text-content-primary">Strict Bill Limit:</strong> Redemptions
                cannot exceed {formData.maxRedeemPercentOfBill}% of total bill.
              </li>
              <li>
                <strong className="text-content-primary">Non-Negative Balances:</strong> Points
                cannot drop below 0; manual debits are guarded.
              </li>
              <li>
                <strong className="text-content-primary">Auto-Reversals:</strong> Cancelled or
                refunded bills trigger automatic debit reversals.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Manual Points Adjust Dialog */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-title font-bold text-content-primary">Manual Adjust Points</h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-content-muted hover:text-content-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformAdjust} className="space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={adjustCustomerSearch}
                  onChange={(e) => {
                    setAdjustCustomerSearch(e.target.value);
                    setAdjustCustomerId('');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                />

                {customerSearchData?.customers &&
                  customerSearchData.customers.length > 0 &&
                  !adjustCustomerId && (
                    <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated p-1 space-y-1">
                      {customerSearchData.customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAdjustCustomerId(c.id);
                            setAdjustCustomerSearch(`${c.name || 'Guest'} (${c.phone})`);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-surface-subtle flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-content-primary">
                            {c.name || 'Guest'}
                          </span>
                          <span className="font-mono text-content-secondary text-[11px]">
                            {c.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                {adjustCustomerId && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold mt-1">
                    <UserCheck className="w-3.5 h-3.5" /> Customer Selected
                  </span>
                )}
              </div>

              {/* Points Delta */}
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Points Delta (+ to credit, - to debit)
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary font-mono font-bold"
                />
                <span className="text-[10px] text-content-muted mt-0.5 block">
                  Positive numbers credit points; negative numbers deduct points.
                </span>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-1">
                  Reason (Mandatory Audit Trail)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. VIP goodwill bonus, service recovery compensation"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-subtle border border-surface-border text-content-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={adjustMutation.isPending || !adjustCustomerId}
                >
                  {adjustMutation.isPending ? 'Adjusting…' : 'Confirm Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
