import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

/**
 * Tests verifying that each curve type connects the correct pair of edges
 * and that the arc bows in the correct direction (toward the interior,
 * away from the pivot corner).
 *
 * Coordinate system:
 *   - North = -Z (z=0 edge of block)
 *   - South = +Z (z=1 edge of block)
 *   - East  = +X (x=1 edge of block)
 *   - West  = -X (x=0 edge of block)
 */
describe('Curve direction - arc connects correct edges', () => {
  function setupCurve(
    neighbors: [number, number, number][]
  ) {
    const chunk = new ChunkData(0, 0);
    // Solid base
    for (let x = 2; x <= 8; x++) {
      for (let z = 2; z <= 8; z++) {
        chunk.setBlock(x, 5, z, BlockType.STONE);
      }
    }
    // Main rail at (5, 6, 5)
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    for (const [nx, ny, nz] of neighbors) {
      chunk.setBlock(nx, ny, nz, BlockType.RAIL);
    }
    return buildChunkMesh(chunk);
  }

  function getRailVertices(geometry: ReturnType<typeof buildChunkMesh>, blockX: number, blockZ: number) {
    const positions = geometry.attributes.position;
    const verts: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      // Metal rail height range (around 6.14)
      if (vx >= blockX - 0.1 && vx <= blockX + 1.1 &&
          vy >= 6.10 && vy <= 6.20 &&
          vz >= blockZ - 0.1 && vz <= blockZ + 1.1) {
        verts.push({ x: vx, y: vy, z: vz });
      }
    }
    return verts;
  }

  it('curve_ne: arc should have vertices near north edge AND east edge', () => {
    const geo = setupCurve([[5, 6, 4], [6, 6, 5]]); // north + east
    const verts = getRailVertices(geo, 5, 5);

    const nearNorth = verts.some(v => v.z < 5.15);
    const nearEast = verts.some(v => v.x > 5.85);
    const nearSouth = verts.some(v => v.z > 5.85);
    const nearWest = verts.some(v => v.x < 5.15);

    expect(nearNorth).toBe(true);
    expect(nearEast).toBe(true);
    // Should NOT have vertices near south or west edges (those are straight rail territory)
    expect(nearSouth).toBe(false);
    expect(nearWest).toBe(false);
  });

  it('curve_nw: arc should have vertices near north edge AND west edge', () => {
    const geo = setupCurve([[5, 6, 4], [4, 6, 5]]); // north + west
    const verts = getRailVertices(geo, 5, 5);

    const nearNorth = verts.some(v => v.z < 5.15);
    const nearWest = verts.some(v => v.x < 5.15);
    const nearSouth = verts.some(v => v.z > 5.85);
    const nearEast = verts.some(v => v.x > 5.85);

    expect(nearNorth).toBe(true);
    expect(nearWest).toBe(true);
    expect(nearSouth).toBe(false);
    expect(nearEast).toBe(false);
  });

  it('curve_se: arc should have vertices near south edge AND east edge', () => {
    const geo = setupCurve([[5, 6, 6], [6, 6, 5]]); // south + east
    const verts = getRailVertices(geo, 5, 5);

    const nearSouth = verts.some(v => v.z > 5.85);
    const nearEast = verts.some(v => v.x > 5.85);
    const nearNorth = verts.some(v => v.z < 5.15);
    const nearWest = verts.some(v => v.x < 5.15);

    expect(nearSouth).toBe(true);
    expect(nearEast).toBe(true);
    expect(nearNorth).toBe(false);
    expect(nearWest).toBe(false);
  });

  it('curve_sw: arc should have vertices near south edge AND west edge', () => {
    const geo = setupCurve([[5, 6, 6], [4, 6, 5]]); // south + west
    const verts = getRailVertices(geo, 5, 5);

    const nearSouth = verts.some(v => v.z > 5.85);
    const nearWest = verts.some(v => v.x < 5.15);
    const nearNorth = verts.some(v => v.z < 5.15);
    const nearEast = verts.some(v => v.x > 5.85);

    expect(nearSouth).toBe(true);
    expect(nearWest).toBe(true);
    expect(nearNorth).toBe(false);
    expect(nearEast).toBe(false);
  });
});

describe('Curve direction - arc bows toward correct interior', () => {
  function setupAndGetMidpoints(
    neighbors: [number, number, number][]
  ) {
    const chunk = new ChunkData(0, 0);
    for (let x = 2; x <= 8; x++) {
      for (let z = 2; z <= 8; z++) {
        chunk.setBlock(x, 5, z, BlockType.STONE);
      }
    }
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    for (const [nx, ny, nz] of neighbors) {
      chunk.setBlock(nx, ny, nz, BlockType.RAIL);
    }
    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Collect rail vertices (at rail height) within the block
    const verts: { x: number; z: number }[] = [];
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 5 && vx <= 6 && vy >= 6.10 && vy <= 6.20 && vz >= 5 && vz <= 6) {
        verts.push({ x: vx - 5, z: vz - 5 }); // local 0-1 coords
      }
    }
    return verts;
  }

  it('curve_ne: arc should bow toward SW (midpoint in SW quadrant of block)', () => {
    const verts = setupAndGetMidpoints([[5, 6, 4], [6, 6, 5]]);
    // The midpoint vertices (x ≈ 0.3-0.7, z ≈ 0.1-0.5) should be
    // in the area between north-edge and east-edge, bowing toward SW
    const midVerts = verts.filter(v => v.x > 0.3 && v.x < 0.8 && v.z > 0.1 && v.z < 0.5);
    expect(midVerts.length).toBeGreaterThan(0);
  });

  it('curve_nw: arc should bow toward SE (midpoint vertices present)', () => {
    const verts = setupAndGetMidpoints([[5, 6, 4], [4, 6, 5]]);
    const midVerts = verts.filter(v => v.x > 0.1 && v.x < 0.6 && v.z > 0.1 && v.z < 0.5);
    expect(midVerts.length).toBeGreaterThan(0);
  });

  it('curve_se: arc should bow toward NW (midpoint vertices present)', () => {
    const verts = setupAndGetMidpoints([[5, 6, 6], [6, 6, 5]]);
    const midVerts = verts.filter(v => v.x > 0.3 && v.x < 0.8 && v.z > 0.5 && v.z < 0.9);
    expect(midVerts.length).toBeGreaterThan(0);
  });

  it('curve_sw: arc should bow toward NE (midpoint vertices present)', () => {
    const verts = setupAndGetMidpoints([[5, 6, 6], [4, 6, 5]]);
    const midVerts = verts.filter(v => v.x > 0.1 && v.x < 0.6 && v.z > 0.5 && v.z < 0.9);
    expect(midVerts.length).toBeGreaterThan(0);
  });
});

describe('Curve continuity - rails align with adjacent straight rails', () => {
  it('curve_ne rail ends should align with NS rail at north and EW rail at east', () => {
    const chunk = new ChunkData(0, 0);
    for (let x = 2; x <= 8; x++) {
      for (let z = 2; z <= 8; z++) {
        chunk.setBlock(x, 5, z, BlockType.STONE);
      }
    }
    // NS rail going north
    chunk.setBlock(5, 6, 3, BlockType.RAIL);
    chunk.setBlock(5, 6, 4, BlockType.RAIL);
    // Curve at (5,6,5)
    chunk.setBlock(5, 6, 5, BlockType.RAIL);
    // EW rail going east
    chunk.setBlock(6, 6, 5, BlockType.RAIL);
    chunk.setBlock(7, 6, 5, BlockType.RAIL);

    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Check that curve has vertices at the junction with the NS rail (z ≈ 5.0)
    // and at the junction with the EW rail (x ≈ 6.0)
    let hasNorthJunction = false;
    let hasEastJunction = false;

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      // Rail height vertices of the curve block
      if (vy >= 6.10 && vy <= 6.20) {
        // North junction: vertices near z=5, x between 5 and 6
        if (vz >= 4.95 && vz <= 5.10 && vx >= 5.1 && vx <= 5.9) {
          hasNorthJunction = true;
        }
        // East junction: vertices near x=6, z between 5 and 6
        if (vx >= 5.90 && vx <= 6.10 && vz >= 5.1 && vz <= 5.9) {
          hasEastJunction = true;
        }
      }
    }

    expect(hasNorthJunction).toBe(true);
    expect(hasEastJunction).toBe(true);
  });
});
