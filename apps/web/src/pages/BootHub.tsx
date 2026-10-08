import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchVersion } from '../api/client.js';
import { useAppStore } from '../stores/useAppStore.js';
import { Button } from '../components/ui/Button.js';
import {
  Utensils,
  Flame,
  LayoutDashboard,
  Palette,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore.js';

export const BootHub: React.FC = () => {
  const { setLastBootCheck } = useAppStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();

  const {
    data: healthData,
    isLoading: isHealthLoading,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth,
    isFetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetchHealth();
      setLastBootCheck(res.data.timestamp);
      return res;
    },
    refetchInterval: 15000,
  });

  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: fetchVersion,
    staleTime: 60000,
  });

  const isDbConnected = healthData?.data.db === 'connected';
  const isApiOk = healthData?.data.status === 'ok';

  return (
    <main className="min-h-screen bg-surface-canvas text-content-primary p-6 md:p-12" role="main">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display font-black tracking-tight text-content-primary">
                Restaurant OS
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30">
                Phase 1 Design System
              </span>
            </div>
            <p className="text-body text-content-secondary mt-1">
              Multi-portal operating system for restaurant dining, kitchen display, and owner
              analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={toggleTheme}
              leftIcon={
                resolvedTheme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )
              }
            >
              {resolvedTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </div>
        </header>

        {/* Portal Entry Navigation */}
        <section aria-labelledby="portals-hub-heading" className="space-y-4">
          <h2
            id="portals-hub-heading"
            className="text-title font-bold text-content-primary flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
            <span>Portal Shells (Tailored Device Experiences)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Waiter Portal Card */}
            <Link
              to="/waiter"
              className="rounded-2xl bg-surface-card border-2 border-surface-border hover:border-accent p-6 flex flex-col justify-between transition-all duration-press active:scale-[0.98] group shadow-sm"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Utensils className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-subhead font-bold text-content-primary group-hover:text-accent transition-colors">
                  Waiter Portal
                </h3>
                <p className="text-caption text-content-secondary mt-2">
                  Phone bottom-nav &amp; tablet rail layout. Table status management, fast order
                  taking, and billing.
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-surface-border/50 text-caption font-bold text-accent">
                <span>Launch /waiter</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Kitchen Portal Card */}
            <Link
              to="/kitchen"
              className="rounded-2xl bg-surface-card border-2 border-surface-border hover:border-accent p-6 flex flex-col justify-between transition-all duration-press active:scale-[0.98] group shadow-sm"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Flame className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-subhead font-bold text-content-primary group-hover:text-accent transition-colors">
                  Kitchen Display (KDS)
                </h3>
                <p className="text-caption text-content-secondary mt-2">
                  High-contrast dark mode with +25% typography scale. Live clock, station filter,
                  and Rush Mode state.
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-surface-border/50 text-caption font-bold text-accent">
                <span>Launch /kitchen</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Owner Portal Card */}
            <Link
              to="/owner"
              className="rounded-2xl bg-surface-card border-2 border-surface-border hover:border-accent p-6 flex flex-col justify-between transition-all duration-press active:scale-[0.98] group shadow-sm"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-subhead font-bold text-content-primary group-hover:text-accent transition-colors">
                  Owner Dashboard
                </h3>
                <p className="text-caption text-content-secondary mt-2">
                  Desktop sidebar &amp; mobile summary tabs. Live revenue pulse, order stream, AI
                  insights, and exports.
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-surface-border/50 text-caption font-bold text-accent">
                <span>Launch /owner</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* Developer & Architecture Tools */}
        <section aria-labelledby="dev-tools-heading" className="space-y-4">
          <h2
            id="dev-tools-heading"
            className="text-subhead font-bold text-content-muted uppercase tracking-wider"
          >
            Developer Resources
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/dev/components"
              className="p-5 rounded-xl bg-surface-card border border-surface-border hover:border-surface-border-strong flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-accent" aria-hidden="true" />
                <div>
                  <h4 className="text-body font-bold text-content-primary group-hover:text-accent">
                    Design System Component Library
                  </h4>
                  <p className="text-xs text-content-muted">
                    Interactive sandbox for all 21 UI components &amp; tokens
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-content-muted group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/login"
              className="p-5 rounded-xl bg-surface-card border border-surface-border hover:border-surface-border-strong flex items-center justify-between group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <div>
                  <h4 className="text-body font-bold text-content-primary group-hover:text-accent">
                    Sign In Gate (Phase 2 Placeholder)
                  </h4>
                  <p className="text-xs text-content-muted">
                    Static disabled layout &amp; navigation intercept demonstration
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-content-muted group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        {/* Phase 0 System Health & Diagnostics */}
        <section
          aria-labelledby="diagnostics-heading"
          className="space-y-4 pt-6 border-t border-surface-border"
        >
          <div className="flex items-center justify-between">
            <h2 id="diagnostics-heading" className="text-subhead font-bold text-content-primary">
              Core Backend Diagnostics
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchHealth()}
              disabled={isFetching}
              isLoading={isFetching}
            >
              Re-check Status
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                API Server
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isApiOk ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500'}`}
                />
                <span className="font-bold text-body">
                  {isHealthLoading ? 'Testing...' : isApiOk ? 'Online (200)' : 'Offline'}
                </span>
              </div>
              <span className="text-xs text-content-muted mt-1 block">
                Latency: {healthData ? `${healthData.latencyMs}ms` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                PostgreSQL
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${isDbConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500'}`}
                />
                <span className="font-bold text-body">
                  {isHealthLoading ? 'Testing...' : isDbConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <span className="text-xs text-content-muted mt-1 block">Query: SELECT 1</span>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                Environment
              </span>
              <span className="font-bold text-body mt-2 block">
                {versionData?.environment || 'development'}
              </span>
              <span className="text-xs text-content-muted mt-1 block">
                Version: {versionData?.version || '0.1.0'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-surface-border">
              <span className="text-xs font-bold uppercase text-content-muted block">
                Server Uptime
              </span>
              <span className="font-bold font-mono text-body mt-2 block">
                {healthData ? `${Math.floor(healthData.data.uptime)}s` : '--'}
              </span>
              <span className="text-xs text-content-muted mt-1 block">Process healthy</span>
            </div>
          </div>

          {isHealthError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-caption"
            >
              {healthError instanceof Error ? healthError.message : 'Backend check failed'}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default BootHub;
