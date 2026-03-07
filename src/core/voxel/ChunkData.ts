import { BlockType } from './BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

export class ChunkData {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  private index(x: number, y: number, z: number): number {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.blocks[this.index(x, y, z)] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[this.index(x, y, z)] = type;
  }

  fill(type: BlockType): void {
    this.blocks.fill(type);
  }
}

export function worldToChunk(wx: number, wz: number): { cx: number; cz: number; lx: number; lz: number } {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { cx, cz, lx, lz };
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
