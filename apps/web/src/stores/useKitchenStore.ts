import { create } from 'zustand';

interface KitchenState {
  rushMode: boolean;
  toggleRushMode: () => void;
  setRushMode: (active: boolean) => void;
}

export const useKitchenStore = create<KitchenState>((set) => ({
  rushMode: false,
  toggleRushMode: () => set((state) => ({ rushMode: !state.rushMode })),
  setRushMode: (active) => set({ rushMode: active }),
}));
