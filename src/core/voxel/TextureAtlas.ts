import * as THREE from 'three';
import { BlockType } from './BlockRegistry';

/**
 * Texture atlas for block faces.
 * Each block has up to 3 textures: top, side, bottom.
 * Each texture is 16x16 pixels packed into a single atlas.
 */

const TEX_SIZE = 16; // pixels per texture
const ATLAS_COLS = 16; // textures per row
// Each block gets 3 slots: top, side, bottom
// Total slots needed: ~30 blocks * 3 = 90 → 16x6 grid = 96 slots

type PixelFunc = (px: number, py: number) => [number, number, number];

// Seeded random for deterministic textures
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function vary(rng: () => number, r: number, g: number, b: number, amount: number): [number, number, number] {
  const v = (rng() - 0.5) * amount;
  return [
    Math.max(0, Math.min(255, r + v * 255)),
    Math.max(0, Math.min(255, g + v * 255)),
    Math.max(0, Math.min(255, b + v * 255)),
  ];
}

// Pattern generators for Minecraft-style 16x16 textures
function solidWithNoise(r: number, g: number, b: number, noiseAmount: number, seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    pixels.push(vary(rng, r, g, b, noiseAmount));
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function grassTop(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const base = 100 + Math.floor(rng() * 50);
    pixels.push([
      Math.floor(base * 0.45 + rng() * 20),
      Math.floor(base + rng() * 30),
      Math.floor(base * 0.3 + rng() * 15),
    ]);
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function grassSide(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      if (y <= 2 + Math.floor(rng() * 2)) {
        // Green top strip
        pixels.push([Math.floor(80 + rng() * 40), Math.floor(150 + rng() * 40), Math.floor(40 + rng() * 25)]);
      } else {
        // Dirt below
        pixels.push(vary(rng, 139, 105, 20, 0.08));
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function dirtTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const shade = 0.85 + rng() * 0.3;
    pixels.push([
      Math.floor(139 * shade),
      Math.floor(105 * shade),
      Math.floor(20 * shade + rng() * 10),
    ]);
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function stoneTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const base = 100 + Math.floor(rng() * 40);
      // Occasional cracks (darker lines)
      const crack = (rng() > 0.92) ? -30 : 0;
      const v = base + crack;
      pixels.push([v, v, v]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function cobblestoneTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  // Create a cobblestone pattern with irregular stone patches
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const gridX = Math.floor(x / 4);
      const gridY = Math.floor(y / 4);
      const stoneShade = 90 + ((gridX * 7 + gridY * 13) % 5) * 12 + Math.floor(rng() * 20);
      // Dark grout lines between stones
      const onEdge = (x % 4 === 0 || y % 4 === 0) && rng() > 0.3;
      const v = onEdge ? stoneShade - 30 : stoneShade;
      pixels.push([v, v, Math.floor(v * 0.95)]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function sandTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const shade = 0.9 + rng() * 0.2;
    pixels.push([
      Math.floor(219 * shade),
      Math.floor(198 * shade),
      Math.floor(123 * shade),
    ]);
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function woodSide(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    const stripe = (y % 3 === 0) ? -15 : 0;
    for (let x = 0; x < TEX_SIZE; x++) {
      pixels.push([
        Math.floor(107 + rng() * 20 + stripe),
        Math.floor(66 + rng() * 15 + stripe),
        Math.floor(38 + rng() * 10 + stripe * 0.5),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function woodTop(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const ring = Math.floor(dist * 1.5) % 2;
      const base = ring === 0 ? 120 : 100;
      pixels.push([
        Math.floor(base * 0.85 + rng() * 15),
        Math.floor(base * 0.55 + rng() * 10),
        Math.floor(base * 0.3 + rng() * 8),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function leavesTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const isHole = rng() > 0.7;
    if (isHole) {
      pixels.push([Math.floor(30 + rng() * 20), Math.floor(80 + rng() * 30), Math.floor(20 + rng() * 15)]);
    } else {
      pixels.push([Math.floor(40 + rng() * 30), Math.floor(100 + rng() * 50), Math.floor(25 + rng() * 20)]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function oreTexture(baseR: number, baseG: number, baseB: number, oreR: number, oreG: number, oreB: number, seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  // Stone base with ore patches
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const stone = 100 + Math.floor(rng() * 40);
      // Ore clusters: a few irregular patches
      const dist1 = Math.abs(x - 4) + Math.abs(y - 5);
      const dist2 = Math.abs(x - 11) + Math.abs(y - 10);
      const dist3 = Math.abs(x - 7) + Math.abs(y - 13);
      const isOre = dist1 < 2.5 + rng() * 1.5 || dist2 < 2 + rng() * 1.5 || dist3 < 1.5 + rng();
      if (isOre) {
        pixels.push([
          Math.floor(oreR + rng() * 30 - 15),
          Math.floor(oreG + rng() * 30 - 15),
          Math.floor(oreB + rng() * 20 - 10),
        ]);
      } else {
        pixels.push([stone, stone, stone]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function planksTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    const plankIdx = Math.floor(y / 4);
    const onLine = y % 4 === 0;
    for (let x = 0; x < TEX_SIZE; x++) {
      const jointX = (plankIdx % 2 === 0) ? 7 : 11;
      const onJoint = Math.abs(x - jointX) < 1 && !onLine;
      const base = onLine ? 140 : onJoint ? 150 : 170;
      pixels.push([
        Math.floor(base * 0.72 + rng() * 12),
        Math.floor(base * 0.58 + rng() * 10),
        Math.floor(base * 0.35 + rng() * 8),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function glassTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
      if (isBorder) {
        pixels.push([180, 200, 210]);
      } else {
        pixels.push([
          Math.floor(200 + rng() * 20),
          Math.floor(225 + rng() * 15),
          Math.floor(240 + rng() * 15),
        ]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function stoneBricksTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const brickY = Math.floor(y / 4);
      const offset = (brickY % 2) * 4;
      const bx = (x + offset) % TEX_SIZE;
      const onLineY = y % 4 === 0;
      const onLineX = bx % 8 === 0;
      if (onLineY || onLineX) {
        pixels.push([80 + Math.floor(rng() * 15), 80 + Math.floor(rng() * 15), 80 + Math.floor(rng() * 10)]);
      } else {
        const v = 110 + Math.floor(rng() * 25);
        pixels.push([v, v, Math.floor(v * 0.95)]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function snowTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) {
    const v = 235 + Math.floor(rng() * 20);
    pixels.push([v, v, v]);
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function iceTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Light blue with occasional cracks
      const crack = rng() > 0.93 ? -20 : 0;
      pixels.push([
        Math.floor(160 + rng() * 20 + crack),
        Math.floor(208 + rng() * 15 + crack),
        Math.floor(224 + rng() * 15),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function sandstoneTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    const layerShade = (y % 5 < 1) ? -10 : 0;
    for (let x = 0; x < TEX_SIZE; x++) {
      pixels.push([
        Math.floor(212 + rng() * 15 + layerShade),
        Math.floor(184 + rng() * 12 + layerShade),
        Math.floor(106 + rng() * 10 + layerShade * 0.5),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function bookshelfSide(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      if (y <= 1 || y >= 14) {
        // Plank top/bottom
        pixels.push([Math.floor(160 + rng() * 15), Math.floor(130 + rng() * 10), Math.floor(70 + rng() * 10)]);
      } else if (y === 7 || y === 8) {
        // Shelf divider
        pixels.push([Math.floor(150 + rng() * 15), Math.floor(125 + rng() * 10), Math.floor(65 + rng() * 8)]);
      } else {
        // Book spines - different colors per column
        const bookColor = ((x * 7 + (y > 8 ? 3 : 0)) % 5);
        const colors: [number, number, number][] = [
          [140, 40, 40], [40, 80, 140], [50, 120, 50], [140, 120, 40], [100, 50, 120],
        ];
        const [br, bg, bb] = colors[bookColor];
        pixels.push([
          Math.floor(br + rng() * 20),
          Math.floor(bg + rng() * 20),
          Math.floor(bb + rng() * 15),
        ]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function furnaceTexture(front: boolean, seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const v = 100 + Math.floor(rng() * 25);
      if (front && x >= 4 && x <= 11 && y >= 5 && y <= 12) {
        // Furnace mouth opening
        if (x === 4 || x === 11 || y === 5 || y === 12) {
          pixels.push([70, 70, 70]);
        } else {
          pixels.push([30 + Math.floor(rng() * 20), 15, 10]);
        }
      } else {
        pixels.push([v, v, Math.floor(v * 0.95)]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function craftingTableTop(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Grid pattern on top
      const onGrid = (x % 4 === 0 || y % 4 === 0);
      if (onGrid) {
        pixels.push([Math.floor(100 + rng() * 15), Math.floor(80 + rng() * 10), Math.floor(45 + rng() * 10)]);
      } else {
        pixels.push([Math.floor(175 + rng() * 15), Math.floor(140 + rng() * 12), Math.floor(80 + rng() * 10)]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function craftingTableSide(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      if (y <= 1) {
        // Top edge darker
        pixels.push([Math.floor(120 + rng() * 15), Math.floor(95 + rng() * 10), Math.floor(55 + rng() * 8)]);
      } else {
        // Plank body with saw pattern
        const saw = (x >= 6 && x <= 9 && y >= 4 && y <= 11) ? 15 : 0;
        pixels.push([
          Math.floor(165 + rng() * 15 - saw),
          Math.floor(130 + rng() * 12 - saw),
          Math.floor(75 + rng() * 10 - saw * 0.5),
        ]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function chestSide(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Horizontal plank bands
      const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
      const isDivider = y === 9;
      if (isBorder || isDivider) {
        pixels.push([Math.floor(120 + rng() * 15), Math.floor(95 + rng() * 10), Math.floor(50 + rng() * 8)]);
      } else {
        pixels.push([Math.floor(175 + rng() * 12), Math.floor(140 + rng() * 10), Math.floor(80 + rng() * 8)]);
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function chestFront(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const base = chestSide(seed + 100);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Gold latch in the middle
      if (x >= 6 && x <= 9 && y >= 7 && y <= 10) {
        pixels.push([Math.floor(220 + rng() * 20), Math.floor(180 + rng() * 20), Math.floor(40 + rng() * 20)]);
      } else {
        pixels.push(base(x, y));
      }
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function lampTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const glow = Math.max(0, 1 - dist / 10);
      pixels.push([
        Math.floor(255 * (0.7 + glow * 0.3) + rng() * 10),
        Math.floor(220 * (0.6 + glow * 0.4) + rng() * 10),
        Math.floor(136 * (0.5 + glow * 0.5) + rng() * 10),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function gravelTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Rounded pebble shapes via grid
      const gx = x % 4;
      const gy = y % 4;
      const corner = (gx === 0 && gy === 0) || (gx === 0 && gy === 3) || (gx === 3 && gy === 0) || (gx === 3 && gy === 3);
      const baseV = 110 + ((Math.floor(x / 4) * 5 + Math.floor(y / 4) * 7) % 4) * 12;
      const v = corner ? baseV - 20 : baseV + Math.floor(rng() * 20);
      pixels.push([v, v, Math.floor(v * 0.95)]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function clayTexture(seed: number): PixelFunc {
  return solidWithNoise(158, 171, 176, 0.04, seed);
}

function mudTexture(seed: number): PixelFunc {
  return solidWithNoise(92, 61, 46, 0.08, seed);
}

function cactusTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const stripe = (y % 4 === 0) ? 10 : 0;
      const spine = ((x + y * 3) % 7 === 0) ? 25 : 0;
      pixels.push([
        Math.floor(45 + rng() * 15 + stripe + spine),
        Math.floor(110 + rng() * 20 + stripe),
        Math.floor(30 + rng() * 12),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

function waterTexture(seed: number): PixelFunc {
  const rng = seededRandom(seed);
  const pixels: [number, number, number][] = [];
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const wave = Math.sin((x + y * 0.5) * 0.8) * 10;
      pixels.push([
        Math.floor(48 + rng() * 15 + wave * 0.3),
        Math.floor(96 + rng() * 20 + wave * 0.5),
        Math.floor(192 + rng() * 20 + wave),
      ]);
    }
  }
  return (px, py) => pixels[py * TEX_SIZE + px];
}

// Block face key: "blockType_face"
type FaceKey = string;

interface AtlasEntry {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

function getTextureFunc(block: BlockType, face: 'top' | 'side' | 'bottom'): PixelFunc {
  const seed = block * 1000 + (face === 'top' ? 0 : face === 'side' ? 333 : 666);

  switch (block) {
    case BlockType.GRASS:
      if (face === 'top') return grassTop(seed);
      if (face === 'bottom') return dirtTexture(seed);
      return grassSide(seed);
    case BlockType.DIRT:
      return dirtTexture(seed);
    case BlockType.STONE:
      return stoneTexture(seed);
    case BlockType.COBBLESTONE:
      return cobblestoneTexture(seed);
    case BlockType.SAND:
      return sandTexture(seed);
    case BlockType.WOOD:
      if (face === 'top' || face === 'bottom') return woodTop(seed);
      return woodSide(seed);
    case BlockType.LEAVES:
      return leavesTexture(seed);
    case BlockType.COAL_ORE:
      return oreTexture(128, 128, 128, 40, 40, 40, seed);
    case BlockType.IRON_ORE:
      return oreTexture(128, 128, 128, 200, 149, 108, seed);
    case BlockType.GOLD_ORE:
      return oreTexture(128, 128, 128, 255, 215, 0, seed);
    case BlockType.DIAMOND_ORE:
      return oreTexture(128, 128, 128, 64, 224, 208, seed);
    case BlockType.SANDSTONE:
      return sandstoneTexture(seed);
    case BlockType.SNOW:
      return snowTexture(seed);
    case BlockType.ICE:
      return iceTexture(seed);
    case BlockType.CACTUS:
      return cactusTexture(seed);
    case BlockType.WATER:
      return waterTexture(seed);
    case BlockType.GRAVEL:
      return gravelTexture(seed);
    case BlockType.PLANKS:
    case BlockType.PLANKS_SLAB:
      return planksTexture(seed);
    case BlockType.GLASS:
      return glassTexture(seed);
    case BlockType.STONE_BRICKS:
    case BlockType.STONE_BRICKS_SLAB:
      return stoneBricksTexture(seed);
    case BlockType.BOOKSHELF:
      if (face === 'top' || face === 'bottom') return planksTexture(seed + 50);
      return bookshelfSide(seed);
    case BlockType.CLAY:
      return clayTexture(seed);
    case BlockType.MUD:
      return mudTexture(seed);
    case BlockType.FURNACE:
      return furnaceTexture(face === 'side', seed);
    case BlockType.CRAFTING_TABLE:
      if (face === 'top') return craftingTableTop(seed);
      if (face === 'bottom') return planksTexture(seed + 70);
      return craftingTableSide(seed);
    case BlockType.LAMP:
      return lampTexture(seed);
    case BlockType.COBBLESTONE_SLAB:
      return cobblestoneTexture(seed);
    case BlockType.FENCE_OAK:
      return planksTexture(seed);
    case BlockType.CHEST:
      if (face === 'side') return chestFront(seed);
      return chestSide(seed);
    // Stairs use the same texture as their material
    case BlockType.OAK_STAIRS:
    case BlockType.OAK_STAIRS_N:
    case BlockType.OAK_STAIRS_S:
    case BlockType.OAK_STAIRS_E:
    case BlockType.OAK_STAIRS_W:
      return planksTexture(seed);
    case BlockType.COBBLE_STAIRS:
    case BlockType.COBBLE_STAIRS_N:
    case BlockType.COBBLE_STAIRS_S:
    case BlockType.COBBLE_STAIRS_E:
    case BlockType.COBBLE_STAIRS_W:
      return cobblestoneTexture(seed);
    // Doors
    case BlockType.DOOR_OAK_BOTTOM:
    case BlockType.DOOR_OAK_TOP:
    case BlockType.DOOR_OAK_BOTTOM_OPEN:
    case BlockType.DOOR_OAK_TOP_OPEN:
      return planksTexture(seed);
    default:
      // Fallback: solid color from block definition
      return solidWithNoise(128, 128, 128, 0.06, seed);
  }
}

let _atlasTexture: THREE.Texture | null = null;
let _atlasMap: Map<FaceKey, AtlasEntry> | null = null;

function buildAtlas(): { texture: THREE.Texture; map: Map<FaceKey, AtlasEntry> } {
  // Collect all block types that need textures
  const blockFaces: { block: BlockType; face: 'top' | 'side' | 'bottom' }[] = [];

  const cubeBlocks = [
    BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.SAND, BlockType.WOOD,
    BlockType.LEAVES, BlockType.COAL_ORE, BlockType.IRON_ORE, BlockType.SANDSTONE,
    BlockType.SNOW, BlockType.ICE, BlockType.CACTUS, BlockType.WATER, BlockType.GRAVEL,
    BlockType.COBBLESTONE, BlockType.GOLD_ORE, BlockType.DIAMOND_ORE,
    BlockType.PLANKS, BlockType.GLASS, BlockType.STONE_BRICKS, BlockType.BOOKSHELF,
    BlockType.CLAY, BlockType.MUD, BlockType.FURNACE, BlockType.CRAFTING_TABLE,
    BlockType.LAMP, BlockType.PLANKS_SLAB, BlockType.COBBLESTONE_SLAB, BlockType.STONE_BRICKS_SLAB,
    BlockType.FENCE_OAK, BlockType.CHEST,
    BlockType.OAK_STAIRS_N, BlockType.OAK_STAIRS_S, BlockType.OAK_STAIRS_E, BlockType.OAK_STAIRS_W,
    BlockType.COBBLE_STAIRS_N, BlockType.COBBLE_STAIRS_S, BlockType.COBBLE_STAIRS_E, BlockType.COBBLE_STAIRS_W,
    BlockType.DOOR_OAK_BOTTOM, BlockType.DOOR_OAK_TOP, BlockType.DOOR_OAK_BOTTOM_OPEN, BlockType.DOOR_OAK_TOP_OPEN,
  ];

  const faces: ('top' | 'side' | 'bottom')[] = ['top', 'side', 'bottom'];
  for (const block of cubeBlocks) {
    for (const face of faces) {
      blockFaces.push({ block, face });
    }
  }

  // +1 for white fallback tile at slot 0
  const totalSlots = blockFaces.length + 1;
  const atlasRows = Math.ceil(totalSlots / ATLAS_COLS);
  const atlasWidth = ATLAS_COLS * TEX_SIZE;
  const atlasHeight = atlasRows * TEX_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(atlasWidth, atlasHeight);
  const data = imageData.data;

  const map = new Map<FaceKey, AtlasEntry>();

  // Slot 0: white fallback tile (for vegetation, rails, etc. that use vertex colors)
  for (let py = 0; py < TEX_SIZE; py++) {
    for (let px = 0; px < TEX_SIZE; px++) {
      const idx = (py * atlasWidth + px) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
  const whiteEntry: AtlasEntry = {
    u0: 0,
    v0: 1 - TEX_SIZE / atlasHeight,
    u1: TEX_SIZE / atlasWidth,
    v1: 1,
  };
  map.set('white', whiteEntry);

  for (let i = 0; i < blockFaces.length; i++) {
    const { block, face } = blockFaces[i];
    const slotIdx = i + 1; // offset by 1 for white tile
    const col = slotIdx % ATLAS_COLS;
    const row = Math.floor(slotIdx / ATLAS_COLS);
    const startX = col * TEX_SIZE;
    const startY = row * TEX_SIZE;

    const texFunc = getTextureFunc(block, face);

    for (let py = 0; py < TEX_SIZE; py++) {
      for (let px = 0; px < TEX_SIZE; px++) {
        const [r, g, b] = texFunc(px, py);
        const idx = ((startY + py) * atlasWidth + (startX + px)) * 4;
        data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        data[idx + 3] = 255;
      }
    }

    const key: FaceKey = `${block}_${face}`;
    map.set(key, {
      u0: startX / atlasWidth,
      v0: 1 - (startY + TEX_SIZE) / atlasHeight, // flip Y for WebGL
      u1: (startX + TEX_SIZE) / atlasWidth,
      v1: 1 - startY / atlasHeight,
    });
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, map };
}

export function getAtlasTexture(): THREE.Texture {
  if (!_atlasTexture) {
    if (typeof document === 'undefined') {
      // Fallback for non-browser (test) environment
      return new THREE.Texture();
    }
    const result = buildAtlas();
    _atlasTexture = result.texture;
    _atlasMap = result.map;
  }
  return _atlasTexture;
}

const FALLBACK_UV: AtlasEntry = { u0: 0, v0: 0, u1: 1, v1: 1 };

function ensureAtlas(): boolean {
  if (_atlasMap) return true;
  if (typeof document === 'undefined') return false; // Node.js/test environment
  const result = buildAtlas();
  _atlasTexture = result.texture;
  _atlasMap = result.map;
  return true;
}

export function getAtlasUV(block: BlockType, face: 'top' | 'side' | 'bottom'): AtlasEntry {
  if (!ensureAtlas()) return FALLBACK_UV;
  const key: FaceKey = `${block}_${face}`;
  return _atlasMap!.get(key) ?? _atlasMap!.get('white')!;
}

/** Get UVs for white (passthrough) texture - used for vegetation, rails, etc. */
export function getWhiteUV(): AtlasEntry {
  if (!ensureAtlas()) return FALLBACK_UV;
  return _atlasMap!.get('white')!;
}
