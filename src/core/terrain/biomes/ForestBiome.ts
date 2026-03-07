import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class ForestBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'forest',
    name: 'Las',
    skyColor: '#87CEEB',
    fogColor: '#c8e6c9',
    fogDensity: 0.01,
    ambientLight: 0.6,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 12, 6, 0.025);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS);
          } else if (y > height - 4) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Trees
        if (this.shouldPlaceTree(wx, wz) && height > 8 && mask > 0.4) {
          this.placeTree(chunk, x, height + 1, z);
        }
        // Vegetation on grass
        else if (height > WATER_LEVEL + 1 && mask > 0.3) {
          const vegNoise = this.noise.get2D(wx * 2.7, wz * 2.7, 0.3);
          if (vegNoise > 0.3) {
            chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
          } else if (vegNoise > 0.15) {
            chunk.setBlock(x, height + 1, z, BlockType.FERN);
          } else if (vegNoise > 0.05) {
            const fn = this.noise.get2D(wx * 5.1, wz * 5.1, 0.8);
            chunk.setBlock(x, height + 1, z, fn > 0 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW);
          } else if (vegNoise < -0.4) {
            chunk.setBlock(x, height + 1, z, BlockType.MUSHROOM);
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.15);
    return v > 0.55 && this.noise.get2D(wx * 3.7, wz * 3.7, 0.5) > 0.2;
  }

  private placeTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 4 + Math.floor(this.noise.get2D(x * 7, z * 7, 1) * 2);

    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.WOOD);
    }

    const leafStart = y + trunkHeight - 1;
    for (let ly = 0; ly < 4; ly++) {
      const radius = ly < 3 ? 2 : 1;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 2) continue;
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && ly === 0) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.LEAVES);
        }
      }
    }
  }
}
