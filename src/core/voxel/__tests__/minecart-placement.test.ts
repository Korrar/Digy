import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isItemType, isSolid } from '../BlockRegistry';

describe('Minecart placement properties', () => {
  it('MINECART should be marked as an item', () => {
    expect(isItemType(BlockType.MINECART)).toBe(true);
  });

  it('MINECART should have isPlaceableItem flag', () => {
    const def = getBlock(BlockType.MINECART);
    expect(def.isPlaceableItem).toBe(true);
  });
});

describe('Rail placement properties', () => {
  it('RAIL should be placeable (not an item)', () => {
    expect(isItemType(BlockType.RAIL)).toBe(false);
  });

  it('POWERED_RAIL should be placeable (not an item)', () => {
    expect(isItemType(BlockType.POWERED_RAIL)).toBe(false);
  });

  it('RAIL block should not block placement of other blocks on same position', () => {
    // Since rails are flat, they should not be solid
    expect(isSolid(BlockType.RAIL)).toBe(false);
  });
});

describe('canPlaceMinecart logic', () => {
  it('should export canPlaceMinecart function', async () => {
    const mod = await import('../BlockRegistry');
    expect(typeof mod.canPlaceMinecart).toBe('function');
  });

  it('should allow placing minecart on RAIL block', async () => {
    const { canPlaceMinecart } = await import('../BlockRegistry');
    expect(canPlaceMinecart(BlockType.RAIL)).toBe(true);
  });

  it('should allow placing minecart on POWERED_RAIL block', async () => {
    const { canPlaceMinecart } = await import('../BlockRegistry');
    expect(canPlaceMinecart(BlockType.POWERED_RAIL)).toBe(true);
  });

  it('should allow placing minecart on solid ground blocks', async () => {
    const { canPlaceMinecart } = await import('../BlockRegistry');
    expect(canPlaceMinecart(BlockType.GRASS)).toBe(true);
    expect(canPlaceMinecart(BlockType.STONE)).toBe(true);
    expect(canPlaceMinecart(BlockType.DIRT)).toBe(true);
    expect(canPlaceMinecart(BlockType.SAND)).toBe(true);
  });

  it('should NOT allow placing minecart on AIR', async () => {
    const { canPlaceMinecart } = await import('../BlockRegistry');
    expect(canPlaceMinecart(BlockType.AIR)).toBe(false);
  });

  it('should NOT allow placing minecart on WATER', async () => {
    const { canPlaceMinecart } = await import('../BlockRegistry');
    expect(canPlaceMinecart(BlockType.WATER)).toBe(false);
  });
});
