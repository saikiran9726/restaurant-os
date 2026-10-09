import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import {
  ScoreDial,
  DeltaChip,
  ConfidenceBadge,
  FactorRow,
  ReasonList,
  SuggestionCard,
  FactorDetailDrawer,
} from '../../components/health/index.js';
import {
  type HealthScoreResult,
  type HealthSnapshotOutput,
  type HealthFactorEvaluation,
} from '@restaurant-os/shared';
import {
  Activity,
  RefreshCw,
  Settings,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const OwnerHealth: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [selectedFactor, setSelectedFactor] = useState<HealthFactorEvaluation | null>(null);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);

  // Queries
  const {
    data: healthData,
    isLoading,
    isError,
    refetch,
  } = useQuery<HealthScoreResult & { snapshotId: string; snapshotDate: string }>({
    queryKey: ['health-score'],
    queryFn: () => apiFetch('/health-score'),
  });

  const { data: historyData } = useQuery<{ history: HealthSnapshotOutput[] }>({
    queryKey: ['health-score-history'],
    queryFn: () => apiFetch('/health-score/history?limit=12'),
  });

  // Recompute mutation
  const recomputeMutation = useMutation({
    mutationFn: () =>
      apiFetch('/health-score/recompute', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Health score recalculated and snapshot recorded' });
      queryClient.invalidateQueries({ queryKey: ['health-score'] });
      queryClient.invalidateQueries({ queryKey: ['health-score-history'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Recalculation failed: ${err.message}` });
    },
  });

  const history = historyData?.history || [];
  const latestSnapshot = history[history.length - 1];
  const previousSnapshot = history.length > 1 ? history[history.length - 2] : null;

  const scoreDelta =
    healthData?.overallScore !== null &&
    healthData?.overallScore !== undefined &&
    previousSnapshot?.overallScore !== null &&
    previousSnapshot?.overallScore !== undefined
      ? healthData.overallScore - previousSnapshot.overallScore
      : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-title font-extrabold text-content-primary">
              Restaurant Health Score
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/10 text-accent">
              Phase 14
            </span>
          </div>
          <p className="text-body text-content-secondary mt-0.5">
            Objective 0–100 operational index computed transparently from real sales, costs, speed,
            and waste.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => recomputeMutation.mutate()}
            isLoading={recomputeMutation.isPending}
            className="flex items-center gap-1.5 font-bold"
            title="Recalculate trailing 30-day health metrics now"
          >
            <RefreshCw className="w-4 h-4" /> Recalculate
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/owner/health/settings')}
            className="flex items-center gap-1.5 text-content-secondary hover:text-content-primary"
            title="Configure factor weights and benchmark targets"
          >
            <Settings className="w-4 h-4" /> Targets & Weights
          </Button>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="p-16 text-center text-content-muted bg-surface-card rounded-xl border border-surface-border">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Evaluating operational metrics across trailing window...</span>
        </div>
      ) : isError || !healthData ? (
        <div className="p-12 text-center text-danger bg-surface-card rounded-xl border border-danger/30">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-bold text-subhead">Unable to load Health Score</h3>
          <p className="text-xs text-content-secondary mt-1">
            Check network connection or ensure user possesses owner authorization.
          </p>
          <Button type="button" variant="secondary" onClick={() => refetch()} className="mt-4">
            Retry Evaluation
          </Button>
        </div>
      ) : !healthData.isSufficientData ? (
        /* Explanatory Insufficient Data State */
        <div className="p-12 bg-surface-card border border-surface-border rounded-xl text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-subhead text-content-primary">Not enough data yet</h3>
            <p className="text-xs text-content-secondary mt-1 leading-relaxed">
              {healthData.insufficientDataReason ||
                'Need at least 14 days of closed sales and 3 active operational factors to generate an honest, un-fabricated score.'}
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/owner/close-day')}
              className="text-xs font-bold"
            >
              Go to Day Close Reconciliations
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Main Top Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Dial Card */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-sm flex flex-col justify-between items-center text-center relative overflow-hidden">
              <div className="w-full flex items-center justify-between pb-2">
                <ConfidenceBadge
                  confidence={healthData.confidence}
                  factorsUsedCount={healthData.factorsUsedCount}
                  totalFactorsCount={healthData.totalFactorsCount}
                />
                {scoreDelta !== null && <DeltaChip delta={scoreDelta} />}
              </div>

              <div className="my-4">
                <ScoreDial
                  score={healthData.overallScore}
                  scoreBand={healthData.scoreBand}
                  size="lg"
                />
              </div>

              <div className="w-full pt-3 border-t border-surface-border flex items-center justify-between text-xs text-content-secondary">
                <span>Trailing {healthData.windowDays} days window</span>
                <span className="font-mono font-bold text-accent">
                  Model v{healthData.modelVersion}
                </span>
              </div>
            </div>

            {/* "Why the score changed" & "Suggestions" Column */}
            <div className="lg:col-span-2 space-y-4">
              <ReasonList reasons={healthData.reasonsForChange} />

              {/* What you can improve (Top 3 rule-based suggestions) */}
              {healthData.suggestions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <h3 className="font-bold text-subhead text-content-primary">
                        What You Can Improve
                      </h3>
                    </div>
                    <span className="text-xs text-content-muted">
                      Top {healthData.suggestions.length} high-leverage actions
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {healthData.suggestions.map((suggestion, idx) => (
                      <SuggestionCard
                        key={suggestion.factorId}
                        suggestion={suggestion}
                        rank={idx + 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Factor Breakdown Table */}
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-surface-border bg-surface-elevated flex items-center justify-between">
              <div>
                <h3 className="font-bold text-subhead text-content-primary">
                  Factor-by-Factor Breakdown
                </h3>
                <p className="text-xs text-content-secondary">
                  Tap any factor to inspect exact mathematical formula and raw database inputs
                </p>
              </div>

              <span className="text-xs font-bold text-accent px-2.5 py-1 bg-accent/10 rounded-full">
                {healthData.factorsUsedCount} of 8 factors contributing
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-content-secondary">
                <thead className="bg-surface-elevated/50 text-content-primary font-bold border-b border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Factor & Current Metric</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4 text-center">Sub-Score</th>
                    <th className="py-3 px-4 text-center">Weight</th>
                    <th className="py-3 px-4 text-right">Contribution</th>
                    <th className="py-3 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {healthData.factors.map((factor) => (
                    <FactorRow
                      key={factor.id}
                      factor={factor}
                      onSelect={(f) => setSelectedFactor(f)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend Over Last 12 Snapshots */}
          {history.length > 0 && (
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-subhead text-content-primary">
                    Historical Trend (Last {history.length} Snapshots)
                  </h3>
                </div>
                <span className="text-xs text-content-muted">Daily snapshots</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-1">
                {history.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-2.5 bg-surface-elevated rounded-lg text-center flex flex-col justify-between border border-surface-border"
                  >
                    <span className="text-[10px] text-content-muted block font-mono">
                      {snap.snapshotDate.slice(5)}
                    </span>
                    <span className="text-body font-black text-content-primary my-1">
                      {snap.overallScore !== null ? snap.overallScore : '—'}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase ${
                        snap.scoreBand === 'strong'
                          ? 'text-emerald-600'
                          : snap.scoreBand === 'stable'
                            ? 'text-blue-600'
                            : snap.scoreBand === 'needs_attention'
                              ? 'text-amber-600'
                              : 'text-red-600'
                      }`}
                    >
                      {snap.scoreBand.slice(0, 6)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transparent Methodology & How this was calculated */}
          <div className="bg-surface-elevated/70 border border-surface-border rounded-xl p-4 text-xs space-y-2">
            <button
              type="button"
              onClick={() => setIsMethodologyOpen(!isMethodologyOpen)}
              className="w-full flex items-center justify-between font-bold text-content-primary hover:text-accent transition-colors focus-visible:outline-none"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-accent" />
                <span>How is the Restaurant Health Score calculated?</span>
              </div>
              {isMethodologyOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isMethodologyOpen && (
              <div className="mt-3 pt-3 border-t border-surface-border space-y-3 text-content-secondary leading-relaxed animate-in fade-in duration-200">
                <p>
                  The Restaurant Health Score is a completely deterministic, non-AI rating from 0 to
                  100 evaluating 8 core operational pillars over a rolling 30-day window.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pt-1">
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      1. Sales Performance (15%)
                    </strong>
                    <span>
                      Compares net sales against the previous window: 100 at ≥ +10%, 50 at flat, 0
                      at ≤ -20%.
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      2. Operating Profitability (20%)
                    </strong>
                    <span>
                      Actual operating margin vs owner target (default 20%). Linear 0% to target.
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      3. Customer Retention (12%)
                    </strong>
                    <span>
                      Share of active guests who visited 2+ times vs target (default 40% repeat
                      guests).
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      4. Food & Supplies Cost (15%)
                    </strong>
                    <span>
                      Supply purchases % of net revenue vs target (default 32%). Lower is better.
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      5. Inventory Efficiency (8%)
                    </strong>
                    <span>
                      Percentage of ingredients maintained above safety reorder level minus count
                      audit variance.
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      6. Kitchen Waste (8%)
                    </strong>
                    <span>
                      Logged waste cost % of total supplies purchases vs target (default 3%). Lower
                      is better.
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      7. Kitchen Speed (10%)
                    </strong>
                    <span>
                      Share of kitchen tickets (KOTs) prepared within 15-minute warn threshold vs
                      target (default 85%).
                    </span>
                  </div>
                  <div className="p-3 bg-surface-card rounded-lg border border-surface-border">
                    <strong className="text-content-primary block mb-1">
                      8. Settlement Reconciliation (12%)
                    </strong>
                    <span>
                      Clean settlement share without pending UPI plus register till cash match
                      accuracy (default 95%).
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-accent/5 border border-accent/20 rounded-lg text-[11px] text-content-primary">
                  <strong>Missing Data Rule:</strong> If an operational module lacks sufficient
                  data, that factor is excluded and the remaining weights are renormalised to sum to
                  100%. Scores are never fabricated or estimated.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Factor Detail Drawer Modal */}
      {selectedFactor && (
        <FactorDetailDrawer factor={selectedFactor} onClose={() => setSelectedFactor(null)} />
      )}
    </div>
  );
};
