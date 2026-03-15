import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class VillageBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'village',
    name: 'Wioska',
    skyColor: '#90c8f0',
    fogColor: '#d4e8c4',
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
        const height = this.getIslandHeight(wx, wz, 10, 3, 0.015);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Paths between houses (gravel paths)
        if (mask > 0.3 && height > WATER_LEVEL + 1) {
          const pathNoise = this.noise.get2D(wx * 0.5, wz * 0.5, 0.3);
          const pathNoise2 = this.noise.get2D(wx * 0.3 + 100, wz * 0.3 + 100, 0.3);
          // Create cross-shaped path network
          const nearPathX = Math.abs(Math.sin(wx * 0.4)) < 0.15;
          const nearPathZ = Math.abs(Math.sin(wz * 0.4)) < 0.15;
          if ((nearPathX || nearPathZ) && pathNoise > -0.2) {
            chunk.setBlock(x, height, z, BlockType.GRAVEL);
          }
          // Small garden patches
          else if (pathNoise2 > 0.5 && mask > 0.5) {
            const vegNoise = this.noise.get2D(wx * 3.1, wz * 3.1, 0.7);
            if (vegNoise > 0.3) {
              chunk.setBlock(x, height + 1, z, BlockType.FLOWER_RED);
            } else if (vegNoise > 0.1) {
              chunk.setBlock(x, height + 1, z, BlockType.FLOWER_YELLOW);
            }
          }
          // Scattered trees (fewer than forest)
          else if (this.shouldPlaceTree(wx, wz) && mask > 0.5) {
            this.placeTree(chunk, x, height + 1, z);
          }
          // Occasional tall grass
          else if (pathNoise > 0.2 && mask > 0.4) {
            const grassNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.5);
            if (grassNoise > 0.3) {
              chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.1);
    return v > 0.7;
  }

  private placeTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 3 + Math.floor(this.noise.get2D(x * 5, z * 5, 1) * 2);

    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.WOOD);
    }

    const leafStart = y + trunkHeight - 1;
    for (let ly = 0; ly < 3; ly++) {
      const radius = ly < 2 ? 2 : 1;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 1) continue;
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && ly === 0) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.LEAVES);
        }
      }
    }
  }
}
