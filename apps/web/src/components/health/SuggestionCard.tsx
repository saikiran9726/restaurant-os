import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { HealthImprovementSuggestion } from '@restaurant-os/shared';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { Button } from '../ui/Button.js';

export interface SuggestionCardProps {
  suggestion: HealthImprovementSuggestion;
  rank: number; // 1, 2, or 3
  className?: string;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  rank,
  className = '',
}) => {
  const navigate = useNavigate();

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-3 transition-all hover:border-accent/40 ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent font-black text-xs flex items-center justify-center shrink-0">
              {rank}
            </span>
            <span className="text-xs font-bold text-content-primary">{suggestion.title}</span>
          </div>

          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
            title="Maximum points score could increase if factor reaches target"
          >
            +{suggestion.potentialGainPoints.toFixed(1)} pts potential
          </span>
        </div>

        <p className="text-xs text-content-secondary leading-relaxed mt-1">
          {suggestion.description}
        </p>
      </div>

      <div className="pt-2 border-t border-surface-border flex items-center justify-between">
        <span className="text-[11px] text-content-muted font-medium">
          Factor: {suggestion.factorName}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(suggestion.actionUrl)}
          className="text-xs font-bold text-accent flex items-center gap-1 py-1 px-2.5 hover:bg-accent/10"
        >
          <span>Take Action</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
