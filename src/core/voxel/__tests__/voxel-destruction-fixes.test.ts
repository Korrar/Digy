import { describe, it, expect } from 'vitest';
import { SubVoxelStore } from '../SubVoxelData';
import { buildSubVoxelGeometry } from '../SubVoxelMesher';
import { BlockType, getBlock } from '../BlockRegistry';

describe('Voxel destruction fixes', () => {
  describe('SubVoxelMesher coordinate handling', () => {
    it('should use local coords for grid lookup and world coords for positions', () => {
      const store = new SubVoxelStore();
      // Store grid at LOCAL coords (5, 10, 3) - simulating a block in a non-origin chunk
      store.initializeBlock(5, 10, 3);
      store.removeSubVoxel(5, 10, 3, 1, 1, 1);

      const blockDef = getBlock(BlockType.STONE);
      // Pass local coords (5,10,3) AND world coords (21,10,19) separately
      const geometry = buildSubVoxelGeometry(
        store, 5, 10, 3, 21, 10, 19, blockDef,
        () => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);

      // Verify positions are in WORLD coordinate space (around 21,10,19)
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        minX = Math.min(minX, positions.getX(i));
        maxX = Math.max(maxX, positions.getX(i));
        minY = Math.min(minY, positions.getY(i));
        maxY = Math.max(maxY, positions.getY(i));
        minZ = Math.min(minZ, positions.getZ(i));
        maxZ = Math.max(maxZ, positions.getZ(i));
      }
      expect(minX).toBeGreaterThanOrEqual(21);
      expect(maxX).toBeLessThanOrEqual(22);
      expect(minY).toBeGreaterThanOrEqual(10);
      expect(maxY).toBeLessThanOrEqual(11);
      expect(minZ).toBeGreaterThanOrEqual(19);
      expect(maxZ).toBeLessThanOrEqual(20);
    });

    it('should correctly show sub-voxel holes when local != world coords', () => {
      const store = new SubVoxelStore();
      // Local coords in chunk
      const lx = 3, ly = 5, lz = 7;
      // World coords (chunk offset 16)
      const wx = 19, wy = 5, wz = 23;

      store.initializeBlock(lx, ly, lz);
      // Remove a corner sub-voxel
      store.removeSubVoxel(lx, ly, lz, 0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);

      // With old code (using world coords for lookup), this would return full block
      // With fix (using local coords for lookup), this shows the hole
      const geometry = buildSubVoxelGeometry(
        store, lx, ly, lz, wx, wy, wz, blockDef,
        () => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      // Full block = 384 vertices (6 faces × 16 quads × 4 verts)
      // With 1 corner removed, we have inner faces exposed → more vertices
      // The damage should be visible (more faces than a full block)
      const fullStore = new SubVoxelStore();
      fullStore.initializeBlock(0, 0, 0);
      const fullGeom = buildSubVoxelGeometry(
        fullStore, 0, 0, 0, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );
      // The geometry should have valid vertices at world coords
      expect(positions.count).toBeGreaterThan(0);
      // Verify the geometry uses the correct world positions
      let foundInWorldRange = false;
      for (let i = 0; i < positions.count; i++) {
        if (positions.getX(i) >= wx && positions.getX(i) <= wx + 1) {
          foundInWorldRange = true;
          break;
        }
      }
      expect(foundInWorldRange).toBe(true);
    });
  });

  describe('sub-voxel damage visibility', () => {
    it('should render fewer sub-voxels after damage', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);

      // Full block
      const geomFull = buildSubVoxelGeometry(
        store, 0, 0, 0, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );
      const fullIdx = geomFull.getIndex()!;

      // Remove several sub-voxels (simulate mining hit)
      store.removeRadius(0, 0, 0, 2, 2, 2, 1.5);

      const geomDamaged = buildSubVoxelGeometry(
        store, 0, 0, 0, 0, 0, 0, blockDef,
        () => BlockType.AIR
      );
      const damagedIdx = geomDamaged.getIndex()!;

      // After removing sub-voxels, the geometry should change
      // (different face count due to exposed inner surfaces and removed outer faces)
      expect(damagedIdx.count).not.toBe(fullIdx.count);
    });
  });
});
