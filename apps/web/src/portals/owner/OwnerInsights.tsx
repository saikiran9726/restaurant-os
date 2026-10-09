import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { BusinessInsightCard } from '../../components/alerts-insights/BusinessInsightCard.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Sparkles, Info } from 'lucide-react';
import type { InsightOutput } from '@restaurant-os/shared';

export const OwnerInsights: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const { data: insights = [], isLoading } = useQuery<InsightOutput[]>({
    queryKey: ['insights'],
    queryFn: () => apiFetch('/insights'),
  });

  const dismissMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiFetch(`/insights/${insightId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ dismissed: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      addToast({ message: 'Insight dismissed', type: 'info' });
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-title font-extrabold text-content-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-500" />
          <span>Business Insights & Explanations</span>
        </h2>
        <p className="text-caption text-content-secondary mt-0.5">
          Deterministic, rule-based explanations of what happened and why, with full additive
          decomposition and metric evidence.
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-content-muted">Computing insights...</div>
      ) : insights.length === 0 ? (
        <div className="p-8 text-center text-sm text-content-muted rounded-xl bg-surface-card border border-surface-border flex flex-col items-center gap-2">
          <Info className="w-6 h-6 text-content-muted" />
          <span>
            No business insights to display right now. Check back as new sales or stock data is
            recorded.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <BusinessInsightCard
              key={insight.id}
              insight={insight}
              onDismiss={async (id) => {
                await dismissMutation.mutateAsync(id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
