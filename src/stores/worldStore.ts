import { create } from 'zustand';
import * as THREE from 'three';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType, isFlat } from '../core/voxel/BlockRegistry';
import { type BiomeType, createBiome } from '../core/terrain/biomes';
import { placeStructures } from '../core/terrain/StructureGenerator';
import { CHUNK_SIZE } from '../utils/constants';

interface ChunkEntry {
  data: ChunkData;
  geometry: THREE.BufferGeometry;
  dirty: boolean;
}

interface WorldState {
  chunks: Map<string, ChunkEntry>;
  biomeType: BiomeType | null;
  seed: number;

  generateWorld: (biome: BiomeType, seed: number, radius: number) => void;
  getBlock: (wx: number, wy: number, wz: number) => BlockType;
  setBlock: (wx: number, wy: number, wz: number, type: BlockType) => void;
  rebuildChunkMesh: (cx: number, cz: number) => void;
  clearWorld: () => void;
  getChunkEntries: () => [string, ChunkEntry][];
}

export const useWorldStore = create<WorldState>((set, get) => ({
  chunks: new Map(),
  biomeType: null,
  seed: 0,

  generateWorld: (biomeType, seed, radius) => {
    const state = get();
    // Dispose old geometries
    state.chunks.forEach(entry => entry.geometry.dispose());

    const biome = createBiome(biomeType, seed);
    const chunks = new Map<string, ChunkEntry>();

    for (let cx = -radius; cx <= radius; cx++) {
      for (let cz = -radius; cz <= radius; cz++) {
        const chunk = new ChunkData(cx, cz);
        biome.generate(chunk);
        placeStructures(chunk, biomeType, biome.noiseGen);

        const getNeighborBlock = (wx: number, wy: number, wz: number): BlockType => {
          const ncx = Math.floor(wx / CHUNK_SIZE);
          const ncz = Math.floor(wz / CHUNK_SIZE);
          const key = chunkKey(ncx, ncz);
          const neighbor = chunks.get(key);
          if (!neighbor) return BlockType.AIR;
          const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          return neighbor.data.getBlock(lx, wy, lz);
        };

        const geometry = buildChunkMesh(chunk, getNeighborBlock);
        chunks.set(chunkKey(cx, cz), { data: chunk, geometry, dirty: false });
      }
    }

    // Rebuild border meshes with neighbor info
    for (const [key, entry] of chunks) {
      const getNeighborBlock = (wx: number, wy: number, wz: number): BlockType => {
        const ncx = Math.floor(wx / CHUNK_SIZE);
        const ncz = Math.floor(wz / CHUNK_SIZE);
        const nkey = chunkKey(ncx, ncz);
        const neighbor = chunks.get(nkey);
        if (!neighbor) return BlockType.AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return neighbor.data.getBlock(lx, wy, lz);
      };
      entry.geometry.dispose();
      entry.geometry = buildChunkMesh(entry.data, getNeighborBlock);
      chunks.set(key, entry);
    }

    set({ chunks, biomeType, seed });
  },

  getBlock: (wx, wy, wz) => {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const entry = get().chunks.get(chunkKey(cx, cz));
    if (!entry) return BlockType.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return entry.data.getBlock(lx, wy, lz);
  },

  setBlock: (wx, wy, wz, type) => {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const state = get();
    const entry = state.chunks.get(chunkKey(cx, cz));
    if (!entry) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    entry.data.setBlock(lx, wy, lz, type);
    entry.dirty = true;

    // Rebuild this chunk and neighbors if on edge
    get().rebuildChunkMesh(cx, cz);
    if (lx === 0) get().rebuildChunkMesh(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) get().rebuildChunkMesh(cx + 1, cz);
    if (lz === 0) get().rebuildChunkMesh(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) get().rebuildChunkMesh(cx, cz + 1);

    // When placing or breaking rails, also rebuild chunks containing adjacent rails
    // so they can update their shape (curves, T-junctions)
    const getBlock = get().getBlock;
    const hasAdjacentRail = isFlat(getBlock(wx+1, wy, wz)) || isFlat(getBlock(wx-1, wy, wz)) ||
      isFlat(getBlock(wx, wy, wz+1)) || isFlat(getBlock(wx, wy, wz-1));
    if (isFlat(type) || hasAdjacentRail) {
      const neighbors = [[wx-1, wz], [wx+1, wz], [wx, wz-1], [wx, wz+1]];
      const rebuilt = new Set([chunkKey(cx, cz)]);
      for (const [nx, nz] of neighbors) {
        const ncx = Math.floor(nx / CHUNK_SIZE);
        const ncz = Math.floor(nz / CHUNK_SIZE);
        const key = chunkKey(ncx, ncz);
        if (!rebuilt.has(key)) {
          rebuilt.add(key);
          get().rebuildChunkMesh(ncx, ncz);
        }
      }
    }

    // Force re-render
    set({ chunks: new Map(get().chunks) });
  },

  rebuildChunkMesh: (cx, cz) => {
    const state = get();
    const entry = state.chunks.get(chunkKey(cx, cz));
    if (!entry) return;

    const getNeighborBlock = (wx: number, wy: number, wz: number): BlockType => {
      const ncx = Math.floor(wx / CHUNK_SIZE);
      const ncz = Math.floor(wz / CHUNK_SIZE);
      const neighbor = state.chunks.get(chunkKey(ncx, ncz));
      if (!neighbor) return BlockType.AIR;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return neighbor.data.getBlock(lx, wy, lz);
    };

    entry.geometry.dispose();
    entry.geometry = buildChunkMesh(entry.data, getNeighborBlock);
    entry.dirty = false;
  },

  clearWorld: () => {
    get().chunks.forEach(entry => entry.geometry.dispose());
    set({ chunks: new Map(), biomeType: null });
  },

  getChunkEntries: () => {
    return Array.from(get().chunks.entries());
  },
}));
