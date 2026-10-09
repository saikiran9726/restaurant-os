import { create } from 'zustand';

export type ActiveConnection = 'hub' | 'cloud' | 'offline';

interface ConnectionState {
  activeConnection: ActiveConnection;
  isOnline: boolean; // true if activeConnection is 'hub' or 'cloud'
  syncPendingCount: number;
  hubAddress: string | null;
  cloudUrl: string;
  isHubReachable: boolean;
  isCloudReachable: boolean;
  isProbing: boolean;
  lastProbeAt: number;

  // Actions
  setHubAddress: (address: string | null) => void;
  probeConnection: () => Promise<ActiveConnection>;
  getBaseUrl: () => string;
}

const DEFAULT_CLOUD_URL = import.meta.env.VITE_API_BASE_URL || '';

export const useConnectionStore = create<ConnectionState>((set, get) => {
  const savedHub =
    typeof window !== 'undefined' ? localStorage.getItem('restaurant_hub_address') : null;

  return {
    activeConnection: navigator.onLine ? 'cloud' : 'offline',
    isOnline: navigator.onLine,
    syncPendingCount: 0,
    hubAddress: savedHub,
    cloudUrl: DEFAULT_CLOUD_URL,
    isHubReachable: false,
    isCloudReachable: navigator.onLine,
    isProbing: false,
    lastProbeAt: Date.now(),

    setHubAddress: (address) => {
      if (address) {
        localStorage.setItem('restaurant_hub_address', address);
      } else {
        localStorage.removeItem('restaurant_hub_address');
      }
      set({ hubAddress: address });
      get().probeConnection();
    },

    getBaseUrl: () => {
      const { activeConnection, hubAddress, cloudUrl } = get();
      if (activeConnection === 'hub' && hubAddress) {
        return hubAddress.startsWith('http') ? hubAddress : `http://${hubAddress}`;
      }
      return cloudUrl;
    },

    probeConnection: async () => {
      const { hubAddress, cloudUrl } = get();
      set({ isProbing: true });

      let hubOk = false;
      let cloudOk = false;

      // 1. Probe Hub if configured
      if (hubAddress) {
        try {
          const hubUrl = hubAddress.startsWith('http') ? hubAddress : `http://${hubAddress}`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 2000);
          const res = await fetch(`${hubUrl}/health`, { signal: ctrl.signal });
          clearTimeout(timer);
          hubOk = res.ok;
        } catch {
          hubOk = false;
        }
      }

      // 2. Probe Cloud
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(`${cloudUrl}/health`, { signal: ctrl.signal });
        clearTimeout(timer);
        cloudOk = res.ok;
      } catch {
        cloudOk = false;
      }

      // Order of precedence: Hub (if reachable) -> Cloud (if reachable) -> Offline
      let nextConnection: ActiveConnection = 'offline';
      if (hubOk) {
        nextConnection = 'hub';
      } else if (cloudOk) {
        nextConnection = 'cloud';
      }

      set({
        isHubReachable: hubOk,
        isCloudReachable: cloudOk,
        activeConnection: nextConnection,
        isOnline: nextConnection !== 'offline',
        isProbing: false,
        lastProbeAt: Date.now(),
      });

      return nextConnection;
    },
  };
});

// Periodic background probe every 15s
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useConnectionStore.getState().probeConnection();
  });
  window.addEventListener('offline', () => {
    useConnectionStore.getState().probeConnection();
  });

  setInterval(() => {
    useConnectionStore.getState().probeConnection();
  }, 15000);
}
