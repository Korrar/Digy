import { create } from 'zustand';
import * as THREE from 'three';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType, isFlat } from '../core/voxel/BlockRegistry';
import { type BiomeType, createBiome } from '../core/terrain/biomes';
import { placeStructures } from '../core/terrain/StructureGenerator';
import { CHUNK_SIZE } from '../utils/constants';
import { mineSubVoxels } from '../core/voxel/VoxelMining';
import { removeDisconnectedFragments, checkBlockStability } from '../core/voxel/VoxelPhysics';

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
  damageSubVoxels: (wx: number, wy: number, wz: number, hitX: number, hitY: number, hitZ: number, tool: BlockType | undefined) => { removed: number; blockDestroyed: boolean };
  rebuildChunkMesh: (cx: number, cz: number) => void;
  clearWorld: () => void;
  getChunkEntries: () => [string, ChunkEntry][];
}

function makeNeighborBlockFn(chunks: Map<string, ChunkEntry>) {
  return (wx: number, wy: number, wz: number): BlockType => {
    const ncx = Math.floor(wx / CHUNK_SIZE);
    const ncz = Math.floor(wz / CHUNK_SIZE);
    const neighbor = chunks.get(chunkKey(ncx, ncz));
    if (!neighbor) return BlockType.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return neighbor.data.getBlock(lx, wy, lz);
  };
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

        const getNeighborBlock = makeNeighborBlockFn(chunks);
        const geometry = buildChunkMesh(chunk, getNeighborBlock);
        chunks.set(chunkKey(cx, cz), { data: chunk, geometry, dirty: false });
      }
    }

    // Rebuild border meshes with neighbor info
    const getNeighborBlock = makeNeighborBlockFn(chunks);
    for (const [key, entry] of chunks) {
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

    // Collect chunks to rebuild (deduplicated via Set)
    const toRebuild = new Set<string>();
    toRebuild.add(chunkKey(cx, cz));
    if (lx === 0) toRebuild.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) toRebuild.add(chunkKey(cx + 1, cz));
    if (lz === 0) toRebuild.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) toRebuild.add(chunkKey(cx, cz + 1));

    // When placing or breaking rails, also rebuild chunks containing adjacent rails
    const getBlock = get().getBlock;
    const hasAdjacentRail = isFlat(getBlock(wx+1, wy, wz)) || isFlat(getBlock(wx-1, wy, wz)) ||
      isFlat(getBlock(wx, wy, wz+1)) || isFlat(getBlock(wx, wy, wz-1));
    if (isFlat(type) || hasAdjacentRail) {
      const neighbors = [[wx-1, wz], [wx+1, wz], [wx, wz-1], [wx, wz+1]];
      for (const [nx, nz] of neighbors) {
        const ncx = Math.floor(nx / CHUNK_SIZE);
        const ncz = Math.floor(nz / CHUNK_SIZE);
        toRebuild.add(chunkKey(ncx, ncz));
      }
    }

    // Rebuild all collected chunks (deduplicated)
    for (const key of toRebuild) {
      const [rcx, rcz] = key.split(',').map(Number);
      get().rebuildChunkMesh(rcx, rcz);
    }

    // Force re-render
    set({ chunks: new Map(get().chunks) });
  },

  damageSubVoxels: (wx, wy, wz, hitX, hitY, hitZ, tool) => {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const entry = get().chunks.get(chunkKey(cx, cz));
    if (!entry) return { removed: 0, blockDestroyed: false };

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    // Use local chunk coordinates for sub-voxel storage
    const result = mineSubVoxels(
      entry.data.subVoxels,
      lx, wy, lz,
      hitX - (wx - lx), hitY, hitZ - (wz - lz),
      tool
    );

    if (result.blockDestroyed) {
      // Block fully destroyed - set to AIR
      entry.data.setBlock(lx, wy, lz, BlockType.AIR);
    } else if (result.removed > 0) {
      // Remove disconnected sub-voxel fragments (gravity)
      removeDisconnectedFragments(entry.data.subVoxels, lx, wy, lz);

      // Check structural stability - collapse if too damaged
      if (!checkBlockStability(entry.data.subVoxels, lx, wy, lz)) {
        // Efficiently clear the sub-voxel grid for this block
        entry.data.subVoxels.clearBlock(lx, wy, lz);
        entry.data.setBlock(lx, wy, lz, BlockType.AIR);
        result.blockDestroyed = true;
      }
    }

    // Rebuild chunk mesh - collect and deduplicate
    entry.dirty = true;
    const toRebuild = new Set<string>();
    toRebuild.add(chunkKey(cx, cz));
    if (lx === 0) toRebuild.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) toRebuild.add(chunkKey(cx + 1, cz));
    if (lz === 0) toRebuild.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) toRebuild.add(chunkKey(cx, cz + 1));

    for (const key of toRebuild) {
      const [rcx, rcz] = key.split(',').map(Number);
      get().rebuildChunkMesh(rcx, rcz);
    }

    set({ chunks: new Map(get().chunks) });

    return result;
  },

  rebuildChunkMesh: (cx, cz) => {
    const state = get();
    const entry = state.chunks.get(chunkKey(cx, cz));
    if (!entry) return;

    const getNeighborBlock = makeNeighborBlockFn(state.chunks);

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
