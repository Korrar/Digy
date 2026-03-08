import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isSolid } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

describe('Lamp block registration', () => {
  it('should have LAMP defined in BlockType enum', () => {
    expect(BlockType.LAMP).toBeDefined();
  });

  it('should have a name of "Lamp"', () => {
    const def = getBlock(BlockType.LAMP);
    expect(def.name).toBe('Lamp');
  });

  it('should emit light', () => {
    const def = getBlock(BlockType.LAMP);
    expect(def.emitsLight).toBe(true);
  });

  it('should be a solid block (not transparent)', () => {
    expect(isSolid(BlockType.LAMP)).toBe(true);
  });

  it('should have warm light color (yellowish)', () => {
    const def = getBlock(BlockType.LAMP);
    // Lamp should have a warm color
    expect(def.color.r).toBeGreaterThan(0.5);
  });

  it('should drop itself when mined', () => {
    const def = getBlock(BlockType.LAMP);
    expect(def.drops).toBe(BlockType.LAMP);
  });
});

describe('Lamp block rendering', () => {
  it('should render as a rectangular solid (full cube mesh)', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(4, 5, 4, BlockType.LAMP);

    const geometry = buildChunkMesh(chunk);
    const positions = geometry.attributes.position;

    // Count lamp vertices
    let lampVertexCount = 0;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      if (vx >= 4 && vx <= 5 && vy >= 5 && vy <= 6 && vz >= 4 && vz <= 5) {
        lampVertexCount++;
      }
    }

    // Should have cube geometry (6 faces * 4 vertices = 24)
    // But exposed faces only - with nothing around it, all 6 faces show
    expect(lampVertexCount).toBe(24);
  });
});
