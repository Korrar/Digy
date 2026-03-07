import { create } from 'zustand';

interface DevState {
  devToolsOpen: boolean;
  /** null = auto cycle, 0-1 = fixed time of day (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset) */
  fixedTimeOfDay: number | null;
  fastMining: boolean;

  toggleDevTools: () => void;
  setFixedTimeOfDay: (t: number | null) => void;
  toggleFastMining: () => void;
}

export const useDevStore = create<DevState>((set) => ({
  devToolsOpen: false,
  fixedTimeOfDay: null,
  fastMining: false,

  toggleDevTools: () => set((s) => ({ devToolsOpen: !s.devToolsOpen })),
  setFixedTimeOfDay: (t) => set({ fixedTimeOfDay: t }),
  toggleFastMining: () => set((s) => ({ fastMining: !s.fastMining })),
}));
