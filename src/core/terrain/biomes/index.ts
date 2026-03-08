import { BiomeBase, type BiomeType } from './BiomeBase';
import { ForestBiome } from './ForestBiome';
import { DesertBiome } from './DesertBiome';
import { CaveBiome } from './CaveBiome';
import { MountainBiome } from './MountainBiome';
import { SwampBiome } from './SwampBiome';
import { TundraBiome } from './TundraBiome';
import { JungleBiome } from './JungleBiome';
import { MushroomBiome } from './MushroomBiome';
import { VolcanicBiome } from './VolcanicBiome';
import { SavannaBiome } from './SavannaBiome';
import { CherryBiome } from './CherryBiome';

export type { BiomeType, BiomeConfig } from './BiomeBase';

export function createBiome(type: BiomeType, seed: number = 42): BiomeBase {
  switch (type) {
    case 'forest': return new ForestBiome(seed);
    case 'desert': return new DesertBiome(seed);
    case 'cave': return new CaveBiome(seed);
    case 'mountains': return new MountainBiome(seed);
    case 'swamp': return new SwampBiome(seed);
    case 'tundra': return new TundraBiome(seed);
    case 'jungle': return new JungleBiome(seed);
    case 'mushroom': return new MushroomBiome(seed);
    case 'volcanic': return new VolcanicBiome(seed);
    case 'savanna': return new SavannaBiome(seed);
    case 'cherry': return new CherryBiome(seed);
  }
}

export const BIOME_LIST: { type: BiomeType; name: string; emoji: string }[] = [
  { type: 'forest', name: 'Las', emoji: '🌲' },
  { type: 'desert', name: 'Pustynia', emoji: '🏜️' },
  { type: 'cave', name: 'Jaskinia', emoji: '🕳️' },
  { type: 'mountains', name: 'Góry', emoji: '⛰️' },
  { type: 'swamp', name: 'Bagno', emoji: '🌿' },
  { type: 'tundra', name: 'Tundra', emoji: '🧊' },
  { type: 'jungle', name: 'Dżungla', emoji: '🌴' },
  { type: 'mushroom', name: 'Wyspa Grzybów', emoji: '🍄' },
  { type: 'volcanic', name: 'Wulkan', emoji: '🌋' },
  { type: 'savanna', name: 'Sawanna', emoji: '🦒' },
  { type: 'cherry', name: 'Wiśniowy Gaj', emoji: '🌸' },
];
