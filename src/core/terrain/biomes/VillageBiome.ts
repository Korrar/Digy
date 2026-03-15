import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE, BIOME_PLATE_SIZE } from '../../../utils/constants';

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
    const BASE_HEIGHT = 10;
    const half = BIOME_PLATE_SIZE / 2;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;

        // Distance from center for zone determination
        const dx = (wx - half) / half;
        const dz = (wz - half) / half;
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);

        // Island mask for edges
        const mask = this.getIslandMask(wx, wz);
        if (mask <= 0) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, BlockType.WATER);
          }
          continue;
        }

        // Very flat center (village area), more terrain variation at edges (forest)
        // Center zone: distFromCenter < 0.4 -> almost no variation
        // Edge zone: distFromCenter > 0.6 -> forest-like variation
        const flatness = distFromCenter < 0.35 ? 0.0
          : distFromCenter < 0.6 ? (distFromCenter - 0.35) / 0.25
          : 1.0;

        const noise = this.noise.fbm2D(wx, wz, 4, 2, 0.5, 0.02);
        const amplitude = flatness * 4;
        const rawHeight = BASE_HEIGHT + noise * amplitude;
        const height = Math.floor(WATER_LEVEL + (rawHeight - WATER_LEVEL) * mask);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        // Terrain layers
        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, height <= WATER_LEVEL + 1 ? BlockType.SAND : BlockType.GRASS);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        if (height <= WATER_LEVEL + 1) continue;

        // === ZONE-BASED DECORATION ===

        // CENTER ZONE (village area) - paths, flowers, open space
        if (distFromCenter < 0.4) {
          const pathNoise = this.noise.get2D(wx * 0.5, wz * 0.5, 0.3);
          const nearPathX = Math.abs(Math.sin(wx * 0.4)) < 0.15;
          const nearPathZ = Math.abs(Math.sin(wz * 0.4)) < 0.15;

          if ((nearPathX || nearPathZ) && pathNoise > -0.2) {
            // Gravel paths
            chunk.setBlock(x, height, z, BlockType.GRAVEL);
          } else {
            // Sparse gardens
            const vegNoise = this.noise.get2D(wx * 3.1, wz * 3.1, 0.7);
            if (vegNoise > 0.55) {
              chunk.setBlock(x, height + 1, z, BlockType.FLOWER_RED);
            } else if (vegNoise > 0.45) {
              chunk.setBlock(x, height + 1, z, BlockType.FLOWER_YELLOW);
            } else if (vegNoise > 0.3) {
              chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
        // EDGE ZONE (forest) - trees, dense vegetation
        else if (distFromCenter > 0.5 && mask > 0.3) {
          if (this.shouldPlaceTree(wx, wz) && mask > 0.4) {
            this.placeTree(chunk, x, height + 1, z);
          } else {
            const vegNoise = this.noise.get2D(wx * 2.7, wz * 2.7, 0.3);
            if (vegNoise > 0.25) {
              chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
            } else if (vegNoise > 0.1) {
              chunk.setBlock(x, height + 1, z, BlockType.FERN);
            } else if (vegNoise < -0.35) {
              chunk.setBlock(x, height + 1, z, BlockType.MUSHROOM);
            }
          }
        }
        // TRANSITION ZONE - occasional trees, grass
        else if (mask > 0.3) {
          const treeNoise = this.noise.get2D(wx * 1.5, wz * 1.5, 0.2);
          if (treeNoise > 0.65 && mask > 0.5) {
            this.placeTree(chunk, x, height + 1, z);
          } else {
            const grassNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.5);
            if (grassNoise > 0.35) {
              chunk.setBlock(x, height + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.15);
    return v > 0.5 && this.noise.get2D(wx * 3.7, wz * 3.7, 0.5) > 0.2;
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
