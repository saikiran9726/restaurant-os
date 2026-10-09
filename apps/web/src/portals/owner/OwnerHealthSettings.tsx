import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import {
  type HealthModelOutput,
  type HealthModelWeights,
  type HealthModelTargets,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_HEALTH_TARGETS,
} from '@restaurant-os/shared';
import {
  ArrowLeft,
  Settings,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Info,
  Sliders,
  Target,
} from 'lucide-react';

export const OwnerHealthSettings: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [windowDays, setWindowDays] = useState<number>(30);
  const [weights, setWeights] = useState<HealthModelWeights>(DEFAULT_HEALTH_WEIGHTS);
  const [targets, setTargets] = useState<HealthModelTargets>(DEFAULT_HEALTH_TARGETS);

  // Query active model
  const { data: modelData, isLoading } = useQuery<{ model: HealthModelOutput }>({
    queryKey: ['health-score-model'],
    queryFn: () => apiFetch('/health-score/model'),
  });

  useEffect(() => {
    if (modelData?.model) {
      setWindowDays(modelData.model.windowDays);
      setWeights(modelData.model.weights);
      setTargets(modelData.model.targets);
    }
  }, [modelData]);

  // Calculate current sum of weights
  const weightsSum =
    (Number(weights.sales_performance) || 0) +
    (Number(weights.profitability) || 0) +
    (Number(weights.customer_retention) || 0) +
    (Number(weights.food_cost) || 0) +
    (Number(weights.inventory_efficiency) || 0) +
    (Number(weights.waste) || 0) +
    (Number(weights.kitchen_efficiency) || 0) +
    (Number(weights.payment_reconciliation) || 0);

  const isWeightsValid = Math.abs(weightsSum - 100) < 0.1;

  // Mutation
  const updateModelMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/health-score/model', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      addToast({
        type: 'success',
        message: `Saved new scoring model version ${data.model.version}`,
      });
      queryClient.invalidateQueries({ queryKey: ['health-score-model'] });
      queryClient.invalidateQueries({ queryKey: ['health-score'] });
      navigate('/owner/health');
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to save model: ${err.message}` });
    },
  });

  const handleResetDefaults = () => {
    setWeights(DEFAULT_HEALTH_WEIGHTS);
    setTargets(DEFAULT_HEALTH_TARGETS);
    setWindowDays(30);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightsValid) {
      addToast({
        type: 'danger',
        message: `Weights sum to ${weightsSum}%. They must equal exactly 100%.`,
      });
      return;
    }

    updateModelMutation.mutate({
      windowDays,
      weights,
      targets,
    });
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-content-muted">Loading health model settings...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/owner/health')}
            className="p-2 -ml-2 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary"
            title="Back to Health Score"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-title font-extrabold text-content-primary">
              Health Model & Target Settings
            </h2>
            <p className="text-xs text-content-secondary mt-0.5">
              Customize factor importance weights and operational target benchmarks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-content-secondary"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Defaults
          </Button>
        </div>
      </div>

      {/* Model Versioning Notice */}
      <div className="p-3.5 bg-accent/5 border border-accent/20 rounded-xl flex items-start gap-3 text-xs text-content-secondary">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-content-primary block">Immutable Versioning:</strong>
          Modifying targets or weights creates a new model version (currently v
          {modelData?.model.version ?? 1}). Historical snapshots maintain the model version they
          were computed with, guaranteeing reproducible audit integrity.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rolling Window Days */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-subhead text-content-primary">
              1. Trailing Evaluation Window
            </h3>
            <span className="font-bold text-accent text-xs">{windowDays} Days</span>
          </div>
          <p className="text-xs text-content-secondary">
            Number of trailing days evaluated and compared against the prior consecutive window.
          </p>
          <div className="w-full sm:w-64">
            <input
              type="number"
              min={7}
              max={90}
              value={windowDays}
              onChange={(e) => setWindowDays(parseInt(e.target.value, 10) || 30)}
              className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-accent font-bold"
            />
          </div>
        </div>

        {/* Weights Section with Live Sum Validator */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-subhead text-content-primary">
                2. Factor Importance Weights
              </h3>
            </div>

            {/* Live Sum Indicator */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                isWeightsValid
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-600 border-red-500/30'
              }`}
            >
              {isWeightsValid ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span>Total: {weightsSum}% (Must equal 100%)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Sales Performance Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.sales_performance}
                onChange={(e) =>
                  setWeights({ ...weights, sales_performance: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Operating Profitability Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.profitability}
                onChange={(e) =>
                  setWeights({ ...weights, profitability: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Customer Retention Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.customer_retention}
                onChange={(e) =>
                  setWeights({ ...weights, customer_retention: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Food & Supply Cost Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.food_cost}
                onChange={(e) =>
                  setWeights({ ...weights, food_cost: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Inventory Efficiency Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.inventory_efficiency}
                onChange={(e) =>
                  setWeights({
                    ...weights,
                    inventory_efficiency: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Kitchen Waste Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.waste}
                onChange={(e) =>
                  setWeights({ ...weights, waste: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Kitchen Ticket Speed Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.kitchen_efficiency}
                onChange={(e) =>
                  setWeights({ ...weights, kitchen_efficiency: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Payment Reconciliation Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.payment_reconciliation}
                onChange={(e) =>
                  setWeights({
                    ...weights,
                    payment_reconciliation: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Operational Benchmark Targets */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-subhead text-content-primary">
              3. Benchmark Target Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Sales Revenue Growth Target (% vs prior window)
              </label>
              <input
                type="number"
                value={targets.salesGrowthPercent}
                onChange={(e) =>
                  setTargets({ ...targets, salesGrowthPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: +10%</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Operating Profit Margin Target (%)
              </label>
              <input
                type="number"
                value={targets.targetMarginPercent}
                onChange={(e) =>
                  setTargets({ ...targets, targetMarginPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 20%</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Repeat Customer Rate Target (% with 2+ visits)
              </label>
              <input
                type="number"
                value={targets.repeatRatePercent}
                onChange={(e) =>
                  setTargets({ ...targets, repeatRatePercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 40%</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Food & Supply Cost Ceiling (% of revenue)
              </label>
              <input
                type="number"
                value={targets.targetFoodCostPercent}
                onChange={(e) =>
                  setTargets({ ...targets, targetFoodCostPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 32% (lower is better)</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Healthy In-Stock Ratio Target (% above reorder level)
              </label>
              <input
                type="number"
                value={targets.inStockTargetPercent}
                onChange={(e) =>
                  setTargets({ ...targets, inStockTargetPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 90%</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Kitchen Waste Ceiling (% of total supplies)
              </label>
              <input
                type="number"
                value={targets.targetWastePercent}
                onChange={(e) =>
                  setTargets({ ...targets, targetWastePercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 3% (lower is better)</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Kitchen On-Time Ticket Target (% within 15 min)
              </label>
              <input
                type="number"
                value={targets.kitchenOnTimePercent}
                onChange={(e) =>
                  setTargets({ ...targets, kitchenOnTimePercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 85%</span>
            </div>

            <div>
              <label className="font-semibold text-content-primary block mb-1">
                Payment Reconciliation Target (% clean settlements)
              </label>
              <input
                type="number"
                value={targets.paymentCleanPercent}
                onChange={(e) =>
                  setTargets({ ...targets, paymentCleanPercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none"
              />
              <span className="text-[10px] text-content-muted">Default: 95%</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/owner/health')}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={!isWeightsValid}
            isLoading={updateModelMutation.isPending}
            className="font-bold flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save New Model Version
          </Button>
        </div>
      </form>
    </div>
  );
};
