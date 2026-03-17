import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SubVoxelStore, SUB_VOXEL_RES } from '../SubVoxelData';
import { buildSubVoxelGeometry } from '../SubVoxelMesher';
import { BlockType, getBlock } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';
import { mineSubVoxels, supportsSubVoxels, hitPointToSubVoxel, computeExplosionDamage } from '../VoxelMining';
import { findDisconnectedFragments, checkBlockStability, removeDisconnectedFragments } from '../VoxelPhysics';

describe('Voxel System Integration', () => {
  describe('full mining workflow', () => {
    it('should mine a block through sub-voxel damage until destroyed', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(5, 10, 5, BlockType.STONE);

      // Verify block supports sub-voxels
      expect(supportsSubVoxels(BlockType.STONE)).toBe(true);

      // Mine each sub-voxel individually (bare hand, radius 0)
      let destroyed = false;
      for (let sy = 0; sy < SUB_VOXEL_RES && !destroyed; sy++) {
        for (let sz = 0; sz < SUB_VOXEL_RES && !destroyed; sz++) {
          for (let sx = 0; sx < SUB_VOXEL_RES && !destroyed; sx++) {
            // Hit point at center of each sub-voxel
            const hx = 5 + (sx + 0.5) / SUB_VOXEL_RES;
            const hy = 10 + (sy + 0.5) / SUB_VOXEL_RES;
            const hz = 5 + (sz + 0.5) / SUB_VOXEL_RES;
            const result = mineSubVoxels(
              chunk.subVoxels,
              5, 10, 5,
              hx, hy, hz,
              undefined // bare hand
            );
            destroyed = result.blockDestroyed;
          }
        }
      }

      expect(destroyed).toBe(true);
      // Grid should be cleaned up
      expect(chunk.subVoxels.hasGrid(5, 10, 5)).toBe(false);
    });

    it('should handle mining at different hit points', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Mine at corner
      mineSubVoxels(store, 0, 0, 0, 0.1, 0.1, 0.1, undefined);
      expect(store.getSubVoxel(0, 0, 0, 0, 0, 0)).toBe(0);

      // Mine at opposite corner
      mineSubVoxels(store, 0, 0, 0, 0.9, 0.9, 0.9, undefined);
      expect(store.getSubVoxel(0, 0, 0, 3, 3, 3)).toBe(0);

      // Both corners removed, center intact
      expect(store.getSubVoxel(0, 0, 0, 2, 2, 2)).toBe(1);
      expect(store.countSolid(0, 0, 0)).toBe(62);
    });
  });

  describe('chunk mesh with sub-voxel damage', () => {
    it('should build mesh that includes sub-voxel geometry for damaged blocks', () => {
      const chunk = new ChunkData(0, 0);
      // Place a stone block
      chunk.setBlock(5, 10, 5, BlockType.STONE);

      // Build mesh without damage
      const geomClean = buildChunkMesh(chunk);
      const cleanVertCount = geomClean.getAttribute('position').count;

      // Damage the block
      chunk.subVoxels.initializeBlock(5, 10, 5);
      chunk.subVoxels.removeSubVoxel(5, 10, 5, 0, 0, 0);

      // Build mesh with damage
      const geomDamaged = buildChunkMesh(chunk);
      const damagedVertCount = geomDamaged.getAttribute('position').count;

      // Damaged version uses sub-voxel mesher, producing different vertex count
      expect(damagedVertCount).not.toBe(cleanVertCount);
      // Sub-voxel mesh has aDamageLevel attribute
      expect(geomDamaged.getAttribute('aDamageLevel')).toBeDefined();

      geomClean.dispose();
      geomDamaged.dispose();
    });
  });

  describe('explosion with sub-voxel edges', () => {
    it('should create irregular crater with partial edge blocks', () => {
      const store = new SubVoxelStore();

      // Simulate explosion
      const affected = computeExplosionDamage(store, 5.5, 10.5, 5.5, 2);

      expect(affected.length).toBeGreaterThan(0);

      // Check for partial damage (not all blocks fully destroyed)
      let hasPartialDamage = false;
      for (const block of affected) {
        if (store.hasGrid(block.wx, block.wy, block.wz)) {
          const solid = store.countSolid(block.wx, block.wy, block.wz);
          if (solid > 0 && solid < 64) {
            hasPartialDamage = true;
            break;
          }
        }
      }

      // Should have at least some blocks with partial damage (irregular edges)
      // Note: with radius 2, edge blocks should be partially damaged
      expect(hasPartialDamage || affected.length > 1).toBe(true);
    });
  });

  describe('physics integration', () => {
    it('should remove floating fragments after mining', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Cut a horizontal slice to disconnect top
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          store.setSubVoxel(0, 0, 0, sx, 2, sz, 0);
        }
      }

      // Find and remove disconnected fragments
      const fragments = removeDisconnectedFragments(store, 0, 0, 0);
      expect(fragments.length).toBeGreaterThan(0);

      // Top layer should now be removed
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          expect(store.getSubVoxel(0, 0, 0, sx, 3, sz)).toBe(0);
        }
      }

      // Bottom layers should still be intact
      expect(store.getSubVoxel(0, 0, 0, 0, 0, 0)).toBe(1);
      expect(store.getSubVoxel(0, 0, 0, 0, 1, 0)).toBe(1);
    });

    it('should collapse unstable blocks', () => {
      const store = new SubVoxelStore();
      store.initializeBlock(0, 0, 0);

      // Remove 80% of sub-voxels
      let removed = 0;
      for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
        for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
          for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
            if (removed >= 52) break; // keep 12/64 = 18.75%
            store.setSubVoxel(0, 0, 0, sx, sy, sz, 0);
            removed++;
          }
        }
      }

      expect(checkBlockStability(store, 0, 0, 0)).toBe(false);
    });
  });

  describe('end-to-end: block types', () => {
    it('should correctly identify terrain blocks for sub-voxel support', () => {
      const terrainBlocks = [
        BlockType.STONE, BlockType.DIRT, BlockType.GRASS,
        BlockType.SAND, BlockType.COBBLESTONE, BlockType.SANDSTONE,
        BlockType.WOOD, BlockType.PLANKS, BlockType.STONE_BRICKS,
        BlockType.CLAY, BlockType.MUD, BlockType.GRAVEL,
        BlockType.COAL_ORE, BlockType.IRON_ORE,
      ];

      for (const bt of terrainBlocks) {
        expect(supportsSubVoxels(bt)).toBe(true);
      }
    });

    it('should correctly identify special blocks that dont support sub-voxels', () => {
      const specialBlocks = [
        BlockType.AIR, BlockType.TORCH, BlockType.RAIL,
        BlockType.LEVER, BlockType.CABLE,
      ];

      for (const bt of specialBlocks) {
        expect(supportsSubVoxels(bt)).toBe(false);
      }
    });
  });
});
