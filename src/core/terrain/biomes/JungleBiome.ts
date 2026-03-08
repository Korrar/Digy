import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class JungleBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'jungle',
    name: 'Dżungla',
    skyColor: '#6aaa5a',
    fogColor: '#4a8a4a',
    fogDensity: 0.02,
    ambientLight: 0.5,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 11, 5, 0.025);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.DIRT : BlockType.WATER);
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

        // Giant jungle trees (taller, wider)
        if (this.shouldPlaceTree(wx, wz) && height > 7 && mask > 0.35) {
          this.placeJungleTree(chunk, x, height + 1, z);
        }
        // Bamboo clusters
        else if (this.shouldPlaceBamboo(wx, wz) && height > WATER_LEVEL + 1 && mask > 0.3) {
          const bambooH = 3 + Math.floor(Math.abs(this.noise.get2D(wx * 6, wz * 6, 1)) * 4);
          for (let by = 1; by <= bambooH; by++) {
            chunk.setBlock(x, height + by, z, BlockType.BAMBOO);
          }
        }
        // Dense vegetation
        else if (height > WATER_LEVEL + 1 && mask > 0.25) {
          const vegNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.35);
          if (vegNoise > 0.2) {
            chunk.setBlock(x, height + 1, z, BlockType.FERN);
          } else if (vegNoise > 0.05) {
            chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
          } else if (vegNoise < -0.3) {
            const fn = this.noise.get2D(wx * 4.1, wz * 4.1, 0.7);
            chunk.setBlock(x, height + 1, z, fn > 0 ? BlockType.FLOWER_ORCHID : BlockType.FLOWER_BLUE);
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.13);
    return v > 0.42 && this.noise.get2D(wx * 3.5, wz * 3.5, 0.5) > 0.15;
  }

  private shouldPlaceBamboo(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx * 1.5 + 100, wz * 1.5 + 100, 0.18);
    return v > 0.55;
  }

  private placeJungleTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 6 + Math.floor(this.noise.get2D(x * 7, z * 7, 1) * 3);

    // Trunk
    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.JUNGLE_WOOD);
    }

    // Vines on trunk sides
    if (x > 0) {
      for (let vy = 1; vy < trunkHeight - 1; vy++) {
        if (this.noise.get2D((x - 1) * 5, (y + vy) * 5, 0.5) > 0.2) {
          chunk.setBlock(x - 1, y + vy, z, BlockType.VINE);
        }
      }
    }
    if (x < CHUNK_SIZE - 1) {
      for (let vy = 1; vy < trunkHeight - 1; vy++) {
        if (this.noise.get2D((x + 1) * 5, (y + vy) * 5, 0.5) > 0.2) {
          chunk.setBlock(x + 1, y + vy, z, BlockType.VINE);
        }
      }
    }

    // Wide canopy
    const leafStart = y + trunkHeight - 2;
    for (let ly = 0; ly < 5; ly++) {
      const radius = ly < 4 ? 3 : 1;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 2) continue;
          if (Math.abs(lx) === radius && Math.abs(lz) === radius) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.JUNGLE_LEAVES);
        }
      }
    }
  }
}
