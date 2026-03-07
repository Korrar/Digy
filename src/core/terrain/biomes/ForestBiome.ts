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

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getHeight(wx, wz, 12, 6, 0.025);

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.GRASS);
          } else if (y > height - 4) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        // Trees
        if (this.shouldPlaceTree(wx, wz) && height > 8) {
          this.placeTree(chunk, x, height + 1, z);
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

    // Trunk
    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.WOOD);
    }

    // Leaves (sphere-ish)
    const leafStart = y + trunkHeight - 1;
    for (let ly = 0; ly < 4; ly++) {
      const radius = ly < 3 ? 2 : 1;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 2) continue; // trunk space
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && ly === 0) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.LEAVES);
        }
      }
    }
  }
}
