import React from 'react';
import { useOutboxStore } from '../stores/useOutboxStore.js';
import { useConnectionStore } from '../stores/useConnectionStore.js';
import { useSocketStore } from '../stores/useSocketStore.js';
import { Banner } from './ui/UtilityComponents.js';
import { useNavigate } from 'react-router-dom';

export const SyncBanner: React.FC = () => {
  const { syncState, pendingCount, lastSyncError, triggerSync } = useOutboxStore();
  const { activeConnection } = useConnectionStore();
  const { isPaused, isConnected } = useSocketStore();
  const navigate = useNavigate();

  // If using Local Hub during internet outage, show reassuring notice
  if (activeConnection === 'hub' && syncState === 'online' && pendingCount === 0) {
    return null;
  }

  // Pure cloud online with zero pending
  if (syncState === 'online' && pendingCount === 0) {
    if (isPaused && !isConnected && navigator.onLine) {
      return (
        <Banner
          variant="warning"
          message="Live updates paused (reconnecting to realtime server...)"
        />
      );
    }
    return null;
  }

  if (syncState === 'offline') {
    const hubSuffix = activeConnection === 'hub' ? ' (Connected to Local Hub on LAN)' : '';
    return (
      <Banner
        variant="offline"
        message={
          pendingCount > 0
            ? `Offline${hubSuffix} — ${pendingCount} command${pendingCount > 1 ? 's' : ''} queued locally`
            : `You are offline${hubSuffix}. Orders will save locally and sync when connection returns.`
        }
      />
    );
  }

  if (syncState === 'syncing') {
    return (
      <Banner
        variant="sync"
        message={`Syncing ${pendingCount} pending command${pendingCount > 1 ? 's' : ''} to server...`}
      />
    );
  }

  if (syncState === 'complete') {
    return (
      <Banner variant="online" message="All local transactions synced and verified successfully!" />
    );
  }

  if (syncState === 'problem') {
    return (
      <Banner
        variant="warning"
        message={`Sync problem: ${lastSyncError || 'Connection interrupted'}. Tap to review.`}
        actionText="View Sync Problems"
        onAction={() => navigate('/owner/sync/problems')}
      />
    );
  }

  return null;
};
