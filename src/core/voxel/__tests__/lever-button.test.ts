import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isItemType, isSolid } from '../BlockRegistry';

describe('Lever block registration', () => {
  it('should have LEVER defined in BlockType enum', () => {
    expect(BlockType.LEVER).toBeDefined();
  });

  it('should have correct name', () => {
    const def = getBlock(BlockType.LEVER);
    expect(def.name).toBe('Lever');
  });

  it('should be transparent (non-full block)', () => {
    const def = getBlock(BlockType.LEVER);
    expect(def.transparent).toBe(true);
  });

  it('should not be solid', () => {
    expect(isSolid(BlockType.LEVER)).toBe(false);
  });

  it('should have isLever flag', () => {
    const def = getBlock(BlockType.LEVER);
    expect(def.isLever).toBe(true);
  });

  it('should have lever icon', () => {
    const def = getBlock(BlockType.LEVER);
    expect(def.icon).toBe('lever');
  });

  it('should drop itself', () => {
    const def = getBlock(BlockType.LEVER);
    expect(def.drops).toBe(BlockType.LEVER);
  });
});

describe('Button block registration', () => {
  it('should have BUTTON defined in BlockType enum', () => {
    expect(BlockType.BUTTON).toBeDefined();
  });

  it('should have correct name', () => {
    const def = getBlock(BlockType.BUTTON);
    expect(def.name).toBe('Button');
  });

  it('should be transparent', () => {
    const def = getBlock(BlockType.BUTTON);
    expect(def.transparent).toBe(true);
  });

  it('should have isButton flag', () => {
    const def = getBlock(BlockType.BUTTON);
    expect(def.isButton).toBe(true);
  });

  it('should have button icon', () => {
    const def = getBlock(BlockType.BUTTON);
    expect(def.icon).toBe('button');
  });
});

describe('Lever ON state', () => {
  it('should have LEVER_ON defined', () => {
    expect(BlockType.LEVER_ON).toBeDefined();
  });

  it('should be a lever in ON state', () => {
    const def = getBlock(BlockType.LEVER_ON);
    expect(def.isLever).toBe(true);
    expect(def.leverOn).toBe(true);
  });

  it('should drop a regular lever', () => {
    const def = getBlock(BlockType.LEVER_ON);
    expect(def.drops).toBe(BlockType.LEVER);
  });
});
