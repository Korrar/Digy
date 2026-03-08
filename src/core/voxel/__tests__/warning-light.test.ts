import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isItemType } from '../BlockRegistry';

describe('Warning Light block registration', () => {
  it('should have WARNING_LIGHT defined in BlockType enum', () => {
    expect(BlockType.WARNING_LIGHT).toBeDefined();
  });

  it('should have a name of "Warning Light"', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.name).toBe('Warning Light');
  });

  it('should be an item (non-placeable as block)', () => {
    expect(isItemType(BlockType.WARNING_LIGHT)).toBe(true);
  });

  it('should be a placeable item (like minecart)', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.isPlaceableItem).toBe(true);
  });

  it('should have yellow-ish color', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.color.r).toBeGreaterThan(0.8);
    expect(def.color.g).toBeGreaterThan(0.5);
  });

  it('should have warning_light icon', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.icon).toBe('warning_light');
  });

  it('should drop itself when obtained', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.drops).toBe(BlockType.WARNING_LIGHT);
  });

  it('should have stackSize of 1', () => {
    const def = getBlock(BlockType.WARNING_LIGHT);
    expect(def.stackSize).toBe(1);
  });
});
