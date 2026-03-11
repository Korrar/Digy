import { ChunkData } from '../voxel/ChunkData';
import { BlockType } from '../voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../utils/constants';

export interface DungeonRoom {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  isBossRoom: boolean;
}

export interface DungeonCorridor {
  from: DungeonRoom;
  to: DungeonRoom;
}

export interface DungeonLayout {
  rooms: DungeonRoom[];
  corridors: DungeonCorridor[];
}

/** Simple seeded PRNG (mulberry32) */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DUNGEON_WALL_BLOCKS = [
  BlockType.STONE_BRICKS,
  BlockType.MOSSY_STONE_BRICKS,
  BlockType.CRACKED_STONE_BRICKS,
];

/**
 * Generate a dungeon layout inside a stone-filled chunk.
 * Carves rooms and corridors, places loot, traps, and boss room.
 */
export function generateDungeon(chunk: ChunkData, seed: number): DungeonLayout {
  const rng = createRng(seed);
  const rooms: DungeonRoom[] = [];
  const corridors: DungeonCorridor[] = [];

  // Dungeon Y level (underground)
  const dungeonBaseY = 2;

  // Generate 2-4 rooms
  const roomCount = 2 + Math.floor(rng() * 3);

  // Try to place rooms without overlap
  for (let attempt = 0; attempt < roomCount * 10 && rooms.length < roomCount; attempt++) {
    const w = 3 + Math.floor(rng() * 4); // 3-6 wide
    const d = 3 + Math.floor(rng() * 4); // 3-6 deep
    const h = 3 + Math.floor(rng() * 2); // 3-4 high
    const x = 1 + Math.floor(rng() * (CHUNK_SIZE - w - 2));
    const z = 1 + Math.floor(rng() * (CHUNK_SIZE - d - 2));
    const y = dungeonBaseY;

    // Check overlap with existing rooms (with 1-block margin)
    let overlaps = false;
    for (const existing of rooms) {
      if (
        x - 1 < existing.x + existing.width &&
        x + w + 1 > existing.x &&
        z - 1 < existing.z + existing.depth &&
        z + d + 1 > existing.z
      ) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    rooms.push({ x, y, z, width: w, height: h, depth: d, isBossRoom: false });
  }

  if (rooms.length === 0) {
    // Fallback: force one room in center
    rooms.push({
      x: 4, y: dungeonBaseY, z: 4,
      width: 5, height: 4, depth: 5,
      isBossRoom: true,
    });
  }

  // Mark the last room as boss room (make it larger if possible)
  const bossIdx = rooms.length - 1;
  const bossRoom = rooms[bossIdx];
  bossRoom.isBossRoom = true;
  // Try to expand boss room
  if (bossRoom.width < 5 && bossRoom.x + 5 <= CHUNK_SIZE - 1) bossRoom.width = 5;
  if (bossRoom.depth < 5 && bossRoom.z + 5 <= CHUNK_SIZE - 1) bossRoom.depth = 5;
  if (bossRoom.height < 4) bossRoom.height = 4;

  // Connect rooms with corridors
  for (let i = 0; i < rooms.length - 1; i++) {
    corridors.push({ from: rooms[i], to: rooms[i + 1] });
  }

  // Carve rooms
  for (const room of rooms) {
    carveRoom(chunk, room, rng);
  }

  // Carve corridors
  for (const corridor of corridors) {
    carveCorridor(chunk, corridor, rng);
  }

  // Place features
  for (const room of rooms) {
    if (room.isBossRoom) {
      placeBossRoomFeatures(chunk, room, rng);
    } else {
      placeRoomFeatures(chunk, room, rng);
    }
  }

  // Place traps in corridors and some rooms
  for (const corridor of corridors) {
    placeCorridorTraps(chunk, corridor, rng);
  }

  return { rooms, corridors };
}

function getWallBlock(rng: () => number): BlockType {
  const r = rng();
  if (r < 0.35) return BlockType.MOSSY_STONE_BRICKS;
  if (r < 0.55) return BlockType.CRACKED_STONE_BRICKS;
  return BlockType.STONE_BRICKS;
}

function carveRoom(chunk: ChunkData, room: DungeonRoom, rng: () => number): void {
  const { x, y, z, width, height, depth } = room;

  for (let rx = x; rx < x + width; rx++) {
    for (let rz = z; rz < z + depth; rz++) {
      // Floor
      chunk.setBlock(rx, y, rz, getWallBlock(rng));

      // Air inside
      for (let ry = y + 1; ry < y + height; ry++) {
        chunk.setBlock(rx, ry, rz, BlockType.AIR);
      }

      // Ceiling
      chunk.setBlock(rx, y + height, rz, getWallBlock(rng));
    }
  }

  // Walls (replace edges that face outward with dungeon bricks)
  for (let ry = y; ry <= y + height; ry++) {
    for (let rx = x; rx < x + width; rx++) {
      if (z > 0) chunk.setBlock(rx, ry, z, getWallBlock(rng));
      if (z + depth < CHUNK_SIZE) chunk.setBlock(rx, ry, z + depth - 1, getWallBlock(rng));
    }
    for (let rz = z; rz < z + depth; rz++) {
      if (x > 0) chunk.setBlock(x, ry, rz, getWallBlock(rng));
      if (x + width < CHUNK_SIZE) chunk.setBlock(x + width - 1, ry, rz, getWallBlock(rng));
    }
  }

  // Re-carve interior air (walls may have overwritten some air)
  for (let rx = x + 1; rx < x + width - 1; rx++) {
    for (let rz = z + 1; rz < z + depth - 1; rz++) {
      for (let ry = y + 1; ry < y + height; ry++) {
        chunk.setBlock(rx, ry, rz, BlockType.AIR);
      }
    }
  }
}

function carveCorridor(chunk: ChunkData, corridor: DungeonCorridor, rng: () => number): void {
  const from = corridor.from;
  const to = corridor.to;

  // Connect room centers with L-shaped corridor
  const fromCx = Math.floor(from.x + from.width / 2);
  const fromCz = Math.floor(from.z + from.depth / 2);
  const toCx = Math.floor(to.x + to.width / 2);
  const toCz = Math.floor(to.z + to.depth / 2);
  const y = from.y; // same level

  // Horizontal segment (along X)
  const xMin = Math.min(fromCx, toCx);
  const xMax = Math.max(fromCx, toCx);
  for (let x = xMin; x <= xMax; x++) {
    if (x >= 0 && x < CHUNK_SIZE && fromCz >= 0 && fromCz < CHUNK_SIZE) {
      chunk.setBlock(x, y, fromCz, getWallBlock(rng)); // floor
      chunk.setBlock(x, y + 1, fromCz, BlockType.AIR);
      chunk.setBlock(x, y + 2, fromCz, BlockType.AIR);
      chunk.setBlock(x, y + 3, fromCz, getWallBlock(rng)); // ceiling
    }
  }

  // Vertical segment (along Z)
  const zMin = Math.min(fromCz, toCz);
  const zMax = Math.max(fromCz, toCz);
  for (let z = zMin; z <= zMax; z++) {
    if (toCx >= 0 && toCx < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      chunk.setBlock(toCx, y, z, getWallBlock(rng)); // floor
      chunk.setBlock(toCx, y + 1, z, BlockType.AIR);
      chunk.setBlock(toCx, y + 2, z, BlockType.AIR);
      chunk.setBlock(toCx, y + 3, z, getWallBlock(rng)); // ceiling
    }
  }
}

function placeRoomFeatures(chunk: ChunkData, room: DungeonRoom, rng: () => number): void {
  const { x, y, z, width, depth } = room;

  // Torch in corner
  const torchX = x + 1;
  const torchZ = z + 1;
  if (torchX < CHUNK_SIZE && torchZ < CHUNK_SIZE) {
    chunk.setBlock(torchX, y + 1, torchZ, BlockType.TORCH);
  }

  // Maybe a chest (50% chance)
  if (rng() < 0.5 && width > 3 && depth > 3) {
    const cx = x + Math.floor(width / 2);
    const cz = z + Math.floor(depth / 2);
    chunk.setBlock(cx, y + 1, cz, BlockType.CHEST);
  }

  // Maybe spike traps on floor (40% chance)
  if (rng() < 0.4 && width > 3 && depth > 3) {
    // Place 1-2 spikes
    const spikeCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < spikeCount; i++) {
      const sx = x + 1 + Math.floor(rng() * (width - 2));
      const sz = z + 1 + Math.floor(rng() * (depth - 2));
      if (chunk.getBlock(sx, y + 1, sz) === BlockType.AIR) {
        chunk.setBlock(sx, y + 1, sz, BlockType.SPIKE_TRAP);
      }
    }
  }
}

function placeBossRoomFeatures(chunk: ChunkData, room: DungeonRoom, rng: () => number): void {
  const { x, y, z, width, depth } = room;
  const cx = x + Math.floor(width / 2);
  const cz = z + Math.floor(depth / 2);

  // Spawner in center
  chunk.setBlock(cx, y + 1, cz, BlockType.SPAWNER);

  // Chest with boss loot
  const chestX = cx + (rng() > 0.5 ? 1 : -1);
  if (chestX >= x + 1 && chestX < x + width - 1) {
    chunk.setBlock(chestX, y + 1, cz, BlockType.CHEST);
  } else {
    chunk.setBlock(cx, y + 1, cz + 1, BlockType.CHEST);
  }

  // Torches in corners
  const corners = [
    [x + 1, z + 1],
    [x + width - 2, z + 1],
    [x + 1, z + depth - 2],
    [x + width - 2, z + depth - 2],
  ];
  for (const [tx, tz] of corners) {
    if (tx >= 0 && tx < CHUNK_SIZE && tz >= 0 && tz < CHUNK_SIZE) {
      if (chunk.getBlock(tx, y + 1, tz) === BlockType.AIR) {
        chunk.setBlock(tx, y + 1, tz, BlockType.TORCH);
      }
    }
  }
}

function placeCorridorTraps(chunk: ChunkData, corridor: DungeonCorridor, rng: () => number): void {
  const from = corridor.from;
  const to = corridor.to;
  const y = from.y;

  const fromCx = Math.floor(from.x + from.width / 2);
  const fromCz = Math.floor(from.z + from.depth / 2);
  const toCx = Math.floor(to.x + to.width / 2);
  const toCz = Math.floor(to.z + to.depth / 2);

  // Place arrow trap in wall along corridor (30% chance per corridor)
  if (rng() < 0.3) {
    // Along the horizontal corridor
    const midX = Math.floor((fromCx + toCx) / 2);
    if (midX >= 1 && midX < CHUNK_SIZE - 1 && fromCz >= 1 && fromCz < CHUNK_SIZE - 1) {
      // Place arrow trap in wall next to corridor
      const trapZ = fromCz - 1;
      if (trapZ >= 0 && chunk.getBlock(midX, y + 1, trapZ) !== BlockType.AIR) {
        chunk.setBlock(midX, y + 1, trapZ, BlockType.ARROW_TRAP);
      }
    }
  }

  // Place spike trap in corridor (40% chance)
  if (rng() < 0.4) {
    const midX = Math.floor((fromCx + toCx) / 2);
    if (midX >= 0 && midX < CHUNK_SIZE && fromCz >= 0 && fromCz < CHUNK_SIZE) {
      if (chunk.getBlock(midX, y + 1, fromCz) === BlockType.AIR) {
        chunk.setBlock(midX, y + 1, fromCz, BlockType.SPIKE_TRAP);
      }
    }
  }
}
