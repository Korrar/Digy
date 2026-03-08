import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../utils/constants';

export class VolcanicBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'volcanic',
    name: 'Wulkan',
    skyColor: '#4a2020',
    fogColor: '#3a1a1a',
    fogDensity: 0.025,
    ambientLight: 0.4,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 14, 12, 0.025);
        const mask = this.getIslandMask(wx, wz);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.BASALT : BlockType.LAVA);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            if (height > 20) {
              chunk.setBlock(x, y, z, BlockType.OBSIDIAN);
            } else if (height > 15) {
              chunk.setBlock(x, y, z, BlockType.BASALT);
            } else {
              chunk.setBlock(x, y, z, BlockType.STONE);
            }
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.BASALT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        // Volcano crater - lava pool at the peak center
        if (mask > 0.85 && height > 22) {
          // Crater: dig down and fill with lava
          for (let y = Math.max(height - 3, 18); y <= height; y++) {
            chunk.setBlock(x, y, z, BlockType.LAVA);
          }
        }

        // Magma blocks scattered on slopes
        if (mask > 0.3 && height > 10 && height < 20) {
          const magmaNoise = this.noise.get2D(wx * 2, wz * 2, 0.3);
          if (magmaNoise > 0.6) {
            chunk.setBlock(x, height, z, BlockType.MAGMA);
          }
        }

        // Lava streams
        if (height > 8 && height < 15 && mask > 0.4) {
          const lavaNoise = this.noise.get2D(wx * 4, wz * 4, 0.5);
          if (lavaNoise > 0.75) {
            chunk.setBlock(x, height, z, BlockType.LAVA);
          }
        }

        // Ores in basalt
        for (let y = 2; y < Math.min(height - 1, 16); y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.STONE) continue;
          const iron = this.noise.get3D(wx * 3 + 200, y * 3, wz * 3 + 200, 0.15);
          if (iron > 0.6) {
            chunk.setBlock(x, y, z, BlockType.IRON_ORE);
            continue;
          }
          if (y < 10) {
            const gold = this.noise.get3D(wx * 4 + 400, y * 4, wz * 4 + 400, 0.18);
            if (gold > 0.7) {
              chunk.setBlock(x, y, z, BlockType.GOLD_ORE);
              continue;
            }
          }
          if (y < 7) {
            const diamond = this.noise.get3D(wx * 5 + 600, y * 5, wz * 5 + 600, 0.22);
            if (diamond > 0.78) {
              chunk.setBlock(x, y, z, BlockType.DIAMOND_ORE);
            }
          }
        }

        // Dead bushes on lower slopes
        if (mask > 0.3 && height > WATER_LEVEL + 1 && height < 14) {
          const bushNoise = this.noise.get2D(wx * 3.5, wz * 3.5, 0.4);
          if (bushNoise > 0.6) {
            chunk.setBlock(x, height + 1, z, BlockType.DEAD_BUSH);
          }
        }
      }
    }
  }
}
