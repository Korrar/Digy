import { BlockType } from '../voxel/BlockRegistry';
import { ChunkData } from '../voxel/ChunkData';

/**
 * A plate template: 32x32 blocks wide, up to 32 blocks high (matching chunk height).
 * Stored as a flat array of block types indexed by [y][z][x].
 * Ground level is y=0..2 (stone/dirt/grass), decorations start at y=3.
 * All plates are strictly natural - no man-made structures.
 */
export interface PlateTemplate {
  id: string;
  name: string;
  description: string;
  /** Generate the 4 chunks (2x2) for this plate */
  generate: () => BlockType[][][];
}

const PLATE_SIZE = 32; // 32x32 blocks
const MAX_HEIGHT = 8;  // we only use up to y=7 (ground 0-2, nature 3-6)

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

/** Simple seeded pseudo-random for deterministic plate generation */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function addTree(data: BlockType[][][], x: number, z: number, height: number, woodType: BlockType = BlockType.WOOD, leafType: BlockType = BlockType.LEAVES) {
  for (let y = 3; y < 3 + height; y++) {
    setBlock(data, x, y, z, woodType);
  }
  const topY = 3 + height;
  // Canopy
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= 3) {
        setBlock(data, x + dx, topY, z + dz, leafType);
      }
    }
  }
  setBlock(data, x, topY, z, woodType);
}

// --- Natural plate templates ---

function generateForest(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);
  const rand = seededRandom(42);

  // Dense trees
  const trees = [
    { x: 3, z: 4 }, { x: 9, z: 3 }, { x: 16, z: 2 }, { x: 24, z: 5 }, { x: 29, z: 3 },
    { x: 5, z: 12 }, { x: 14, z: 10 }, { x: 22, z: 11 }, { x: 28, z: 14 },
    { x: 2, z: 20 }, { x: 10, z: 18 }, { x: 18, z: 20 }, { x: 26, z: 19 },
    { x: 6, z: 27 }, { x: 15, z: 28 }, { x: 23, z: 26 }, { x: 30, z: 28 },
  ];
  for (const t of trees) {
    const height = 2 + Math.floor(rand() * 2); // 2-3 blocks trunk
    addTree(data, t.x, t.z, height);
  }

  // Undergrowth: tall grass, ferns, mushrooms
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (rand() < 0.15 && data[3][z][x] === BlockType.AIR) {
        const r = rand();
        if (r < 0.5) setBlock(data, x, 3, z, BlockType.TALL_GRASS);
        else if (r < 0.75) setBlock(data, x, 3, z, BlockType.FERN);
        else if (r < 0.9) setBlock(data, x, 3, z, BlockType.MUSHROOM);
        else setBlock(data, x, 3, z, BlockType.FLOWER_RED);
      }
    }
  }

  return data;
}

function generateMeadow(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);
  const rand = seededRandom(123);

  // Wildflower field with scattered flowers
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      const r = rand();
      if (r < 0.12) {
        const flowers = [BlockType.FLOWER_RED, BlockType.FLOWER_YELLOW, BlockType.FLOWER_BLUE, BlockType.FLOWER_ORCHID];
        setBlock(data, x, 3, z, flowers[Math.floor(rand() * flowers.length)]);
      } else if (r < 0.25) {
        setBlock(data, x, 3, z, BlockType.TALL_GRASS);
      }
    }
  }

  // A few lone trees
  const trees = [{ x: 6, z: 8 }, { x: 25, z: 14 }, { x: 12, z: 25 }];
  for (const t of trees) {
    addTree(data, t.x, t.z, 3);
  }

  // Small natural pond
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz <= 8) {
        setBlock(data, 20 + dx, 2, 6 + dz, BlockType.WATER);
        // Clear any flowers above water
        setBlock(data, 20 + dx, 3, 6 + dz, BlockType.AIR);
      }
    }
  }
  // Reeds around pond
  setBlock(data, 17, 3, 5, BlockType.TALL_GRASS);
  setBlock(data, 23, 3, 7, BlockType.TALL_GRASS);
  setBlock(data, 19, 3, 9, BlockType.FERN);

  return data;
}

function generateRockyHills(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.STONE);

  // Rocky surface with gravel patches
  const rand = seededRandom(777);
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      const r = rand();
      if (r < 0.3) data[2][z][x] = BlockType.GRAVEL;
      else if (r < 0.5) data[2][z][x] = BlockType.COBBLESTONE;
    }
  }

  // Stone outcrops (natural rock formations, max 3-4 blocks high)
  const outcrops = [
    { x: 6, z: 6, r: 3 }, { x: 24, z: 8, r: 2 },
    { x: 10, z: 22, r: 4 }, { x: 26, z: 25, r: 3 },
    { x: 16, z: 14, r: 2 },
  ];
  for (const o of outcrops) {
    for (let dx = -o.r; dx <= o.r; dx++) {
      for (let dz = -o.r; dz <= o.r; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= o.r) {
          const height = Math.max(1, Math.round((o.r - dist + 1)));
          const maxH = Math.min(height, 4);
          for (let y = 3; y < 3 + maxH; y++) {
            setBlock(data, o.x + dx, y, o.z + dz, BlockType.STONE);
          }
        }
      }
    }
  }

  // Ore veins exposed in rock
  setBlock(data, 7, 3, 7, BlockType.COAL_ORE);
  setBlock(data, 8, 3, 7, BlockType.COAL_ORE);
  setBlock(data, 25, 4, 9, BlockType.IRON_ORE);
  setBlock(data, 11, 4, 23, BlockType.GOLD_ORE);

  // A few hardy plants in crevices
  setBlock(data, 15, 3, 5, BlockType.DEAD_BUSH);
  setBlock(data, 20, 3, 18, BlockType.DEAD_BUSH);
  setBlock(data, 4, 3, 15, BlockType.TALL_GRASS);

  return data;
}

function generateSwamp(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.MUD);

  // Replace some ground with water (marshland)
  const rand = seededRandom(333);
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      // Create irregular water patches
      const noise = Math.sin(x * 0.4) * Math.cos(z * 0.3) + Math.sin(x * 0.15 + z * 0.2);
      if (noise > 0.3) {
        data[2][z][x] = BlockType.WATER;
      }
    }
  }

  // Lily pads on water
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[2][z][x] === BlockType.WATER && rand() < 0.12) {
        setBlock(data, x, 3, z, BlockType.LILY_PAD);
      }
    }
  }

  // Swamp trees (short, with vines)
  const trees = [
    { x: 4, z: 4 }, { x: 14, z: 7 }, { x: 27, z: 5 },
    { x: 8, z: 18 }, { x: 22, z: 16 },
    { x: 5, z: 28 }, { x: 18, z: 26 }, { x: 28, z: 28 },
  ];
  for (const t of trees) {
    if (data[2][t.z][t.x] === BlockType.WATER) continue; // skip if on water
    setBlock(data, t.x, 3, t.z, BlockType.WOOD);
    setBlock(data, t.x, 4, t.z, BlockType.WOOD);
    // Wide low canopy
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          setBlock(data, t.x + dx, 5, t.z + dz, BlockType.LEAVES);
        }
      }
    }
    setBlock(data, t.x, 5, t.z, BlockType.WOOD);
    // Hanging vines
    setBlock(data, t.x - 2, 4, t.z, BlockType.VINE);
    setBlock(data, t.x + 2, 4, t.z, BlockType.VINE);
    setBlock(data, t.x, 4, t.z - 2, BlockType.VINE);
  }

  // Mushrooms on mud
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[2][z][x] === BlockType.MUD && data[3][z][x] === BlockType.AIR && rand() < 0.06) {
        setBlock(data, x, 3, z, BlockType.MUSHROOM);
      }
    }
  }

  return data;
}

function generateDesertDunes(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.SAND);

  // Replace dirt layer with sandstone
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      data[1][z][x] = BlockType.SANDSTONE;
    }
  }

  // Sand dunes (gentle hills)
  const dunes = [
    { x: 8, z: 8, r: 5, h: 2 },
    { x: 22, z: 6, r: 4, h: 3 },
    { x: 14, z: 20, r: 6, h: 2 },
    { x: 28, z: 22, r: 3, h: 2 },
    { x: 5, z: 26, r: 4, h: 3 },
  ];
  for (const d of dunes) {
    for (let dx = -d.r; dx <= d.r; dx++) {
      for (let dz = -d.r; dz <= d.r; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= d.r) {
          const height = Math.max(1, Math.round((d.r - dist) / d.r * d.h));
          for (let y = 3; y < 3 + height; y++) {
            setBlock(data, d.x + dx, y, d.z + dz, BlockType.SAND);
          }
        }
      }
    }
  }

  // Cacti scattered
  const cacti = [
    { x: 4, z: 4 }, { x: 17, z: 3 }, { x: 28, z: 12 },
    { x: 10, z: 16 }, { x: 24, z: 28 }, { x: 3, z: 20 },
  ];
  for (const c of cacti) {
    const h = data[3]?.[c.z]?.[c.x] === BlockType.AIR ? 3 : 4;
    for (let y = h; y < h + 2; y++) {
      setBlock(data, c.x, y, c.z, BlockType.CACTUS);
    }
  }

  // Dead bushes
  const rand = seededRandom(555);
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[3][z][x] === BlockType.AIR && rand() < 0.04) {
        setBlock(data, x, 3, z, BlockType.DEAD_BUSH);
      }
    }
  }

  // Small oasis
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz <= 4) {
        setBlock(data, 20 + dx, 2, 16 + dz, BlockType.WATER);
        setBlock(data, 20 + dx, 3, 16 + dz, BlockType.AIR);
      }
    }
  }
  // Palm-like tree near oasis
  addTree(data, 22, 14, 3);

  return data;
}

function generateSnowfield(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.SNOW);

  // Ice patches
  const rand = seededRandom(999);
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (rand() < 0.08) {
        data[2][z][x] = BlockType.ICE;
      }
    }
  }

  // Frozen pond
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      if (dx * dx + dz * dz <= 14) {
        setBlock(data, 16 + dx, 2, 12 + dz, BlockType.ICE);
      }
    }
  }

  // Snow mounds
  const mounds = [
    { x: 6, z: 5, r: 3 }, { x: 26, z: 7, r: 2 },
    { x: 8, z: 24, r: 3 }, { x: 24, z: 26, r: 4 },
  ];
  for (const m of mounds) {
    for (let dx = -m.r; dx <= m.r; dx++) {
      for (let dz = -m.r; dz <= m.r; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= m.r) {
          const height = Math.max(1, Math.round((m.r - dist)));
          for (let y = 3; y < 3 + Math.min(height, 2); y++) {
            setBlock(data, m.x + dx, y, m.z + dz, BlockType.SNOW);
          }
        }
      }
    }
  }

  // Sparse evergreen trees (spruce-like)
  const trees = [
    { x: 4, z: 14 }, { x: 14, z: 4 }, { x: 28, z: 16 },
    { x: 16, z: 28 }, { x: 20, z: 20 },
  ];
  for (const t of trees) {
    // Trunk
    setBlock(data, t.x, 3, t.z, BlockType.WOOD);
    setBlock(data, t.x, 4, t.z, BlockType.WOOD);
    setBlock(data, t.x, 5, t.z, BlockType.WOOD);
    // Conical leaf layers
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 2) {
          setBlock(data, t.x + dx, 4, t.z + dz, BlockType.LEAVES);
        }
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(data, t.x + dx, 5, t.z + dz, BlockType.LEAVES);
      }
    }
    setBlock(data, t.x, 6, t.z, BlockType.LEAVES);
  }

  return data;
}

function generateLake(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data);

  // Large central lake
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      const dx = x - 16;
      const dz = z - 16;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Irregular shoreline
      const wobble = Math.sin(Math.atan2(dz, dx) * 5) * 2;
      if (dist < 10 + wobble) {
        setBlock(data, x, 2, z, BlockType.WATER);
      }
    }
  }

  // Sandy beach around lake
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      const dx = x - 16;
      const dz = z - 16;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wobble = Math.sin(Math.atan2(dz, dx) * 5) * 2;
      if (dist >= 10 + wobble && dist < 12 + wobble && data[2][z][x] !== BlockType.WATER) {
        data[2][z][x] = BlockType.SAND;
      }
    }
  }

  // Lily pads
  const rand = seededRandom(222);
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[2][z][x] === BlockType.WATER && rand() < 0.05) {
        setBlock(data, x, 3, z, BlockType.LILY_PAD);
      }
    }
  }

  // Trees around shore
  const trees = [
    { x: 2, z: 4 }, { x: 4, z: 28 }, { x: 28, z: 4 }, { x: 28, z: 28 },
    { x: 2, z: 16 }, { x: 30, z: 16 },
  ];
  for (const t of trees) {
    if (data[2][t.z][t.x] === BlockType.WATER || data[2][t.z][t.x] === BlockType.SAND) continue;
    addTree(data, t.x, t.z, 3);
  }

  // Reeds/tall grass near shore
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[2][z][x] === BlockType.SAND && rand() < 0.15) {
        setBlock(data, x, 3, z, BlockType.TALL_GRASS);
      }
    }
  }

  return data;
}

function generateMushroomGrove(): BlockType[][][] {
  const data = createEmpty();
  fillGround(data, BlockType.MYCELIUM);

  const rand = seededRandom(666);

  // Giant mushrooms (3-4 blocks tall)
  const giants = [
    { x: 8, z: 8 }, { x: 22, z: 6 }, { x: 6, z: 22 },
    { x: 24, z: 24 }, { x: 16, z: 16 },
  ];
  for (const g of giants) {
    const isRed = rand() > 0.5;
    const capType = isRed ? BlockType.MUSHROOM_BLOCK_RED : BlockType.MUSHROOM_BLOCK_BROWN;
    // Stem
    setBlock(data, g.x, 3, g.z, BlockType.GIANT_MUSHROOM_STEM);
    setBlock(data, g.x, 4, g.z, BlockType.GIANT_MUSHROOM_STEM);
    setBlock(data, g.x, 5, g.z, BlockType.GIANT_MUSHROOM_STEM);
    // Cap
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          setBlock(data, g.x + dx, 6, g.z + dz, capType);
        }
      }
    }
  }

  // Smaller mushrooms on ground
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (data[3][z][x] === BlockType.AIR && rand() < 0.1) {
        setBlock(data, x, 3, z, BlockType.MUSHROOM);
      }
    }
  }

  // Scattered mycelium patches showing through
  for (let z = 0; z < PLATE_SIZE; z++) {
    for (let x = 0; x < PLATE_SIZE; x++) {
      if (rand() < 0.05) {
        setBlock(data, x, 3, z, BlockType.FERN);
      }
    }
  }

  return data;
}

// --- Registry ---

export const PLATE_TEMPLATES: PlateTemplate[] = [
  {
    id: 'forest',
    name: 'Las',
    description: 'Gesty las z podszyciem i grzybami',
    generate: generateForest,
  },
  {
    id: 'meadow',
    name: 'Laka',
    description: 'Laka z dzikimi kwiatami i stawem',
    generate: generateMeadow,
  },
  {
    id: 'rocky_hills',
    name: 'Skaliste wzgorza',
    description: 'Skaliste wzgorza z wychodniami i rudami',
    generate: generateRockyHills,
  },
  {
    id: 'swamp',
    name: 'Bagno',
    description: 'Mokradla z liliami, pnaczami i grzybami',
    generate: generateSwamp,
  },
  {
    id: 'desert',
    name: 'Pustynia',
    description: 'Wydmy piaskowe z kaktusami i oaza',
    generate: generateDesertDunes,
  },
  {
    id: 'snowfield',
    name: 'Sniezne pole',
    description: 'Zaspy sniezne, lod i igliwe drzewa',
    generate: generateSnowfield,
  },
  {
    id: 'lake',
    name: 'Jezioro',
    description: 'Duze jezioro z piasczysta plaza',
    generate: generateLake,
  },
  {
    id: 'mushroom_grove',
    name: 'Grzybowy gaj',
    description: 'Gaj gigantycznych grzybow na grzybnicy',
    generate: generateMushroomGrove,
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
