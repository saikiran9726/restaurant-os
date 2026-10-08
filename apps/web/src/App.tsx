import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BootHub } from './pages/BootHub.js';
import { ToastContainer } from './components/ui/Toast.js';
import { Skeleton } from './components/ui/UtilityComponents.js';
import { RequireAuth } from './components/RequireAuth.js';

// Separate lazy-loaded route bundles
const WaiterPortal = lazy(() => import('./portals/waiter/index.js'));
const KitchenPortal = lazy(() => import('./portals/kitchen/index.js'));
const OwnerPortal = lazy(() => import('./portals/owner/index.js'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase.js'));
const LoginPage = lazy(() => import('./pages/Login.js'));

const PortalLoadingFallback: React.FC = () => (
  <div
    role="status"
    aria-label="Loading view..."
    className="min-h-screen flex flex-col p-6 space-y-4 bg-surface-canvas text-content-primary"
  >
    <div className="h-16 w-full rounded-xl bg-surface-elevated animate-pulse flex items-center justify-between px-6">
      <Skeleton variant="text" width={160} height={24} />
      <Skeleton variant="circular" width={40} height={40} />
    </div>
    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      <Skeleton variant="rectangular" height={220} />
      <Skeleton variant="rectangular" height={220} />
      <Skeleton variant="rectangular" height={220} />
    </div>
  </div>
);

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Suspense fallback={<PortalLoadingFallback />}>
        <Routes>
          {/* Main Diagnostics & Portal Entry Hub */}
          <Route path="/" element={<BootHub />} />

          {/* Static Login Screen */}
          <Route path="/login" element={<LoginPage />} />

          {/* Waiter Portal Shell (phone bottom nav, tablet rail) */}
          <Route
            path="/waiter/*"
            element={
              <RequireAuth>
                <WaiterPortal />
              </RequireAuth>
            }
          />

          {/* Kitchen Display System Shell (full-screen header, live clock, rush mode) */}
          <Route
            path="/kitchen/*"
            element={
              <RequireAuth>
                <KitchenPortal />
              </RequireAuth>
            }
          />

          {/* Owner Console Shell (desktop sidebar, mobile summary tabs) */}
          <Route
            path="/owner/*"
            element={
              <RequireAuth>
                <OwnerPortal />
              </RequireAuth>
            }
          />

          {/* Design System & Component Library (Dev Only) */}
          <Route path="/dev/components" element={<ComponentShowcase />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Global Toast Notification Container */}
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
