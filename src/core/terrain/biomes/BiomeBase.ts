import { ChunkData } from '../../voxel/ChunkData';
import { NoiseGenerator } from '../NoiseGenerator';
import { BIOME_PLATE_SIZE } from '../../../utils/constants';

export type BiomeType = 'forest' | 'desert' | 'cave' | 'mountains';

export interface BiomeConfig {
  type: BiomeType;
  name: string;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  ambientLight: number;
}

export abstract class BiomeBase {
  protected noise: NoiseGenerator;
  abstract readonly config: BiomeConfig;

  constructor(seed: number) {
    this.noise = new NoiseGenerator(seed);
  }

  abstract generate(chunk: ChunkData): void;

  protected getHeight(wx: number, wz: number, baseHeight: number, amplitude: number, scale: number = 0.02): number {
    const n = this.noise.fbm2D(wx, wz, 4, 2, 0.5, scale);
    return Math.floor(baseHeight + n * amplitude);
  }

  /**
   * Returns island falloff mask (0..1) for a world position.
   * 1.0 = center of island, 0.0 = edge/outside.
   * Island is centered at (BIOME_PLATE_SIZE/2, BIOME_PLATE_SIZE/2).
   */
  protected getIslandMask(wx: number, wz: number): number {
    const half = BIOME_PLATE_SIZE / 2;
    const cx = half;
    const cz = half;
    // Distance from center, normalized to 0..1
    const dx = (wx - cx) / half;
    const dz = (wz - cz) / half;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Smooth falloff: full height at center, drops off past 0.6 radius
    if (dist >= 1.0) return 0;
    if (dist <= 0.6) return 1.0;
    // Smooth hermite interpolation
    const t = (dist - 0.6) / 0.4;
    return 1.0 - t * t * (3 - 2 * t);
  }

  /**
   * Get height with island mask applied.
   * Outside the island, height goes to 0 (water level).
   */
  protected getIslandHeight(wx: number, wz: number, baseHeight: number, amplitude: number, scale: number = 0.02): number {
    const mask = this.getIslandMask(wx, wz);
    if (mask <= 0) return -1; // Below water, no land
    const n = this.noise.fbm2D(wx, wz, 4, 2, 0.5, scale);
    const rawHeight = baseHeight + n * amplitude;
    // Water level is at y=3, island minimum is water level
    const waterLevel = 3;
    return Math.floor(waterLevel + (rawHeight - waterLevel) * mask);
  }
}
