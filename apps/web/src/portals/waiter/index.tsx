import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { WaiterLayout } from './WaiterLayout.js';
import { WaiterHome } from './WaiterHome.js';
import { EmptyState } from '../../components/ui/UtilityComponents.js';
import { Utensils, Receipt, Bell } from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';

const WaiterOrders: React.FC = () => (
  <div className="space-y-4">
    <h2 className="text-title font-bold text-content-primary">Active KOT Orders</h2>
    <EmptyState
      icon={<Utensils className="w-8 h-8" />}
      title="No active kitchen orders"
      description="Orders fired to kitchen will show live preparation progress here."
    />
  </div>
);

import { BillHistoryView } from '../../components/BillHistoryView.js';

const WaiterAlerts: React.FC = () => (
  <div className="space-y-4">
    <h2 className="text-title font-bold text-content-primary">Waiter Notifications</h2>
    <EmptyState
      icon={<Bell className="w-8 h-8" />}
      title="All clear"
      description="Kitchen ready notifications and guest call bell alerts will appear here."
    />
  </div>
);

export default function WaiterPortal(): React.JSX.Element {
  return (
    <ErrorBoundary portalName="Waiter Portal">
      <Routes>
        <Route element={<WaiterLayout />}>
          <Route index element={<WaiterHome />} />
          <Route path="orders" element={<WaiterOrders />} />
          <Route path="bill" element={<BillHistoryView />} />
          <Route path="alerts" element={<WaiterAlerts />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
