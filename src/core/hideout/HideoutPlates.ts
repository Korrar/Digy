import { BlockType } from '../voxel/BlockRegistry';
import { ChunkData } from '../voxel/ChunkData';

/**
 * A plate template: 32x32 blocks wide, up to 32 blocks high (matching chunk height).
 * Stored as a flat array of block types indexed by [y][z][x].
 * Ground level is y=0..2 (stone/dirt/grass), decorations start at y=3.
 */
export interface PlateTemplate {
  id: string;
  name: string;
  description: string;
  /** Generate the 4 chunks (2x2) for this plate */
  generate: () => BlockType[][][];
}

const PLATE_SIZE = 32; // 32x32 blocks
const MAX_HEIGHT = 8;  // we only use up to y=7 (ground 0-2, structures 3-6)

function createEmpty(): BlockType[][][] {
  const data: BlockType[][][] = [];
  for (let y = 0; y < MAX_HEIGHT; y++) {
    data[y] = [];
    for (let z = 0; z < PLATE_SIZE; z++) {
      data[y][z] = new Array(PLATE_SIZE).fill(BlockType.AIR);
    }
  }
  return data;
}

function fillGround(data: BlockType[][][], groundBlock: BlockType = BlockType.GRASS) {
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      data[0][z][x] = BlockType.STONE;
      data[1][z][x] = BlockType.DIRT;
      data[2][z][x] = groundBlock;
    }
  }
}

function setBlock(data: BlockType[][][], x: number, y: number, z: number, type: BlockType) {
  if (x >= 0 && x < PLATE_SIZE && z >= 0 && z < PLATE_SIZE && y >= 0 && y < MAX_HEIGHT) {
    data[y][z][x] = type;
  }
}

// --- Plate templates ---

function generateGarden(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Flower beds in corners
  const flowerPatches = [
    { cx: 4, cz: 4 }, { cx: 26, cz: 4 },
    { cx: 4, cz: 26 }, { cx: 26, cz: 26 },
  ];
  for (const patch of flowerPatches) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = patch.cx + dx;
        const z = patch.cz + dz;
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          const flowers = [BlockType.FLOWER_RED, BlockType.FLOWER_YELLOW, BlockType.FLOWER_BLUE, BlockType.FLOWER_ORCHID];
          setBlock(data, x, 3, z, flowers[(dx + dz + 10) % flowers.length]);
        }
      }
    }
  }

  // Stone path through center
  for (let i = 0; i < PLATE_SIZE; i++) {
    setBlock(data, 15, 2, i, BlockType.COBBLESTONE);
    setBlock(data, 16, 2, i, BlockType.COBBLESTONE);
    setBlock(data, i, 2, 15, BlockType.COBBLESTONE);
    setBlock(data, i, 2, 16, BlockType.COBBLESTONE);
  }

  // Central fountain (small cobblestone ring with water)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const dist = Math.abs(dx) + Math.abs(dz);
      if (dist === 3 || dist === 4) {
        setBlock(data, 16 + dx, 3, 16 + dz, BlockType.COBBLESTONE);
      } else if (dist <= 2 && !(dx === 0 && dz === 0)) {
        setBlock(data, 16 + dx, 3, 16 + dz, BlockType.WATER);
      }
    }
  }
  // Fountain center pillar
  setBlock(data, 16, 3, 16, BlockType.STONE_BRICKS);
  setBlock(data, 16, 4, 16, BlockType.STONE_BRICKS);

  // Fences along edges (every other block)
  for (let i = 1; i < PLATE_SIZE - 1; i += 2) {
    setBlock(data, 0, 3, i, BlockType.FENCE_OAK);
    setBlock(data, 31, 3, i, BlockType.FENCE_OAK);
    setBlock(data, i, 3, 0, BlockType.FENCE_OAK);
    setBlock(data, i, 3, 31, BlockType.FENCE_OAK);
  }

  // Some trees
  const trees = [{ x: 8, z: 8 }, { x: 24, z: 8 }, { x: 8, z: 24 }, { x: 24, z: 24 }];
  for (const t of trees) {
    // trunk
    setBlock(data, t.x, 3, t.z, BlockType.WOOD);
    setBlock(data, t.x, 4, t.z, BlockType.WOOD);
    setBlock(data, t.x, 5, t.z, BlockType.WOOD);
    // canopy
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(data, t.x + dx, 6, t.z + dz, BlockType.LEAVES);
      }
    }
  }

  return data;
}

function generateFarm(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Plowed rows (alternating dirt and water channels)
  for (let z = 2; z < 30; z++) {
    for (let x = 2; x < 30; x++) {
      if (x % 5 === 0) {
        // Water channel
        setBlock(data, x, 2, z, BlockType.WATER);
      } else {
        // Farmland (use dirt with crops on top)
        setBlock(data, x, 2, z, BlockType.DIRT);
        // Different crops based on row
        const cropType = z % 8 < 4 ? BlockType.TALL_GRASS : BlockType.FERN;
        if (x % 5 !== 1 && x % 5 !== 4) {
          setBlock(data, x, 3, z, cropType);
        }
      }
    }
  }

  // Wooden fence around farm
  for (let i = 1; i < 31; i++) {
    setBlock(data, 1, 3, i, BlockType.FENCE_OAK);
    setBlock(data, 30, 3, i, BlockType.FENCE_OAK);
    setBlock(data, i, 3, 1, BlockType.FENCE_OAK);
    setBlock(data, i, 3, 30, BlockType.FENCE_OAK);
  }

  // Small barn in corner
  for (let x = 3; x <= 7; x++) {
    for (let z = 3; z <= 7; z++) {
      setBlock(data, x, 3, z, BlockType.PLANKS);
      if (x === 3 || x === 7 || z === 3 || z === 7) {
        setBlock(data, x, 4, z, BlockType.PLANKS);
        setBlock(data, x, 5, z, BlockType.PLANKS);
      }
    }
  }
  // Barn roof (slabs)
  for (let x = 3; x <= 7; x++) {
    for (let z = 3; z <= 7; z++) {
      setBlock(data, x, 6, z, BlockType.PLANKS_SLAB);
    }
  }
  // Barn door opening
  setBlock(data, 5, 4, 7, BlockType.AIR);
  setBlock(data, 5, 5, 7, BlockType.AIR);

  // Haystacks (gold blocks as stand-in)
  setBlock(data, 4, 3, 5, BlockType.SAND);
  setBlock(data, 6, 3, 5, BlockType.SAND);

  return data;
}

function generateMine(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.STONE);

  // Rocky terrain - replace grass with stone/gravel
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      data[2][z][x] = (x + z) % 3 === 0 ? BlockType.GRAVEL : BlockType.STONE;
    }
  }

  // Mine entrance (stone bricks frame)
  for (let x = 13; x <= 18; x++) {
    setBlock(data, x, 3, 15, BlockType.STONE_BRICKS);
    setBlock(data, x, 6, 15, BlockType.STONE_BRICKS);
  }
  setBlock(data, 13, 4, 15, BlockType.STONE_BRICKS);
  setBlock(data, 13, 5, 15, BlockType.STONE_BRICKS);
  setBlock(data, 18, 4, 15, BlockType.STONE_BRICKS);
  setBlock(data, 18, 5, 15, BlockType.STONE_BRICKS);

  // Rails leading into mine
  for (let z = 16; z < 30; z++) {
    setBlock(data, 15, 3, z, BlockType.RAIL);
    setBlock(data, 16, 3, z, BlockType.RAIL);
  }

  // Ore deposits scattered on ground
  const ores = [
    { x: 5, z: 8, type: BlockType.COAL_ORE },
    { x: 25, z: 5, type: BlockType.IRON_ORE },
    { x: 10, z: 22, type: BlockType.GOLD_ORE },
    { x: 27, z: 20, type: BlockType.DIAMOND_ORE },
  ];
  for (const ore of ores) {
    setBlock(data, ore.x, 3, ore.z, ore.type);
    setBlock(data, ore.x + 1, 3, ore.z, ore.type);
    setBlock(data, ore.x, 3, ore.z + 1, ore.type);
  }

  // Stone pillars
  const pillars = [{ x: 6, z: 6 }, { x: 25, z: 6 }, { x: 6, z: 25 }, { x: 25, z: 25 }];
  for (const p of pillars) {
    for (let y = 3; y <= 6; y++) {
      setBlock(data, p.x, y, p.z, BlockType.COBBLESTONE);
    }
  }

  // Torches near pillars
  for (const p of pillars) {
    setBlock(data, p.x + 1, 4, p.z, BlockType.TORCH);
  }

  // Minecart tracks loop
  for (let x = 3; x <= 28; x++) {
    setBlock(data, x, 3, 3, BlockType.RAIL);
    setBlock(data, x, 3, 28, BlockType.RAIL);
  }
  for (let z = 3; z <= 28; z++) {
    setBlock(data, 3, 3, z, BlockType.RAIL);
    setBlock(data, 28, 3, z, BlockType.RAIL);
  }

  return data;
}

function generateCampsite(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Central campfire (lava block surrounded by stone)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) {
        setBlock(data, 16, 3, 16, BlockType.LAVA);
      } else {
        setBlock(data, 16 + dx, 3, 16 + dz, BlockType.COBBLESTONE);
      }
    }
  }

  // Tents (wooden structures with slabs as roofs)
  const tents = [
    { x: 6, z: 10 }, { x: 24, z: 10 },
    { x: 6, z: 22 }, { x: 24, z: 22 },
  ];
  for (const t of tents) {
    // Base walls
    for (let dx = 0; dx <= 3; dx++) {
      setBlock(data, t.x + dx, 3, t.z, BlockType.PLANKS);
      setBlock(data, t.x + dx, 3, t.z + 3, BlockType.PLANKS);
      setBlock(data, t.x + dx, 4, t.z, BlockType.PLANKS);
      setBlock(data, t.x + dx, 4, t.z + 3, BlockType.PLANKS);
    }
    for (let dz = 0; dz <= 3; dz++) {
      setBlock(data, t.x, 3, t.z + dz, BlockType.PLANKS);
      setBlock(data, t.x, 4, t.z + dz, BlockType.PLANKS);
    }
    // Roof
    for (let dx = 0; dx <= 3; dx++) {
      for (let dz = 0; dz <= 3; dz++) {
        setBlock(data, t.x + dx, 5, t.z + dz, BlockType.PLANKS_SLAB);
      }
    }
    // Door opening
    setBlock(data, t.x + 1, 3, t.z + 3, BlockType.AIR);
    setBlock(data, t.x + 2, 3, t.z + 3, BlockType.AIR);
    setBlock(data, t.x + 1, 4, t.z + 3, BlockType.AIR);
    setBlock(data, t.x + 2, 4, t.z + 3, BlockType.AIR);

    // Torch inside
    setBlock(data, t.x + 1, 4, t.z + 1, BlockType.TORCH);
  }

  // Log seats around campfire
  const seats = [
    { x: 14, z: 14 }, { x: 18, z: 14 },
    { x: 14, z: 18 }, { x: 18, z: 18 },
  ];
  for (const s of seats) {
    setBlock(data, s.x, 3, s.z, BlockType.WOOD);
  }

  // Scattered trees on edges
  const edgeTrees = [
    { x: 2, z: 2 }, { x: 29, z: 2 }, { x: 2, z: 29 }, { x: 29, z: 29 },
    { x: 15, z: 1 }, { x: 1, z: 15 },
  ];
  for (const t of edgeTrees) {
    setBlock(data, t.x, 3, t.z, BlockType.WOOD);
    setBlock(data, t.x, 4, t.z, BlockType.WOOD);
    setBlock(data, t.x, 5, t.z, BlockType.WOOD);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(data, t.x + dx, 6, t.z + dz, BlockType.LEAVES);
      }
    }
  }

  return data;
}

function generateMarketplace(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Cobblestone floor center area
  for (let x = 4; x < 28; x++) {
    for (let z = 4; z < 28; z++) {
      setBlock(data, x, 2, z, BlockType.COBBLESTONE);
    }
  }

  // Market stalls (4 stalls)
  const stalls = [
    { x: 6, z: 6, color: BlockType.PLANKS },
    { x: 20, z: 6, color: BlockType.COBBLESTONE },
    { x: 6, z: 20, color: BlockType.STONE_BRICKS },
    { x: 20, z: 20, color: BlockType.PLANKS },
  ];
  for (const stall of stalls) {
    // Counter
    for (let dx = 0; dx < 6; dx++) {
      setBlock(data, stall.x + dx, 3, stall.z + 3, stall.color);
    }
    // Pillars
    setBlock(data, stall.x, 3, stall.z, BlockType.FENCE_OAK);
    setBlock(data, stall.x, 4, stall.z, BlockType.FENCE_OAK);
    setBlock(data, stall.x + 5, 3, stall.z, BlockType.FENCE_OAK);
    setBlock(data, stall.x + 5, 4, stall.z, BlockType.FENCE_OAK);
    setBlock(data, stall.x, 3, stall.z + 3, stall.color);
    setBlock(data, stall.x + 5, 3, stall.z + 3, stall.color);
    // Roof
    for (let dx = 0; dx < 6; dx++) {
      for (let dz = 0; dz <= 3; dz++) {
        setBlock(data, stall.x + dx, 5, stall.z + dz, BlockType.PLANKS_SLAB);
      }
    }
    // Chest on counter
    setBlock(data, stall.x + 2, 4, stall.z + 3, BlockType.CHEST);
  }

  // Central well
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) + Math.abs(dz) === 2) {
        setBlock(data, 16 + dx, 3, 16 + dz, BlockType.STONE_BRICKS);
        setBlock(data, 16 + dx, 4, 16 + dz, BlockType.FENCE_OAK);
      } else if (dx === 0 && dz === 0) {
        setBlock(data, 16, 3, 16, BlockType.WATER);
      } else {
        setBlock(data, 16 + dx, 3, 16 + dz, BlockType.STONE_BRICKS);
      }
    }
  }

  // Lamp posts
  const lamps = [{ x: 12, z: 12 }, { x: 20, z: 12 }, { x: 12, z: 20 }, { x: 20, z: 20 }];
  for (const l of lamps) {
    setBlock(data, l.x, 3, l.z, BlockType.FENCE_OAK);
    setBlock(data, l.x, 4, l.z, BlockType.FENCE_OAK);
    setBlock(data, l.x, 5, l.z, BlockType.LAMP);
  }

  return data;
}

function generatePark(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Winding path (cobblestone)
  for (let i = 0; i < PLATE_SIZE; i++) {
    const offset = Math.round(Math.sin(i * 0.3) * 4);
    setBlock(data, 16 + offset, 2, i, BlockType.COBBLESTONE);
    setBlock(data, 16 + offset + 1, 2, i, BlockType.COBBLESTONE);
  }

  // Pond
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      if (dx * dx + dz * dz <= 9) {
        setBlock(data, 8 + dx, 2, 16 + dz, BlockType.WATER);
      }
    }
  }

  // Lily pads on pond
  setBlock(data, 7, 3, 15, BlockType.LILY_PAD);
  setBlock(data, 9, 3, 17, BlockType.LILY_PAD);
  setBlock(data, 8, 3, 14, BlockType.LILY_PAD);

  // Trees scattered
  const trees = [
    { x: 24, z: 6 }, { x: 26, z: 16 }, { x: 22, z: 26 },
    { x: 4, z: 6 }, { x: 4, z: 26 },
  ];
  for (const t of trees) {
    setBlock(data, t.x, 3, t.z, BlockType.WOOD);
    setBlock(data, t.x, 4, t.z, BlockType.WOOD);
    setBlock(data, t.x, 5, t.z, BlockType.WOOD);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          setBlock(data, t.x + dx, 6, t.z + dz, BlockType.LEAVES);
        }
      }
    }
    setBlock(data, t.x, 6, t.z, BlockType.WOOD);
  }

  // Flower beds
  for (let x = 20; x < 28; x++) {
    setBlock(data, x, 3, 10, BlockType.FLOWER_RED);
    setBlock(data, x, 3, 11, BlockType.FLOWER_YELLOW);
  }

  // Benches (slabs)
  setBlock(data, 19, 3, 8, BlockType.PLANKS_SLAB);
  setBlock(data, 20, 3, 8, BlockType.PLANKS_SLAB);
  setBlock(data, 19, 3, 22, BlockType.PLANKS_SLAB);
  setBlock(data, 20, 3, 22, BlockType.PLANKS_SLAB);

  return data;
}

function generateWatchTower(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Central tower base (stone bricks)
  for (let x = 13; x <= 18; x++) {
    for (let z = 13; z <= 18; z++) {
      setBlock(data, x, 3, z, BlockType.STONE_BRICKS);
      if (x === 13 || x === 18 || z === 13 || z === 18) {
        setBlock(data, x, 4, z, BlockType.STONE_BRICKS);
        setBlock(data, x, 5, z, BlockType.STONE_BRICKS);
        setBlock(data, x, 6, z, BlockType.STONE_BRICKS);
      }
    }
  }
  // Tower entrance
  setBlock(data, 15, 4, 18, BlockType.AIR);
  setBlock(data, 16, 4, 18, BlockType.AIR);
  setBlock(data, 15, 5, 18, BlockType.AIR);
  setBlock(data, 16, 5, 18, BlockType.AIR);

  // Top platform with fence railing
  for (let x = 12; x <= 19; x++) {
    for (let z = 12; z <= 19; z++) {
      setBlock(data, x, 7, z, BlockType.PLANKS_SLAB);
    }
  }
  for (let i = 12; i <= 19; i++) {
    setBlock(data, i, 7, 12, BlockType.FENCE_OAK);
    setBlock(data, i, 7, 19, BlockType.FENCE_OAK);
    setBlock(data, 12, 7, i, BlockType.FENCE_OAK);
    setBlock(data, 19, 7, i, BlockType.FENCE_OAK);
  }

  // Torches on corners
  setBlock(data, 13, 7, 13, BlockType.TORCH);
  setBlock(data, 18, 7, 13, BlockType.TORCH);
  setBlock(data, 13, 7, 18, BlockType.TORCH);
  setBlock(data, 18, 7, 18, BlockType.TORCH);

  // Surrounding path
  for (let i = 8; i <= 23; i++) {
    setBlock(data, i, 2, 8, BlockType.COBBLESTONE);
    setBlock(data, i, 2, 23, BlockType.COBBLESTONE);
    setBlock(data, 8, 2, i, BlockType.COBBLESTONE);
    setBlock(data, 23, 2, i, BlockType.COBBLESTONE);
  }

  // Corner gardens
  const gardenCorners = [{ x: 3, z: 3 }, { x: 27, z: 3 }, { x: 3, z: 27 }, { x: 27, z: 27 }];
  for (const g of gardenCorners) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(data, g.x + dx, 3, g.z + dz, BlockType.FLOWER_RED);
      }
    }
  }

  return data;
}

function generateStonePlaza(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.STONE);

  // Checkered stone brick and cobblestone floor
  for (let x = 0; x < PLATE_SIZE; x++) {
    for (let z = 0; z < PLATE_SIZE; z++) {
      data[2][z][x] = (x + z) % 2 === 0 ? BlockType.STONE_BRICKS : BlockType.COBBLESTONE;
    }
  }

  // Four pillared arches
  const archPositions = [
    { x: 8, z: 16, dir: 'x' as const },
    { x: 24, z: 16, dir: 'x' as const },
    { x: 16, z: 8, dir: 'z' as const },
    { x: 16, z: 24, dir: 'z' as const },
  ];
  for (const arch of archPositions) {
    // Two pillars
    const offsets = arch.dir === 'x' ? [[0, -2], [0, 2]] : [[-2, 0], [2, 0]];
    for (const [ox, oz] of offsets) {
      for (let y = 3; y <= 6; y++) {
        setBlock(data, arch.x + ox, y, arch.z + oz, BlockType.STONE_BRICKS);
      }
    }
    // Top beam
    if (arch.dir === 'x') {
      for (let dz = -2; dz <= 2; dz++) {
        setBlock(data, arch.x, 6, arch.z + dz, BlockType.STONE_BRICKS_SLAB);
      }
    } else {
      for (let dx = -2; dx <= 2; dx++) {
        setBlock(data, arch.x + dx, 6, arch.z, BlockType.STONE_BRICKS_SLAB);
      }
    }
  }

  // Central statue (stone pillar with lamp on top)
  setBlock(data, 16, 3, 16, BlockType.STONE_BRICKS);
  setBlock(data, 16, 4, 16, BlockType.STONE_BRICKS);
  setBlock(data, 16, 5, 16, BlockType.STONE_BRICKS);
  setBlock(data, 16, 6, 16, BlockType.LAMP);

  // Lamp posts at edges
  for (let i = 4; i < PLATE_SIZE; i += 8) {
    for (const edge of [1, 30]) {
      setBlock(data, i, 3, edge, BlockType.FENCE_OAK);
      setBlock(data, i, 4, edge, BlockType.LAMP);
      setBlock(data, edge, 3, i, BlockType.FENCE_OAK);
      setBlock(data, edge, 4, i, BlockType.LAMP);
    }
  }

  return data;
}

// --- Registry ---

export const PLATE_TEMPLATES: PlateTemplate[] = [
  {
    id: 'garden',
    name: 'Ogrod',
    description: 'Ogrod z fontanna, drzewami i kwiatami',
    generate: generateGarden,
  },
  {
    id: 'farm',
    name: 'Farma',
    description: 'Pole uprawne z stodola i kanalikami',
    generate: generateFarm,
  },
  {
    id: 'mine',
    name: 'Kopalnia',
    description: 'Wejscie do kopalni z torami i rudami',
    generate: generateMine,
  },
  {
    id: 'campsite',
    name: 'Obozowisko',
    description: 'Oboz z namiotami i ogniskiem',
    generate: generateCampsite,
  },
  {
    id: 'marketplace',
    name: 'Targ',
    description: 'Rynek z kramami i studnia',
    generate: generateMarketplace,
  },
  {
    id: 'park',
    name: 'Park',
    description: 'Park ze stawem, alejkami i lawkami',
    generate: generatePark,
  },
  {
    id: 'watchtower',
    name: 'Strażnica',
    description: 'Wieza straznicza z platforma widokowa',
    generate: generateWatchTower,
  },
  {
    id: 'plaza',
    name: 'Plac',
    description: 'Kamienny plac z lukami i pomnikiem',
    generate: generateStonePlaza,
  },
];

/**
 * Apply a plate template to chunks at the given chunk origin.
 * originCx/originCz is the top-left chunk of the 2x2 plate area.
 * Returns array of 4 ChunkData objects.
 */
export function applyPlateTemplate(
  template: PlateTemplate,
  originCx: number,
  originCz: number,
): ChunkData[] {
  const blockData = template.generate();
  const chunks: ChunkData[] = [];

  // Create 4 chunks (2x2)
  for (let dcx = 0; dcx < 2; dcx++) {
    for (let dcz = 0; dcz < 2; dcz++) {
      const chunk = new ChunkData(originCx + dcx, originCz + dcz);
      const xOff = dcx * 16;
      const zOff = dcz * 16;

      for (let y = 0; y < Math.min(blockData.length, 32); y++) {
        for (let lz = 0; lz < 16; lz++) {
          for (let lx = 0; lx < 16; lx++) {
            const wx = xOff + lx;
            const wz = zOff + lz;
            if (wx < PLATE_SIZE && wz < PLATE_SIZE && blockData[y] && blockData[y][wz]) {
              const block = blockData[y][wz][wx];
              if (block !== BlockType.AIR) {
                chunk.setBlock(lx, y, lz, block);
              }
            }
          }
        }
      }

      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Get available plate positions around the main 2x2 platform.
 * Main platform is at chunks (0,0),(0,1),(1,0),(1,1).
 * Returns positions as chunk origins (top-left of 2x2 area).
 */
export interface PlatePosition {
  label: string;
  originCx: number;
  originCz: number;
}

export const PLATE_POSITIONS: PlatePosition[] = [
  { label: 'N',  originCx: 0,  originCz: -2 },
  { label: 'S',  originCx: 0,  originCz: 2  },
  { label: 'E',  originCx: 2,  originCz: 0  },
  { label: 'W',  originCx: -2, originCz: 0  },
  { label: 'NE', originCx: 2,  originCz: -2 },
  { label: 'NW', originCx: -2, originCz: -2 },
  { label: 'SE', originCx: 2,  originCz: 2  },
  { label: 'SW', originCx: -2, originCz: 2  },
];
