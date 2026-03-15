import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

/**
 * Village spans 5 chunks (radius=2): cx -2..2, world x -32..47.
 * Center at (8, 8) which is the middle of chunk (0,0).
 * VILLAGE_RADIUS = ~38 blocks from center to edge.
 */
const VILLAGE_CX = 8;
const VILLAGE_CZ = 8;
const VILLAGE_RADIUS = 38;
const WATER_LEVEL = 3;
const BASE_HEIGHT = 10;

export class VillageBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'village',
    name: 'Wioska',
    skyColor: '#90c8f0',
    fogColor: '#d4e8c4',
    fogDensity: 0.006,
    ambientLight: 0.7,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;

        // Distance from village center normalized to 0..1
        const cdx = (wx - VILLAGE_CX) / VILLAGE_RADIUS;
        const cdz = (wz - VILLAGE_CZ) / VILLAGE_RADIUS;
        const distFromCenter = Math.sqrt(cdx * cdx + cdz * cdz);

        // === RIVER ===
        // Winding river using sine wave, flows roughly NW to SE
        const riverCenter = VILLAGE_CX + Math.sin(wz * 0.08) * 10 + Math.sin(wz * 0.03 + 2) * 6;
        const riverDist = Math.abs(wx - riverCenter);
        const riverWidth = 2.5 + Math.sin(wz * 0.05) * 0.8;
        const isRiver = riverDist < riverWidth;
        const isRiverBank = riverDist < riverWidth + 1.5 && !isRiver;

        // === TERRAIN HEIGHT ===
        // Flat village center, gentle hills at edges
        const flatness = distFromCenter < 0.3 ? 0.0
          : distFromCenter < 0.55 ? (distFromCenter - 0.3) / 0.25
          : 1.0;

        const terrainNoise = this.noise.fbm2D(wx, wz, 4, 2, 0.5, 0.015);
        const amplitude = flatness * 4;
        const height = Math.floor(BASE_HEIGHT + terrainNoise * amplitude);

        // Edge falloff - terrain drops at world edges
        const edgeDist = distFromCenter > 0.85
          ? 1.0 - (distFromCenter - 0.85) / 0.15
          : 1.0;
        const finalHeight = edgeDist <= 0 ? WATER_LEVEL - 1
          : Math.floor(WATER_LEVEL + (height - WATER_LEVEL) * Math.max(0, edgeDist));

        // === RIVER CARVING ===
        if (isRiver && finalHeight >= WATER_LEVEL) {
          // River bed
          const riverDepth = WATER_LEVEL - 1;
          for (let y = 0; y <= WATER_LEVEL; y++) {
            if (y <= riverDepth) {
              chunk.setBlock(x, y, z, BlockType.SAND);
            } else {
              chunk.setBlock(x, y, z, BlockType.WATER);
            }
          }
          continue;
        }

        // === TERRAIN FILL ===
        if (finalHeight < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= finalHeight ? BlockType.SAND : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= finalHeight; y++) {
          if (y === finalHeight) {
            if (isRiverBank) {
              chunk.setBlock(x, y, z, BlockType.SAND);
            } else {
              chunk.setBlock(x, y, z, BlockType.GRASS);
            }
          } else if (y > finalHeight - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        if (isRiverBank) continue; // no vegetation on river banks

        // === DECORATION ZONES ===
        const inBounds = edgeDist > 0.3;
        if (!inBounds) continue;

        // VILLAGE CENTER - flat open area with paths and gardens
        if (distFromCenter < 0.3) {
          const pathNoise = this.noise.get2D(wx * 0.5, wz * 0.5, 0.3);
          const nearPathX = Math.abs(Math.sin(wx * 0.3)) < 0.12;
          const nearPathZ = Math.abs(Math.sin(wz * 0.3)) < 0.12;

          if ((nearPathX || nearPathZ) && pathNoise > -0.3) {
            chunk.setBlock(x, finalHeight, z, BlockType.GRAVEL);
          } else {
            const vegNoise = this.noise.get2D(wx * 3.1, wz * 3.1, 0.7);
            if (vegNoise > 0.55) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FLOWER_RED);
            } else if (vegNoise > 0.45) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FLOWER_YELLOW);
            } else if (vegNoise > 0.3) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
        // FOREST EDGES - dense trees
        else if (distFromCenter > 0.55) {
          if (this.shouldPlaceTree(wx, wz)) {
            this.placeTree(chunk, x, finalHeight + 1, z);
          } else {
            const vegNoise = this.noise.get2D(wx * 2.7, wz * 2.7, 0.3);
            if (vegNoise > 0.2) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            } else if (vegNoise > 0.05) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FERN);
            } else if (vegNoise < -0.4) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.MUSHROOM);
            }
          }
        }
        // TRANSITION - sparse trees, grass
        else {
          const treeNoise = this.noise.get2D(wx * 1.5, wz * 1.5, 0.2);
          if (treeNoise > 0.6) {
            this.placeTree(chunk, x, finalHeight + 1, z);
          } else {
            const grassNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.5);
            if (grassNoise > 0.3) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
      }
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.15);
    return v > 0.45 && this.noise.get2D(wx * 3.7, wz * 3.7, 0.5) > 0.15;
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
