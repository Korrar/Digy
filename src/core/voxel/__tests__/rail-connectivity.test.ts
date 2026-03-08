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

describe('Rail shape computation - Minecraft rules', () => {
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

  it('2 adjacent neighbors (S+E), neither is line: curves SE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S - lone rail, not part of a line
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E - lone rail, not part of a line
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('2 adjacent neighbors (N+W), neither is line: curves NW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N - lone rail
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W - lone rail
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_nw');
  });

  it('3 neighbors (T-junction): south-east rule', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('3 neighbors without S or E: curves SW', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_sw');
  });

  it('4 neighbors: always curve SE', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_se');
  });

  it('powered rail: always straight, never curves', () => {
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

  it('RAIL_EW with 1 neighbor overrides stored orientation', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_EW);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });
});

describe('Rail line-extension priority', () => {
  it('NS line + lone E neighbor: extends NS (line wins over lone rail)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N neighbor
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // beyond N → makes N part of NS line
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E neighbor (lone, no continuation)
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('EW line + lone S neighbor: extends EW (line wins over lone rail)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E neighbor
    chunk.setBlock(7, 6, 5, BlockType.RAIL); // beyond E → makes E part of EW line
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S neighbor (lone)
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  it('NS line + lone W neighbor: extends NS', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S neighbor
    chunk.setBlock(5, 6, 7, BlockType.RAIL); // beyond S → NS line
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W neighbor (lone)
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('both neighbors are lines: camera hint (RAIL=NS) breaks tie', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // NS hint
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // beyond N → NS line
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(7, 6, 5, BlockType.RAIL); // beyond E → EW line
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('both neighbors are lines: camera hint (RAIL_EW) breaks tie', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL_EW); // EW hint
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // beyond N → NS line
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(7, 6, 5, BlockType.RAIL); // beyond E → EW line
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ew');
  });

  it('practical: rail next to curve and straight line, prefers the line', () => {
    // Straight NS line going north + curve_se to the east
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // rail under test
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N neighbor (part of NS line)
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // continuation of NS line
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E neighbor (start of a curve)
    chunk.setBlock(6, 6, 6, BlockType.RAIL); // S of E neighbor → E becomes curve_se
    // E neighbor is lone (no continuation beyond east), NS has a line → prefer NS
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('ns');
  });

  it('neither neighbor is a line: curves normally', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N (lone)
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E (lone)
    // Neither has a continuation → normal curve
    expect(computeRailShape(chunkGetter(chunk), 5, 6, 5)).toBe('curve_ne');
  });
});
