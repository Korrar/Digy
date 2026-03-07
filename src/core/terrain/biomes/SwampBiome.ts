import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class SwampBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'swamp',
    name: 'Bagno',
    skyColor: '#6b7b5a',
    fogColor: '#5a6b4a',
    fogDensity: 0.02,
    ambientLight: 0.5,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 5;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 6, 3, 0.03);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            if (y <= height) {
              chunk.setBlock(x, y, z, BlockType.MUD);
            } else {
              chunk.setBlock(x, y, z, BlockType.WATER);
            }
          }
          // Lily pads on water surface
          const lilyNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.5);
          if (lilyNoise > 0.35 && height >= WATER_LEVEL - 2) {
            chunk.setBlock(x, WATER_LEVEL + 1, z, BlockType.LILY_PAD);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.GRASS);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.MUD);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Dead trees
        if (mask > 0.3 && this.shouldPlaceTree(wx, wz) && height > WATER_LEVEL) {
          const treeH = 3 + Math.floor(Math.abs(this.noise.get2D(wx * 5, wz * 5, 1)) * 2);
          for (let ty = 1; ty <= treeH; ty++) {
            chunk.setBlock(x, height + ty, z, BlockType.WOOD);
          }
          chunk.setBlock(x, height + treeH + 1, z, BlockType.LEAVES);
          if (x > 0) chunk.setBlock(x - 1, height + treeH, z, BlockType.LEAVES);
          if (x < CHUNK_SIZE - 1) chunk.setBlock(x + 1, height + treeH, z, BlockType.LEAVES);
          if (z > 0) chunk.setBlock(x, height + treeH, z - 1, BlockType.LEAVES);
          if (z < CHUNK_SIZE - 1) chunk.setBlock(x, height + treeH, z + 1, BlockType.LEAVES);
        }
        // Swamp vegetation
        else if (mask > 0.2 && height > WATER_LEVEL) {
          const vegNoise = this.noise.get2D(wx * 2.9, wz * 2.9, 0.35);
          if (vegNoise > 0.35) {
            chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
          } else if (vegNoise > 0.2) {
            chunk.setBlock(x, height + 1, z, BlockType.MUSHROOM);
          } else if (vegNoise < -0.3) {
            chunk.setBlock(x, height + 1, z, BlockType.FERN);
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.12);
    return v > 0.5 && this.noise.get2D(wx * 4.3, wz * 4.3, 0.6) > 0.3;
  }
}
