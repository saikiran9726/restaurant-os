import { create } from 'zustand';

interface AppState {
  currentRestaurantId: string | null;
  isDevMode: boolean;
  lastBootCheck: string | null;
  setCurrentRestaurantId: (id: string | null) => void;
  setLastBootCheck: (timestamp: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentRestaurantId: null,
  isDevMode: true,
  lastBootCheck: null,
  setCurrentRestaurantId: (id) => set({ currentRestaurantId: id }),
  setLastBootCheck: (timestamp) => set({ lastBootCheck: timestamp }),
}));
