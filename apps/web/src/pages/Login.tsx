import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { SegmentedControl } from '../components/ui/SegmentedControl.js';
import { PinPad } from '../components/PinPad.js';
import { PasswordField } from '../components/PasswordField.js';
import { useAuthStore } from '../stores/useAuthStore.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { Roles } from '@restaurant-os/shared';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const { login } = useAuthStore();

  const [mode, setMode] = useState<'pin' | 'password'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    if (!reducedMotion) {
      setShake(true);
      setTimeout(() => setShake(false), 200);
    }
  };

  const handleSuccessfulRedirect = (userRole: string) => {
    // Check if there was an intended redirect destination
    const stateFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (stateFrom && !stateFrom.startsWith('/login')) {
      navigate(stateFrom, { replace: true });
      return;
    }

    // Role-based landing portal redirect
    switch (userRole.toUpperCase()) {
      case Roles.OWNER:
      case Roles.MANAGER:
        navigate('/owner', { replace: true });
        break;
      case Roles.WAITER:
      case Roles.CASHIER:
        navigate('/waiter', { replace: true });
        break;
      case Roles.KITCHEN:
        navigate('/kitchen', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = await login({
        username: username.trim(),
        credentialType: 'password',
        password,
      });
      handleSuccessfulRedirect(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (pinValue: string) => {
    if (!username.trim() || !pinValue) {
      setError('Please enter your Staff Username first');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = await login({
        username: username.trim(),
        credentialType: 'pin',
        pin: pinValue,
      });
      handleSuccessfulRedirect(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid staff ID or PIN');
      triggerShake();
      setPin(''); // Reset PIN on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-canvas text-content-primary">
      <div
        className={`w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-8 shadow-xl transition-transform ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent mx-auto flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-title font-extrabold text-content-primary">Restaurant OS</h1>
          <p className="text-caption text-content-secondary mt-1">
            Sign in to start your shift or console
          </p>
        </div>

        {/* Mode Selector: Password (Owner/Manager) vs Fast PIN (Floor/Kitchen) */}
        <div className="mb-6">
          <SegmentedControl
            options={[
              { value: 'password', label: 'Password' },
              { value: 'pin', label: 'Quick PIN (Floor)' },
            ]}
            value={mode}
            onChange={(val) => {
              setMode(val as 'pin' | 'password');
              setError(null);
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-danger/10 border border-danger/30 p-3.5 mb-5 flex items-start gap-3 text-danger text-caption font-medium"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
            </div>
          </div>
        )}

        {mode === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-caption font-semibold text-content-secondary mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. owner or admin"
                autoComplete="username"
                className="w-full h-11 px-3.5 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            <PasswordField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="pin-username"
                className="block text-caption font-semibold text-content-secondary mb-1.5"
              >
                Staff Username / ID
              </label>
              <input
                id="pin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. rahul_waiter"
                className="w-full h-11 px-3.5 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-center font-medium"
              />
            </div>

            <PinPad
              pin={pin}
              onChange={setPin}
              onSubmit={handlePinSubmit}
              disabled={isSubmitting || !username.trim()}
              maxLength={4}
            />

            {isSubmitting && (
              <p className="text-center text-xs text-accent font-semibold animate-pulse">
                Verifying PIN...
              </p>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-surface-border text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-caption text-accent hover:text-accent-hover font-semibold focus-visible:outline-none focus-visible:underline"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Diagnostics Hub</span>
          </button>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
