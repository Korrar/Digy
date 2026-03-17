import { create } from 'zustand';

export interface DestructionState {
  /** Total blocks destroyed in this biome session */
  blocksDestroyed: number;
  /** Total blocks placed */
  blocksPlaced: number;
  /** NPCs terrorized (hit by magic) */
  npcsTerrorized: number;
  /** Lightning strikes used */
  lightningStrikes: number;
  /** Floods triggered */
  floodsTriggered: number;
  /** NPCs petrified */
  npcsPetrified: number;
  /** Explosions caused */
  explosions: number;
  /** Wind blasts used */
  windBlasts: number;

  /** Computed destruction level 0-100% */
  getDestructionLevel: () => number;
  /** Computed destruction tier label */
  getDestructionTier: () => string;

  recordBlockDestroyed: () => void;
  recordBlockPlaced: () => void;
  recordNPCTerrorized: () => void;
  recordLightningStrike: () => void;
  recordFlood: () => void;
  recordPetrification: () => void;
  recordExplosion: () => void;
  recordWindBlast: () => void;
  resetDestruction: () => void;
}

export const useDestructionStore = create<DestructionState>((set, get) => ({
  blocksDestroyed: 0,
  blocksPlaced: 0,
  npcsTerrorized: 0,
  lightningStrikes: 0,
  floodsTriggered: 0,
  npcsPetrified: 0,
  explosions: 0,
  windBlasts: 0,

  getDestructionLevel: () => {
    const s = get();
    // Weighted score: blocks destroyed are the primary indicator
    const score =
      s.blocksDestroyed * 1 +
      s.lightningStrikes * 5 +
      s.floodsTriggered * 10 +
      s.npcsPetrified * 3 +
      s.explosions * 8 +
      s.windBlasts * 2 +
      s.npcsTerrorized * 2 -
      s.blocksPlaced * 0.5; // Building reduces destruction
    // Normalize: 0 at score 0, 100 at score 500+
    return Math.min(100, Math.max(0, Math.round(score / 5)));
  },

  getDestructionTier: () => {
    const level = get().getDestructionLevel();
    if (level === 0) return 'Rajska Harmonia';
    if (level < 15) return 'Spokojny Dzien';
    if (level < 30) return 'Drobne Zniszczenia';
    if (level < 50) return 'Gniew Bogow';
    if (level < 70) return 'Plaga Olimpu';
    if (level < 90) return 'Apokalipsa';
    return 'Zagłada Polis';
  },

  recordBlockDestroyed: () => set((s) => ({ blocksDestroyed: s.blocksDestroyed + 1 })),
  recordBlockPlaced: () => set((s) => ({ blocksPlaced: s.blocksPlaced + 1 })),
  recordNPCTerrorized: () => set((s) => ({ npcsTerrorized: s.npcsTerrorized + 1 })),
  recordLightningStrike: () => set((s) => ({ lightningStrikes: s.lightningStrikes + 1 })),
  recordFlood: () => set((s) => ({ floodsTriggered: s.floodsTriggered + 1 })),
  recordPetrification: () => set((s) => ({ npcsPetrified: s.npcsPetrified + 1 })),
  recordExplosion: () => set((s) => ({ explosions: s.explosions + 1 })),
  recordWindBlast: () => set((s) => ({ windBlasts: s.windBlasts + 1 })),
  resetDestruction: () => set({
    blocksDestroyed: 0, blocksPlaced: 0, npcsTerrorized: 0,
    lightningStrikes: 0, floodsTriggered: 0, npcsPetrified: 0,
    explosions: 0, windBlasts: 0,
  }),
}));
