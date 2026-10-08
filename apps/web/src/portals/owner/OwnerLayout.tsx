import React from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  UtensilsCrossed,
  Users2,
  Settings,
  ArrowLeft,
  Sun,
  Moon,
  Shield,
  LogOut,
} from 'lucide-react';
import { ConnectionBanner } from '../../components/ConnectionBanner.js';
import { useThemeStore } from '../../stores/useThemeStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { IconButton } from '../../components/ui/Button.js';

interface OwnerNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: OwnerNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/owner', icon: LayoutDashboard },
  { id: 'sales', label: 'Live Sales', path: '/owner/sales', icon: TrendingUp },
  { id: 'menu', label: 'Menu Analytics', path: '/owner/menu', icon: UtensilsCrossed },
  { id: 'staff', label: 'Staff & Roles', path: '/owner/staff', icon: Users2 },
  { id: 'audit', label: 'Audit Trail', path: '/owner/audit', icon: Shield },
  { id: 'settings', label: 'Settings', path: '/owner/settings', icon: Settings },
];

export const OwnerLayout: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-content-primary">
      <ConnectionBanner />

      {/* Top Header */}
      <header className="h-16 px-6 border-b border-surface-border bg-surface-card flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to Portal Hub"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-subhead font-extrabold text-content-primary leading-tight">
              Owner Executive Console
            </h1>
            <span className="text-xs text-content-muted block">
              {user ? `${user.name} (@${user.username})` : 'The Grand Bistro • Multi-outlet view'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <IconButton
            aria-label={`Toggle theme (currently ${resolvedTheme})`}
            variant="ghost"
            size="md"
            onClick={toggleTheme}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Moon className="w-5 h-5" aria-hidden="true" />
            )}
          </IconButton>

          <IconButton
            aria-label="Sign out"
            variant="ghost"
            size="md"
            onClick={handleLogout}
            className="text-danger hover:bg-danger/10"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (hidden on mobile) */}
        <nav
          aria-label="Owner navigation"
          className="hidden md:flex flex-col w-64 border-r border-surface-border bg-surface-card p-4 gap-1.5 shrink-0 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/owner'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 min-h-[44px] rounded-xl font-semibold text-body transition-colors duration-press active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8" role="main">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation (summary tabs for mobile owner) */}
      <nav
        aria-label="Owner mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t border-surface-border bg-surface-card/95 backdrop-blur-md px-2 flex items-center justify-around z-30 shadow-lg"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/owner'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-1 py-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'text-accent font-bold'
                    : 'text-content-muted hover:text-content-primary'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
