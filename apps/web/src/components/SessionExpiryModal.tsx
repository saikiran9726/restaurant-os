import React, { useState } from 'react';
import { Dialog } from './ui/Overlay.js';
import { PasswordField } from './PasswordField.js';
import { Button } from './ui/Button.js';
import { useAuthStore } from '../stores/useAuthStore.js';
import { AlertCircle, Lock } from 'lucide-react';

export const SessionExpiryModal: React.FC = () => {
  const { isSessionExpiredModalOpen, setSessionExpiredModalOpen, user, login } = useAuthStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSessionExpiredModalOpen) return null;

  const handleReLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login({
        username: user?.username || '',
        credentialType: 'password',
        password,
      });
      setPassword('');
      setSessionExpiredModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isSessionExpiredModalOpen}
      onClose={() => {}} // Non-dismissible without login or manual sign out
      title="Session Expired"
      description="Your secure session has timed out. Enter your password to resume without losing work."
    >
      <form onSubmit={handleReLogin} className="space-y-4 pt-2">
        <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-surface-border">
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-body font-bold text-content-primary">
              {user?.name || user?.username}
            </p>
            <p className="text-xs text-content-secondary">@{user?.username}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-caption">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <PasswordField
          label="Password / PIN"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter credential to unlock"
          autoFocus
        />

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              useAuthStore.getState().logout();
              setSessionExpiredModalOpen(false);
            }}
          >
            Sign Out Completely
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Resume Session
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
