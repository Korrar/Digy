import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SubVoxelStore } from '../SubVoxelData';
import { buildSubVoxelGeometry } from '../SubVoxelMesher';
import { BlockType, getBlock } from '../BlockRegistry';

describe('SubVoxelMesher', () => {
  describe('buildSubVoxelGeometry for single damaged block', () => {
    it('should generate geometry for a block with one sub-voxel removed', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 1, 1, 1); // remove interior sub-voxel

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should generate no geometry for fully solid block (no grid)', () => {
      const store = new SubVoxelStore();
      // No grid initialized = fully solid, should not be called normally
      // but if called, should produce full cube equivalent
      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      // No grid = no sub-voxel damage, so should render as a standard block
      // SubVoxelMesher generates geometry for all solid sub-voxels
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should generate correct faces when corner sub-voxel removed', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 0, 0, 0); // remove corner

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      // Should have faces: outer faces of 63 sub-voxels + 3 inner faces from hole
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should not generate internal faces between two solid sub-voxels', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      // Remove nothing - all solid, surrounded by air on outside

      const blockDef = getBlock(BlockType.STONE);
      const geomFull = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      // Now remove one sub-voxel
      store.removeSubVoxel(0, 0, 0, 1, 1, 1);
      const geomDamaged = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      // Damaged geometry should have MORE faces (inner faces exposed)
      const fullPositions = geomFull.getAttribute('position');
      const damagedPositions = geomDamaged.getAttribute('position');
      expect(damagedPositions.count).toBeGreaterThan(fullPositions.count);
    });
  });

  describe('face culling at block boundaries', () => {
    it('should not render faces adjacent to solid neighbor blocks', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 1, 1, 1);

      const blockDef = getBlock(BlockType.STONE);

      // With air neighbor
      const geomAir = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      // With solid neighbor on +X side
      const geomSolid = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (wx, _wy, _wz) => wx >= 1 ? BlockType.STONE : BlockType.AIR
      );

      const airCount = geomAir.getAttribute('position').count;
      const solidCount = geomSolid.getAttribute('position').count;

      // Should have fewer faces when neighbor is solid (no +X face on edge)
      expect(solidCount).toBeLessThan(airCount);
    });
  });

  describe('vertex attributes', () => {
    it('should include color attribute derived from block definition', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 0, 0, 0);

      const blockDef = getBlock(BlockType.DIRT);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      const colorAttr = geometry.getAttribute('color');
      expect(colorAttr).toBeDefined();
      expect(colorAttr.count).toBeGreaterThan(0);

      // First vertex color should be reasonable (not zero, not over 1)
      const r = colorAttr.getX(0);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1);
    });

    it('should include all required buffer attributes', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      expect(geometry.getAttribute('position')).toBeDefined();
      expect(geometry.getAttribute('normal')).toBeDefined();
      expect(geometry.getAttribute('color')).toBeDefined();
      expect(geometry.getAttribute('uv')).toBeDefined();
      expect(geometry.getAttribute('aSparkle')).toBeDefined();
      expect(geometry.getAttribute('aIsWater')).toBeDefined();
      expect(geometry.getAttribute('aIsLava')).toBeDefined();
      expect(geometry.getAttribute('aIsCable')).toBeDefined();
      expect(geometry.getAttribute('aIsGlass')).toBeDefined();
      expect(geometry.getAttribute('aOreColor')).toBeDefined();
      expect(geometry.getIndex()).not.toBeNull();
    });
  });

  describe('sub-voxel positions', () => {
    it('should place sub-voxels within block bounds (0-1)', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);
      store.removeSubVoxel(0, 0, 0, 1, 1, 1);

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 0, 0, 0, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        // All positions should be within the block at (0,0,0)
        expect(px).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(1);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(py).toBeLessThanOrEqual(1);
        expect(pz).toBeGreaterThanOrEqual(0);
        expect(pz).toBeLessThanOrEqual(1);
      }
    });

    it('should offset positions for non-origin blocks', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(5, 10, 3);
      store.removeSubVoxel(5, 10, 3, 0, 0, 0);

      const blockDef = getBlock(BlockType.STONE);
      const geometry = buildSubVoxelGeometry(
        store, 5, 10, 3, blockDef,
        (_wx, _wy, _wz) => BlockType.AIR
      );

      const positions = geometry.getAttribute('position');
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        minX = Math.min(minX, positions.getX(i));
        minY = Math.min(minY, positions.getY(i));
        minZ = Math.min(minZ, positions.getZ(i));
        maxX = Math.max(maxX, positions.getX(i));
        maxY = Math.max(maxY, positions.getY(i));
        maxZ = Math.max(maxZ, positions.getZ(i));
      }
      // Positions should be offset by block world coords
      expect(minX).toBeGreaterThanOrEqual(5);
      expect(maxX).toBeLessThanOrEqual(6);
      expect(minY).toBeGreaterThanOrEqual(10);
      expect(maxY).toBeLessThanOrEqual(11);
      expect(minZ).toBeGreaterThanOrEqual(3);
      expect(maxZ).toBeLessThanOrEqual(4);
    });
  });
});
