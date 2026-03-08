import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isSolid } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

describe('Rail block properties', () => {
  it('RAIL should be transparent (not occlude neighbors)', () => {
    const def = getBlock(BlockType.RAIL);
    expect(def.transparent).toBe(true);
  });

  it('POWERED_RAIL should be transparent', () => {
    const def = getBlock(BlockType.POWERED_RAIL);
    expect(def.transparent).toBe(true);
  });

  it('RAIL should not be considered solid for placement checks', () => {
    // Rails should allow placing blocks on top of them / walking through them
    expect(isSolid(BlockType.RAIL)).toBe(false);
  });

  it('POWERED_RAIL should not be considered solid', () => {
    expect(isSolid(BlockType.POWERED_RAIL)).toBe(false);
  });

  it('RAIL should have isFlat property for thin rendering', () => {
    const def = getBlock(BlockType.RAIL);
    expect(def.isFlat).toBe(true);
  });

  it('POWERED_RAIL should have isFlat property', () => {
    const def = getBlock(BlockType.POWERED_RAIL);
    expect(def.isFlat).toBe(true);
  });
});

describe('Rail mesh generation', () => {
  it('should render rail as a thin flat shape, not a full cube', () => {
    const chunk = new ChunkData(0, 0);
    // Place a solid block with a rail on top
    chunk.setBlock(4, 5, 4, BlockType.STONE);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);

    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Collect all Y values for vertices that are in the rail block area (y between 6 and 7)
    const railYValues = new Set<number>();
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      // Vertices belonging to the rail block at (4, 6, 4)
      if (vx >= 4 && vx <= 5 && vy >= 6 && vy <= 7 && vz >= 4 && vz <= 5) {
        railYValues.add(Math.round(vy * 100) / 100);
      }
    }

    // Rail should NOT span from y=6 to y=7 (full cube height)
    // It should be flat - all vertices close to the bottom of the block (y≈6)
    const minY = Math.min(...railYValues);
    const maxY = Math.max(...railYValues);
    const height = maxY - minY;

    // A flat rail should be much thinner than 1.0 (full block height)
    expect(height).toBeLessThan(0.2);
    // But it should have some geometry (not zero)
    expect(railYValues.size).toBeGreaterThan(0);
  });

  it('should not render side faces for rail blocks', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(4, 5, 4, BlockType.STONE);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);

    const geometry = buildChunkMesh(chunk);
    const normals = geometry.attributes.normal;
    const positions = geometry.attributes.position;

    // Check normals of rail-only vertices (y > 6.0, excluding stone block top boundary)
    let sideNormalCount = 0;
    let railVertexCount = 0;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      // Only vertices strictly within rail block space (above y=6 baseline)
      if (vx >= 4 && vx <= 5 && vy > 6.0 && vy <= 7 && vz >= 4 && vz <= 5) {
        railVertexCount++;
        const ny = normals.getY(i);
        // Side normals have ny ≈ 0
        if (Math.abs(ny) < 0.1) {
          sideNormalCount++;
        }
      }
    }

    // Rail should have no full-height side faces - only top-facing normals
    expect(sideNormalCount).toBe(0);
    expect(railVertexCount).toBeGreaterThan(0);
  });
});
