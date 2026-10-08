import { create } from 'zustand';

interface ConnectionState {
  isOnline: boolean;
  isWsConnected: boolean;
  syncPendingCount: number;
  setOnline: (online: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  setSyncPendingCount: (count: number) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => {
  const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => set({ isOnline: true }));
    window.addEventListener('offline', () => set({ isOnline: false }));
  }

  return {
    isOnline: initialOnline,
    isWsConnected: true, // Placeholder for WebSocket store
    syncPendingCount: 0,
    setOnline: (online) => set({ isOnline: online }),
    setWsConnected: (connected) => set({ isWsConnected: connected }),
    setSyncPendingCount: (count) => set({ syncPendingCount: count }),
  };
});
