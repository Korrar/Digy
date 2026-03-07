import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';

export interface CraftingRecipe {
  id: string;
  name: string;
  ingredients: { type: BlockType; count: number }[];
  result: { type: BlockType; count: number };
  craftTime: number; // seconds
  category: 'tools' | 'weapons' | 'blocks' | 'food' | 'smelting';
}

export interface CraftingJob {
  recipeId: string;
  startTime: number;
  endTime: number;
  result: { type: BlockType; count: number };
}

interface CraftingState {
  recipes: CraftingRecipe[];
  activeJobs: CraftingJob[];
  maxSlots: number;
  craftingOpen: boolean;

  toggleCrafting: () => void;
  startCraft: (recipeId: string) => boolean;
  collectJob: (index: number) => { type: BlockType; count: number } | null;
  getCompletedJobs: () => number[];
}

const ALL_RECIPES: CraftingRecipe[] = [
  // Tools
  { id: 'stick', name: 'Sticks', ingredients: [{ type: BlockType.PLANKS, count: 2 }], result: { type: BlockType.STICK, count: 4 }, craftTime: 3, category: 'tools' },
  { id: 'planks', name: 'Planks', ingredients: [{ type: BlockType.WOOD, count: 1 }], result: { type: BlockType.PLANKS, count: 4 }, craftTime: 3, category: 'blocks' },
  { id: 'crafting_table', name: 'Crafting Table', ingredients: [{ type: BlockType.PLANKS, count: 4 }], result: { type: BlockType.CRAFTING_TABLE, count: 1 }, craftTime: 5, category: 'blocks' },
  { id: 'furnace', name: 'Furnace', ingredients: [{ type: BlockType.COBBLESTONE, count: 8 }], result: { type: BlockType.FURNACE, count: 1 }, craftTime: 8, category: 'blocks' },
  { id: 'wooden_pickaxe', name: 'Wooden Pickaxe', ingredients: [{ type: BlockType.PLANKS, count: 3 }, { type: BlockType.STICK, count: 2 }], result: { type: BlockType.WOODEN_PICKAXE, count: 1 }, craftTime: 5, category: 'tools' },
  { id: 'stone_pickaxe', name: 'Stone Pickaxe', ingredients: [{ type: BlockType.COBBLESTONE, count: 3 }, { type: BlockType.STICK, count: 2 }], result: { type: BlockType.STONE_PICKAXE, count: 1 }, craftTime: 8, category: 'tools' },
  { id: 'iron_pickaxe', name: 'Iron Pickaxe', ingredients: [{ type: BlockType.IRON_INGOT, count: 3 }, { type: BlockType.STICK, count: 2 }], result: { type: BlockType.IRON_PICKAXE, count: 1 }, craftTime: 15, category: 'tools' },
  { id: 'diamond_pickaxe', name: 'Diamond Pickaxe', ingredients: [{ type: BlockType.DIAMOND, count: 3 }, { type: BlockType.STICK, count: 2 }], result: { type: BlockType.DIAMOND_PICKAXE, count: 1 }, craftTime: 30, category: 'tools' },
  // Weapons
  { id: 'wooden_sword', name: 'Wooden Sword', ingredients: [{ type: BlockType.PLANKS, count: 2 }, { type: BlockType.STICK, count: 1 }], result: { type: BlockType.WOODEN_SWORD, count: 1 }, craftTime: 5, category: 'weapons' },
  { id: 'stone_sword', name: 'Stone Sword', ingredients: [{ type: BlockType.COBBLESTONE, count: 2 }, { type: BlockType.STICK, count: 1 }], result: { type: BlockType.STONE_SWORD, count: 1 }, craftTime: 8, category: 'weapons' },
  { id: 'iron_sword', name: 'Iron Sword', ingredients: [{ type: BlockType.IRON_INGOT, count: 2 }, { type: BlockType.STICK, count: 1 }], result: { type: BlockType.IRON_SWORD, count: 1 }, craftTime: 15, category: 'weapons' },
  { id: 'diamond_sword', name: 'Diamond Sword', ingredients: [{ type: BlockType.DIAMOND, count: 2 }, { type: BlockType.STICK, count: 1 }], result: { type: BlockType.DIAMOND_SWORD, count: 1 }, craftTime: 30, category: 'weapons' },
  // Building blocks
  { id: 'stone_bricks', name: 'Stone Bricks', ingredients: [{ type: BlockType.STONE, count: 4 }], result: { type: BlockType.STONE_BRICKS, count: 4 }, craftTime: 5, category: 'blocks' },
  { id: 'glass', name: 'Glass', ingredients: [{ type: BlockType.SAND, count: 1 }, { type: BlockType.COAL, count: 1 }], result: { type: BlockType.GLASS, count: 1 }, craftTime: 8, category: 'smelting' },
  { id: 'torch', name: 'Torch', ingredients: [{ type: BlockType.STICK, count: 1 }, { type: BlockType.COAL, count: 1 }], result: { type: BlockType.TORCH, count: 4 }, craftTime: 3, category: 'blocks' },
  { id: 'bookshelf', name: 'Bookshelf', ingredients: [{ type: BlockType.PLANKS, count: 6 }], result: { type: BlockType.BOOKSHELF, count: 1 }, craftTime: 8, category: 'blocks' },
  // Smelting
  { id: 'iron_ingot', name: 'Iron Ingot', ingredients: [{ type: BlockType.IRON_ORE, count: 1 }, { type: BlockType.COAL, count: 1 }], result: { type: BlockType.IRON_INGOT, count: 1 }, craftTime: 10, category: 'smelting' },
  { id: 'gold_ingot', name: 'Gold Ingot', ingredients: [{ type: BlockType.GOLD_ORE, count: 1 }, { type: BlockType.COAL, count: 1 }], result: { type: BlockType.GOLD_INGOT, count: 1 }, craftTime: 12, category: 'smelting' },
  // Food
  { id: 'bread', name: 'Bread', ingredients: [{ type: BlockType.SAND, count: 3 }], result: { type: BlockType.BREAD, count: 1 }, craftTime: 5, category: 'food' },
  { id: 'cooked_meat', name: 'Cooked Meat', ingredients: [{ type: BlockType.RAW_MEAT, count: 1 }, { type: BlockType.COAL, count: 1 }], result: { type: BlockType.COOKED_MEAT, count: 1 }, craftTime: 8, category: 'smelting' },
];

export const useCraftingStore = create<CraftingState>((set, get) => ({
  recipes: ALL_RECIPES,
  activeJobs: [],
  maxSlots: 3,
  craftingOpen: false,

  toggleCrafting: () => set((s) => ({ craftingOpen: !s.craftingOpen })),

  startCraft: (recipeId) => {
    const state = get();
    if (state.activeJobs.length >= state.maxSlots) return false;

    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return false;

    const now = Date.now();
    const job: CraftingJob = {
      recipeId,
      startTime: now,
      endTime: now + recipe.craftTime * 1000,
      result: recipe.result,
    };

    set({ activeJobs: [...state.activeJobs, job] });
    return true;
  },

  collectJob: (index) => {
    const state = get();
    const job = state.activeJobs[index];
    if (!job || Date.now() < job.endTime) return null;

    const newJobs = [...state.activeJobs];
    newJobs.splice(index, 1);
    set({ activeJobs: newJobs });
    return job.result;
  },

  getCompletedJobs: () => {
    const state = get();
    const now = Date.now();
    return state.activeJobs
      .map((job, i) => (now >= job.endTime ? i : -1))
      .filter((i) => i >= 0);
  },
}));
