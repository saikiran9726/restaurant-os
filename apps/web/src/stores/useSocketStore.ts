import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore.js';
import { useToastStore } from './useToastStore.js';
import { useKitchenStore } from './useKitchenStore.js';
import { localDb } from '../db/dexie.js';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  isPaused: boolean;
  lastEventTimestamp: number;
  init: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isPaused: false,
  lastEventTimestamp: Date.now(),

  init: () => {
    const existing = get().socket;
    if (existing) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const s = io(window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      set({ isConnected: true, isPaused: false });
      // Catch up on reconnect
      s.emit('catch_up', { since: get().lastEventTimestamp }, (events: any[]) => {
        if (Array.isArray(events)) {
          for (const ev of events) {
            handleIncomingRealtimeEvent(ev.event, ev.data);
          }
        }
      });
    });

    s.on('disconnect', () => {
      set({ isConnected: false, isPaused: true });
    });

    // Realtime events
    s.on('kot.created', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('kot.created', payload.data);
    });

    s.on('kot.updated', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('kot.updated', payload.data);
    });

    s.on('kot.itemDone', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('kot.itemDone', payload.data);
    });

    s.on('kot.statusChanged', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('kot.statusChanged', payload.data);
    });

    s.on('order.ready', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('order.ready', payload.data);
    });

    s.on('table.statusChanged', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('table.statusChanged', payload.data);
    });

    s.on('menu.availabilityChanged', (payload) => {
      set({ lastEventTimestamp: payload.timestamp || Date.now() });
      handleIncomingRealtimeEvent('menu.availabilityChanged', payload.data);
    });

    set({ socket: s });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));

function handleIncomingRealtimeEvent(event: string, data: any) {
  const { addToast } = useToastStore.getState();

  // Forward to kitchen store if active
  useKitchenStore.getState().applyRealtimeKotEvent(event, data);

  switch (event) {
    case 'order.ready': {
      addToast({
        type: 'success',
        message: `Order #${(data.orderId || '').slice(0, 6)} is READY in kitchen!`,
      });
      // Trigger optional haptic or sound
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      break;
    }
    case 'table.statusChanged': {
      if (data.tableId && data.status) {
        localDb.floorTables.update(data.tableId, { status: data.status }).catch(() => {});
      }
      break;
    }
    case 'menu.availabilityChanged': {
      if (data.itemId !== undefined && data.available !== undefined) {
        localDb.menu
          .update(data.itemId, {
            available: data.available,
            oosReason: data.oosReason || null,
          } as any)
          .catch(() => {});

        if (!data.available) {
          addToast({
            type: 'warning',
            message: `Menu item was marked OUT OF STOCK: ${data.oosReason || ''}`,
          });
        }
      }
      break;
    }
  }
}
