/**
 * VoxelMining: utilities for sub-voxel based mining and explosions.
 * Converts world-space hit points to sub-voxel coordinates and provides
 * radius-based mining and explosion damage calculations.
 */

import { BlockType, getBlock, isToolPickaxe } from './BlockRegistry';
import { SubVoxelStore, SUB_VOXEL_RES } from './SubVoxelData';

/**
 * Check if a block type supports sub-voxel mining (terrain/building blocks only).
 * Special blocks (doors, rails, torches, etc.) are destroyed in whole.
 */
export function supportsSubVoxels(blockType: BlockType): boolean {
  if (blockType === BlockType.AIR) return false;
  const def = getBlock(blockType);
  if (def.isItem) return false;
  if (def.crossedQuad || def.isFlat || def.isSlab || def.isFence || def.stairDir ||
      def.isDoor || def.isChest || def.isTorch || def.isLever || def.isButton ||
      def.isCable || def.isPiston || def.isPistonHead || def.isSign ||
      def.isPressurePlate || def.isDetectorRail || def.isRepeater || def.isComparator ||
      def.isSpikeTrap || def.isArrowTrap || def.isSpawner || def.isTNT ||
      def.isLava || def.transparent) {
    return false;
  }
  return true;
}

/**
 * Convert a world-space hit point to sub-voxel coordinates within a block.
 */
export function hitPointToSubVoxel(
  hitX: number, hitY: number, hitZ: number,
  blockX: number, blockY: number, blockZ: number
): { sx: number; sy: number; sz: number } {
  const localX = hitX - blockX;
  const localY = hitY - blockY;
  const localZ = hitZ - blockZ;

  const sx = Math.max(0, Math.min(SUB_VOXEL_RES - 1, Math.floor(localX * SUB_VOXEL_RES)));
  const sy = Math.max(0, Math.min(SUB_VOXEL_RES - 1, Math.floor(localY * SUB_VOXEL_RES)));
  const sz = Math.max(0, Math.min(SUB_VOXEL_RES - 1, Math.floor(localZ * SUB_VOXEL_RES)));

  return { sx, sy, sz };
}

/**
 * Get mining radius in sub-voxel units based on equipped tool.
 * Returns 0 for bare hand (single sub-voxel removal).
 */
export function getMiningRadius(tool: BlockType | undefined): number {
  if (tool === undefined) return 0;

  if (!isToolPickaxe(tool)) return 0;

  const def = getBlock(tool);
  const speed = def.toolSpeed ?? 1;

  // Scale radius with tool speed:
  // wooden (speed 2) → 1, stone (speed 4) → 1, iron (speed 6) → 1.5, diamond (speed 8) → 2
  if (speed <= 2) return 1;
  if (speed <= 4) return 1;
  if (speed <= 6) return 1.5;
  return 2;
}

/**
 * Compute explosion damage across multiple blocks using sub-voxel granularity.
 * Returns array of affected blocks with count of removed sub-voxels.
 * Blocks near center are fully destroyed, edge blocks get partial damage.
 */
export function computeExplosionDamage(
  store: SubVoxelStore,
  centerX: number, centerY: number, centerZ: number,
  worldRadius: number
): Array<{ wx: number; wy: number; wz: number; count: number }> {
  return store.removeRadiusWorld(centerX, centerY, centerZ, worldRadius);
}

/**
 * Perform a mining hit at a specific point, removing sub-voxels.
 * Returns the number of sub-voxels removed and whether the block was fully destroyed.
 */
export function mineSubVoxels(
  store: SubVoxelStore,
  blockX: number, blockY: number, blockZ: number,
  hitX: number, hitY: number, hitZ: number,
  tool: BlockType | undefined
): { removed: number; blockDestroyed: boolean } {
  const { sx, sy, sz } = hitPointToSubVoxel(hitX, hitY, hitZ, blockX, blockY, blockZ);
  const radius = getMiningRadius(tool);

  if (radius === 0) {
    // Single sub-voxel removal (bare hand or non-tool)
    const destroyed = store.removeSubVoxel(blockX, blockY, blockZ, sx, sy, sz);
    return { removed: 1, blockDestroyed: destroyed };
  }

  // Radius-based removal
  const removed = store.removeRadius(blockX, blockY, blockZ, sx, sy, sz, radius);
  const blockDestroyed = !store.hasGrid(blockX, blockY, blockZ) && removed > 0;
  // If grid exists and has 0 solid, it's cleaned up automatically
  // If grid doesn't exist after removal, block was either fully destroyed or had no grid

  return { removed, blockDestroyed };
}
