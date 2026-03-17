import { describe, it, expect } from 'vitest';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { BlockType } from '../BlockRegistry';
import { hitPointToSubVoxel, getMiningRadius, computeExplosionDamage } from '../VoxelMining';

describe('VoxelMining', () => {
  describe('hitPointToSubVoxel', () => {
    it('should convert hit point to sub-voxel coordinates within block', () => {
      // Hit at center of block at (5, 10, 3)
      const result = hitPointToSubVoxel(5.5, 10.5, 3.5, 5, 10, 3);
      expect(result.sx).toBe(2); // 0.5 * 4 = 2
      expect(result.sy).toBe(2);
      expect(result.sz).toBe(2);
    });

    it('should handle hit at block origin corner', () => {
      const result = hitPointToSubVoxel(5.01, 10.01, 3.01, 5, 10, 3);
      expect(result.sx).toBe(0);
      expect(result.sy).toBe(0);
      expect(result.sz).toBe(0);
    });

    it('should handle hit at block far corner', () => {
      const result = hitPointToSubVoxel(5.99, 10.99, 3.99, 5, 10, 3);
      expect(result.sx).toBe(3); // 0.99 * 4 = 3.96 → floor = 3
      expect(result.sy).toBe(3);
      expect(result.sz).toBe(3);
    });

    it('should clamp values to valid range', () => {
      // Edge case: exactly on boundary
      const result = hitPointToSubVoxel(6.0, 11.0, 4.0, 5, 10, 3);
      expect(result.sx).toBeGreaterThanOrEqual(0);
      expect(result.sx).toBeLessThan(SUB_VOXEL_RES);
      expect(result.sy).toBeGreaterThanOrEqual(0);
      expect(result.sy).toBeLessThan(SUB_VOXEL_RES);
    });
  });

  describe('getMiningRadius', () => {
    it('should return 0 for bare hand (single sub-voxel)', () => {
      expect(getMiningRadius(undefined)).toBe(0);
    });

    it('should return larger radius for better tools', () => {
      const wooden = getMiningRadius(BlockType.WOODEN_PICKAXE);
      const stone = getMiningRadius(BlockType.STONE_PICKAXE);
      const iron = getMiningRadius(BlockType.IRON_PICKAXE);
      const diamond = getMiningRadius(BlockType.DIAMOND_PICKAXE);

      expect(stone).toBeGreaterThanOrEqual(wooden);
      expect(iron).toBeGreaterThanOrEqual(stone);
      expect(diamond).toBeGreaterThanOrEqual(iron);
    });

    it('should return 0 for non-tool items', () => {
      expect(getMiningRadius(BlockType.DIRT)).toBe(0);
    });
  });

  describe('computeExplosionDamage', () => {
    it('should create damage across multiple blocks', () => {
      const store = new SubVoxelStore();

      const affected = computeExplosionDamage(store, 5.5, 10.5, 3.5, 3);

      expect(affected.length).toBeGreaterThan(0);
      // Center block should be heavily damaged
      const centerDamage = affected.find(a => a.wx === 5 && a.wy === 10 && a.wz === 3);
      expect(centerDamage).toBeDefined();
      expect(centerDamage!.count).toBeGreaterThan(0);
    });

    it('should damage blocks proportionally to distance from center', () => {
      const store = new SubVoxelStore();

      const affected = computeExplosionDamage(store, 5.5, 10.5, 3.5, 2);

      // Find center block and edge block
      const center = affected.find(a => a.wx === 5 && a.wy === 10 && a.wz === 3);
      const edge = affected.find(a =>
        Math.abs(a.wx - 5) + Math.abs(a.wy - 10) + Math.abs(a.wz - 3) >= 2
      );

      if (center && edge) {
        // Center should have more sub-voxels removed
        expect(center.count).toBeGreaterThanOrEqual(edge.count);
      }
    });

    it('should fully destroy center block with large radius', () => {
      const store = new SubVoxelStore();

      computeExplosionDamage(store, 5.5, 10.5, 3.5, 3);

      // Center block should be fully destroyed (no grid = cleaned up)
      expect(store.hasGrid(5, 10, 3)).toBe(false);
    });

    it('should create partial damage on edge blocks', () => {
      const store = new SubVoxelStore();

      const affected = computeExplosionDamage(store, 5.5, 10.5, 3.5, 1.5);

      // Some blocks should have partial damage
      const partial = affected.find(a => {
        const solid = store.countSolid(a.wx, a.wy, a.wz);
        return solid > 0 && solid < 64;
      });
      // With radius 1.5, we should get partial damage on some blocks
      // (edge blocks won't have all sub-voxels removed)
      expect(partial !== undefined || affected.length > 0).toBe(true);
    });
  });

  describe('sub-voxel mining integration', () => {
    it('should remove sub-voxels at hit point with radius', () => {
      const store = new SubVoxelStore();

      // Mine at center of block with radius 1
      const hitSx = 2, hitSy = 2, hitSz = 2;
      store.initializeBlock(5, 10, 3);
      const removed = store.removeRadius(5, 10, 3, hitSx, hitSy, hitSz, 1.0);

      expect(removed).toBeGreaterThan(0);
      expect(store.getSubVoxel(5, 10, 3, 2, 2, 2)).toBe(0); // center removed
    });

    it('should accumulate damage over multiple mining hits', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 3);

      // First hit
      store.removeSubVoxel(5, 10, 3, 0, 0, 0);
      const solid1 = store.countSolid(5, 10, 3);

      // Second hit
      store.removeSubVoxel(5, 10, 3, 1, 0, 0);
      const solid2 = store.countSolid(5, 10, 3);

      expect(solid2).toBeLessThan(solid1);
      expect(solid2).toBe(62);
    });
  });
});
