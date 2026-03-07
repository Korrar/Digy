import { ChunkData } from '../../voxel/ChunkData';
import { NoiseGenerator } from '../NoiseGenerator';

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
}
