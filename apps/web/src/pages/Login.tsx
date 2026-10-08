import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { t } from '../i18n/index.js';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-canvas">
      <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent mx-auto flex items-center justify-center mb-3">
            <Lock className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-title font-extrabold text-content-primary">{t('common.appName')}</h1>
          <p className="text-caption text-content-secondary mt-1">
            Sign in to access your portal session
          </p>
        </div>

        {/* Phase 1 Disabled Notice */}
        <div
          role="note"
          aria-label="Feature status"
          className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 mb-6 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-body font-bold text-amber-500 leading-tight">
              Sign In Not Available Yet
            </h2>
            <p className="text-caption text-content-secondary mt-1">
              Authentication will be introduced in Phase 2. All portal shells are currently open for
              direct UX exploration and evaluation.
            </p>
            {from && (
              <p className="text-xs text-content-muted mt-2">
                Redirected from:{' '}
                <code className="font-mono bg-surface-elevated px-1 py-0.5 rounded">{from}</code>
              </p>
            )}
          </div>
        </div>

        {/* Disabled Login Form */}
        <form onSubmit={(e) => e.preventDefault()} aria-disabled="true" className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-caption font-semibold text-content-secondary mb-1.5"
            >
              Username / Staff ID
            </label>
            <input
              id="username"
              type="text"
              disabled
              placeholder="e.g. waiter_01"
              className="w-full h-11 px-3.5 rounded-lg border border-surface-border bg-surface-elevated text-content-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-caption font-semibold text-content-secondary mb-1.5"
            >
              PIN / Password
            </label>
            <input
              id="password"
              type="password"
              disabled
              placeholder="••••••"
              className="w-full h-11 px-3.5 rounded-lg border border-surface-border bg-surface-elevated text-content-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" disabled className="w-full mt-2">
            Sign In (Phase 2)
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-surface-border text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-caption text-accent hover:text-accent-hover font-semibold focus-visible:outline-none focus-visible:underline"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Portal Hub</span>
          </Link>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
