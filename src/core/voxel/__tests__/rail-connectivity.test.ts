import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { computeRailShape } from '../ChunkMesher';

/** Helper: create a getBlockAt function from a ChunkData instance */
function chunkGetter(chunk: ChunkData) {
  return (x: number, y: number, z: number): BlockType => {
    if (x >= 0 && x < 16 && y >= 0 && y < 64 && z >= 0 && z < 16) {
      return chunk.getBlock(x, y, z);
    }
    return BlockType.AIR;
  };
}

describe('Rail shape computation - pure Minecraft rules', () => {
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

  // === 1 neighbor: extend toward that neighbor ===
  it('1 neighbor to north: extends NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('1 neighbor to south: extends NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('1 neighbor to east: extends EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  it('1 neighbor to west: extends EW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(4, 6, 5, BlockType.RAIL);
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

  it('2 perpendicular (N+W): curve_nw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_nw');
  });

  it('2 perpendicular (S+E): curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('2 perpendicular (S+W): curve_sw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_sw');
  });

  // === 3 neighbors (T-junction): south-east priority ===
  it('T-junction N+S+E: curve_se (SE rule)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('T-junction N+S+W: curve_sw', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_sw');
  });

  it('T-junction N+E+W: curve_ne (SE rule - has E)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_ne');
  });

  it('T-junction S+E+W: curve_se (SE rule - has S+E)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  // === 4 neighbors: always curve_se ===
  it('4 neighbors: always curve_se', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
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

  // === Non-rail blocks are not neighbors ===
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

  // === Practical scenarios ===
  it('rail between two curves (E+W): straight EW connecting them', () => {
    // curve_se at west, curve_sw at east, rail between them
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W - part of a curve
    chunk.setBlock(4, 6, 6, BlockType.RAIL); // S of W - makes W a curve
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E - part of a curve
    chunk.setBlock(6, 6, 6, BlockType.RAIL); // S of E - makes E a curve
    // (5,6,5) has E+W neighbors → opposite → straight EW
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  it('rail between two curves (N+S): straight NS connecting them', () => {
    // curve at north, curve at south, rail between them
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N - part of a curve
    chunk.setBlock(6, 6, 4, BlockType.RAIL); // E of N - makes N a curve
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S - part of a curve
    chunk.setBlock(6, 6, 6, BlockType.RAIL); // E of S - makes S a curve
    // (5,6,5) has N+S neighbors → opposite → straight NS
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('straight line: middle rail stays straight despite nearby rails', () => {
    // Long NS line with a side rail
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // part of NS line
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N neighbor
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S neighbor
    chunk.setBlock(5, 6, 7, BlockType.RAIL); // part of NS line
    // (5,6,5) has N+S → opposite → NS, even if other rails exist nearby
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });
});
