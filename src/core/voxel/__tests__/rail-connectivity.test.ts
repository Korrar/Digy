import { describe, it, expect } from 'vitest';
import { BlockType, isFlat } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { computeRailShape, computeRailBlockType, shouldRailUpdate, getRailConnections } from '../ChunkMesher';

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

  // === T-junction: Minecraft south-east rule (SE > SW > NE > NW) ===
  it('T-junction N+S+E: curve_se (south-east rule)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  it('T-junction N+S+W: curve_sw (south preferred over north)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
  });

  it('T-junction N+E+W: curve_ne (east preferred, north is only perpendicular)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_NE);
  });

  it('T-junction S+E+W: curve_se (south and east both preferred)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  // === S-curve behavior: depends on placement order ===
  // When computed statically (all blocks present), T-junctions follow the SE rule.
  // S-curves in Minecraft work because of placement ORDER + shouldRailUpdate preserving
  // existing connections. The static function always applies the SE rule.
  it('static T-junction N+S+W: both positions get curve_sw (SE rule)', () => {
    // Layout:
    //   z=3:       NS(5,3)
    //   z=4:  EW(4,4)  RAIL(5,4)  ← N+S+W → curve_sw (SE rule)
    //   z=5:  EW(4,5)  RAIL(5,5)  ← N+S+W → curve_sw (SE rule)
    //   z=6:       NS(5,6)
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    // Static computation: both T-junctions have N+S+W → SW wins per SE rule
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 4)).toBe(BlockType.RAIL_CURVE_SW);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);
  });

  it('static T-junction N+S+E: both positions get curve_se (SE rule)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(6, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 4)).toBe(BlockType.RAIL_CURVE_SE);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  it('static T-junction E+W+N: both positions get curve_ne (SE rule)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(3, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);

    // N+E+W T-junctions → NE wins per SE rule (no S available, E preferred)
    expect(computeRailBlockType(chunkGetter(chunk), 4, 6, 5)).toBe(BlockType.RAIL_CURVE_NE);
    expect(computeRailBlockType(chunkGetter(chunk), 5, 6, 5)).toBe(BlockType.RAIL_CURVE_NE);
  });

  it('static T-junction E+W+S: both positions get curve_se (SE rule)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(3, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 6, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);

    // S+E+W T-junctions → SE wins per SE rule
    expect(computeRailBlockType(chunkGetter(chunk), 4, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
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

describe('getRailConnections - returns connected directions', () => {
  it('RAIL connects N and S', () => {
    const conns = getRailConnections(BlockType.RAIL);
    expect(conns).toEqual([[0, -1], [0, 1]]);
  });

  it('RAIL_EW connects E and W', () => {
    const conns = getRailConnections(BlockType.RAIL_EW);
    expect(conns).toEqual([[1, 0], [-1, 0]]);
  });

  it('RAIL_CURVE_NE connects N and E', () => {
    const conns = getRailConnections(BlockType.RAIL_CURVE_NE);
    expect(conns).toEqual([[0, -1], [1, 0]]);
  });

  it('RAIL_CURVE_SW connects S and W', () => {
    const conns = getRailConnections(BlockType.RAIL_CURVE_SW);
    expect(conns).toEqual([[0, 1], [-1, 0]]);
  });
});

describe('shouldRailUpdate - Minecraft connection preservation', () => {
  it('rail with both connections valid should NOT update', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_NW); // connects N and W
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N neighbor
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W neighbor
    expect(shouldRailUpdate(chunkGetter(chunk), 5, 6, 5)).toBe(false);
  });

  it('rail with one broken connection should update', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_CURVE_NW); // connects N and W
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N neighbor exists
    // W neighbor is missing
    expect(shouldRailUpdate(chunkGetter(chunk), 5, 6, 5)).toBe(true);
  });

  it('rail with zero connections should update', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // connects N and S
    // No neighbors at all
    expect(shouldRailUpdate(chunkGetter(chunk), 5, 6, 5)).toBe(true);
  });

  it('straight NS rail between N and S rails should NOT update even with new E neighbor', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // NS - connects N and S
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E (new, but NS rail has both connections valid)
    expect(shouldRailUpdate(chunkGetter(chunk), 5, 6, 5)).toBe(false);
  });

  it('powered rail should never update', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.POWERED_RAIL);
    // No neighbors - but powered rails never update
    expect(shouldRailUpdate(chunkGetter(chunk), 5, 6, 5)).toBe(false);
  });
});

describe('Minecraft S-curve placement simulation', () => {
  /**
   * Helper: simulate placing a rail with Minecraft-style neighbor updates.
   * 1. Place the rail block
   * 2. Compute its type based on neighbors
   * 3. Update neighbors (only those with broken connections)
   */
  function placeRail(chunk: ChunkData, x: number, y: number, z: number) {
    const get = chunkGetter(chunk);
    chunk.setBlock(x, y, z, BlockType.RAIL);
    const correctType = computeRailBlockType(get, x, y, z);
    chunk.setBlock(x, y, z, correctType);

    // Update neighbors like Minecraft does
    const neighbors: [number, number, number][] = [
      [x, y, z - 1], [x, y, z + 1],
      [x + 1, y, z], [x - 1, y, z],
    ];
    for (const [nx, ny, nz] of neighbors) {
      if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16) {
        const nBlock = chunk.getBlock(nx, ny, nz);
        if (isFlat(nBlock) && nBlock !== BlockType.POWERED_RAIL) {
          if (shouldRailUpdate(get, nx, ny, nz)) {
            const newType = computeRailBlockType(get, nx, ny, nz);
            if (newType !== nBlock) {
              chunk.setBlock(nx, ny, nz, newType);
            }
          }
        }
      }
    }
  }

  it('S-curve west: place order creates NW then SW curves', () => {
    // Layout:
    //   z=3:       NS(5,3)
    //   z=4:  EW(4,4)  ←place 1st→(5,4) should be curve_nw
    //   z=5:  EW(4,5)  ←place 2nd→(5,5) should be curve_sw
    //   z=6:       NS(5,6)
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(4, 6, 4, BlockType.RAIL_EW);
    chunk.setBlock(4, 6, 5, BlockType.RAIL_EW);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    // Place first S-curve rail at (5,4): 2 neighbors N+W → curve_NW
    placeRail(chunk, 5, 6, 4);
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NW);

    // Place second S-curve rail at (5,5): has N(curve_NW), S(NS), W → 3 neighbors
    // But the SE rule gives curve_SW (south preferred) → connects S+W
    placeRail(chunk, 5, 6, 5);
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);

    // The first rail at (5,4) should NOT change (both N and W connections still valid)
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NW);
  });

  it('S-curve east: place order creates NE then SE curves', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(6, 6, 4, BlockType.RAIL_EW);
    chunk.setBlock(6, 6, 5, BlockType.RAIL_EW);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    placeRail(chunk, 5, 6, 4);
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NE);

    placeRail(chunk, 5, 6, 5);
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NE); // preserved!
  });

  it('user scenario: 2 NS rails with western branches, fill gap', () => {
    // The exact scenario from the bug report:
    // (5,3): NS rail
    // (4,4): EW rail (branch west from gap)
    // (5,4): empty ← place 1st
    // (5,5): empty ← place 2nd
    // (4,5): EW rail (branch west from gap)
    // (5,6): NS rail
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL);   // top NS rail
    chunk.setBlock(4, 6, 4, BlockType.RAIL_EW); // western branch top
    chunk.setBlock(4, 6, 5, BlockType.RAIL_EW); // western branch bottom
    chunk.setBlock(5, 6, 6, BlockType.RAIL);   // bottom NS rail

    // Place first rail: 2 neighbors (N + W) → curve_NW
    placeRail(chunk, 5, 6, 4);
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NW);

    // Place second rail: 3 neighbors (N=curve_NW, S=NS_rail, W=EW_rail)
    // SE rule for N+S+W → curve_SW (connects S + W)
    placeRail(chunk, 5, 6, 5);
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL_CURVE_SW);

    // First rail MUST NOT change (its N and W connections are still valid)
    expect(chunk.getBlock(5, 6, 4)).toBe(BlockType.RAIL_CURVE_NW);

    // Result: path goes (5,3)→(5,4) curves NW to (4,4)
    //         and (5,6)→(5,5) curves SW to (4,5)
    // Two separate branches, each properly formed
  });

  it('4-way intersection always curves SE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W

    placeRail(chunk, 5, 6, 5);
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL_CURVE_SE);
  });

  it('existing straight rail with 2 connections does not curve to new neighbor', () => {
    const chunk = new ChunkData(0, 0);
    // Straight NS line
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);

    // Place a rail to the east of the middle rail
    placeRail(chunk, 6, 6, 5);

    // The middle NS rail should NOT change to a curve
    // because both its connections (N and S) are still valid
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL);
  });

  it('isolated NS rail re-orients when E neighbor placed', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // isolated NS rail

    // Place a rail to the east
    placeRail(chunk, 6, 6, 5);

    // The isolated rail has 0 valid connections (N and S are empty)
    // so it should update to connect to the new east neighbor → becomes EW
    expect(chunk.getBlock(5, 6, 5)).toBe(BlockType.RAIL_EW);
  });
});
