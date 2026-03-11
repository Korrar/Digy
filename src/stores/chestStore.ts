import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';
import type { InventorySlot } from './inventoryStore';

const CHEST_SIZE = 27; // 3 rows of 9

export interface ChestData {
  slots: (InventorySlot | null)[];
}

interface ChestState {
  /** Map from "x,y,z" key to chest contents */
  chests: Map<string, ChestData>;
  /** Currently open chest key (null if none) */
  openChestKey: string | null;

  createChest: (x: number, y: number, z: number, loot?: InventorySlot[]) => void;
  removeChest: (x: number, y: number, z: number) => void;
  openChest: (x: number, y: number, z: number) => void;
  closeChest: () => void;
  getChestSlots: () => (InventorySlot | null)[];
  /** Move item within chest or take/put from player inventory */
  moveChestSlot: (from: number, to: number) => void;
  /** Take item from chest slot into player inventory */
  takeFromChest: (slotIndex: number) => InventorySlot | null;
  /** Put item into chest slot */
  putInChest: (slotIndex: number, item: InventorySlot) => boolean;
  /** Take all items from open chest */
  takeAll: () => InventorySlot[];
}

function chestKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

// Biome-aware loot pools for chests found in the world
const LOOT_POOLS: Record<string, { type: BlockType; weight: number; min: number; max: number }[]> = {
  default: [
    { type: BlockType.COAL, weight: 5, min: 1, max: 4 },
    { type: BlockType.IRON_INGOT, weight: 3, min: 1, max: 2 },
    { type: BlockType.GOLD_INGOT, weight: 2, min: 1, max: 1 },
    { type: BlockType.DIAMOND, weight: 1, min: 1, max: 1 },
    { type: BlockType.APPLE, weight: 4, min: 1, max: 3 },
    { type: BlockType.BREAD, weight: 3, min: 1, max: 2 },
    { type: BlockType.STICK, weight: 4, min: 2, max: 6 },
    { type: BlockType.TORCH, weight: 3, min: 1, max: 4 },
    { type: BlockType.PLANKS, weight: 4, min: 2, max: 8 },
    { type: BlockType.IRON_ORE, weight: 3, min: 1, max: 3 },
    { type: BlockType.RAIL, weight: 2, min: 2, max: 8 },
    { type: BlockType.COOKED_MEAT, weight: 2, min: 1, max: 2 },
  ],
  dungeon: [
    { type: BlockType.IRON_INGOT, weight: 4, min: 2, max: 5 },
    { type: BlockType.GOLD_INGOT, weight: 3, min: 1, max: 3 },
    { type: BlockType.DIAMOND, weight: 2, min: 1, max: 2 },
    { type: BlockType.IRON_SWORD, weight: 2, min: 1, max: 1 },
    { type: BlockType.IRON_PICKAXE, weight: 2, min: 1, max: 1 },
    { type: BlockType.DIAMOND_SWORD, weight: 1, min: 1, max: 1 },
    { type: BlockType.COOKED_MEAT, weight: 3, min: 2, max: 4 },
    { type: BlockType.APPLE, weight: 3, min: 2, max: 5 },
    { type: BlockType.TORCH, weight: 3, min: 3, max: 8 },
    { type: BlockType.BREAD, weight: 3, min: 2, max: 4 },
  ],
};

function generateChestLoot(itemCount: number = 3, poolName: string = 'default'): InventorySlot[] {
  const pool = LOOT_POOLS[poolName] || LOOT_POOLS.default;
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  const loot: InventorySlot[] = [];

  for (let i = 0; i < itemCount; i++) {
    let roll = Math.random() * totalWeight;
    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) {
        const count = item.min + Math.floor(Math.random() * (item.max - item.min + 1));
        loot.push({ blockType: item.type, count });
        break;
      }
    }
  }

  return loot;
}

export { CHEST_SIZE, chestKey, generateChestLoot };

export const useChestStore = create<ChestState>((set, get) => ({
  chests: new Map(),
  openChestKey: null,

  createChest: (x, y, z, loot) => {
    const state = get();
    const key = chestKey(x, y, z);
    const newChests = new Map(state.chests);
    const slots: (InventorySlot | null)[] = new Array(CHEST_SIZE).fill(null);
    if (loot) {
      for (let i = 0; i < Math.min(loot.length, CHEST_SIZE); i++) {
        // Randomize slot placement
        let targetSlot: number;
        do {
          targetSlot = Math.floor(Math.random() * CHEST_SIZE);
        } while (slots[targetSlot] !== null);
        slots[targetSlot] = loot[i];
      }
    }
    newChests.set(key, { slots });
    set({ chests: newChests });
  },

  removeChest: (x, y, z) => {
    const state = get();
    const key = chestKey(x, y, z);
    const newChests = new Map(state.chests);
    newChests.delete(key);
    const updates: Partial<ChestState> = { chests: newChests };
    if (state.openChestKey === key) {
      updates.openChestKey = null;
    }
    set(updates as ChestState);
  },

  openChest: (x, y, z) => {
    const key = chestKey(x, y, z);
    const state = get();
    // Auto-create chest data if not exists (for world-generated chests)
    if (!state.chests.has(key)) {
      const loot = generateChestLoot(2 + Math.floor(Math.random() * 4));
      state.createChest(x, y, z, loot);
    }
    set({ openChestKey: key });
  },

  closeChest: () => set({ openChestKey: null }),

  getChestSlots: () => {
    const state = get();
    if (!state.openChestKey) return new Array(CHEST_SIZE).fill(null);
    const chest = state.chests.get(state.openChestKey);
    return chest ? [...chest.slots] : new Array(CHEST_SIZE).fill(null);
  },

  moveChestSlot: (from, to) => {
    const state = get();
    if (!state.openChestKey) return;
    const chest = state.chests.get(state.openChestKey);
    if (!chest) return;
    const newSlots = [...chest.slots];
    const temp = newSlots[to];
    newSlots[to] = newSlots[from];
    newSlots[from] = temp;
    const newChests = new Map(state.chests);
    newChests.set(state.openChestKey, { slots: newSlots });
    set({ chests: newChests });
  },

  takeFromChest: (slotIndex) => {
    const state = get();
    if (!state.openChestKey) return null;
    const chest = state.chests.get(state.openChestKey);
    if (!chest || !chest.slots[slotIndex]) return null;
    const item = { ...chest.slots[slotIndex]! };
    const newSlots = [...chest.slots];
    newSlots[slotIndex] = null;
    const newChests = new Map(state.chests);
    newChests.set(state.openChestKey, { slots: newSlots });
    set({ chests: newChests });
    return item;
  },

  putInChest: (slotIndex, item) => {
    const state = get();
    if (!state.openChestKey) return false;
    const chest = state.chests.get(state.openChestKey);
    if (!chest || chest.slots[slotIndex] !== null) return false;
    const newSlots = [...chest.slots];
    newSlots[slotIndex] = item;
    const newChests = new Map(state.chests);
    newChests.set(state.openChestKey, { slots: newSlots });
    set({ chests: newChests });
    return true;
  },

  takeAll: () => {
    const state = get();
    if (!state.openChestKey) return [];
    const chest = state.chests.get(state.openChestKey);
    if (!chest) return [];
    const items = chest.slots.filter((s): s is InventorySlot => s !== null);
    const newSlots: (InventorySlot | null)[] = new Array(CHEST_SIZE).fill(null);
    const newChests = new Map(state.chests);
    newChests.set(state.openChestKey, { slots: newSlots });
    set({ chests: newChests });
    return items;
  },
}));
