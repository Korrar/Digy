import { BiomeBase, type BiomeType } from './BiomeBase';
import { ForestBiome } from './ForestBiome';
import { DesertBiome } from './DesertBiome';
import { CaveBiome } from './CaveBiome';
import { MountainBiome } from './MountainBiome';

export type { BiomeType, BiomeConfig } from './BiomeBase';

export function createBiome(type: BiomeType, seed: number = 42): BiomeBase {
  switch (type) {
    case 'forest': return new ForestBiome(seed);
    case 'desert': return new DesertBiome(seed);
    case 'cave': return new CaveBiome(seed);
    case 'mountains': return new MountainBiome(seed);
  }
}

export const BIOME_LIST: { type: BiomeType; name: string; emoji: string }[] = [
  { type: 'forest', name: 'Las', emoji: '🌲' },
  { type: 'desert', name: 'Pustynia', emoji: '🏜️' },
  { type: 'cave', name: 'Jaskinia', emoji: '🕳️' },
  { type: 'mountains', name: 'Góry', emoji: '⛰️' },
];
