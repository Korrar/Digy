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
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  color: THREE.Color;
  topColor?: THREE.Color;
  hardness: number; // seconds to mine
  transparent: boolean;
  drops: BlockType;
  stackSize: number;
  /** Sparkle intensity for ores (0 = none, higher = more sparkle) */
  sparkle?: number;
}

const BLOCKS: Map<BlockType, BlockDefinition> = new Map();

function register(def: BlockDefinition) {
  BLOCKS.set(def.id, def);
}

register({ id: BlockType.AIR, name: 'Air', color: new THREE.Color(0x000000), hardness: 0, transparent: true, drops: BlockType.AIR, stackSize: 0 });
register({ id: BlockType.GRASS, name: 'Grass', color: new THREE.Color(0x5d8a2d), topColor: new THREE.Color(0x7ec850), hardness: 0.6, transparent: false, drops: BlockType.DIRT, stackSize: 64 });
register({ id: BlockType.DIRT, name: 'Dirt', color: new THREE.Color(0x8b6914), hardness: 0.5, transparent: false, drops: BlockType.DIRT, stackSize: 64 });
register({ id: BlockType.STONE, name: 'Stone', color: new THREE.Color(0x808080), hardness: 1.5, transparent: false, drops: BlockType.COBBLESTONE, stackSize: 64 });
register({ id: BlockType.SAND, name: 'Sand', color: new THREE.Color(0xdbc67b), hardness: 0.5, transparent: false, drops: BlockType.SAND, stackSize: 64 });
register({ id: BlockType.WOOD, name: 'Wood', color: new THREE.Color(0x6b4226), hardness: 2.0, transparent: false, drops: BlockType.WOOD, stackSize: 64 });
register({ id: BlockType.LEAVES, name: 'Leaves', color: new THREE.Color(0x3a7d22), hardness: 0.2, transparent: true, drops: BlockType.AIR, stackSize: 64 });
register({ id: BlockType.COAL_ORE, name: 'Coal Ore', color: new THREE.Color(0x4a4a4a), hardness: 3.0, transparent: false, drops: BlockType.COAL_ORE, stackSize: 64 });
register({ id: BlockType.IRON_ORE, name: 'Iron Ore', color: new THREE.Color(0xa08060), hardness: 3.0, transparent: false, drops: BlockType.IRON_ORE, stackSize: 64, sparkle: 0.3 });
register({ id: BlockType.SANDSTONE, name: 'Sandstone', color: new THREE.Color(0xd4b86a), hardness: 0.8, transparent: false, drops: BlockType.SANDSTONE, stackSize: 64 });
register({ id: BlockType.SNOW, name: 'Snow', color: new THREE.Color(0xf0f0f0), hardness: 0.2, transparent: false, drops: BlockType.SNOW, stackSize: 64 });
register({ id: BlockType.ICE, name: 'Ice', color: new THREE.Color(0xa0d0e0), hardness: 0.5, transparent: true, drops: BlockType.ICE, stackSize: 64 });
register({ id: BlockType.CACTUS, name: 'Cactus', color: new THREE.Color(0x2d6e1e), hardness: 0.4, transparent: false, drops: BlockType.CACTUS, stackSize: 64 });
register({ id: BlockType.WATER, name: 'Water', color: new THREE.Color(0x3060c0), hardness: Infinity, transparent: true, drops: BlockType.AIR, stackSize: 0 });
register({ id: BlockType.GRAVEL, name: 'Gravel', color: new THREE.Color(0x909090), hardness: 0.6, transparent: false, drops: BlockType.GRAVEL, stackSize: 64 });
register({ id: BlockType.COBBLESTONE, name: 'Cobblestone', color: new THREE.Color(0x707070), hardness: 2.0, transparent: false, drops: BlockType.COBBLESTONE, stackSize: 64 });
register({ id: BlockType.GOLD_ORE, name: 'Gold Ore', color: new THREE.Color(0x808060), topColor: new THREE.Color(0xdaa520), hardness: 3.0, transparent: false, drops: BlockType.GOLD_ORE, stackSize: 64, sparkle: 0.6 });
register({ id: BlockType.DIAMOND_ORE, name: 'Diamond Ore', color: new THREE.Color(0x607080), topColor: new THREE.Color(0x4dd9e8), hardness: 5.0, transparent: false, drops: BlockType.DIAMOND_ORE, stackSize: 64, sparkle: 0.9 });

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
  return type !== BlockType.AIR && type !== BlockType.WATER;
}

export function getAllPlaceableBlocks(): BlockDefinition[] {
  return Array.from(BLOCKS.values()).filter(b => b.id !== BlockType.AIR && b.stackSize > 0);
}
