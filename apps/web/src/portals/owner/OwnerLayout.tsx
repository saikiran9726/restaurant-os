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
  QrCode,
  Receipt,
  Award,
  CalendarCheck,
  Boxes,
  Wallet,
  Calculator,
  Activity,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { ConnectionBanner } from '../../components/ConnectionBanner.js';
import { SyncBanner } from '../../components/SyncBanner.js';
import { ConnectionBadge } from '../../components/ConnectionBadge.js';
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
  { id: 'alerts', label: 'Attention Required', path: '/owner/alerts', icon: AlertCircle },
  { id: 'insights', label: 'Insights', path: '/owner/insights', icon: Sparkles },
  { id: 'health', label: 'Health Score', path: '/owner/health', icon: Activity },
  { id: 'sales', label: 'Sales & Analytics', path: '/owner/sales', icon: TrendingUp },
  { id: 'inventory', label: 'Stock & Inventory', path: '/owner/inventory', icon: Boxes },
  { id: 'expenses', label: 'Expenses', path: '/owner/expenses', icon: Wallet },
  { id: 'month-review', label: 'Month Review', path: '/owner/month-review', icon: Calculator },
  { id: 'close-day', label: 'Day Close (EOD)', path: '/owner/close-day', icon: CalendarCheck },
  { id: 'customers', label: 'Customers', path: '/owner/customers', icon: Users2 },
  { id: 'loyalty', label: 'Loyalty & Rewards', path: '/owner/loyalty', icon: Award },
  { id: 'payments', label: 'UPI & Payments', path: '/owner/payments', icon: QrCode },
  { id: 'bills', label: 'Bill History', path: '/owner/bills', icon: Receipt },
  { id: 'menu', label: 'Menu Analytics', path: '/owner/menu', icon: UtensilsCrossed },
  { id: 'staff', label: 'Staff & Roles', path: '/owner/staff', icon: Shield },
  { id: 'audit', label: 'Audit Trail', path: '/owner/audit', icon: Shield },
  { id: 'hub', label: 'Local Hub & Sync', path: '/owner/hub', icon: Settings },
  { id: 'settings', label: 'Settings', path: '/owner/settings', icon: Settings },
];

export const OwnerLayout: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();

  const { data: alerts = [] } = useQuery<{ id: string; status: string }[]>({
    queryKey: ['alerts', 'open'],
    queryFn: () => apiFetch('/alerts?status=open'),
    refetchInterval: 15000,
  });

  const openAlertsCount = alerts.filter((a) => a.status === 'open').length;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-content-primary">
      <ConnectionBanner />
      <SyncBanner />

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
          <ConnectionBadge />

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
                <span className="flex-1">{item.label}</span>
                {item.id === 'alerts' && openAlertsCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-black rounded-full bg-red-500 text-white shrink-0 shadow-sm animate-pulse">
                    {openAlertsCount}
                  </span>
                )}
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
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {item.id === 'alerts' && openAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
                    {openAlertsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
