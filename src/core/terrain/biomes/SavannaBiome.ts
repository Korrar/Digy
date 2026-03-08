import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class SavannaBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'savanna',
    name: 'Sawanna',
    skyColor: '#e8c870',
    fogColor: '#d4b060',
    fogDensity: 0.008,
    ambientLight: 0.75,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 9, 3, 0.015);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.SAVANNA_GRASS);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Acacia trees (wide, flat canopy)
        if (this.shouldPlaceTree(wx, wz) && height > 6 && mask > 0.35) {
          this.placeAcaciaTree(chunk, x, height + 1, z);
        }
        // Tall dry grass
        else if (mask > 0.25 && height > WATER_LEVEL) {
          const vegNoise = this.noise.get2D(wx * 2.2, wz * 2.2, 0.3);
          if (vegNoise > 0.15) {
            chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
          } else if (vegNoise < -0.45) {
            chunk.setBlock(x, height + 1, z, BlockType.FLOWER_YELLOW);
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.2);
    return v > 0.65 && this.noise.get2D(wx * 4.2, wz * 4.2, 0.6) > 0.3;
  }

  private placeAcaciaTree(chunk: ChunkData, x: number, y: number, z: number): void {
    // Acacia: tall trunk, wide flat canopy offset to one side
    const trunkHeight = 5 + Math.floor(this.noise.get2D(x * 7, z * 7, 1) * 2);
    const offsetX = this.noise.get2D(x * 9, z * 9, 0.5) > 0 ? 1 : -1;
    const offsetZ = this.noise.get2D(x * 11, z * 11, 0.5) > 0 ? 1 : -1;

    // Trunk (slightly angled)
    for (let ty = 0; ty < trunkHeight; ty++) {
      const tx = ty >= trunkHeight - 2 ? offsetX : 0;
      chunk.setBlock(x + tx, y + ty, z, BlockType.ACACIA_WOOD);
    }

    // Flat canopy (wide, 1-2 blocks tall)
    const canopyCenter = y + trunkHeight;
    const cx = x + offsetX;
    for (let ly = 0; ly < 2; ly++) {
      const radius = ly === 0 ? 3 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (Math.abs(lx) === radius && Math.abs(lz) === radius) continue;
          chunk.setBlock(cx + lx, canopyCenter + ly, z + offsetZ + lz, BlockType.ACACIA_LEAVES);
        }
      }
    }
  }
}
