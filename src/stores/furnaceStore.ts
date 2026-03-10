import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';
import { useInventoryStore } from './inventoryStore';

interface SmeltingRecipe {
  input: BlockType;
  fuel: BlockType;
  output: BlockType;
  smeltTime: number; // seconds
}

interface SmeltingJob {
  input: BlockType;
  output: BlockType;
  startTime: number;
  endTime: number;
}

interface FurnaceState {
  furnaceOpen: boolean;
  furnacePosition: [number, number, number] | null;
  activeJobs: SmeltingJob[];
  maxJobs: number;
  recipes: SmeltingRecipe[];

  openFurnace: (x: number, y: number, z: number) => void;
  closeFurnace: () => void;
  startSmelt: (input: BlockType) => boolean;
  collectJob: (index: number) => BlockType | null;
}

const SMELTING_RECIPES: SmeltingRecipe[] = [
  { input: BlockType.IRON_ORE, fuel: BlockType.COAL, output: BlockType.IRON_INGOT, smeltTime: 10 },
  { input: BlockType.GOLD_ORE, fuel: BlockType.COAL, output: BlockType.GOLD_INGOT, smeltTime: 12 },
  { input: BlockType.SAND, fuel: BlockType.COAL, output: BlockType.GLASS, smeltTime: 8 },
  { input: BlockType.RAW_MEAT, fuel: BlockType.COAL, output: BlockType.COOKED_MEAT, smeltTime: 6 },
  { input: BlockType.COBBLESTONE, fuel: BlockType.COAL, output: BlockType.STONE, smeltTime: 8 },
  { input: BlockType.WOOD, fuel: BlockType.COAL, output: BlockType.COAL, smeltTime: 5 },
];

function findSlotWithType(type: BlockType): number {
  const slots = useInventoryStore.getState().slots;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && slot.blockType === type && slot.count > 0) {
      return i;
    }
  }
  return -1;
}

export const useFurnaceStore = create<FurnaceState>((set, get) => ({
  furnaceOpen: false,
  furnacePosition: null,
  activeJobs: [],
  maxJobs: 2,
  recipes: SMELTING_RECIPES,

  openFurnace: (x: number, y: number, z: number) => {
    set({ furnaceOpen: true, furnacePosition: [x, y, z] });
  },

  closeFurnace: () => {
    set({ furnaceOpen: false, furnacePosition: null });
  },

  startSmelt: (input: BlockType): boolean => {
    const state = get();

    if (state.activeJobs.length >= state.maxJobs) {
      return false;
    }

    const recipe = state.recipes.find((r) => r.input === input);
    if (!recipe) {
      return false;
    }

    const inputSlot = findSlotWithType(recipe.input);
    if (inputSlot === -1) {
      return false;
    }

    const fuelSlot = findSlotWithType(recipe.fuel);
    if (fuelSlot === -1) {
      return false;
    }

    const inventory = useInventoryStore.getState();
    inventory.removeBlock(inputSlot, 1);
    inventory.removeBlock(fuelSlot, 1);

    const now = Date.now();
    const job: SmeltingJob = {
      input: recipe.input,
      output: recipe.output,
      startTime: now,
      endTime: now + recipe.smeltTime * 1000,
    };

    set({ activeJobs: [...state.activeJobs, job] });
    return true;
  },

  collectJob: (index: number): BlockType | null => {
    const state = get();
    const job = state.activeJobs[index];

    if (!job) {
      return null;
    }

    if (Date.now() < job.endTime) {
      return null;
    }

    const newJobs = [...state.activeJobs];
    newJobs.splice(index, 1);
    set({ activeJobs: newJobs });

    return job.output;
  },
}));
