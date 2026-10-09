import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutGrid, Utensils, Receipt, Bell, ArrowLeft, Sun, Moon } from 'lucide-react';
import { SyncBanner } from '../../components/SyncBanner.js';
import { useThemeStore } from '../../stores/useThemeStore.js';
import { IconButton } from '../../components/ui/Button.js';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'tables', label: 'Tables', path: '/waiter', icon: LayoutGrid },
  { id: 'orders', label: 'Active Orders', path: '/waiter/orders', icon: Utensils, badge: 3 },
  { id: 'bill', label: 'Quick Bill', path: '/waiter/bill', icon: Receipt },
  { id: 'alerts', label: 'Alerts', path: '/waiter/alerts', icon: Bell, badge: 1 },
];

export const WaiterLayout: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-content-primary">
      <SyncBanner />

      {/* Top Header */}
      <header className="h-16 px-4 md:px-6 border-b border-surface-border bg-surface-card flex items-center justify-between shrink-0 sticky top-0 z-30">
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
              Waiter Station
            </h1>
            <span className="text-xs text-content-muted block">Floor Section A • Device #04</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Main Content Area with Tablet/Desktop Left Rail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tablet / Desktop Left Rail (hidden on mobile) */}
        <nav
          aria-label="Waiter Navigation"
          className="hidden md:flex flex-col w-64 border-r border-surface-border bg-surface-card p-4 gap-2 shrink-0 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/waiter'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 min-h-[48px] rounded-xl font-semibold text-body transition-colors duration-press active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Viewport content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6" role="main">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (phone-first, >= 48px touch targets) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t border-surface-border bg-surface-card/95 backdrop-blur-md px-2 flex items-center justify-around z-30 shadow-lg"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/waiter'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'text-accent font-bold'
                    : 'text-content-muted hover:text-content-primary'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-accent text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
