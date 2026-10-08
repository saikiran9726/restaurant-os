import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { OwnerLayout } from './OwnerLayout.js';
import { OwnerHome } from './OwnerHome.js';
import { OwnerStaff } from './OwnerStaff.js';
import { OwnerAudit } from './OwnerAudit.js';
import { EmptyState } from '../../components/ui/UtilityComponents.js';
import { TrendingUp, UtensilsCrossed, Settings } from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';

const OwnerSales: React.FC = () => (
  <div className="space-y-4 max-w-7xl mx-auto">
    <h2 className="text-title font-bold text-content-primary">Detailed Sales Analytics</h2>
    <EmptyState
      icon={<TrendingUp className="w-8 h-8" />}
      title="Sales trends loading"
      description="Historical hourly volume charts and payment breakup (UPI, Cash, Cards) will be visualized here."
    />
  </div>
);

const OwnerMenu: React.FC = () => (
  <div className="space-y-4 max-w-7xl mx-auto">
    <h2 className="text-title font-bold text-content-primary">Menu Performance Matrix</h2>
    <EmptyState
      icon={<UtensilsCrossed className="w-8 h-8" />}
      title="BCG Matrix / Menu Engineering"
      description="Top-selling stars, hidden gems, and low-margin menu items will appear in this report."
    />
  </div>
);

const OwnerSettings: React.FC = () => (
  <div className="space-y-4 max-w-7xl mx-auto">
    <h2 className="text-title font-bold text-content-primary">Restaurant Settings</h2>
    <EmptyState
      icon={<Settings className="w-8 h-8" />}
      title="Configuration Portal"
      description="GST/VAT tax rules, service charges, currency, and portal device authorizations."
    />
  </div>
);

export default function OwnerPortal(): React.JSX.Element {
  return (
    <ErrorBoundary portalName="Owner Console">
      <Routes>
        <Route element={<OwnerLayout />}>
          <Route index element={<OwnerHome />} />
          <Route path="sales" element={<OwnerSales />} />
          <Route path="menu" element={<OwnerMenu />} />
          <Route path="staff" element={<OwnerStaff />} />
          <Route path="audit" element={<OwnerAudit />} />
          <Route path="settings" element={<OwnerSettings />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
