import { ChunkData } from '../voxel/ChunkData';
import { BlockType } from '../voxel/BlockRegistry';
import { NoiseGenerator } from './NoiseGenerator';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';
import { generateDungeon, type DungeonLayout } from './DungeonGenerator';

type Block = [number, number, number, BlockType]; // [dx, dy, dz, type]

interface Structure {
  name: string;
  blocks: Block[];
  width: number;
  depth: number;
  height: number;
}

// Forest cabin (5x5x4)
function createCabin(): Structure {
  const blocks: Block[] = [];
  // Floor
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      blocks.push([x, 0, z, BlockType.PLANKS]);
    }
  }
  // Walls (hollow)
  for (let y = 1; y <= 3; y++) {
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        if (x === 0 || x === 4 || z === 0 || z === 4) {
          // Door opening
          if (x === 2 && z === 0 && y <= 2) continue;
          // Window
          if ((x === 0 || x === 4) && z === 2 && y === 2) {
            blocks.push([x, y, z, BlockType.GLASS]);
          } else {
            blocks.push([x, y, z, BlockType.PLANKS]);
          }
        }
      }
    }
  }
  // Roof
  for (let x = -1; x <= 5; x++) {
    for (let z = 0; z < 5; z++) {
      blocks.push([x, 4, z, BlockType.WOOD]);
    }
  }
  // Torch inside
  blocks.push([2, 2, 2, BlockType.TORCH]);
  // Chest with loot
  blocks.push([3, 1, 3, BlockType.CHEST]);
  return { name: 'cabin', blocks, width: 5, depth: 5, height: 5 };
}

// Desert pyramid (7x7x5)
function createPyramid(): Structure {
  const blocks: Block[] = [];
  for (let y = 0; y < 5; y++) {
    const size = 7 - y * 2;
    const offset = y;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        // Hollow inside (keep shell only for y > 0)
        if (y > 0 && y < 4 && x > 0 && x < size - 1 && z > 0 && z < size - 1) {
          if (y === 1) {
            // Floor
            blocks.push([offset + x, y, offset + z, BlockType.SANDSTONE]);
          }
          // Entrance
          if (x === Math.floor(size / 2) && z === 0 && y <= 2) continue;
          continue;
        }
        blocks.push([offset + x, y, offset + z, BlockType.SANDSTONE]);
      }
    }
  }
  // Treasure inside
  blocks.push([3, 1, 3, BlockType.CHEST]);
  blocks.push([3, 2, 3, BlockType.TORCH]);
  return { name: 'pyramid', blocks, width: 7, depth: 7, height: 5 };
}

// Mountain watchtower (3x3x8)
function createWatchtower(): Structure {
  const blocks: Block[] = [];
  // Base platform
  for (let x = 0; x < 3; x++) {
    for (let z = 0; z < 3; z++) {
      blocks.push([x, 0, z, BlockType.STONE_BRICKS]);
    }
  }
  // Pillar corners
  for (let y = 1; y <= 6; y++) {
    blocks.push([0, y, 0, BlockType.STONE_BRICKS]);
    blocks.push([2, y, 0, BlockType.STONE_BRICKS]);
    blocks.push([0, y, 2, BlockType.STONE_BRICKS]);
    blocks.push([2, y, 2, BlockType.STONE_BRICKS]);
  }
  // Top platform
  for (let x = -1; x <= 3; x++) {
    for (let z = -1; z <= 3; z++) {
      blocks.push([x, 7, z, BlockType.STONE_BRICKS]);
    }
  }
  // Battlements
  blocks.push([-1, 8, -1, BlockType.STONE_BRICKS]);
  blocks.push([3, 8, -1, BlockType.STONE_BRICKS]);
  blocks.push([-1, 8, 3, BlockType.STONE_BRICKS]);
  blocks.push([3, 8, 3, BlockType.STONE_BRICKS]);
  blocks.push([1, 8, -1, BlockType.STONE_BRICKS]);
  blocks.push([1, 8, 3, BlockType.STONE_BRICKS]);
  blocks.push([-1, 8, 1, BlockType.STONE_BRICKS]);
  blocks.push([3, 8, 1, BlockType.STONE_BRICKS]);
  // Torch on top
  blocks.push([1, 8, 1, BlockType.TORCH]);
  // Chest at base
  blocks.push([1, 1, 1, BlockType.CHEST]);
  return { name: 'watchtower', blocks, width: 5, depth: 5, height: 9 };
}

// Swamp boardwalk (7x2x1)
function createBoardwalk(): Structure {
  const blocks: Block[] = [];
  for (let x = 0; x < 7; x++) {
    blocks.push([x, 0, 0, BlockType.WOOD]); // support
    blocks.push([x, 1, 0, BlockType.PLANKS]); // walkway
    blocks.push([x, 1, 1, BlockType.PLANKS]);
  }
  return { name: 'boardwalk', blocks, width: 7, depth: 2, height: 2 };
}

// Tundra igloo (5x5x3 dome)
function createIgloo(): Structure {
  const blocks: Block[] = [];
  const cx = 2, cz = 2;
  // Dome shape
  for (let y = 0; y < 3; y++) {
    const radius = y === 0 ? 2.5 : y === 1 ? 2.0 : 1.0;
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        const dx = x - cx;
        const dz = z - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radius && dist > radius - 1.2) {
          // Door opening
          if (x === 2 && z === 0 && y === 0) continue;
          blocks.push([x, y, z, BlockType.SNOW]);
        }
      }
    }
  }
  // Cap
  blocks.push([2, 3, 2, BlockType.ICE]);
  // Hidden chest
  blocks.push([2, 1, 2, BlockType.CHEST]);
  // Floor
  for (let x = 1; x < 4; x++) {
    for (let z = 1; z < 4; z++) {
      blocks.push([x, 0, z, BlockType.SNOW]);
    }
  }
  return { name: 'igloo', blocks, width: 5, depth: 5, height: 4 };
}

// Cave mine corridor
function createMineCorridor(): Structure {
  const blocks: Block[] = [];
  for (let z = 0; z < 5; z++) {
    // Support pillars
    blocks.push([0, 0, z, BlockType.WOOD]);
    blocks.push([0, 1, z, BlockType.WOOD]);
    blocks.push([0, 2, z, BlockType.WOOD]);
    blocks.push([2, 0, z, BlockType.WOOD]);
    blocks.push([2, 1, z, BlockType.WOOD]);
    blocks.push([2, 2, z, BlockType.WOOD]);
    // Top beam
    blocks.push([1, 2, z, BlockType.PLANKS]);
  }
  // Torch at entrance
  blocks.push([1, 1, 0, BlockType.TORCH]);
  blocks.push([1, 1, 4, BlockType.TORCH]);
  // Chest at the end of the corridor
  blocks.push([1, 0, 3, BlockType.CHEST]);
  return { name: 'mine_corridor', blocks, width: 3, depth: 5, height: 3 };
}

const BIOME_STRUCTURES: Record<string, Structure[]> = {
  forest: [createCabin()],
  desert: [createPyramid()],
  mountains: [createWatchtower()],
  swamp: [createBoardwalk()],
  tundra: [createIgloo()],
  cave: [createMineCorridor()],
};

/** Last generated dungeon layout (for enemy spawning) */
let lastDungeonLayout: DungeonLayout | null = null;

export function getLastDungeonLayout(): DungeonLayout | null {
  return lastDungeonLayout;
}

/**
 * Try to place structures in a chunk based on biome type.
 * Called after terrain generation.
 */
export function placeStructures(
  chunk: ChunkData,
  biomeType: string,
  noise: NoiseGenerator
): void {
  const structures = BIOME_STRUCTURES[biomeType];
  if (!structures) return;

  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (const structure of structures) {
    // Use noise to decide if this chunk gets a structure
    const structureNoise = noise.get2D(ox * 0.1 + 1000, oz * 0.1 + 1000, 0.5);
    if (structureNoise < 0.3) continue;

    // Find placement position (center-ish of chunk, on solid ground)
    const sx = Math.floor(CHUNK_SIZE / 2 - structure.width / 2);
    const sz = Math.floor(CHUNK_SIZE / 2 - structure.depth / 2);

    // Find ground height at center
    let groundY = -1;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = chunk.getBlock(sx + Math.floor(structure.width / 2), y, sz + Math.floor(structure.depth / 2));
      if (block !== BlockType.AIR && block !== BlockType.WATER &&
          block !== BlockType.TALL_GRASS && block !== BlockType.FLOWER_RED &&
          block !== BlockType.FLOWER_YELLOW && block !== BlockType.FERN &&
          block !== BlockType.DEAD_BUSH && block !== BlockType.MUSHROOM) {
        groundY = y;
        break;
      }
    }

    if (groundY < 3) continue; // Too low / underwater

    // Place structure blocks
    for (const [dx, dy, dz, type] of structure.blocks) {
      const bx = sx + dx;
      const by = groundY + dy + 1;
      const bz = sz + dz;
      if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by >= 0 && by < CHUNK_HEIGHT) {
        chunk.setBlock(bx, by, bz, type);
      }
    }
  }

  // Generate dungeon in cave biome
  if (biomeType === 'cave') {
    const dungeonSeed = Math.abs(ox * 73856093 ^ oz * 19349663) | 0;
    const dungeonNoise = noise.get2D(ox * 0.05 + 2000, oz * 0.05 + 2000, 0.5);
    if (dungeonNoise > 0.1) {
      lastDungeonLayout = generateDungeon(chunk, dungeonSeed);
    }
  }
}
