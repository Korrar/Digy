import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class MushroomBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'mushroom',
    name: 'Wyspa Grzybów',
    skyColor: '#9a7aaa',
    fogColor: '#8a6a9a',
    fogDensity: 0.015,
    ambientLight: 0.55,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const WATER_LEVEL = 3;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getIslandHeight(wx, wz, 10, 4, 0.02);

        if (height < WATER_LEVEL) {
          for (let y = 0; y <= WATER_LEVEL; y++) {
            chunk.setBlock(x, y, z, y <= height ? BlockType.DIRT : BlockType.WATER);
          }
          continue;
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            chunk.setBlock(x, y, z, BlockType.MYCELIUM);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        const mask = this.getIslandMask(wx, wz);

        // Giant mushrooms
        if (this.shouldPlaceGiantMushroom(wx, wz) && height > 6 && mask > 0.35) {
          const isRed = this.noise.get2D(wx * 3, wz * 3, 0.7) > 0;
          this.placeGiantMushroom(chunk, x, height + 1, z, isRed);
        }
        // Small mushrooms (very dense)
        else if (mask > 0.25 && height > WATER_LEVEL) {
          const vegNoise = this.noise.get2D(wx * 3.2, wz * 3.2, 0.3);
          if (vegNoise > 0.2) {
            chunk.setBlock(x, height + 1, z, BlockType.MUSHROOM);
          } else if (vegNoise < -0.35) {
            chunk.setBlock(x, height + 1, z, BlockType.FLOWER_RED);
          }
        }
      }
    }
  }

  private shouldPlaceGiantMushroom(wx: number, wz: number): boolean {
    const v = this.noise.get2D(wx, wz, 0.15);
    return v > 0.5 && this.noise.get2D(wx * 3.8, wz * 3.8, 0.55) > 0.25;
  }

  private placeGiantMushroom(chunk: ChunkData, x: number, y: number, z: number, isRed: boolean): void {
    const stemHeight = 4 + Math.floor(Math.abs(this.noise.get2D(x * 8, z * 8, 1)) * 3);
    const capBlock = isRed ? BlockType.MUSHROOM_BLOCK_RED : BlockType.MUSHROOM_BLOCK_BROWN;

    // Stem
    for (let sy = 0; sy < stemHeight; sy++) {
      chunk.setBlock(x, y + sy, z, BlockType.GIANT_MUSHROOM_STEM);
    }

    // Cap (wider for red, flatter for brown)
    const capTop = y + stemHeight;
    if (isRed) {
      // Dome cap
      for (let ly = 0; ly < 3; ly++) {
        const radius = ly < 2 ? 3 : 1;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (Math.abs(lx) === radius && Math.abs(lz) === radius && ly === 0) continue;
            chunk.setBlock(x + lx, capTop + ly, z + lz, capBlock);
          }
        }
      }
    } else {
      // Flat cap
      for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
          chunk.setBlock(x + lx, capTop, z + lz, capBlock);
        }
      }
    }
  }
}
