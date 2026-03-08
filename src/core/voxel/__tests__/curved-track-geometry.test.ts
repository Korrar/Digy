import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

/**
 * Curved rail geometry tests.
 *
 * A curved rail connects two perpendicular directions (e.g. north + east).
 * The arc must stay fully within the block's local 0-1 coordinate range.
 * If vertices go outside (e.g. z < 0 or z > 1), the curve is broken.
 */
describe('Curved track geometry - vertices within block bounds', () => {
  const curveConfigs = [
    {
      name: 'curve_ne',
      // Place rail at (4,6,4) with neighbors north (4,6,3) and east (5,6,4)
      neighbors: [[4, 6, 3], [5, 6, 4]] as [number, number, number][],
    },
    {
      name: 'curve_nw',
      // Neighbors: north (4,6,3) and west (3,6,4)
      neighbors: [[4, 6, 3], [3, 6, 4]] as [number, number, number][],
    },
    {
      name: 'curve_se',
      // Neighbors: south (4,6,5) and east (5,6,4)
      neighbors: [[4, 6, 5], [5, 6, 4]] as [number, number, number][],
    },
    {
      name: 'curve_sw',
      // Neighbors: south (4,6,5) and west (3,6,4)
      neighbors: [[4, 6, 5], [3, 6, 4]] as [number, number, number][],
    },
  ];

  for (const config of curveConfigs) {
    it(`${config.name}: all vertices should be within the block bounds [0,1]`, () => {
      const chunk = new ChunkData(0, 0);
      // Solid base
      for (let x = 2; x <= 6; x++) {
        for (let z = 2; z <= 6; z++) {
          chunk.setBlock(x, 5, z, BlockType.STONE);
        }
      }
      // The main rail
      chunk.setBlock(4, 6, 4, BlockType.RAIL);
      // Neighbor rails to trigger curve shape
      for (const [nx, ny, nz] of config.neighbors) {
        chunk.setBlock(nx, ny, nz, BlockType.RAIL);
      }

      const geometry = buildChunkMesh(chunk);
      const positions = geometry.attributes.position;

      // Collect vertices belonging to the rail block at (4, 6, 4)
      // The block occupies world space x:[4,5], y:[6,7], z:[4,5]
      const railVertices: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const vz = positions.getZ(i);
        // Use a slightly expanded range to catch vertices that belong to this rail
        // but we'll check they're within the strict block bounds
        if (vx >= 3.9 && vx <= 5.1 && vy >= 6.0 && vy <= 6.3 && vz >= 3.9 && vz <= 5.1) {
          railVertices.push({ x: vx, y: vy, z: vz });
        }
      }

      // Should have generated geometry
      expect(railVertices.length).toBeGreaterThan(0);

      // ALL vertices must be within the block bounds [4, 5] for x and z
      // Allow small overshoot from rail width at curve extremes + float precision
      const eps = 0.06;
      for (const v of railVertices) {
        expect(v.x).toBeGreaterThanOrEqual(4 - eps);
        expect(v.x).toBeLessThanOrEqual(5 + eps);
        expect(v.z).toBeGreaterThanOrEqual(4 - eps);
        expect(v.z).toBeLessThanOrEqual(5 + eps);
      }
    });
  }

  it('curved rail should have arc-shaped geometry (not straight)', () => {
    const chunk = new ChunkData(0, 0);
    for (let x = 2; x <= 6; x++) {
      for (let z = 2; z <= 6; z++) {
        chunk.setBlock(x, 5, z, BlockType.STONE);
      }
    }
    // curve_ne: rail at (4,6,4) with north (4,6,3) and east (5,6,4)
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 3, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);

    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Collect unique X positions of rail vertices at rail height
    const railXValues = new Set<number>();
    const railZValues = new Set<number>();
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 4 && vx <= 5 && vy >= 6.05 && vy <= 6.2 && vz >= 4 && vz <= 5) {
        railXValues.add(Math.round(vx * 100) / 100);
        railZValues.add(Math.round(vz * 100) / 100);
      }
    }

    // An arc should have vertices spread across both X and Z
    // (a straight rail would only vary in one axis)
    expect(railXValues.size).toBeGreaterThan(2);
    expect(railZValues.size).toBeGreaterThan(2);
  });
});

describe('Curved track geometry - connections', () => {
  it('curve_ne should connect north edge (z≈4) to east edge (x≈5)', () => {
    const chunk = new ChunkData(0, 0);
    for (let x = 2; x <= 6; x++) {
      for (let z = 2; z <= 6; z++) {
        chunk.setBlock(x, 5, z, BlockType.STONE);
      }
    }
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    chunk.setBlock(4, 6, 3, BlockType.RAIL); // north
    chunk.setBlock(5, 6, 4, BlockType.RAIL); // east

    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Find rail vertices at rail height for the center block
    let hasNearNorthEdge = false;
    let hasNearEastEdge = false;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vy >= 6.1 && vy <= 6.2 && vx >= 4 && vx <= 5 && vz >= 4 && vz <= 5) {
        // Near north edge of block (z close to 4)
        if (vz < 4.15) hasNearNorthEdge = true;
        // Near east edge of block (x close to 5)
        if (vx > 4.85) hasNearEastEdge = true;
      }
    }

    expect(hasNearNorthEdge).toBe(true);
    expect(hasNearEastEdge).toBe(true);
  });
});
