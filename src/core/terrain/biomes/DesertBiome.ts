import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class DesertBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'desert',
    name: 'Pustynia',
    skyColor: '#f0d080',
    fogColor: '#e8d5a0',
    fogDensity: 0.008,
    ambientLight: 0.8,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 10, 4, 0.015);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y > height - 4) {
            chunk.setBlock(x, y, z, BlockType.SAND);
          } else if (y > height - 8) {
            chunk.setBlock(x, y, z, BlockType.SANDSTONE);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Cacti
        if (this.shouldPlaceCactus(wx, wz) && height > 7 && mask > 0.4) {
          const cactusH = 2 + Math.floor(Math.abs(this.noise.get2D(wx * 5, wz * 5, 1)) * 2);
          for (let cy = 1; cy <= cactusH; cy++) {
            chunk.setBlock(x, height + cy, z, BlockType.CACTUS);
          }
        }
        // Dead bushes scattered on sand
        else if (mask > 0.3 && height > WATER_LEVEL) {
          const bushNoise = this.noise.get2D(wx * 3.3, wz * 3.3, 0.4);
          if (bushNoise > 0.55) {
            chunk.setBlock(x, height + 1, z, BlockType.DEAD_BUSH);
          }
        }
      }
    }
  }

  private shouldPlaceCactus(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.2);
    return v > 0.65;
  }
}
