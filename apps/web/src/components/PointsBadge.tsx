import React, { useEffect, useState } from 'react';
import { Award, Sparkles, TrendingUp } from 'lucide-react';

interface PointsBadgeProps {
  points: number;
  animated?: boolean;
  className?: string;
  showIcon?: boolean;
}

export const PointsBadge: React.FC<PointsBadgeProps> = ({
  points,
  animated = true,
  className = '',
  showIcon = true,
}) => {
  const [displayPoints, setDisplayPoints] = useState(points);

  useEffect(() => {
    if (!animated) {
      setDisplayPoints(points);
      return;
    }

    // Check for prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayPoints(points);
      return;
    }

    const start = displayPoints;
    const end = points;
    if (start === end) return;

    const durationMs = 300;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(start + (end - start) * eased);
      setDisplayPoints(currentVal);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    const handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [points, animated]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold ${className}`}
      aria-label={`${displayPoints} loyalty points`}
    >
      {showIcon && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
      <span>{displayPoints.toLocaleString('en-IN')} pts</span>
    </span>
  );
};
