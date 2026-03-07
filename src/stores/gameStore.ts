import { create } from 'zustand';
import type { BiomeType } from '../core/terrain/biomes';

export type GameScene = 'menu' | 'biome' | 'hideout';

interface GameState {
  scene: GameScene;
  currentBiome: BiomeType;
  biomeSeed: number;

  setScene: (scene: GameScene) => void;
  enterBiome: (biome: BiomeType) => void;
  enterHideout: () => void;
  returnToMenu: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  scene: 'menu',
  currentBiome: 'forest',
  biomeSeed: Math.floor(Math.random() * 10000),

  setScene: (scene) => set({ scene }),

  enterBiome: (biome) => set({
    scene: 'biome',
    currentBiome: biome,
    biomeSeed: Math.floor(Math.random() * 10000),
  }),

  enterHideout: () => set({ scene: 'hideout' }),

  returnToMenu: () => set({ scene: 'menu' }),
}));
