import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { BlockType, getBlock, isChest, isSolid, isTransparent } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';

describe('Chest block', () => {
  it('should be registered with correct properties', () => {
    const def = getBlock(BlockType.CHEST);
    expect(def.name).toBe('Chest');
    expect(def.isChest).toBe(true);
    expect(def.transparent).toBe(true);
    expect(def.hardness).toBe(1.5);
    expect(def.drops).toBe(BlockType.CHEST);
    expect(def.stackSize).toBe(64);
  });

  it('isChest should return true for CHEST', () => {
    expect(isChest(BlockType.CHEST)).toBe(true);
  });

  it('isChest should return false for other blocks', () => {
    expect(isChest(BlockType.STONE)).toBe(false);
    expect(isChest(BlockType.PLANKS)).toBe(false);
    expect(isChest(BlockType.AIR)).toBe(false);
  });

  it('should be solid (collision)', () => {
    expect(isSolid(BlockType.CHEST)).toBe(true);
  });

  it('should be transparent (for face culling)', () => {
    expect(isTransparent(BlockType.CHEST)).toBe(true);
  });

  describe('Chest rendering', () => {
    let chunk: ChunkData;

    beforeEach(() => {
      chunk = new ChunkData(0, 0);
    });

    it('should generate geometry for a chest block', () => {
      chunk.setBlock(4, 5, 4, BlockType.CHEST);
      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
    });

    it('should render within block bounds', () => {
      chunk.setBlock(4, 5, 4, BlockType.CHEST);
      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position');
      const arr = positions.array as Float32Array;

      for (let i = 0; i < positions.count; i++) {
        const x = arr[i * 3];
        const y = arr[i * 3 + 1];
        const z = arr[i * 3 + 2];
        // Chest is inset, so coordinates should be within block bounds
        expect(x).toBeGreaterThanOrEqual(4);
        expect(x).toBeLessThanOrEqual(5);
        expect(y).toBeGreaterThanOrEqual(5);
        expect(y).toBeLessThanOrEqual(6);
        expect(z).toBeGreaterThanOrEqual(4);
        expect(z).toBeLessThanOrEqual(5);
      }
    });

    it('should have colors in valid range', () => {
      chunk.setBlock(4, 5, 4, BlockType.CHEST);
      const geometry = buildChunkMesh(chunk);
      const colors = geometry.getAttribute('color');
      const arr = colors.array as Float32Array;

      for (let i = 0; i < colors.count * 3; i++) {
        expect(arr[i]).toBeGreaterThanOrEqual(-0.1);
        expect(arr[i]).toBeLessThanOrEqual(1.5);
      }
    });
  });
});
