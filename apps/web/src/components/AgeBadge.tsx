import React, { useState, useEffect } from 'react';
import { Timer, AlertTriangle, Flame } from 'lucide-react';

interface AgeBadgeProps {
  createdAt: string;
  warnMinutes?: number;
  criticalMinutes?: number;
}

export const AgeBadge: React.FC<AgeBadgeProps> = ({
  createdAt,
  warnMinutes = 10,
  criticalMinutes = 15,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isCritical = elapsedMinutes >= criticalMinutes;
  const isWarn = !isCritical && elapsedMinutes >= warnMinutes;

  if (isCritical) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-600 text-white font-black text-body tracking-wider animate-pulse shadow-md border-2 border-white/40"
        title={`Overdue: ${timeFormatted}`}
      >
        <Flame className="w-5 h-5 shrink-0 animate-bounce" />
        <span className="font-mono tabular-nums">{timeFormatted}</span>
        <span className="text-xs uppercase bg-black/40 px-1.5 py-0.5 rounded font-black">
          OVERDUE
        </span>
      </div>
    );
  }

  if (isWarn) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border-2 border-amber-500 text-amber-400 font-bold text-body tracking-wider"
        title={`Late: ${timeFormatted}`}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="font-mono tabular-nums text-white font-extrabold">{timeFormatted}</span>
        <span className="text-[10px] uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded font-black">
          LATE
        </span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated border border-surface-border text-content-secondary font-mono text-body font-bold tabular-nums"
      title={`Elapsed: ${timeFormatted}`}
    >
      <Timer className="w-4 h-4 shrink-0 text-content-muted" />
      <span>{timeFormatted}</span>
    </div>
  );
};
