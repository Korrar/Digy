import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { computeRailShape } from '../ChunkMesher';

/**
 * Tests that rails only connect to neighbors whose shape actually faces toward them.
 * A curved rail only connects in 2 directions, so a rail on the unconnected side
 * should NOT count as a neighbor.
 */

describe('Rail connectivity - ignore non-connecting neighbors', () => {
  it('should be straight EW when curved neighbor to north does not connect south', () => {
    // Layout:
    //   E-N      N = curved rail (curve_ne connecting north+east)
    //     |      E = rail east of N
    //   W-C      C = our rail, W = rail west of C
    //
    // N's curve_ne connects north and east, NOT south.
    // So C should NOT connect to N, and should be straight EW.
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // C
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W

    // North neighbor at (5, 6, 4) which curves NE (has north and east neighbors)
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // north of N
    chunk.setBlock(6, 6, 4, BlockType.RAIL); // east of N (E)

    expect(computeRailShape(chunk, 5, 6, 5)).toBe('ew');
  });

  it('should be straight NS when curved neighbor to east does not connect west', () => {
    // Layout:
    //   C-E      E = curved rail (curve_ne connecting north+east)
    //   |  |     N = north neighbor of E
    //   S  N
    //
    // E's curve_ne connects north and east, NOT west.
    // So C should NOT connect to E, and should be straight NS.
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // C
    chunk.setBlock(5, 6, 6, BlockType.RAIL); // S (south of C)

    // East neighbor at (6, 6, 5) which curves NE (has north and east neighbors)
    chunk.setBlock(6, 6, 5, BlockType.RAIL); // E
    chunk.setBlock(6, 6, 4, BlockType.RAIL); // north of E
    chunk.setBlock(7, 6, 5, BlockType.RAIL); // east of E

    expect(computeRailShape(chunk, 5, 6, 5)).toBe('ns');
  });

  it('should connect to curved neighbor that DOES face toward it', () => {
    // W at (4,6,5) has neighbors south (4,6,6) and east (5,6,5=C)
    // W only has 1 other neighbor (south) excluding C, so it will orient toward C.
    // C's neighbors: north (N) and west (W) → curve_nw
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // C
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N (north of C)

    // West neighbor at (4, 6, 5) which has neighbor to south
    chunk.setBlock(4, 6, 5, BlockType.RAIL); // W
    chunk.setBlock(4, 6, 6, BlockType.RAIL); // south of W

    expect(computeRailShape(chunk, 5, 6, 5)).toBe('curve_nw');
  });

  it('straight rail neighbor always connects in its direction', () => {
    // Simple: two straight rails should connect
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 6, 5, BlockType.RAIL); // C
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // N
    chunk.setBlock(5, 6, 3, BlockType.RAIL); // further N (makes N stay straight NS)

    expect(computeRailShape(chunk, 5, 6, 5)).toBe('ns');
  });
});
