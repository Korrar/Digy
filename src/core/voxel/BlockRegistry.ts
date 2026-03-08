import * as THREE from 'three';

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WOOD = 5,
  LEAVES = 6,
  COAL_ORE = 7,
  IRON_ORE = 8,
  SANDSTONE = 9,
  SNOW = 10,
  ICE = 11,
  CACTUS = 12,
  WATER = 13,
  GRAVEL = 14,
  COBBLESTONE = 15,
  GOLD_ORE = 16,
  DIAMOND_ORE = 17,
  // Vegetation
  TALL_GRASS = 18,
  FLOWER_RED = 19,
  FLOWER_YELLOW = 20,
  MUSHROOM = 21,
  DEAD_BUSH = 22,
  LILY_PAD = 23,
  FERN = 24,
  // Building blocks
  PLANKS = 25,
  GLASS = 26,
  STONE_BRICKS = 27,
  TORCH = 28,
  BOOKSHELF = 29,
  CLAY = 30,
  MUD = 31,
  // Crafted items (non-placeable)
  STICK = 32,
  WOODEN_PICKAXE = 33,
  STONE_PICKAXE = 34,
  IRON_PICKAXE = 35,
  DIAMOND_PICKAXE = 36,
  WOODEN_SWORD = 37,
  STONE_SWORD = 38,
  IRON_SWORD = 39,
  DIAMOND_SWORD = 40,
  COAL = 41,
  IRON_INGOT = 42,
  GOLD_INGOT = 43,
  DIAMOND = 44,
  APPLE = 46,
  BREAD = 47,
  RAW_MEAT = 48,
  COOKED_MEAT = 49,
  FURNACE = 50,
  CRAFTING_TABLE = 51,
  RAIL = 52,
  MINECART = 53,
  POWERED_RAIL = 54,
  LAMP = 55,
  // Slabs (half-height blocks)
  PLANKS_SLAB = 56,
  COBBLESTONE_SLAB = 57,
  STONE_BRICKS_SLAB = 58,
  // Fences (auto-connecting posts)
  FENCE_OAK = 59,
  // Stairs - inventory items
  OAK_STAIRS = 60,
  COBBLE_STAIRS = 61,
  // Stairs - placed (4 orientations per material, step rises toward named direction)
  OAK_STAIRS_N = 62,
  OAK_STAIRS_S = 63,
  OAK_STAIRS_E = 64,
  OAK_STAIRS_W = 65,
  COBBLE_STAIRS_N = 66,
  COBBLE_STAIRS_S = 67,
  COBBLE_STAIRS_E = 68,
  COBBLE_STAIRS_W = 69,
  // Door - inventory item
  DOOR_OAK = 70,
  // Door - placed blocks
  DOOR_OAK_BOTTOM = 71,
  DOOR_OAK_TOP = 72,
  DOOR_OAK_BOTTOM_OPEN = 73,
  DOOR_OAK_TOP_OPEN = 74,
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  color: THREE.Color;
  topColor?: THREE.Color;
  hardness: number;
  transparent: boolean;
  drops: BlockType;
  stackSize: number;
  sparkle?: number;
  oreColor?: THREE.Color;
  /** Render as crossed quads instead of cube (vegetation) */
  crossedQuad?: boolean;
  /** Emits light (torch etc) */
  emitsLight?: boolean;
  /** Non-placeable item (tool, ingot, food) */
  isItem?: boolean;
  /** Tool mining speed multiplier */
  toolSpeed?: number;
  /** Weapon damage */
  damage?: number;
  /** Food healing amount (half-hearts) */
  healAmount?: number;
  /** Tool/weapon durability */
  durability?: number;
  /** Icon ID for SVG display in UI */
  icon?: string;
  /** Render as a flat surface instead of full cube (rails) */
  isFlat?: boolean;
  /** Item that can be placed in the world as an entity (minecart) */
  isPlaceableItem?: boolean;
  /** Render as half-height slab */
  isSlab?: boolean;
  /** Render as fence post with auto-connecting bars */
  isFence?: boolean;
  /** Render as stair geometry; direction indicates which way step rises */
  stairDir?: 'n' | 's' | 'e' | 'w';
  /** Render as thin door panel */
  isDoor?: boolean;
  /** Door is in open state */
  doorOpen?: boolean;
  /** Door is upper half */
  doorUpper?: boolean;
}

const BLOCKS: Map<BlockType, BlockDefinition> = new Map();

function register(def: BlockDefinition) {
  BLOCKS.set(def.id, def);
}

// Basic terrain
register({ id: BlockType.AIR, name: 'Air', color: new THREE.Color(0x000000), hardness: 0, transparent: true, drops: BlockType.AIR, stackSize: 0 });
register({ id: BlockType.GRASS, name: 'Grass', color: new THREE.Color(0x5d8a2d), topColor: new THREE.Color(0x7ec850), hardness: 0.6, transparent: false, drops: BlockType.DIRT, stackSize: 64 });
register({ id: BlockType.DIRT, name: 'Dirt', color: new THREE.Color(0x8b6914), hardness: 0.5, transparent: false, drops: BlockType.DIRT, stackSize: 64 });
register({ id: BlockType.STONE, name: 'Stone', color: new THREE.Color(0x808080), hardness: 1.5, transparent: false, drops: BlockType.COBBLESTONE, stackSize: 64 });
register({ id: BlockType.SAND, name: 'Sand', color: new THREE.Color(0xdbc67b), hardness: 0.5, transparent: false, drops: BlockType.SAND, stackSize: 64 });
register({ id: BlockType.WOOD, name: 'Wood', color: new THREE.Color(0x6b4226), hardness: 2.0, transparent: false, drops: BlockType.WOOD, stackSize: 64 });
register({ id: BlockType.LEAVES, name: 'Leaves', color: new THREE.Color(0x3a7d22), hardness: 0.2, transparent: true, drops: BlockType.AIR, stackSize: 64 });
register({ id: BlockType.COAL_ORE, name: 'Coal Ore', color: new THREE.Color(0x4a4a4a), hardness: 3.0, transparent: false, drops: BlockType.COAL_ORE, stackSize: 64 });
register({ id: BlockType.IRON_ORE, name: 'Iron Ore', color: new THREE.Color(0x808080), hardness: 3.0, transparent: false, drops: BlockType.IRON_ORE, stackSize: 64, sparkle: 0.3, oreColor: new THREE.Color(0xc8956c) });
register({ id: BlockType.SANDSTONE, name: 'Sandstone', color: new THREE.Color(0xd4b86a), hardness: 0.8, transparent: false, drops: BlockType.SANDSTONE, stackSize: 64 });
register({ id: BlockType.SNOW, name: 'Snow', color: new THREE.Color(0xf0f0f0), hardness: 0.2, transparent: false, drops: BlockType.SNOW, stackSize: 64 });
register({ id: BlockType.ICE, name: 'Ice', color: new THREE.Color(0xa0d0e0), hardness: 0.5, transparent: true, drops: BlockType.ICE, stackSize: 64 });
register({ id: BlockType.CACTUS, name: 'Cactus', color: new THREE.Color(0x2d6e1e), hardness: 0.4, transparent: false, drops: BlockType.CACTUS, stackSize: 64 });
register({ id: BlockType.WATER, name: 'Water', color: new THREE.Color(0x3060c0), hardness: Infinity, transparent: true, drops: BlockType.AIR, stackSize: 0 });
register({ id: BlockType.GRAVEL, name: 'Gravel', color: new THREE.Color(0x909090), hardness: 0.6, transparent: false, drops: BlockType.GRAVEL, stackSize: 64 });
register({ id: BlockType.COBBLESTONE, name: 'Cobblestone', color: new THREE.Color(0x707070), hardness: 2.0, transparent: false, drops: BlockType.COBBLESTONE, stackSize: 64 });
register({ id: BlockType.GOLD_ORE, name: 'Gold Ore', color: new THREE.Color(0x808080), topColor: new THREE.Color(0x808080), hardness: 3.0, transparent: false, drops: BlockType.GOLD_ORE, stackSize: 64, sparkle: 0.6, oreColor: new THREE.Color(0xffd700) });
register({ id: BlockType.DIAMOND_ORE, name: 'Diamond Ore', color: new THREE.Color(0x808080), topColor: new THREE.Color(0x808080), hardness: 5.0, transparent: false, drops: BlockType.DIAMOND_ORE, stackSize: 64, sparkle: 0.9, oreColor: new THREE.Color(0x40e0d0) });

// Vegetation (crossed quads)
register({ id: BlockType.TALL_GRASS, name: 'Tall Grass', color: new THREE.Color(0x5a9e2a), hardness: 0.0, transparent: true, drops: BlockType.AIR, stackSize: 64, crossedQuad: true });
register({ id: BlockType.FLOWER_RED, name: 'Red Flower', color: new THREE.Color(0xcc2222), topColor: new THREE.Color(0x22aa22), hardness: 0.0, transparent: true, drops: BlockType.FLOWER_RED, stackSize: 64, crossedQuad: true });
register({ id: BlockType.FLOWER_YELLOW, name: 'Yellow Flower', color: new THREE.Color(0xddcc22), topColor: new THREE.Color(0x22aa22), hardness: 0.0, transparent: true, drops: BlockType.FLOWER_YELLOW, stackSize: 64, crossedQuad: true });
register({ id: BlockType.MUSHROOM, name: 'Mushroom', color: new THREE.Color(0x9e6b4a), topColor: new THREE.Color(0xcc3333), hardness: 0.0, transparent: true, drops: BlockType.MUSHROOM, stackSize: 64, crossedQuad: true });
register({ id: BlockType.DEAD_BUSH, name: 'Dead Bush', color: new THREE.Color(0x8b7355), hardness: 0.0, transparent: true, drops: BlockType.AIR, stackSize: 64, crossedQuad: true });
register({ id: BlockType.LILY_PAD, name: 'Lily Pad', color: new THREE.Color(0x2d8a2d), hardness: 0.0, transparent: true, drops: BlockType.LILY_PAD, stackSize: 64, crossedQuad: true });
register({ id: BlockType.FERN, name: 'Fern', color: new THREE.Color(0x3d7a1d), hardness: 0.0, transparent: true, drops: BlockType.AIR, stackSize: 64, crossedQuad: true });

// Building blocks
register({ id: BlockType.PLANKS, name: 'Planks', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: false, drops: BlockType.PLANKS, stackSize: 64 });
register({ id: BlockType.GLASS, name: 'Glass', color: new THREE.Color(0xc8e8f8), hardness: 0.3, transparent: true, drops: BlockType.AIR, stackSize: 64 });
register({ id: BlockType.STONE_BRICKS, name: 'Stone Bricks', color: new THREE.Color(0x7a7a7a), hardness: 1.5, transparent: false, drops: BlockType.STONE_BRICKS, stackSize: 64 });
register({ id: BlockType.TORCH, name: 'Torch', color: new THREE.Color(0xffaa33), hardness: 0.0, transparent: true, drops: BlockType.TORCH, stackSize: 64, crossedQuad: true, emitsLight: true });
register({ id: BlockType.BOOKSHELF, name: 'Bookshelf', color: new THREE.Color(0x8b6914), topColor: new THREE.Color(0xb8945a), hardness: 1.0, transparent: false, drops: BlockType.BOOKSHELF, stackSize: 64 });
register({ id: BlockType.CLAY, name: 'Clay', color: new THREE.Color(0x9eabb0), hardness: 0.6, transparent: false, drops: BlockType.CLAY, stackSize: 64 });
register({ id: BlockType.MUD, name: 'Mud', color: new THREE.Color(0x5c3d2e), hardness: 0.5, transparent: false, drops: BlockType.MUD, stackSize: 64 });

// Items (non-placeable)
register({ id: BlockType.STICK, name: 'Stick', color: new THREE.Color(0x8b6914), hardness: 0, transparent: true, drops: BlockType.STICK, stackSize: 64, isItem: true, icon: 'stick' });
register({ id: BlockType.WOODEN_PICKAXE, name: 'Wooden Pickaxe', color: new THREE.Color(0xb8945a), hardness: 0, transparent: true, drops: BlockType.WOODEN_PICKAXE, stackSize: 1, isItem: true, toolSpeed: 1.5, durability: 60, icon: 'pickaxe' });
register({ id: BlockType.STONE_PICKAXE, name: 'Stone Pickaxe', color: new THREE.Color(0x808080), hardness: 0, transparent: true, drops: BlockType.STONE_PICKAXE, stackSize: 1, isItem: true, toolSpeed: 2.5, durability: 132, icon: 'pickaxe' });
register({ id: BlockType.IRON_PICKAXE, name: 'Iron Pickaxe', color: new THREE.Color(0xc8c8c8), hardness: 0, transparent: true, drops: BlockType.IRON_PICKAXE, stackSize: 1, isItem: true, toolSpeed: 4.0, durability: 250, icon: 'pickaxe' });
register({ id: BlockType.DIAMOND_PICKAXE, name: 'Diamond Pickaxe', color: new THREE.Color(0x40e0d0), hardness: 0, transparent: true, drops: BlockType.DIAMOND_PICKAXE, stackSize: 1, isItem: true, toolSpeed: 6.0, durability: 1561, icon: 'pickaxe' });
register({ id: BlockType.WOODEN_SWORD, name: 'Wooden Sword', color: new THREE.Color(0xb8945a), hardness: 0, transparent: true, drops: BlockType.WOODEN_SWORD, stackSize: 1, isItem: true, damage: 2, durability: 60, icon: 'sword' });
register({ id: BlockType.STONE_SWORD, name: 'Stone Sword', color: new THREE.Color(0x808080), hardness: 0, transparent: true, drops: BlockType.STONE_SWORD, stackSize: 1, isItem: true, damage: 3, durability: 132, icon: 'sword' });
register({ id: BlockType.IRON_SWORD, name: 'Iron Sword', color: new THREE.Color(0xc8c8c8), hardness: 0, transparent: true, drops: BlockType.IRON_SWORD, stackSize: 1, isItem: true, damage: 4, durability: 250, icon: 'sword' });
register({ id: BlockType.DIAMOND_SWORD, name: 'Diamond Sword', color: new THREE.Color(0x40e0d0), hardness: 0, transparent: true, drops: BlockType.DIAMOND_SWORD, stackSize: 1, isItem: true, damage: 6, durability: 1561, icon: 'sword' });
register({ id: BlockType.COAL, name: 'Coal', color: new THREE.Color(0x2a2a2a), hardness: 0, transparent: true, drops: BlockType.COAL, stackSize: 64, isItem: true, icon: 'circle' });
register({ id: BlockType.IRON_INGOT, name: 'Iron Ingot', color: new THREE.Color(0xd0d0d0), hardness: 0, transparent: true, drops: BlockType.IRON_INGOT, stackSize: 64, isItem: true, icon: 'ingot' });
register({ id: BlockType.GOLD_INGOT, name: 'Gold Ingot', color: new THREE.Color(0xffd700), hardness: 0, transparent: true, drops: BlockType.GOLD_INGOT, stackSize: 64, isItem: true, icon: 'ingot' });
register({ id: BlockType.DIAMOND, name: 'Diamond', color: new THREE.Color(0x40e0d0), hardness: 0, transparent: true, drops: BlockType.DIAMOND, stackSize: 64, isItem: true, icon: 'gem' });
register({ id: BlockType.APPLE, name: 'Apple', color: new THREE.Color(0xcc2222), hardness: 0, transparent: true, drops: BlockType.APPLE, stackSize: 64, isItem: true, healAmount: 2, icon: 'apple' });
register({ id: BlockType.BREAD, name: 'Bread', color: new THREE.Color(0xd4a843), hardness: 0, transparent: true, drops: BlockType.BREAD, stackSize: 64, isItem: true, healAmount: 3, icon: 'bread' });
register({ id: BlockType.RAW_MEAT, name: 'Raw Meat', color: new THREE.Color(0xcc6666), hardness: 0, transparent: true, drops: BlockType.RAW_MEAT, stackSize: 64, isItem: true, healAmount: 1, icon: 'meat_raw' });
register({ id: BlockType.COOKED_MEAT, name: 'Cooked Meat', color: new THREE.Color(0x8b4513), hardness: 0, transparent: true, drops: BlockType.COOKED_MEAT, stackSize: 64, isItem: true, healAmount: 4, icon: 'meat_cooked' });
register({ id: BlockType.FURNACE, name: 'Furnace', color: new THREE.Color(0x707070), hardness: 2.0, transparent: false, drops: BlockType.FURNACE, stackSize: 64, icon: 'furnace' });
register({ id: BlockType.CRAFTING_TABLE, name: 'Crafting Table', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: false, drops: BlockType.CRAFTING_TABLE, stackSize: 64, icon: 'wrench' });
register({ id: BlockType.RAIL, name: 'Rail', color: new THREE.Color(0x8b6914), hardness: 0.5, transparent: true, drops: BlockType.RAIL, stackSize: 64, icon: 'rail', isFlat: true });
register({ id: BlockType.MINECART, name: 'Minecart', color: new THREE.Color(0x888888), hardness: 0.5, transparent: true, drops: BlockType.MINECART, stackSize: 1, isItem: true, isPlaceableItem: true, icon: 'minecart' });
register({ id: BlockType.POWERED_RAIL, name: 'Powered Rail', color: new THREE.Color(0xcc4444), hardness: 0.5, transparent: true, drops: BlockType.POWERED_RAIL, stackSize: 64, icon: 'powered_rail', isFlat: true });
register({ id: BlockType.LAMP, name: 'Lamp', color: new THREE.Color(0xffdd88), hardness: 0.5, transparent: false, drops: BlockType.LAMP, stackSize: 64, emitsLight: true, icon: 'lamp' });

// Slabs (half-height blocks)
register({ id: BlockType.PLANKS_SLAB, name: 'Oak Slab', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.PLANKS_SLAB, stackSize: 64, isSlab: true });
register({ id: BlockType.COBBLESTONE_SLAB, name: 'Cobblestone Slab', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLESTONE_SLAB, stackSize: 64, isSlab: true });
register({ id: BlockType.STONE_BRICKS_SLAB, name: 'Stone Brick Slab', color: new THREE.Color(0x7a7a7a), hardness: 1.5, transparent: true, drops: BlockType.STONE_BRICKS_SLAB, stackSize: 64, isSlab: true });

// Fences
register({ id: BlockType.FENCE_OAK, name: 'Oak Fence', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.FENCE_OAK, stackSize: 64, isFence: true });

// Stairs - inventory items (non-placeable directly, converted to oriented on placement)
register({ id: BlockType.OAK_STAIRS, name: 'Oak Stairs', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.OAK_STAIRS, stackSize: 64, isItem: true, icon: 'stairs' });
register({ id: BlockType.COBBLE_STAIRS, name: 'Cobble Stairs', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLE_STAIRS, stackSize: 64, isItem: true, icon: 'stairs' });

// Stairs - placed blocks (4 orientations per material)
register({ id: BlockType.OAK_STAIRS_N, name: 'Oak Stairs', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.OAK_STAIRS, stackSize: 0, stairDir: 'n' });
register({ id: BlockType.OAK_STAIRS_S, name: 'Oak Stairs', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.OAK_STAIRS, stackSize: 0, stairDir: 's' });
register({ id: BlockType.OAK_STAIRS_E, name: 'Oak Stairs', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.OAK_STAIRS, stackSize: 0, stairDir: 'e' });
register({ id: BlockType.OAK_STAIRS_W, name: 'Oak Stairs', color: new THREE.Color(0xb8945a), hardness: 1.0, transparent: true, drops: BlockType.OAK_STAIRS, stackSize: 0, stairDir: 'w' });
register({ id: BlockType.COBBLE_STAIRS_N, name: 'Cobble Stairs', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLE_STAIRS, stackSize: 0, stairDir: 'n' });
register({ id: BlockType.COBBLE_STAIRS_S, name: 'Cobble Stairs', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLE_STAIRS, stackSize: 0, stairDir: 's' });
register({ id: BlockType.COBBLE_STAIRS_E, name: 'Cobble Stairs', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLE_STAIRS, stackSize: 0, stairDir: 'e' });
register({ id: BlockType.COBBLE_STAIRS_W, name: 'Cobble Stairs', color: new THREE.Color(0x707070), hardness: 2.0, transparent: true, drops: BlockType.COBBLE_STAIRS, stackSize: 0, stairDir: 'w' });

// Door - inventory item
register({ id: BlockType.DOOR_OAK, name: 'Oak Door', color: new THREE.Color(0x8b6914), hardness: 1.0, transparent: true, drops: BlockType.DOOR_OAK, stackSize: 64, isItem: true, icon: 'door' });

// Door - placed blocks
register({ id: BlockType.DOOR_OAK_BOTTOM, name: 'Oak Door', color: new THREE.Color(0x8b6914), hardness: 1.0, transparent: true, drops: BlockType.DOOR_OAK, stackSize: 0, isDoor: true, doorOpen: false, doorUpper: false });
register({ id: BlockType.DOOR_OAK_TOP, name: 'Oak Door', color: new THREE.Color(0x6b4226), hardness: 1.0, transparent: true, drops: BlockType.AIR, stackSize: 0, isDoor: true, doorOpen: false, doorUpper: true });
register({ id: BlockType.DOOR_OAK_BOTTOM_OPEN, name: 'Oak Door', color: new THREE.Color(0x8b6914), hardness: 1.0, transparent: true, drops: BlockType.DOOR_OAK, stackSize: 0, isDoor: true, doorOpen: true, doorUpper: false });
register({ id: BlockType.DOOR_OAK_TOP_OPEN, name: 'Oak Door', color: new THREE.Color(0x6b4226), hardness: 1.0, transparent: true, drops: BlockType.AIR, stackSize: 0, isDoor: true, doorOpen: true, doorUpper: true });

// Update ore drops to drop raw materials
BLOCKS.get(BlockType.COAL_ORE)!.drops = BlockType.COAL;
BLOCKS.get(BlockType.DIAMOND_ORE)!.drops = BlockType.DIAMOND;

// Leaves can drop apples
const leavesDef = BLOCKS.get(BlockType.LEAVES)!;
leavesDef.drops = BlockType.LEAVES; // we handle apple drop chance in code

export function getBlock(type: BlockType): BlockDefinition {
  return BLOCKS.get(type) ?? BLOCKS.get(BlockType.AIR)!;
}

export function getBlockColor(type: BlockType, face: 'top' | 'bottom' | 'side'): THREE.Color {
  const def = getBlock(type);
  if (face === 'top' && def.topColor) return def.topColor;
  return def.color;
}

export function isTransparent(type: BlockType): boolean {
  return getBlock(type).transparent;
}

export function isSolid(type: BlockType): boolean {
  const def = getBlock(type);
  return type !== BlockType.AIR && type !== BlockType.WATER && !def.crossedQuad && !def.isFlat;
}

export function isCrossedQuad(type: BlockType): boolean {
  return getBlock(type).crossedQuad === true;
}

export function getAllPlaceableBlocks(): BlockDefinition[] {
  return Array.from(BLOCKS.values()).filter(b => b.id !== BlockType.AIR && b.stackSize > 0 && !b.isItem);
}

export function isItemType(type: BlockType): boolean {
  return getBlock(type).isItem === true;
}

export function isToolPickaxe(type: BlockType): boolean {
  return [BlockType.WOODEN_PICKAXE, BlockType.STONE_PICKAXE, BlockType.IRON_PICKAXE, BlockType.DIAMOND_PICKAXE].includes(type);
}

export function isSword(type: BlockType): boolean {
  return [BlockType.WOODEN_SWORD, BlockType.STONE_SWORD, BlockType.IRON_SWORD, BlockType.DIAMOND_SWORD].includes(type);
}

export function isFood(type: BlockType): boolean {
  return (getBlock(type).healAmount ?? 0) > 0;
}

export function canPlaceMinecart(surfaceBlock: BlockType): boolean {
  if (surfaceBlock === BlockType.AIR || surfaceBlock === BlockType.WATER) return false;
  if (surfaceBlock === BlockType.RAIL || surfaceBlock === BlockType.POWERED_RAIL) return true;
  return isSolid(surfaceBlock);
}

export function isFlat(type: BlockType): boolean {
  return getBlock(type).isFlat === true;
}

export function isSlab(type: BlockType): boolean {
  return getBlock(type).isSlab === true;
}

export function isFence(type: BlockType): boolean {
  return getBlock(type).isFence === true;
}

export function isStairs(type: BlockType): boolean {
  return getBlock(type).stairDir !== undefined;
}

export function isStairsItem(type: BlockType): boolean {
  return type === BlockType.OAK_STAIRS || type === BlockType.COBBLE_STAIRS;
}

export function isDoor(type: BlockType): boolean {
  return getBlock(type).isDoor === true;
}

export function isDoorItem(type: BlockType): boolean {
  return type === BlockType.DOOR_OAK;
}

/** Get the oriented stair block type for a stair inventory item + direction */
export function getOrientedStairs(item: BlockType, dir: 'n' | 's' | 'e' | 'w'): BlockType {
  if (item === BlockType.OAK_STAIRS) {
    switch (dir) {
      case 'n': return BlockType.OAK_STAIRS_N;
      case 's': return BlockType.OAK_STAIRS_S;
      case 'e': return BlockType.OAK_STAIRS_E;
      case 'w': return BlockType.OAK_STAIRS_W;
    }
  }
  if (item === BlockType.COBBLE_STAIRS) {
    switch (dir) {
      case 'n': return BlockType.COBBLE_STAIRS_N;
      case 's': return BlockType.COBBLE_STAIRS_S;
      case 'e': return BlockType.COBBLE_STAIRS_E;
      case 'w': return BlockType.COBBLE_STAIRS_W;
    }
  }
  return item;
}
