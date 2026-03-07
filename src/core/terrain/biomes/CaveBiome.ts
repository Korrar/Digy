import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../utils/constants';

export class CaveBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'cave',
    name: 'Jaskinia',
    skyColor: '#1a1a2e',
    fogColor: '#2a2a3e',
    fogDensity: 0.03,
    ambientLight: 0.3,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    // Fill with stone within island mask, then carve caves
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const mask = this.getIslandMask(wx, wz);
        if (mask <= 0) continue;

        const maxHeight = Math.floor(Math.min(CHUNK_HEIGHT, 22) * mask);
        for (let y = 0; y < maxHeight; y++) {
          chunk.setBlock(x, y, z, BlockType.STONE);
        }
      }
    }

    // Carve caves using 3D noise
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const mask = this.getIslandMask(wx, wz);
        if (mask <= 0) continue;

        for (let y = 1; y < 21; y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.STONE) continue;
          const cave = this.noise.get3D(wx, y, wz, 0.08);
          const cave2 = this.noise.get3D(wx, y, wz, 0.15);
          if (cave > 0.2 && cave2 > -0.1) {
            chunk.setBlock(x, y, z, BlockType.AIR);
          }
        }
      }
    }

    // Ore generation
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        for (let y = 1; y < 20; y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.STONE) continue;

          const coal = this.noise.get3D(wx * 2, y * 2, wz * 2, 0.2);
          if (coal > 0.6) {
            chunk.setBlock(x, y, z, BlockType.COAL_ORE);
            continue;
          }

          const iron = this.noise.get3D(wx * 3 + 100, y * 3, wz * 3 + 100, 0.18);
          if (iron > 0.7) {
            chunk.setBlock(x, y, z, BlockType.IRON_ORE);
          }
        }
      }
    }
  }
}
