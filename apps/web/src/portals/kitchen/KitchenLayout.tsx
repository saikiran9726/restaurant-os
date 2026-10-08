import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, Wifi, Zap, Volume2 } from 'lucide-react';
import { useKitchenStore } from '../../stores/useKitchenStore.js';
import { useConnectionStore } from '../../stores/useConnectionStore.js';
import { ConnectionBanner } from '../../components/ConnectionBanner.js';

export const KitchenLayout: React.FC = () => {
  const { rushMode, toggleRushMode } = useKitchenStore();
  const { isOnline } = useConnectionStore();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      data-portal="kitchen"
      className="theme-kitchen dark min-h-screen flex flex-col bg-surface-canvas text-content-primary"
    >
      <ConnectionBanner />

      {/* Full-screen Kitchen Header with Digital Clock, Rush Mode, Connection */}
      <header className="h-20 px-6 border-b-2 border-surface-border bg-surface-card flex items-center justify-between shrink-0 sticky top-0 z-30 select-none">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2.5 -ml-2 rounded-xl bg-surface-elevated hover:bg-surface-border text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to Portal Hub"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-title font-black uppercase tracking-wider text-content-primary leading-none">
              KDS • Live Kitchen Display
            </h1>
            <span className="text-caption text-content-muted block mt-1">
              Station: Main Kitchen & Grill
            </span>
          </div>
        </div>

        {/* Center: Live Digital Kitchen Clock */}
        <div className="hidden sm:flex flex-col items-center">
          <time
            aria-label="Current kitchen time"
            className="text-headline font-mono font-black tracking-widest text-content-primary"
          >
            {currentTime || '00:00:00'}
          </time>
        </div>

        {/* Right: Controls & Rush Mode Toggle */}
        <div className="flex items-center gap-4">
          {/* Rush Mode Toggle wired to real local state */}
          <button
            type="button"
            role="switch"
            aria-checked={rushMode}
            onClick={toggleRushMode}
            aria-label="Toggle rush mode"
            className={`flex items-center gap-2.5 px-4 h-12 rounded-xl font-black text-body uppercase tracking-wider transition-all duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              rushMode
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse focus-visible:ring-red-500'
                : 'bg-surface-elevated text-content-secondary border border-surface-border hover:text-content-primary focus-visible:ring-accent'
            }`}
          >
            <Zap className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Rush: {rushMode ? 'ACTIVE' : 'OFF'}</span>
          </button>

          {/* Connection Indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-caption font-bold ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
            title={isOnline ? 'Network connected' : 'Offline'}
          >
            <Wifi className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">{isOnline ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>

          <button
            type="button"
            aria-label="Kitchen bell sound volume"
            className="p-2.5 rounded-xl bg-surface-elevated text-content-muted hover:text-content-primary transition-colors"
          >
            <Volume2 className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main KDS view */}
      <main className="flex-1 p-6 overflow-y-auto" role="main">
        <Outlet />
      </main>
    </div>
  );
};
