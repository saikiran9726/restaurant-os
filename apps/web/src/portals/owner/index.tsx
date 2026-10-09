import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { OwnerLayout } from './OwnerLayout.js';
import { OwnerHome } from './OwnerHome.js';
import { OwnerStaff } from './OwnerStaff.js';
import { OwnerAudit } from './OwnerAudit.js';
import { OwnerPaymentsView } from './OwnerPaymentsView.js';
import { OwnerCustomers } from './OwnerCustomers.js';
import { OwnerLoyalty } from './OwnerLoyalty.js';
import { OwnerSales } from './OwnerSales.js';
import { OwnerCloseDay } from './OwnerCloseDay.js';
import { OwnerInventory } from './OwnerInventory.js';
import { OwnerPurchases } from './OwnerPurchases.js';
import { OwnerExpenses } from './OwnerExpenses.js';
import { OwnerMonthReview } from './OwnerMonthReview.js';
import { OwnerHealth } from './OwnerHealth.js';
import { OwnerHealthSettings } from './OwnerHealthSettings.js';
import { OwnerAlerts } from './OwnerAlerts.js';
import { OwnerInsights } from './OwnerInsights.js';
import { OwnerAlertSettings } from './OwnerAlertSettings.js';
import { OwnerHubSetup } from './OwnerHubSetup.js';
import { OwnerSyncProblems } from './OwnerSyncProblems.js';
import { BillHistoryView } from '../../components/BillHistoryView.js';
import { EmptyState } from '../../components/ui/UtilityComponents.js';
import { TrendingUp, UtensilsCrossed, Settings } from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';

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
          <Route path="customers" element={<OwnerCustomers />} />
          <Route path="loyalty" element={<OwnerLoyalty />} />
          <Route path="payments" element={<OwnerPaymentsView />} />
          <Route path="bills" element={<BillHistoryView />} />
          <Route path="sales" element={<OwnerSales />} />
          <Route path="close-day" element={<OwnerCloseDay />} />
          <Route path="inventory" element={<OwnerInventory />} />
          <Route path="purchases" element={<OwnerPurchases />} />
          <Route path="expenses" element={<OwnerExpenses />} />
          <Route path="month-review" element={<OwnerMonthReview />} />
          <Route path="health" element={<OwnerHealth />} />
          <Route path="health/settings" element={<OwnerHealthSettings />} />
          <Route path="alerts" element={<OwnerAlerts />} />
          <Route path="alerts/settings" element={<OwnerAlertSettings />} />
          <Route path="insights" element={<OwnerInsights />} />
          <Route path="hub" element={<OwnerHubSetup />} />
          <Route path="sync/problems" element={<OwnerSyncProblems />} />
          <Route path="menu" element={<OwnerMenu />} />
          <Route path="staff" element={<OwnerStaff />} />
          <Route path="audit" element={<OwnerAudit />} />
          <Route path="settings" element={<OwnerSettings />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
