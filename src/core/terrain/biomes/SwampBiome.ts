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
          // Shallow water with mud bottom
          for (let y = 0; y <= WATER_LEVEL; y++) {
            if (y <= height) {
              chunk.setBlock(x, y, z, BlockType.DIRT);
            } else {
              chunk.setBlock(x, y, z, BlockType.WATER);
            }
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.GRASS);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        // Dead trees (sparse, short)
        const mask = this.getIslandMask(wx, wz);
        if (mask > 0.3 && this.shouldPlaceTree(wx, wz) && height > WATER_LEVEL) {
          const treeH = 3 + Math.floor(Math.abs(this.noise.get2D(wx * 5, wz * 5, 1)) * 2);
          for (let ty = 1; ty <= treeH; ty++) {
            chunk.setBlock(x, height + ty, z, BlockType.WOOD);
          }
          // Sparse leaves only at top
          chunk.setBlock(x, height + treeH + 1, z, BlockType.LEAVES);
          if (x > 0) chunk.setBlock(x - 1, height + treeH, z, BlockType.LEAVES);
          if (x < CHUNK_SIZE - 1) chunk.setBlock(x + 1, height + treeH, z, BlockType.LEAVES);
          if (z > 0) chunk.setBlock(x, height + treeH, z - 1, BlockType.LEAVES);
          if (z < CHUNK_SIZE - 1) chunk.setBlock(x, height + treeH, z + 1, BlockType.LEAVES);
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.12);
    return v > 0.5 && this.noise.get2D(wx * 4.3, wz * 4.3, 0.6) > 0.3;
  }
}
