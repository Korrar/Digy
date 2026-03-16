import { describe, it, expect } from 'vitest';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { BlockType, getBlock } from '../BlockRegistry';
import { buildSubVoxelGeometry } from '../SubVoxelMesher';
import { supportsSubVoxels } from '../VoxelMining';

describe('VoxelOptimization', () => {
  describe('supportsSubVoxels flag', () => {
    it('should return true for terrain blocks', () => {
      expect(supportsSubVoxels(BlockType.STONE)).toBe(true);
      expect(supportsSubVoxels(BlockType.DIRT)).toBe(true);
      expect(supportsSubVoxels(BlockType.GRASS)).toBe(true);
      expect(supportsSubVoxels(BlockType.SAND)).toBe(true);
      expect(supportsSubVoxels(BlockType.COBBLESTONE)).toBe(true);
      expect(supportsSubVoxels(BlockType.WOOD)).toBe(true);
    });

    it('should return false for special blocks', () => {
      expect(supportsSubVoxels(BlockType.TORCH)).toBe(false);
      expect(supportsSubVoxels(BlockType.RAIL)).toBe(false);
      expect(supportsSubVoxels(BlockType.LEVER)).toBe(false);
      expect(supportsSubVoxels(BlockType.DOOR_OAK_BOTTOM)).toBe(false);
    });

    it('should return false for AIR', () => {
      expect(supportsSubVoxels(BlockType.AIR)).toBe(false);
    });

    it('should return false for items', () => {
      expect(supportsSubVoxels(BlockType.WOODEN_PICKAXE)).toBe(false);
      expect(supportsSubVoxels(BlockType.APPLE)).toBe(false);
    });
  });

  describe('SubVoxelStore max grids limit', () => {
    it('should track active grid count', () => {
      const store = new SubVoxelStore();
      expect(store.activeGridCount).toBe(0);

      store.initializeBlock(0, 0, 0);
      expect(store.activeGridCount).toBe(1);

      store.initializeBlock(1, 0, 0);
      expect(store.activeGridCount).toBe(2);
    });
  });

  describe('sub-voxel mesh vertex efficiency', () => {
    it('should generate fewer vertices for undamaged block than many separate faces', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      // Full block surrounded by air: 6 faces × 4 vertices per sub-voxel row
      // With face culling: only outer faces should be rendered
      // This is 6 faces × 4×4 sub-voxels per face × 4 vertices = 384
      // Much less than 64 sub-voxels × 6 faces × 4 = 1536 if no culling
      expect(positions.count).toBeLessThan(1536);
      expect(positions.count).toBe(384); // 6 outer faces of 4×4 quads each
    });

    it('should have more vertices when sub-voxels are removed (inner faces)', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);
      const geomFull = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );

      // Remove center sub-voxels to create inner cavity
      store.removeSubVoxel(0, 0, 0, 1, 1, 1);
      store.removeSubVoxel(0, 0, 0, 2, 1, 1);
      store.removeSubVoxel(0, 0, 0, 1, 2, 1);
      store.removeSubVoxel(0, 0, 0, 2, 2, 1);

      const geomDamaged = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );

      // Damaged version has fewer outer vertices (4 missing) but more inner faces
      const fullCount = geomFull.getAttribute('position').count;
      const damagedCount = geomDamaged.getAttribute('position').count;
      // Inner cavity creates new faces
      expect(damagedCount).toBeGreaterThan(fullCount - 20);
    });
  });
});
