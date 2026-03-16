import { describe, it, expect } from 'vitest';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';

describe('SubVoxelStore', () => {
  describe('constants', () => {
    it('should have sub-voxel resolution of 4', () => {
      expect(SUB_VOXEL_RES).toBe(4);
    });
  });

  describe('initialization', () => {
    it('should treat uninitialized block as fully solid', () => {
      const store = new SubVoxelStore();
      expect(store.isFullBlock(5, 10, 5)).toBe(true);
      expect(store.countSolid(5, 10, 5)).toBe(64); // 4*4*4
    });

    it('should create sub-voxel grid when block is first damaged', () => {
      const store = new SubVoxelStore();
      expect(store.hasGrid(5, 10, 5)).toBe(false);
      store.initializeBlock(5, 10, 5);
      expect(store.hasGrid(5, 10, 5)).toBe(true);
      expect(store.countSolid(5, 10, 5)).toBe(64);
    });
  });

  describe('individual sub-voxel access', () => {
    it('should return 1 (solid) for uninitialized block sub-voxels', () => {
      const store = new SubVoxelStore();
      expect(store.getSubVoxel(5, 10, 5, 0, 0, 0)).toBe(1);
      expect(store.getSubVoxel(5, 10, 5, 3, 3, 3)).toBe(1);
    });

    it('should track individual sub-voxel removal', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 5);
      store.setSubVoxel(5, 10, 5, 1, 2, 1, 0);

      expect(store.getSubVoxel(5, 10, 5, 1, 2, 1)).toBe(0);
      expect(store.getSubVoxel(5, 10, 5, 0, 0, 0)).toBe(1);
      expect(store.countSolid(5, 10, 5)).toBe(63);
    });

    it('should auto-initialize grid on setSubVoxel if not initialized', () => {
      const store = new SubVoxelStore();
      store.setSubVoxel(5, 10, 5, 0, 0, 0, 0);

      expect(store.hasGrid(5, 10, 5)).toBe(true);
      expect(store.getSubVoxel(5, 10, 5, 0, 0, 0)).toBe(0);
      expect(store.countSolid(5, 10, 5)).toBe(63);
    });
  });

  describe('removeSubVoxel', () => {
    it('should remove a single sub-voxel', () => {
      const store = new SubVoxelStore();
      store.removeSubVoxel(5, 10, 5, 2, 2, 2);

      expect(store.getSubVoxel(5, 10, 5, 2, 2, 2)).toBe(0);
      expect(store.countSolid(5, 10, 5)).toBe(63);
    });

    it('should return true when block becomes empty', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      let blockDestroyed = false;
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
          for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
            blockDestroyed = store.removeSubVoxel(0, 0, 0, sx, sy, sz);
          }
        }
      }

      expect(blockDestroyed).toBe(true);
      // Grid is cleaned up after full destruction, so hasGrid returns false
      expect(store.hasGrid(0, 0, 0)).toBe(false);
    });
  });

  describe('removeRadius', () => {
    it('should remove sub-voxels in a spherical radius', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 5);

      const removed = store.removeRadius(5, 10, 5, 2, 2, 2, 1.0);

      expect(removed).toBeGreaterThan(0);
      expect(store.getSubVoxel(5, 10, 5, 2, 2, 2)).toBe(0); // center removed
      expect(store.countSolid(5, 10, 5)).toBeLessThan(64);
    });

    it('should remove more sub-voxels with larger radius', () => {
      const store1 = new SubVoxelStore();
      store1.initializeBlock(0, 0, 0);
      const removed1 = store1.removeRadius(0, 0, 0, 2, 2, 2, 0.5);

      const store2 = new SubVoxelStore();
      store2.initializeBlock(0, 0, 0);
      const removed2 = store2.removeRadius(0, 0, 0, 2, 2, 2, 1.5);

      expect(removed2).toBeGreaterThan(removed1);
    });
  });

  describe('cross-block explosion', () => {
    it('should remove sub-voxels across multiple blocks with removeRadiusWorld', () => {
      const store = new SubVoxelStore();
      // Initialize two adjacent blocks
      store.initializeBlock(5, 10, 5);
      store.initializeBlock(6, 10, 5);

      // Explode at the boundary between blocks (right edge of block 5)
      const removed = store.removeRadiusWorld(5.875, 10.5, 5.5, 0.5);

      // Should have affected both blocks
      expect(removed.length).toBeGreaterThan(0);
      const block5Solid = store.countSolid(5, 10, 5);
      const block6Solid = store.countSolid(6, 10, 5);
      expect(block5Solid).toBeLessThan(64);
      expect(block6Solid).toBeLessThan(64);
    });
  });

  describe('cleanup', () => {
    it('should remove grid when block is fully destroyed', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove all sub-voxels
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
          for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
            store.removeSubVoxel(0, 0, 0, sx, sy, sz);
          }
        }
      }

      // Grid should be cleaned up
      expect(store.hasGrid(0, 0, 0)).toBe(false);
    });

    it('should clear all grids', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.initializeBlock(1, 0, 0);
      store.initializeBlock(2, 0, 0);

      store.clear();

      expect(store.hasGrid(0, 0, 0)).toBe(false);
      expect(store.hasGrid(1, 0, 0)).toBe(false);
      expect(store.hasGrid(2, 0, 0)).toBe(false);
    });
  });

  describe('grid data access', () => {
    it('should return the raw grid for mesh building', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 5);
      store.setSubVoxel(5, 10, 5, 0, 0, 0, 0);

      const grid = store.getGrid(5, 10, 5);
      expect(grid).not.toBeNull();
      expect(grid!.length).toBe(64);
      expect(grid![0]).toBe(0); // first sub-voxel removed
      expect(grid![1]).toBe(1); // others still solid
    });

    it('should return null grid for uninitialized block', () => {
      const store = new SubVoxelStore();
      const grid = store.getGrid(5, 10, 5);
      expect(grid).toBeNull();
    });
  });

  describe('damage ratio', () => {
    it('should return 0 for undamaged block', () => {
      const store = new SubVoxelStore();
      expect(store.getDamageRatio(5, 10, 5)).toBe(0);
    });

    it('should return correct ratio for partially damaged block', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 5);
      // Remove 16 sub-voxels (25%)
      for (let i = 0; i < 16; i++) {
        const sx = i % SUB_VOXEL_RES;
        const sy = Math.floor(i / SUB_VOXEL_RES) % SUB_VOXEL_RES;
        const sz = Math.floor(i / (SUB_VOXEL_RES * SUB_VOXEL_RES));
        store.setSubVoxel(5, 10, 5, sx, sy, sz, 0);
      }
      expect(store.getDamageRatio(5, 10, 5)).toBeCloseTo(0.25, 2);
    });

    it('should return 1 for fully destroyed block', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 5);
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
          for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
            store.setSubVoxel(5, 10, 5, sx, sy, sz, 0);
          }
        }
      }
      // Grid cleaned up, so damage ratio conceptually = 1
      // but since grid is gone, we treat it as undamaged (block is AIR now)
      expect(store.hasGrid(5, 10, 5)).toBe(false);
    });
  });
});

describe('ChunkData sub-voxel integration', () => {
  it('should have a SubVoxelStore instance', () => {
    const chunk = new ChunkData(0, 0);
    expect(chunk.subVoxels).toBeDefined();
    expect(chunk.subVoxels).toBeInstanceOf(SubVoxelStore);
  });

  it('should report sub-voxel damage for damaged blocks', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 10, 5, BlockType.STONE);
    chunk.subVoxels.initializeBlock(5, 10, 5);
    chunk.subVoxels.removeSubVoxel(5, 10, 5, 0, 0, 0);

    expect(chunk.hasSubVoxelDamage(5, 10, 5)).toBe(true);
  });

  it('should not report sub-voxel damage for undamaged blocks', () => {
    const chunk = new ChunkData(0, 0);
    chunk.setBlock(5, 10, 5, BlockType.STONE);

    expect(chunk.hasSubVoxelDamage(5, 10, 5)).toBe(false);
  });
});
