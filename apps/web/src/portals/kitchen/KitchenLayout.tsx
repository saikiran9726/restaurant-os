import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Wifi,
  Zap,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Ban,
  History,
  Sun,
  Smartphone,
} from 'lucide-react';
import { useKitchenStore, type TextSize } from '../../stores/useKitchenStore.js';
import { useConnectionStore } from '../../stores/useConnectionStore.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { ConnectionBanner } from '../../components/ConnectionBanner.js';

export const KitchenLayout: React.FC = () => {
  const {
    rushMode,
    toggleRushMode,
    textSize,
    setTextSize,
    soundEnabled,
    setSoundEnabled,
    wakeLockActive,
    toggleWakeLock,
    setOosOpen,
    setRecentlyServedOpen,
  } = useKitchenStore();

  const { isOnline } = useConnectionStore();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Live Digital Clock
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle error:', err);
    }
  };

  // Fetch count of currently 86'd (out-of-stock) items for header badge
  const { data: menuData } = useQuery<{ items: Array<{ available: boolean }> }>({
    queryKey: ['kitchen-menu-oos-count'],
    queryFn: () => apiFetch('/menu'),
    refetchInterval: 30000,
  });

  const oosCount = (menuData?.items || []).filter((i) => !i.available).length;

  return (
    <div
      data-portal="kitchen"
      className="theme-kitchen dark min-h-screen flex flex-col bg-surface-canvas text-content-primary"
    >
      <ConnectionBanner />

      {/* Full-screen Kitchen Header with Digital Clock, Rush Mode, Connection, Controls */}
      <header className="h-20 px-4 md:px-6 border-b-2 border-surface-border bg-surface-card flex items-center justify-between shrink-0 sticky top-0 z-30 select-none gap-2 md:gap-4">
        {/* Left: Navigation and Station Identification */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2.5 -ml-1 rounded-xl bg-surface-elevated hover:bg-surface-border text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to Portal Hub"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-body sm:text-title font-black uppercase tracking-wider text-content-primary leading-none">
              KDS • Live Kitchen Display
            </h1>
            <span className="text-caption text-content-muted block mt-1 hidden sm:block">
              Station: Main Kitchen & Grill
            </span>
          </div>
        </div>

        {/* Center: Live Digital Monospace Tabular Kitchen Clock */}
        <div className="hidden md:flex flex-col items-center">
          <time
            aria-label="Current kitchen time"
            className="text-headline font-mono font-black tracking-widest text-content-primary tabular-nums"
          >
            {currentTime || '00:00:00'}
          </time>
        </div>

        {/* Right: Quick Operational Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* 86 List Button with Out-of-Stock Count */}
          <button
            type="button"
            onClick={() => setOosOpen(true)}
            aria-label="Open 86 out-of-stock list"
            className="flex items-center gap-2 px-3 h-11 rounded-xl font-black text-caption uppercase tracking-wider bg-surface-elevated hover:bg-surface-border border border-surface-border text-content-primary transition-colors"
          >
            <Ban className={`w-4 h-4 ${oosCount > 0 ? 'text-red-400' : 'text-content-muted'}`} />
            <span className="hidden sm:inline">86 List</span>
            {oosCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black">
                {oosCount}
              </span>
            )}
          </button>

          {/* Recently Served Drawer Trigger */}
          <button
            type="button"
            onClick={() => setRecentlyServedOpen(true)}
            aria-label="Open recently served history drawer"
            className="p-2.5 h-11 rounded-xl bg-surface-elevated hover:bg-surface-border border border-surface-border text-content-secondary hover:text-content-primary transition-colors flex items-center justify-center"
            title="Recently Served Orders"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Text Size Stepper (M / L / XL) */}
          <div className="hidden lg:flex items-center rounded-xl bg-surface-elevated border border-surface-border p-0.5">
            {(['M', 'L', 'XL'] as TextSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setTextSize(size)}
                className={`px-2 py-1 rounded-lg text-xs font-black transition-colors ${
                  textSize === size
                    ? 'bg-accent text-accent-content'
                    : 'text-content-muted hover:text-content-primary'
                }`}
                title={`Font Size: ${size}`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Rush Mode Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={rushMode}
            onClick={toggleRushMode}
            aria-label="Toggle rush mode"
            className={`flex items-center gap-2 px-3 h-11 rounded-xl font-black text-caption uppercase tracking-wider transition-all duration-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              rushMode
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse focus-visible:ring-red-500'
                : 'bg-surface-elevated text-content-secondary border border-surface-border hover:text-content-primary focus-visible:ring-accent'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Rush: {rushMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Wake Lock Toggle */}
          <button
            type="button"
            onClick={toggleWakeLock}
            aria-label="Toggle screen wake lock"
            className={`p-2.5 h-11 rounded-xl border transition-colors flex items-center justify-center ${
              wakeLockActive
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-surface-elevated border-surface-border text-content-muted hover:text-content-primary'
            }`}
            title={wakeLockActive ? 'Screen Awake: ACTIVE' : 'Screen Awake: DISABLED'}
          >
            <Smartphone className="w-5 h-5" />
          </button>

          {/* Audio Chime Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Mute kitchen notification chime' : 'Unmute kitchen chime'}
            className={`p-2.5 h-11 rounded-xl border transition-colors flex items-center justify-center ${
              soundEnabled
                ? 'bg-surface-elevated border-surface-border text-content-primary'
                : 'bg-surface-elevated border-surface-border text-content-muted'
            }`}
            title={soundEnabled ? 'Chime sound enabled' : 'Chime muted'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-accent" />
            ) : (
              <VolumeX className="w-5 h-5 text-red-400" />
            )}
          </button>

          {/* Fullscreen API Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="p-2.5 h-11 rounded-xl bg-surface-elevated hover:bg-surface-border border border-surface-border text-content-secondary hover:text-content-primary transition-colors flex items-center justify-center"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {/* Connection Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-caption font-bold ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
            title={isOnline ? 'Network connected' : 'Offline'}
          >
            <Wifi className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">{isOnline ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>
        </div>
      </header>

      {/* Main KDS view */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto" role="main">
        <Outlet />
      </main>
    </div>
  );
};
