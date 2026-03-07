import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class TundraBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'tundra',
    name: 'Tundra',
    skyColor: '#c0d0e0',
    fogColor: '#b8c8d8',
    fogDensity: 0.01,
    ambientLight: 0.65,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 8, 4, 0.02);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            if (y <= height) {
              chunk.setBlock(x, y, z, BlockType.GRAVEL);
            } else {
              chunk.setBlock(x, y, z, BlockType.ICE);
            }
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.SNOW);
          } else if (y > height - 2) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Ice patches
        if (mask > 0.3) {
          const icePatch = this.noise.get2D(wx, wz, 0.1);
          if (icePatch > 0.6 && height > WATER_LEVEL) {
            chunk.setBlock(x, height, z, BlockType.ICE);
          }
        }

        // Sparse dead bushes on tundra
        if (mask > 0.3 && height > WATER_LEVEL) {
          const bushNoise = this.noise.get2D(wx * 2.8, wz * 2.8, 0.4);
          if (bushNoise > 0.55) {
            chunk.setBlock(x, height + 1, z, BlockType.DEAD_BUSH);
          }
        }

        // Coal near surface
        for (let y = 2; y < Math.min(height - 1, 10); y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.STONE) continue;
          const coal = this.noise.get3D(wx * 2 + 50, y * 2, wz * 2 + 50, 0.2);
          if (coal > 0.65) {
            chunk.setBlock(x, y, z, BlockType.COAL_ORE);
          }
        }
      }
    }
  }
}
