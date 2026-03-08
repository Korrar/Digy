import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isSolid, isTransparent } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../utils/constants';

function createTestChunk(): ChunkData {
  return new ChunkData(0, 0);
}

function buildMeshWithBlock(blockType: BlockType, x = 4, y = 4, z = 4) {
  const chunk = createTestChunk();
  chunk.setBlock(x, y, z, blockType);
  return buildChunkMesh(chunk);
}

function getPositions(geometry: THREE.BufferGeometry): Float32Array {
  return geometry.attributes.position.array as Float32Array;
}

function getBounds(geometry: THREE.BufferGeometry, baseX = 4, baseY = 4, baseZ = 4) {
  const pos = getPositions(geometry);
  let minY = Infinity, maxY = -Infinity;
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i] - baseX);
    maxX = Math.max(maxX, pos[i] - baseX);
    minY = Math.min(minY, pos[i + 1] - baseY);
    maxY = Math.max(maxY, pos[i + 1] - baseY);
    minZ = Math.min(minZ, pos[i + 2] - baseZ);
    maxZ = Math.max(maxZ, pos[i + 2] - baseZ);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

describe('Slabs', () => {
  it('should render PLANKS_SLAB as half-height block', () => {
    const geo = buildMeshWithBlock(BlockType.PLANKS_SLAB);
    const bounds = getBounds(geo);
    expect(bounds.minY).toBeCloseTo(0, 1);
    expect(bounds.maxY).toBeCloseTo(0.5, 1);
    expect(bounds.minX).toBeCloseTo(0, 1);
    expect(bounds.maxX).toBeCloseTo(1, 1);
  });

  it('should render COBBLESTONE_SLAB as half-height block', () => {
    const geo = buildMeshWithBlock(BlockType.COBBLESTONE_SLAB);
    const bounds = getBounds(geo);
    expect(bounds.maxY).toBeCloseTo(0.5, 1);
  });

  it('should render STONE_BRICKS_SLAB as half-height block', () => {
    const geo = buildMeshWithBlock(BlockType.STONE_BRICKS_SLAB);
    const bounds = getBounds(geo);
    expect(bounds.maxY).toBeCloseTo(0.5, 1);
  });

  it('slabs should be transparent so neighbors render their face', () => {
    expect(isTransparent(BlockType.PLANKS_SLAB)).toBe(true);
    expect(isTransparent(BlockType.COBBLESTONE_SLAB)).toBe(true);
    expect(isTransparent(BlockType.STONE_BRICKS_SLAB)).toBe(true);
  });

  it('slabs should drop themselves when mined', () => {
    expect(getBlock(BlockType.PLANKS_SLAB).drops).toBe(BlockType.PLANKS_SLAB);
    expect(getBlock(BlockType.COBBLESTONE_SLAB).drops).toBe(BlockType.COBBLESTONE_SLAB);
  });
});

describe('Fences', () => {
  it('should render FENCE_OAK as a narrow center post', () => {
    const geo = buildMeshWithBlock(BlockType.FENCE_OAK);
    const bounds = getBounds(geo);
    // Fence post is narrower than a full block
    expect(bounds.maxX - bounds.minX).toBeLessThan(0.5);
    expect(bounds.maxZ - bounds.minZ).toBeLessThan(0.5);
    // Full height
    expect(bounds.minY).toBeCloseTo(0, 1);
    expect(bounds.maxY).toBeCloseTo(1, 1);
  });

  it('should auto-connect fence to adjacent fence', () => {
    const chunk = createTestChunk();
    chunk.setBlock(4, 4, 4, BlockType.FENCE_OAK);
    chunk.setBlock(5, 4, 4, BlockType.FENCE_OAK); // neighbor to east
    const geo = buildChunkMesh(chunk);
    const pos = getPositions(geo);
    // With two connected fences, we should have more vertices than a single fence
    const singleGeo = buildMeshWithBlock(BlockType.FENCE_OAK);
    expect(pos.length).toBeGreaterThan(getPositions(singleGeo).length);
  });

  it('fence should be transparent for face culling', () => {
    expect(isTransparent(BlockType.FENCE_OAK)).toBe(true);
  });
});

describe('Stairs', () => {
  it('should render OAK_STAIRS_N within block bounds', () => {
    const geo = buildMeshWithBlock(BlockType.OAK_STAIRS_N);
    const bounds = getBounds(geo);
    expect(bounds.minX).toBeGreaterThanOrEqual(-0.01);
    expect(bounds.maxX).toBeLessThanOrEqual(1.01);
    expect(bounds.minY).toBeGreaterThanOrEqual(-0.01);
    expect(bounds.maxY).toBeLessThanOrEqual(1.01);
    expect(bounds.minZ).toBeGreaterThanOrEqual(-0.01);
    expect(bounds.maxZ).toBeLessThanOrEqual(1.01);
  });

  it('should render stair geometry (not full cube)', () => {
    const stairGeo = buildMeshWithBlock(BlockType.OAK_STAIRS_N);
    const cubeGeo = buildMeshWithBlock(BlockType.PLANKS);
    // Stairs have more faces than a cube (step creates extra geometry)
    expect(getPositions(stairGeo).length).toBeGreaterThan(getPositions(cubeGeo).length);
  });

  it('all stair orientations should have same vertex count', () => {
    const geoN = buildMeshWithBlock(BlockType.OAK_STAIRS_N);
    const geoS = buildMeshWithBlock(BlockType.OAK_STAIRS_S);
    const geoE = buildMeshWithBlock(BlockType.OAK_STAIRS_E);
    const geoW = buildMeshWithBlock(BlockType.OAK_STAIRS_W);
    const count = getPositions(geoN).length;
    expect(getPositions(geoS).length).toBe(count);
    expect(getPositions(geoE).length).toBe(count);
    expect(getPositions(geoW).length).toBe(count);
  });

  it('stair inventory items should drop themselves', () => {
    expect(getBlock(BlockType.OAK_STAIRS).drops).toBe(BlockType.OAK_STAIRS);
    expect(getBlock(BlockType.COBBLE_STAIRS).drops).toBe(BlockType.COBBLE_STAIRS);
  });

  it('placed stair blocks should drop their inventory item', () => {
    expect(getBlock(BlockType.OAK_STAIRS_N).drops).toBe(BlockType.OAK_STAIRS);
    expect(getBlock(BlockType.OAK_STAIRS_S).drops).toBe(BlockType.OAK_STAIRS);
    expect(getBlock(BlockType.COBBLE_STAIRS_N).drops).toBe(BlockType.COBBLE_STAIRS);
  });
});

describe('Doors', () => {
  it('should render DOOR_OAK_BOTTOM as a thin vertical block', () => {
    const geo = buildMeshWithBlock(BlockType.DOOR_OAK_BOTTOM);
    const bounds = getBounds(geo);
    // Door is thin in one dimension (Z by default for closed door)
    const xSpan = bounds.maxX - bounds.minX;
    const zSpan = bounds.maxZ - bounds.minZ;
    const thinDimension = Math.min(xSpan, zSpan);
    expect(thinDimension).toBeLessThan(0.3);
  });

  it('should render DOOR_OAK_TOP as a thin vertical block', () => {
    const geo = buildMeshWithBlock(BlockType.DOOR_OAK_TOP);
    const bounds = getBounds(geo);
    const xSpan = bounds.maxX - bounds.minX;
    const zSpan = bounds.maxZ - bounds.minZ;
    const thinDimension = Math.min(xSpan, zSpan);
    expect(thinDimension).toBeLessThan(0.3);
  });

  it('open door should be rotated (thin along X instead of Z)', () => {
    const closedGeo = buildMeshWithBlock(BlockType.DOOR_OAK_BOTTOM);
    const openGeo = buildMeshWithBlock(BlockType.DOOR_OAK_BOTTOM_OPEN);
    const closedBounds = getBounds(closedGeo);
    const openBounds = getBounds(openGeo);
    // Closed door thin in Z, open door thin in X (rotated 90 degrees)
    const closedZSpan = closedBounds.maxZ - closedBounds.minZ;
    const openXSpan = openBounds.maxX - openBounds.minX;
    expect(closedZSpan).toBeLessThan(0.3);
    expect(openXSpan).toBeLessThan(0.3);
  });

  it('door blocks should be transparent', () => {
    expect(isTransparent(BlockType.DOOR_OAK_BOTTOM)).toBe(true);
    expect(isTransparent(BlockType.DOOR_OAK_TOP)).toBe(true);
  });

  it('door blocks should drop DOOR_OAK item (only bottom half)', () => {
    expect(getBlock(BlockType.DOOR_OAK_BOTTOM).drops).toBe(BlockType.DOOR_OAK);
    expect(getBlock(BlockType.DOOR_OAK_TOP).drops).toBe(BlockType.AIR); // top half drops nothing
    expect(getBlock(BlockType.DOOR_OAK_BOTTOM_OPEN).drops).toBe(BlockType.DOOR_OAK);
  });
});
