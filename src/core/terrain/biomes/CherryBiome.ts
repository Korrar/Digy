import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class CherryBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'cherry',
    name: 'Wiśniowy Gaj',
    skyColor: '#ffccdd',
    fogColor: '#ffbbcc',
    fogDensity: 0.008,
    ambientLight: 0.7,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 11, 5, 0.02);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.MOSS);
          } else if (y > height - 4) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Cherry blossom trees
        if (this.shouldPlaceTree(wx, wz) && height > 7 && mask > 0.35) {
          this.placeCherryTree(chunk, x, height + 1, z);
        }
        // Cherry petals on ground + flowers
        else if (height > WATER_LEVEL + 1 && mask > 0.25) {
          const vegNoise = this.noise.get2D(wx * 2.8, wz * 2.8, 0.3);
          if (vegNoise > 0.3) {
            chunk.setBlock(x, height + 1, z, BlockType.CHERRY_PETALS);
          } else if (vegNoise > 0.1) {
            chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
          } else if (vegNoise < -0.3) {
            const fn = this.noise.get2D(wx * 5.1, wz * 5.1, 0.8);
            chunk.setBlock(x, height + 1, z, fn > 0 ? BlockType.FLOWER_RED : BlockType.FLOWER_ORCHID);
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.14);
    return v > 0.48 && this.noise.get2D(wx * 3.7, wz * 3.7, 0.5) > 0.15;
  }

  private placeCherryTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 4 + Math.floor(this.noise.get2D(x * 7, z * 7, 1) * 2);

    // Cherry wood trunk
    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.CHERRY_WOOD);
    }

    // Round pink canopy
    const leafStart = y + trunkHeight - 1;
    for (let ly = 0; ly < 4; ly++) {
      const radius = ly < 3 ? 2 : 1;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 2) continue;
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && ly === 0) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.CHERRY_LEAVES);
        }
      }
    }
  }
}
