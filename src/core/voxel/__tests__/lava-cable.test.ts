import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isSolid } from '../BlockRegistry';

describe('Lava block registration', () => {
  it('should have LAVA defined in BlockType enum', () => {
    expect(BlockType.LAVA).toBeDefined();
  });

  it('should be named Lava', () => {
    const def = getBlock(BlockType.LAVA);
    expect(def.name).toBe('Lava');
  });

  it('should be transparent', () => {
    const def = getBlock(BlockType.LAVA);
    expect(def.transparent).toBe(true);
  });

  it('should emit light', () => {
    const def = getBlock(BlockType.LAVA);
    expect(def.emitsLight).toBe(true);
  });

  it('should have warm orange-red color', () => {
    const def = getBlock(BlockType.LAVA);
    expect(def.color.r).toBeGreaterThan(0.7);
  });

  it('should be marked as lava', () => {
    const def = getBlock(BlockType.LAVA);
    expect(def.isLava).toBe(true);
  });
});

describe('Cable block registration', () => {
  it('should have CABLE defined in BlockType enum', () => {
    expect(BlockType.CABLE).toBeDefined();
  });

  it('should be named Cable', () => {
    const def = getBlock(BlockType.CABLE);
    expect(def.name).toBe('Cable');
  });

  it('should be transparent (thin wire)', () => {
    const def = getBlock(BlockType.CABLE);
    expect(def.transparent).toBe(true);
  });

  it('should not be solid', () => {
    expect(isSolid(BlockType.CABLE)).toBe(false);
  });

  it('should have isCable flag', () => {
    const def = getBlock(BlockType.CABLE);
    expect(def.isCable).toBe(true);
  });

  it('should have blue color', () => {
    const def = getBlock(BlockType.CABLE);
    expect(def.color.b).toBeGreaterThan(0.5);
  });

  it('should have cable icon', () => {
    const def = getBlock(BlockType.CABLE);
    expect(def.icon).toBe('cable');
  });
});

describe('Cable powered state', () => {
  it('should have CABLE_POWERED defined', () => {
    expect(BlockType.CABLE_POWERED).toBeDefined();
  });

  it('should be a cable in powered state', () => {
    const def = getBlock(BlockType.CABLE_POWERED);
    expect(def.isCable).toBe(true);
    expect(def.cablePowered).toBe(true);
  });

  it('should emit light when powered', () => {
    const def = getBlock(BlockType.CABLE_POWERED);
    expect(def.emitsLight).toBe(true);
  });

  it('should drop regular cable', () => {
    const def = getBlock(BlockType.CABLE_POWERED);
    expect(def.drops).toBe(BlockType.CABLE);
  });
});
