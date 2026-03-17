import { describe, it, expect } from 'vitest';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { findDisconnectedFragments, checkBlockStability } from '../VoxelPhysics';

describe('VoxelPhysics', () => {
  describe('findDisconnectedFragments', () => {
    it('should return empty array for fully solid block', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      const fragments = findDisconnectedFragments(store, 0, 0, 0);
      expect(fragments).toHaveLength(0);
    });

    it('should return empty array for block with no grid', () => {
      const store = new SubVoxelStore();
      const fragments = findDisconnectedFragments(store, 0, 0, 0);
      expect(fragments).toHaveLength(0);
    });

    it('should detect a disconnected floating sub-voxel group', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove a horizontal slice at y=2 to disconnect top from bottom
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          store.setSubVoxel(0, 0, 0, sx, 2, sz, 0);
        }
      }

      const fragments = findDisconnectedFragments(store, 0, 0, 0);
      // Top layer (y=3) should be disconnected from bottom (y=0,1)
      expect(fragments.length).toBeGreaterThan(0);

      // Fragment should contain the top layer sub-voxels
      const topFragment = fragments[0];
      expect(topFragment.length).toBe(16); // 4x4 top layer
      // All should be at y=3
      for (const sv of topFragment) {
        expect(sv.sy).toBe(3);
      }
    });

    it('should not report fragments when all sub-voxels are connected', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove a single sub-voxel (doesn't disconnect anything)
      store.removeSubVoxel(0, 0, 0, 1, 1, 1);

      const fragments = findDisconnectedFragments(store, 0, 0, 0);
      expect(fragments).toHaveLength(0);
    });

    it('should detect multiple disconnected groups', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Create two isolated sub-voxels connected only at bottom
      // Remove everything except bottom layer and two separate columns
      for (let sy = 1; sy < SUB_VOXEL_RES; sy++) {
        for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
          for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
            store.setSubVoxel(0, 0, 0, sx, sy, sz, 0);
          }
        }
      }
      // Add two isolated sub-voxels at top (not connected to bottom)
      store.setSubVoxel(0, 0, 0, 0, 3, 0, 1);
      store.setSubVoxel(0, 0, 0, 3, 3, 3, 1);

      const fragments = findDisconnectedFragments(store, 0, 0, 0);
      // Two separate disconnected fragments
      expect(fragments.length).toBe(2);
    });
  });

  describe('checkBlockStability', () => {
    it('should return true for block with > 25% sub-voxels', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      // Remove 10 sub-voxels (84% remaining)
      for (let i = 0; i < 10; i++) {
        store.setSubVoxel(0, 0, 0, i % 4, Math.floor(i / 4) % 4, Math.floor(i / 16), 0);
      }

      expect(checkBlockStability(store, 0, 0, 0)).toBe(true);
    });

    it('should return false for block with <= 25% sub-voxels', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove 49 sub-voxels (23% remaining = 15 solid)
      let removed = 0;
      for (let sy = 0; sy < SUB_VOXEL_RES && removed < 49; sy++) {
        for (let sz = 0; sz < SUB_VOXEL_RES && removed < 49; sz++) {
          for (let sx = 0; sx < SUB_VOXEL_RES && removed < 49; sx++) {
            store.setSubVoxel(0, 0, 0, sx, sy, sz, 0);
            removed++;
          }
        }
      }

      expect(checkBlockStability(store, 0, 0, 0)).toBe(false);
    });

    it('should return true for block without grid (fully solid)', () => {
      const store = new SubVoxelStore();
      expect(checkBlockStability(store, 0, 0, 0)).toBe(true);
    });
  });
});
