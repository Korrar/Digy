import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

/**
 * Ancient Greek Village biome - "Polis"
 * Features: marble temple, agora (marketplace), amphitheater, olive groves,
 * columns, terracotta houses, mosaic paths, grape vineyards.
 */
const VILLAGE_CX = 8;
const VILLAGE_CZ = 8;
const VILLAGE_RADIUS = 38;
const WATER_LEVEL = 3;
const BASE_HEIGHT = 10;

export class VillageBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'village',
    name: 'Grecka Polis',
    skyColor: '#a0d8f8',
    fogColor: '#e8dcc0',
    fogDensity: 0.005,
    ambientLight: 0.75,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;

        const cdx = (wx - VILLAGE_CX) / VILLAGE_RADIUS;
        const cdz = (wz - VILLAGE_CZ) / VILLAGE_RADIUS;
        const distFromCenter = Math.sqrt(cdx * cdx + cdz * cdz);

        // === RIVER (Mediterranean stream) ===
        const riverCenter = VILLAGE_CX + Math.sin(wz * 0.06) * 8 + Math.sin(wz * 0.025 + 1.5) * 5;
        const riverDist = Math.abs(wx - riverCenter);
        const riverWidth = 2.0 + Math.sin(wz * 0.04) * 0.6;
        const isRiver = riverDist < riverWidth;
        const isRiverBank = riverDist < riverWidth + 1.5 && !isRiver;

        // === TERRAIN HEIGHT ===
        const flatness = distFromCenter < 0.3 ? 0.0
          : distFromCenter < 0.55 ? (distFromCenter - 0.3) / 0.25
          : 1.0;

        const terrainNoise = this.noise.fbm2D(wx, wz, 4, 2, 0.5, 0.015);
        const amplitude = flatness * 4;
        const height = Math.floor(BASE_HEIGHT + terrainNoise * amplitude);

        const edgeDist = distFromCenter > 0.85
          ? 1.0 - (distFromCenter - 0.85) / 0.15
          : 1.0;
        const finalHeight = edgeDist <= 0 ? WATER_LEVEL - 1
          : Math.floor(WATER_LEVEL + (height - WATER_LEVEL) * Math.max(0, edgeDist));

        // === RIVER CARVING ===
        if (isRiver && finalHeight >= WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= WATER_LEVEL - 1 ? BlockType.SAND : BlockType.WATER);
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
          } else if (y > finalHeight - 2) {
            chunk.setBlock(x, y, z, BlockType.LIMESTONE);
          } else if (y > finalHeight - 4) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        if (isRiverBank) continue;

        const inBounds = edgeDist > 0.3;
        if (!inBounds) continue;

        // === AGORA (central marketplace) ===
        if (distFromCenter < 0.15) {
          // Mosaic tile floor in center
          const pathNoise = this.noise.get2D(wx * 0.5, wz * 0.5, 0.3);
          const nearPathX = Math.abs(Math.sin(wx * 0.25)) < 0.10;
          const nearPathZ = Math.abs(Math.sin(wz * 0.25)) < 0.10;

          if ((nearPathX || nearPathZ) && pathNoise > -0.3) {
            chunk.setBlock(x, finalHeight, z, BlockType.MOSAIC_FLOOR);
          } else {
            // Agora cobblestones
            chunk.setBlock(x, finalHeight, z, BlockType.LIMESTONE);
            // Scatter amphorae and flowers
            const vegNoise = this.noise.get2D(wx * 4.1, wz * 4.1, 0.7);
            if (vegNoise > 0.6) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.AMPHORA);
            } else if (vegNoise > 0.5) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FLOWER_RED);
            }
          }
        }
        // === TEMPLE ZONE (north of center) ===
        else if (distFromCenter < 0.3) {
          const dx = wx - VILLAGE_CX;
          const dz = wz - VILLAGE_CZ;

          // Temple: north of center
          if (dz < -3 && dz > -12 && dx > -6 && dx < 6) {
            this.placeTempleBlock(chunk, x, finalHeight, z, dx, dz);
          }
          // Amphitheater: east of center (semicircle of steps)
          else if (dx > 4 && dx < 12) {
            const ampDist = Math.sqrt((dx - 8) * (dx - 8) + dz * dz);
            if (ampDist > 3 && ampDist < 7 && dx > 6) {
              // Stepped seating
              const stepLevel = Math.floor(ampDist - 3);
              for (let s = 0; s <= stepLevel; s++) {
                chunk.setBlock(x, finalHeight + s, z, BlockType.MARBLE);
              }
            } else if (ampDist <= 3) {
              // Stage floor
              chunk.setBlock(x, finalHeight, z, BlockType.MOSAIC_FLOOR);
            } else {
              // Paths around
              chunk.setBlock(x, finalHeight, z, BlockType.GRAVEL);
              const vegNoise = this.noise.get2D(wx * 2.5, wz * 2.5, 0.5);
              if (vegNoise > 0.4) {
                chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
              }
            }
          }
          // Gravel paths and gardens elsewhere in village center
          else {
            const pathNoise = this.noise.get2D(wx * 0.4, wz * 0.4, 0.25);
            if (pathNoise > 0.3) {
              chunk.setBlock(x, finalHeight, z, BlockType.GRAVEL);
            }
            const vegNoise = this.noise.get2D(wx * 3.1, wz * 3.1, 0.7);
            if (vegNoise > 0.55) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FLOWER_YELLOW);
            } else if (vegNoise > 0.4) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.GRAPE_VINE);
            } else if (vegNoise > 0.25) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
        // === OLIVE GROVES & VINEYARDS (transition zone) ===
        else if (distFromCenter < 0.55) {
          const treeNoise = this.noise.get2D(wx * 1.3, wz * 1.3, 0.18);
          if (treeNoise > 0.55) {
            this.placeOliveTree(chunk, x, finalHeight + 1, z);
          } else {
            const vineNoise = this.noise.get2D(wx * 2.0, wz * 2.0, 0.4);
            if (vineNoise > 0.4) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.GRAPE_VINE);
            } else if (vineNoise > 0.2) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            }
          }
        }
        // === FOREST EDGES (Mediterranean pines and oaks) ===
        else if (distFromCenter > 0.55) {
          if (this.shouldPlaceTree(wx, wz)) {
            // Mix of olive trees and regular trees
            if (this.noise.get2D(wx * 2.1, wz * 2.1, 0.8) > 0.3) {
              this.placeOliveTree(chunk, x, finalHeight + 1, z);
            } else {
              this.placeTree(chunk, x, finalHeight + 1, z);
            }
          } else {
            const vegNoise = this.noise.get2D(wx * 2.7, wz * 2.7, 0.3);
            if (vegNoise > 0.2) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.TALL_GRASS);
            } else if (vegNoise > 0.05) {
              chunk.setBlock(x, finalHeight + 1, z, BlockType.FERN);
            }
          }
        }
      }
    }
  }

  /** Place temple structure blocks based on relative position */
  private placeTempleBlock(chunk: ChunkData, x: number, h: number, z: number, dx: number, dz: number): void {
    // Floor
    chunk.setBlock(x, h, z, BlockType.MOSAIC_FLOOR);

    // Columns at edges (every 3 blocks)
    const isEdge = Math.abs(dx) >= 4 && Math.abs(dx) <= 5;
    const isColPos = (dz + 12) % 3 === 0;

    if (isEdge && isColPos) {
      // Column base
      chunk.setBlock(x, h, z, BlockType.COLUMN_BASE);
      // Column shaft
      for (let cy = 1; cy <= 4; cy++) {
        chunk.setBlock(x, h + cy, z, BlockType.MARBLE_COLUMN);
      }
      // Column capital
      chunk.setBlock(x, h + 5, z, BlockType.COLUMN_BASE);
    }

    // Front row of columns (dz == -4)
    if (dz === -4 && Math.abs(dx) <= 4 && dx % 2 === 0) {
      chunk.setBlock(x, h, z, BlockType.COLUMN_BASE);
      for (let cy = 1; cy <= 4; cy++) {
        chunk.setBlock(x, h + cy, z, BlockType.MARBLE_COLUMN);
      }
      chunk.setBlock(x, h + 5, z, BlockType.COLUMN_BASE);
    }

    // Roof (triangle pediment)
    if (dz >= -11 && dz <= -4) {
      const roofY = h + 6;
      chunk.setBlock(x, roofY, z, BlockType.COPPER_ROOF);

      // Triangular pediment at front
      if (dz === -4) {
        const pedimentH = Math.max(0, 3 - Math.abs(dx));
        for (let py = 1; py <= pedimentH; py++) {
          chunk.setBlock(x, roofY + py, z, BlockType.MARBLE);
        }
      }
    }

    // Inner sanctum walls (back of temple)
    if (dz <= -8 && dz >= -11 && (Math.abs(dx) === 3)) {
      for (let wy = 1; wy <= 4; wy++) {
        chunk.setBlock(x, h + wy, z, BlockType.MARBLE);
      }
    }

    // Back wall
    if (dz === -11 && Math.abs(dx) <= 3) {
      for (let wy = 1; wy <= 4; wy++) {
        chunk.setBlock(x, h + wy, z, BlockType.MARBLE);
      }
    }

    // Torch inside temple
    if (dz === -8 && dx === 0) {
      chunk.setBlock(x, h + 3, z, BlockType.TORCH);
    }
  }

  private shouldPlaceTree(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.15);
    return v > 0.45 && this.noise.get2D(wx * 3.7, wz * 3.7, 0.5) > 0.15;
  }

  /** Place an olive tree (gnarled trunk, wide silver-green canopy) */
  private placeOliveTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 3 + Math.floor(this.noise.get2D(x * 5, z * 5, 1) * 2);

    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.OLIVE_WOOD);
    }

    // Wide, spreading canopy
    const leafStart = y + trunkHeight - 1;
    for (let ly = 0; ly < 3; ly++) {
      const radius = ly < 2 ? 3 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly === 0) continue;
          if (Math.abs(lx) === radius && Math.abs(lz) === radius) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.OLIVE_LEAVES);
        }
      }
    }
  }

  /** Place a regular tree (cypress-like, tall and narrow) */
  private placeTree(chunk: ChunkData, x: number, y: number, z: number): void {
    const trunkHeight = 5 + Math.floor(this.noise.get2D(x * 7, z * 7, 1) * 2);

    for (let ty = 0; ty < trunkHeight; ty++) {
      chunk.setBlock(x, y + ty, z, BlockType.WOOD);
    }

    // Narrow cypress-like canopy
    const leafStart = y + 2;
    for (let ly = 0; ly < trunkHeight - 1; ly++) {
      const radius = ly < trunkHeight - 3 ? 1 : 0;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < 2) continue;
          chunk.setBlock(x + lx, leafStart + ly, z + lz, BlockType.LEAVES);
        }
      }
    }
    // Tip
    chunk.setBlock(x, y + trunkHeight, z, BlockType.LEAVES);
  }
}
