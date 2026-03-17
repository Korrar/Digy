import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SubVoxelStore } from '../SubVoxelData';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../utils/constants';

describe('VoxelSystemOptimizations', () => {
  describe('SubVoxelStore integer keys', () => {
    it('should store and retrieve grids correctly with integer keys', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, -3);
      expect(store.hasGrid(5, 10, -3)).toBe(true);
      expect(store.hasGrid(5, 10, -4)).toBe(false);
      expect(store.getSubVoxel(5, 10, -3, 0, 0, 0)).toBe(1);
    });

    it('should handle negative coordinates', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(-100, 0, -200);
      expect(store.hasGrid(-100, 0, -200)).toBe(true);
      expect(store.countSolid(-100, 0, -200)).toBe(64);
    });

    it('should not collide keys for different coordinates', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(1, 2, 3);
      store.initializeBlock(3, 2, 1);
      store.removeSubVoxel(1, 2, 3, 0, 0, 0);
      expect(store.countSolid(1, 2, 3)).toBe(63);
      expect(store.countSolid(3, 2, 1)).toBe(64);
    });
  });

  describe('SubVoxelStore grid pool', () => {
    it('should recycle grids when blocks are destroyed', () => {
      const store = new SubVoxelStore();
      // Initialize and fully destroy a block
      store.initializeBlock(0, 0, 0);
      for (let sy = 0; sy < 4; sy++)
        for (let sz = 0; sz < 4; sz++)
          for (let sx = 0; sx < 4; sx++)
            store.setSubVoxel(0, 0, 0, sx, sy, sz, 0);

      expect(store.hasGrid(0, 0, 0)).toBe(false);

      // Allocating a new grid should reuse the pooled one
      store.initializeBlock(1, 1, 1);
      expect(store.hasGrid(1, 1, 1)).toBe(true);
      expect(store.countSolid(1, 1, 1)).toBe(64);
    });

    it('should recycle grids on clearBlock', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 5, 5);
      store.clearBlock(5, 5, 5);
      expect(store.hasGrid(5, 5, 5)).toBe(false);

      // New allocation should work correctly
      store.initializeBlock(6, 6, 6);
      expect(store.countSolid(6, 6, 6)).toBe(64);
    });
  });

  describe('Greedy meshing', () => {
    it('should produce fewer vertices than naive per-face rendering for uniform terrain', () => {
      const chunk = new ChunkData(0, 0);
      // Fill a flat layer of stone at y=0
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          chunk.setBlock(x, 0, z, BlockType.STONE);
        }
      }

      const geometry = buildChunkMesh(chunk);
      const posAttr = geometry.getAttribute('position');

      // Naive rendering: 16x16 blocks, each with top face visible = 256 faces × 4 verts = 1024
      // Plus bottom faces (256 × 4 = 1024) plus some side faces at edges
      // Greedy meshing for top face: 1 merged quad = 4 vertices
      // Greedy for bottom: 1 merged quad = 4 vertices
      // Side faces: 4 edges × 16 blocks × 4 verts = 256
      // Total greedy: much less than naive
      // The key assertion: vertex count should be significantly less than naive
      const naiveMinVertices = 256 * 4; // just top faces alone
      expect(posAttr.count).toBeLessThan(naiveMinVertices);
    });

    it('should correctly handle mixed block types without merging across types', () => {
      const chunk = new ChunkData(0, 0);
      // Checkerboard pattern: stone and dirt alternating
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const type = (x + z) % 2 === 0 ? BlockType.STONE : BlockType.DIRT;
          chunk.setBlock(x, 0, z, type);
        }
      }

      const geometry = buildChunkMesh(chunk);
      const posAttr = geometry.getAttribute('position');
      // Checkerboard can't be merged much, so vertex count should be close to naive
      // Each block has at least a top face (4 verts)
      expect(posAttr.count).toBeGreaterThan(100);
    });

    it('should produce valid geometry with correct normals', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(5, 5, 5, BlockType.STONE);

      const geometry = buildChunkMesh(chunk);
      const posAttr = geometry.getAttribute('position');
      const normAttr = geometry.getAttribute('normal');

      expect(posAttr.count).toBeGreaterThan(0);
      expect(normAttr.count).toBe(posAttr.count);

      // Check that all normals are unit vectors (axis-aligned)
      for (let i = 0; i < normAttr.count; i++) {
        const nx = normAttr.getX(i);
        const ny = normAttr.getY(i);
        const nz = normAttr.getZ(i);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(len).toBeCloseTo(1.0, 3);
      }
    });

    it('should still render special blocks (rails, torches) correctly', () => {
      const chunk = new ChunkData(0, 0);
      // Ground
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          chunk.setBlock(x, 0, z, BlockType.STONE);
        }
      }
      // Rail on top
      chunk.setBlock(5, 1, 5, BlockType.RAIL);

      const geometry = buildChunkMesh(chunk);
      const posAttr = geometry.getAttribute('position');
      // Should have geometry for both stone ground and rail
      expect(posAttr.count).toBeGreaterThan(10);
    });
  });

  describe('Chunk rebuild deduplication', () => {
    it('should rebuild chunk mesh correctly after block change', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(8, 5, 8, BlockType.STONE);
      const geom1 = buildChunkMesh(chunk);
      const count1 = geom1.getAttribute('position').count;
      expect(count1).toBeGreaterThan(0);

      // Add a different block type next to it to create more faces
      chunk.setBlock(9, 5, 8, BlockType.DIRT);
      const geom2 = buildChunkMesh(chunk);
      const count2 = geom2.getAttribute('position').count;

      // Two adjacent different-type blocks: more vertices than one block alone
      expect(count2).toBeGreaterThan(count1);
    });
  });
});
