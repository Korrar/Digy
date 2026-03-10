import { describe, it, expect } from 'vitest';
import { BlockType, needsSupportFromBelow, isSolid } from '../BlockRegistry';

describe('needsSupportFromBelow', () => {
  it('should return true for rails (flat blocks)', () => {
    expect(needsSupportFromBelow(BlockType.RAIL)).toBe(true);
  });

  it('should return true for powered rails', () => {
    expect(needsSupportFromBelow(BlockType.POWERED_RAIL)).toBe(true);
  });

  it('should return true for detector rails', () => {
    expect(needsSupportFromBelow(BlockType.DETECTOR_RAIL)).toBe(true);
  });

  it('should return true for pressure plates', () => {
    expect(needsSupportFromBelow(BlockType.PRESSURE_PLATE)).toBe(true);
  });

  it('should return true for cables', () => {
    expect(needsSupportFromBelow(BlockType.CABLE)).toBe(true);
  });

  it('should return true for powered cables', () => {
    expect(needsSupportFromBelow(BlockType.CABLE_POWERED)).toBe(true);
  });

  it('should return true for torches', () => {
    expect(needsSupportFromBelow(BlockType.TORCH)).toBe(true);
  });

  it('should return true for buttons', () => {
    expect(needsSupportFromBelow(BlockType.BUTTON)).toBe(true);
  });

  it('should return true for levers', () => {
    expect(needsSupportFromBelow(BlockType.LEVER)).toBe(true);
  });

  it('should return true for signs', () => {
    expect(needsSupportFromBelow(BlockType.SIGN)).toBe(true);
  });

  it('should return true for repeaters', () => {
    expect(needsSupportFromBelow(BlockType.REPEATER_N)).toBe(true);
  });

  it('should return true for comparators', () => {
    expect(needsSupportFromBelow(BlockType.COMPARATOR_N)).toBe(true);
  });

  it('should return true for crossed quad blocks (flowers, tall grass)', () => {
    expect(needsSupportFromBelow(BlockType.TALL_GRASS)).toBe(true);
    expect(needsSupportFromBelow(BlockType.FLOWER_RED)).toBe(true);
    expect(needsSupportFromBelow(BlockType.FLOWER_YELLOW)).toBe(true);
  });

  it('should return true for doors (lower half needs support)', () => {
    expect(needsSupportFromBelow(BlockType.DOOR_OAK_BOTTOM)).toBe(true);
    expect(needsSupportFromBelow(BlockType.DOOR_OAK_BOTTOM_OPEN)).toBe(true);
  });

  it('should return false for solid blocks', () => {
    expect(needsSupportFromBelow(BlockType.STONE)).toBe(false);
    expect(needsSupportFromBelow(BlockType.DIRT)).toBe(false);
    expect(needsSupportFromBelow(BlockType.GRASS)).toBe(false);
    expect(needsSupportFromBelow(BlockType.PLANKS)).toBe(false);
  });

  it('should return false for AIR', () => {
    expect(needsSupportFromBelow(BlockType.AIR)).toBe(false);
  });

  it('should return false for WATER and LAVA', () => {
    expect(needsSupportFromBelow(BlockType.WATER)).toBe(false);
    expect(needsSupportFromBelow(BlockType.LAVA)).toBe(false);
  });

  it('should be consistent with isSolid - non-solid placeable blocks need support', () => {
    // All blocks that needsSupportFromBelow should NOT be solid
    const supportBlocks = [
      BlockType.RAIL, BlockType.POWERED_RAIL, BlockType.TORCH,
      BlockType.LEVER, BlockType.BUTTON, BlockType.CABLE,
      BlockType.PRESSURE_PLATE, BlockType.SIGN,
    ];
    for (const block of supportBlocks) {
      expect(isSolid(block)).toBe(false);
      expect(needsSupportFromBelow(block)).toBe(true);
    }
  });
});
