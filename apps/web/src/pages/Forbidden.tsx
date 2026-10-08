import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { useAuthStore } from '../stores/useAuthStore.js';

export const ForbiddenPage: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-canvas text-content-primary">
      <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>

        <h1 className="text-display font-extrabold text-danger mb-2">403</h1>
        <h2 className="text-title font-bold text-content-primary mb-2">Access Denied</h2>
        <p className="text-caption text-content-secondary mb-6 leading-relaxed">
          Your account role (
          <strong className="text-content-primary">{user?.role || 'Current Session'}</strong>) does
          not have sufficient permissions to view or manage this portal.
        </p>

        <div className="space-y-3">
          {user?.role === 'WAITER' && (
            <Link to="/waiter" className="w-full block">
              <Button variant="primary" size="lg" className="w-full">
                Go to Waiter Portal
              </Button>
            </Link>
          )}

          {user?.role === 'KITCHEN' && (
            <Link to="/kitchen" className="w-full block">
              <Button variant="primary" size="lg" className="w-full">
                Go to Kitchen Display
              </Button>
            </Link>
          )}

          {user?.role === 'OWNER' && (
            <Link to="/owner" className="w-full block">
              <Button variant="primary" size="lg" className="w-full">
                Go to Owner Console
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="md"
            className="w-full text-danger hover:bg-danger/10"
            onClick={() => logout()}
          >
            Sign Out
          </Button>

          <div className="pt-4 border-t border-surface-border">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-caption text-content-secondary hover:text-content-primary font-medium"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Diagnostics Hub</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ForbiddenPage;
