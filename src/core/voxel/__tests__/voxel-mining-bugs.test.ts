import { describe, it, expect } from 'vitest';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { BlockType } from '../BlockRegistry';
import { mineSubVoxels, supportsSubVoxels } from '../VoxelMining';
import { checkBlockStability } from '../VoxelPhysics';

describe('VoxelMining bug fixes', () => {
  describe('Bug: mining already-empty sub-voxels should not count as removed', () => {
    it('should return removed=0 when hitting an already-empty sub-voxel with bare hand', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 3);

      // First hit removes the sub-voxel
      const first = mineSubVoxels(store, 5, 10, 3, 5.1, 10.1, 3.1, undefined);
      expect(first.removed).toBe(1);

      // Second hit at the same position should NOT count as removed
      const second = mineSubVoxels(store, 5, 10, 3, 5.1, 10.1, 3.1, undefined);
      expect(second.removed).toBe(0);
    });

    it('should return removed=0 when radius mining hits only empty sub-voxels', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 3);

      // First radius hit
      const first = mineSubVoxels(store, 5, 10, 3, 5.1, 10.1, 3.1, BlockType.WOODEN_PICKAXE);
      expect(first.removed).toBeGreaterThan(0);

      // Second hit at same spot - most sub-voxels in radius already empty
      const second = mineSubVoxels(store, 5, 10, 3, 5.1, 10.1, 3.1, BlockType.WOODEN_PICKAXE);
      // Should remove 0 since all sub-voxels in that radius were already removed
      expect(second.removed).toBe(0);
    });
  });

  describe('Bug: stability collapse should clean up grid efficiently', () => {
    it('should clear sub-voxel grid when block collapses from instability', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove 80% of sub-voxels to make unstable
      let removed = 0;
      for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
            if (removed >= 52) break; // keep 12/64 = 18.75% < 25%
            store.setSubVoxel(0, 0, 0, sx, sy, sz, 0);
            removed++;
          }
        }
      }

      expect(checkBlockStability(store, 0, 0, 0)).toBe(false);

      // After clearing (simulating collapse), grid should be cleaned up
      store.clearBlock(0, 0, 0);
      expect(store.hasGrid(0, 0, 0)).toBe(false);
      expect(store.countSolid(0, 0, 0)).toBe(64); // no grid = fully solid (default)
    });
  });

  describe('Bug: sub-voxel block destruction should report correctly', () => {
    it('should correctly detect block destruction when last sub-voxels are mined with bare hand', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 3);

      // Remove all but one sub-voxel
      for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
            if (sx === 3 && sy === 3 && sz === 3) continue; // leave last one
            store.setSubVoxel(5, 10, 3, sx, sy, sz, 0);
          }
        }
      }

      expect(store.countSolid(5, 10, 3)).toBe(1);

      // Mine the last sub-voxel
      const result = mineSubVoxels(store, 5, 10, 3, 5.9, 10.9, 3.9, undefined);
      expect(result.blockDestroyed).toBe(true);
      expect(result.removed).toBe(1);
    });
  });

  describe('TNT edge damage should respect supportsSubVoxels', () => {
    it('should not support sub-voxels for special blocks', () => {
      // These blocks should NOT get sub-voxel damage from TNT edges
      expect(supportsSubVoxels(BlockType.RAIL)).toBe(false);
      expect(supportsSubVoxels(BlockType.TORCH)).toBe(false);
      expect(supportsSubVoxels(BlockType.LEVER)).toBe(false);
      expect(supportsSubVoxels(BlockType.CABLE)).toBe(false);
      expect(supportsSubVoxels(BlockType.TNT)).toBe(false);
      expect(supportsSubVoxels(BlockType.DOOR_OAK_BOTTOM)).toBe(false);
    });

    it('should support sub-voxels for terrain blocks', () => {
      expect(supportsSubVoxels(BlockType.STONE)).toBe(true);
      expect(supportsSubVoxels(BlockType.DIRT)).toBe(true);
      expect(supportsSubVoxels(BlockType.COBBLESTONE)).toBe(true);
    });
  });
});
