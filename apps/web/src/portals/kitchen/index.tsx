import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { KitchenLayout } from './KitchenLayout.js';
import { KitchenHome } from './KitchenHome.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';

export default function KitchenPortal(): React.JSX.Element {
  return (
    <ErrorBoundary portalName="Kitchen Display System">
      <Routes>
        <Route element={<KitchenLayout />}>
          <Route index element={<KitchenHome />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
