import { BiomeBase, type BiomeConfig } from './BiomeBase';
import { ChunkData } from '../../voxel/ChunkData';
import { BlockType } from '../../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../../utils/constants';

export class MountainBiome extends BiomeBase {
  readonly config: BiomeConfig = {
    type: 'mountains',
    name: 'Góry',
    skyColor: '#a0c4e8',
    fogColor: '#d0dde8',
    fogDensity: 0.012,
    ambientLight: 0.7,
  };

  generate(chunk: ChunkData): void {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x;
        const wz = oz + z;
        const height = this.getHeight(wx, wz, 14, 14, 0.03);
        const snowLine = 22;

        for (let y = 0; y <= height; y++) {
          if (y >= snowLine) {
            chunk.setBlock(x, y, z, BlockType.SNOW);
          } else if (y === height && height < snowLine) {
            chunk.setBlock(x, y, z, BlockType.GRAVEL);
          } else if (y > height - 3) {
            chunk.setBlock(x, y, z, BlockType.DIRT);
          } else {
            chunk.setBlock(x, y, z, BlockType.STONE);
          }
        }

        // Iron ore in mountains
        for (let y = 2; y < Math.min(height - 2, 18); y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.STONE) continue;
          const iron = this.noise.get3D(wx * 3 + 200, y * 3, wz * 3 + 200, 0.15);
          if (iron > 0.65) {
            chunk.setBlock(x, y, z, BlockType.IRON_ORE);
          }
        }
      }
    }
  }
}
