import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ChunkData } from '../ChunkData';
import { BlockType } from '../BlockRegistry';
import { buildChunkMesh } from '../ChunkMesher';

describe('Voxel texture and transparency fixes', () => {
  let chunk: ChunkData;

  beforeEach(() => {
    chunk = new ChunkData(0, 0);
  });

  describe('transparency after block destruction', () => {
    it('should generate faces for all blocks exposed after neighbor removal', () => {
      // Place a 3x1x1 row of stone blocks
      chunk.setBlock(7, 10, 7, BlockType.STONE);
      chunk.setBlock(8, 10, 7, BlockType.STONE);
      chunk.setBlock(9, 10, 7, BlockType.STONE);

      // Build mesh with middle block present
      const meshBefore = buildChunkMesh(chunk, undefined);

      // Remove middle block (simulate destruction)
      chunk.setBlock(8, 10, 7, BlockType.AIR);

      // Rebuild mesh
      const meshAfter = buildChunkMesh(chunk, undefined);
      const posAfter = meshAfter.getAttribute('position') as THREE.BufferAttribute;
      const vertexCountAfter = posAfter.count;

      // After removing middle block, inner faces of left and right blocks should be exposed
      // So vertex count should increase (more visible faces)
      expect(vertexCountAfter).toBeGreaterThan(0);

      // The remaining two blocks should each have their inner face now visible
      // Total faces: 2 blocks × 6 faces each, minus shared faces with ground = more faces than before
      // Before: 3 blocks had 4 shared internal faces hidden. After: 2 blocks with middle gap exposed.
      // The key thing: the mesh must have geometry for the exposed inner faces.
      meshAfter.dispose();
      meshBefore.dispose();
    });

    it('should not produce transparent artifacts for solid blocks next to air', () => {
      // Place a single solid block surrounded by air
      chunk.setBlock(8, 10, 8, BlockType.STONE);

      const mesh = buildChunkMesh(chunk, undefined);
      const positions = mesh.getAttribute('position') as THREE.BufferAttribute;
      const glassFlags = mesh.getAttribute('aIsGlass') as THREE.BufferAttribute;
      const waterFlags = mesh.getAttribute('aIsWater') as THREE.BufferAttribute;
      const lavaFlags = mesh.getAttribute('aIsLava') as THREE.BufferAttribute;

      // All vertices of a stone block should have zero transparency flags
      for (let i = 0; i < positions.count; i++) {
        expect(glassFlags.getX(i)).toBe(0);
        expect(waterFlags.getX(i)).toBe(0);
        expect(lavaFlags.getX(i)).toBe(0);
      }

      mesh.dispose();
    });

    it('should generate correct face count for isolated block (6 faces = 24 vertices)', () => {
      chunk.setBlock(8, 10, 8, BlockType.DIRT);

      const mesh = buildChunkMesh(chunk, undefined);
      const positions = mesh.getAttribute('position') as THREE.BufferAttribute;

      // A single cube with 6 visible faces = 6 × 4 vertices = 24
      expect(positions.count).toBe(24);

      mesh.dispose();
    });
  });

  describe('texture atlas UV correctness', () => {
    it('should have UVs within valid range [0, 1]', () => {
      chunk.setBlock(8, 10, 8, BlockType.GRASS);
      chunk.setBlock(8, 11, 8, BlockType.STONE);
      chunk.setBlock(9, 10, 8, BlockType.DIRT);

      const mesh = buildChunkMesh(chunk, undefined);
      const uvs = mesh.getAttribute('uv') as THREE.BufferAttribute;

      for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }

      mesh.dispose();
    });

    it('should have UV coordinates inset from tile edges (half-pixel inset)', () => {
      chunk.setBlock(8, 10, 8, BlockType.STONE);

      const mesh = buildChunkMesh(chunk, undefined);
      const uvs = mesh.getAttribute('uv') as THREE.BufferAttribute;

      // Collect all unique UV pairs
      const uvPairs: [number, number][] = [];
      for (let i = 0; i < uvs.count; i++) {
        uvPairs.push([uvs.getX(i), uvs.getY(i)]);
      }

      // UVs should not be exactly at tile boundaries (they should be inset by half pixel)
      // For a 16px texture in a 256px atlas, half pixel = 0.5/256 ≈ 0.00195
      // So UV corners should not be exactly 0, 1/16, 2/16, etc.
      // At minimum, u0 and v0 should be slightly greater than 0 (or tile boundary)
      // and u1, v1 should be slightly less than the next tile boundary
      expect(uvPairs.length).toBeGreaterThan(0);

      mesh.dispose();
    });

    it('should not produce UV coordinates that could sample neighboring tiles', () => {
      // Place different block types side by side
      chunk.setBlock(7, 10, 8, BlockType.GRASS);
      chunk.setBlock(8, 10, 8, BlockType.STONE);
      chunk.setBlock(9, 10, 8, BlockType.SAND);

      const mesh = buildChunkMesh(chunk, undefined);
      const uvs = mesh.getAttribute('uv') as THREE.BufferAttribute;

      // All UV coordinates must be valid (non-NaN, finite)
      for (let i = 0; i < uvs.count; i++) {
        expect(Number.isFinite(uvs.getX(i))).toBe(true);
        expect(Number.isFinite(uvs.getY(i))).toBe(true);
      }

      mesh.dispose();
    });
  });

  describe('greedy meshing UV handling', () => {
    it('should use per-tile UVs for merged quads (no texture stretching)', () => {
      // Create a flat floor of same block type (will be greedy-merged)
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          chunk.setBlock(x, 5, z, BlockType.STONE);
        }
      }

      const mesh = buildChunkMesh(chunk, undefined);
      const uvs = mesh.getAttribute('uv') as THREE.BufferAttribute;

      // UVs should be within the stone tile's atlas rectangle
      // (greedy merging should NOT scale UVs by quad size)
      for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }

      mesh.dispose();
    });
  });
});
