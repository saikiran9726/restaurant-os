import React from 'react';
import { useConnectionStore } from '../stores/useConnectionStore.js';
import { Banner } from './ui/UtilityComponents.js';
import { t } from '../i18n/index.js';

export const ConnectionBanner: React.FC = () => {
  const { isOnline, syncPendingCount } = useConnectionStore();

  if (isOnline && syncPendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return <Banner variant="offline" message={t('common.offline')} />;
  }

  if (syncPendingCount > 0) {
    return (
      <Banner variant="sync" message={`${t('common.syncing')} (${syncPendingCount} pending)`} />
    );
  }

  return null;
};
