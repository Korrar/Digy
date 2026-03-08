import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { computeRailShape, computeRailBlockType } from '../ChunkMesher';

/** Helper: create a getBlockAt function from a ChunkData instance */
function chunkGetter(chunk: ChunkData) {
  return (x: number, y: number, z: number): BlockType => {
    if (x >= 0 && x < 16 && y >= 0 && y < 64 && z >= 0 && z < 16) {
      return chunk.getBlock(x, y, z);
    }
    return BlockType.AIR;
  };
}

describe('computeRailShape - rendering (reads stored block types)', () => {
  // === 0 neighbors: stored block type determines orientation ===
  it('0 neighbors: RAIL defaults to NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('0 neighbors: RAIL_EW defaults to EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_EW);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  // === Stored curve types return their shape directly ===
  it('RAIL_CURVE_NE returns curve_ne regardless of neighbors', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_NE);
    // Even with south and west neighbors, stored curve wins
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_ne');
  });

  it('RAIL_CURVE_NW returns curve_nw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_NW);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_nw');
  });

  it('RAIL_CURVE_SE returns curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_SE);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('RAIL_CURVE_SW returns curve_sw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_SW);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_sw');
  });

  // === 1 neighbor: extend toward that neighbor ===
  it('1 neighbor to north: extends NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('1 neighbor to east: extends EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  // === 2 opposite neighbors: always straight ===
  it('2 opposite neighbors (N+S): straight NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('2 opposite neighbors (E+W): straight EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  // === 2 perpendicular neighbors: always curve ===
  it('2 perpendicular (N+E): curve_ne', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_ne');
  });

  it('2 perpendicular (S+W): curve_sw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_sw');
  });

  // === Straight RAIL with 3+ neighbors stays straight (N+S priority) ===
  it('straight RAIL with N+S+W neighbors: stays NS (stored as straight)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // stored as straight
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    // RAIL block with N+S → opposite → straight NS (curve should be stored explicitly)
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  // === Powered rails: always straight ===
  it('powered rail with perpendicular neighbors: stays straight NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.POWERED_RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('powered rail with E+W neighbors: orients EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.POWERED_RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  // === Stored type override ===
  it('RAIL_EW with 1 neighbor: neighbor wins over stored type', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_EW); // stored as EW
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // north neighbor
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  // === Non-rail blocks ===
  it('non-rail neighbors are ignored', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.STONE); // N is stone, not rail
    chunk.setBlock(6, 6, 5, BlockType.RAIL);  // E is rail
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  it('non-flat block returns null', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.STONE);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBeNull();
  });
});

describe('computeRailBlockType - placement decisions', () => {
  // === 0 neighbors: keep current type ===
  it('0 neighbors: RAIL stays RAIL', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL);
  });

  it('0 neighbors: RAIL_EW stays RAIL_EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_EW);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_EW);
  });

  // === 1 neighbor ===
  it('1 neighbor north: RAIL (NS)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL);
  });

  it('1 neighbor east: RAIL_EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_EW);
  });

  // === 2 perpendicular neighbors: curve block types ===
  it('2 perpendicular (N+E): RAIL_CURVE_NE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_NE);
  });

  it('2 perpendicular (S+W): RAIL_CURVE_SW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
  });

  it('2 perpendicular (N+W): RAIL_CURVE_NW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_NW);
  });

  it('2 perpendicular (S+E): RAIL_CURVE_SE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  // === 2 opposite: straight ===
  it('2 opposite (N+S): RAIL (NS)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL);
  });

  it('2 opposite (E+W): RAIL_EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_EW);
  });

  // === T-junction: smart 2nd-degree neighbor check ===
  it('T-junction N+S+E without diagonal: fallback curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  it('T-junction N+S+W without diagonal: fallback curve_sw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
  });

  // === T-junction S-curve: two adjacent T-junctions ===
  it('S-curve N+S+W: top=curve_nw, bottom=curve_sw', () => {
    // Layout:
    //   z=3:       NS(5,3)
    //   z=4:  EW(4,4)  RAIL(5,4)  ← should be curve_nw
    //   z=5:  EW(4,5)  RAIL(5,5)  ← should be curve_sw
    //   z=6:       NS(5,6)
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 4)).toBe(BlockType.RAIL_CURVE_NW);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
  });

  it('S-curve N+S+E: top=curve_ne, bottom=curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(6, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 4)).toBe(BlockType.RAIL_CURVE_NE);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  it('S-curve E+W+N: left=curve_nw, right=curve_ne', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(3, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);

    expect(computeRailBlockType(chunkGetter(chunk), 4, 6, 5)).toBe(BlockType.RAIL_CURVE_NW);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_NE);
  });

  it('S-curve E+W+S: left=curve_sw, right=curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(3, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 6, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);

    expect(computeRailBlockType(chunkGetter(chunk), 4, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  // === 4 neighbors: curve_se ===
  it('4 neighbors: RAIL_CURVE_SE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  // === Two adjacent loops scenario ===
  it('two adjacent loops: curves stored independently dont interfere', () => {
    // Loop 1:            Loop 2:
    // (4,4)→(5,4)        (6,4)→(7,4)
    //   ↑      ↓           ↑      ↓
    // (4,5)←(5,5)        (6,5)←(7,5)
    //
    // (5,4) and (6,4) are adjacent. With stored shapes they don't interfere.
    const chunk = new ChunkData(0, 0);
    // Loop 1
    chunk.setBlock(4, 6, 4, BlockType.RAIL_CURVE_SE);
    chunk.setBlock(5, 6, 4, BlockType.RAIL_CURVE_SW);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_NW);
    chunk.setBlock(4, 6, 5, BlockType.RAIL_CURVE_NE);
    // Loop 2
    chunk.setBlock(6, 6, 4, BlockType.RAIL_CURVE_SE);
    chunk.setBlock(7, 6, 4, BlockType.RAIL_CURVE_SW);
    chunk.setBlock(7, 6, 5, BlockType.RAIL_CURVE_NW);
    chunk.setBlock(6, 6, 5, BlockType.RAIL_CURVE_NE);

    // Each curve keeps its stored shape even though (5,4) and (6,4) are adjacent
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 4)).toBe('curve_sw');
    expect(computeRailShape(chunkGetter(chunk), 6, 6, 4)).toBe('curve_se');
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_nw');
    expect(computeRailShape(chunkGetter(chunk), 6, 6, 5)).toBe('curve_ne');
  });

  // === Powered rails: always straight ===
  it('powered rail stays POWERED_RAIL regardless of neighbors', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.POWERED_RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.POWERED_RAIL);
  });

  // === Practical: straight line stays straight ===
  it('straight line: middle rail stays straight despite extra nearby rails', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    chunk.setBlock(5, 6, 7, BlockType.RAIL);
    // (5,6,5) has N+S → opposite → RAIL (NS)
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL);
  });
});
