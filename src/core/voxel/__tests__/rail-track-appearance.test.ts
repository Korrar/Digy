import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

describe('Rail track appearance - cross ties', () => {
  function buildRailChunk() {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(4, 5, 4, BlockType.STONE);
    chunk.setBlock(4, 6, 4, BlockType.RAIL);
    return chunk;
  }

  it('should have more vertices than a simple flat quad (ties add geometry)', () => {
    const chunk = buildRailChunk();
    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Count vertices in rail block space
    let railVertexCount = 0;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 4 && vx <= 5 && vy >= 6 && vy <= 7 && vz >= 4 && vz <= 5) {
        railVertexCount++;
      }
    }

    // A plain flat quad would be 8 vertices (top+bottom).
    // With ties/rails detail, should have more.
    expect(railVertexCount).toBeGreaterThan(8);
  });

  it('should have some vertices raised above the base to form rail profiles', () => {
    const chunk = buildRailChunk();
    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    const railYValues = new Set<number>();
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 4 && vx <= 5 && vy >= 6 && vy <= 7 && vz >= 4 && vz <= 5) {
        railYValues.add(Math.round(vy * 100) / 100);
      }
    }

    // Rail should have at least 2 different Y levels (base ties + raised rails)
    expect(railYValues.size).toBeGreaterThanOrEqual(2);
  });

  it('should still be thin overall (not full block height)', () => {
    const chunk = buildRailChunk();
    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 4 && vx <= 5 && vy >= 6 && vy <= 7 && vz >= 4 && vz <= 5) {
        minY = Math.min(minY, vy);
        maxY = Math.max(maxY, vy);
      }
    }

    // Should still be less than 0.3 total height (thin but with some 3D)
    expect(maxY - minY).toBeLessThan(0.3);
    expect(maxY - minY).toBeGreaterThan(0.05);
  });
});
