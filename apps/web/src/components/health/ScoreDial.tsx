import React, { useEffect, useState } from 'react';
import type { HealthScoreBand } from '@restaurant-os/shared';

export interface ScoreDialProps {
  score: number | null;
  scoreBand: HealthScoreBand;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ScoreDial: React.FC<ScoreDialProps> = ({
  score,
  scoreBand,
  size = 'lg',
  className = '',
}) => {
  const [displayedScore, setDisplayedScore] = useState<number>(0);

  // Motion: Score count-up 300 ms ease-out; reduced motion: instant.
  useEffect(() => {
    if (score === null) {
      setDisplayedScore(0);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayedScore(score);
      return;
    }

    const start = 0;
    const duration = 300;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedScore(Math.round(start + (score - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const bandConfig: Record<
    HealthScoreBand,
    { label: string; textClass: string; bgClass: string; strokeClass: string }
  > = {
    strong: {
      label: 'Strong',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30',
      strokeClass: '#10b981',
    },
    stable: {
      label: 'Stable',
      textClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      strokeClass: '#3b82f6',
    },
    needs_attention: {
      label: 'Needs Attention',
      textClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10 border-amber-500/30',
      strokeClass: '#f59e0b',
    },
    at_risk: {
      label: 'At Risk',
      textClass: 'text-red-600 dark:text-red-400',
      bgClass: 'bg-red-500/10 border-red-500/30',
      strokeClass: '#ef4444',
    },
    insufficient_data: {
      label: 'Insufficient Data',
      textClass: 'text-content-muted',
      bgClass: 'bg-surface-elevated border-surface-border',
      strokeClass: '#94a3b8',
    },
  };

  const currentBand = bandConfig[scoreBand];

  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="flex items-baseline gap-1">
          <span className={`text-title font-black ${currentBand.textClass}`}>
            {score !== null ? displayedScore : '—'}
          </span>
          <span className="text-xs text-content-muted font-bold">/ 100</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${currentBand.bgClass} ${currentBand.textClass}`}
        >
          {currentBand.label}
        </span>
      </div>
    );
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    score !== null ? circumference - (displayedScore / 100) * circumference : circumference;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Visual SVG Progress Ring with Large Centered Text */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox="0 0 140 140"
          aria-hidden="true"
        >
          {/* Background circle track */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="10"
            className="text-surface-border"
          />
          {/* Progress circle */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke={currentBand.strokeClass}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Numeric text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={`text-3xl font-black tracking-tight leading-none ${currentBand.textClass}`}
          >
            {score !== null ? displayedScore : '—'}
          </span>
          <span className="text-xs font-bold text-content-muted mt-1">out of 100</span>
        </div>
      </div>

      {/* Prominent Text Band below Dial */}
      <div className="mt-3">
        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${currentBand.bgClass} ${currentBand.textClass}`}
        >
          {currentBand.label}
        </span>
      </div>
    </div>
  );
};
