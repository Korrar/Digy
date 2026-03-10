import { create } from 'zustand';
import { BlockType, isToolPickaxe, isSword } from '../core/voxel/BlockRegistry';
import { useCombatStore } from './combatStore';
import { useInventoryStore } from './inventoryStore';

export type EnchantmentType = 'efficiency' | 'unbreaking' | 'fortune' | 'sharpness';

export interface Enchantment {
  type: EnchantmentType;
  level: number; // 1-3
}

export interface EnchantmentDef {
  type: EnchantmentType;
  name: string;
  description: string;
  maxLevel: number;
  xpCost: number[]; // cost per level [level1, level2, level3]
  appliesTo: 'pickaxe' | 'sword' | 'both';
}

export const ENCHANTMENT_DEFS: EnchantmentDef[] = [
  {
    type: 'efficiency',
    name: 'Efficiency',
    description: 'Increases mining speed',
    maxLevel: 3,
    xpCost: [3, 5, 8],
    appliesTo: 'pickaxe',
  },
  {
    type: 'unbreaking',
    name: 'Unbreaking',
    description: 'Reduces durability loss chance',
    maxLevel: 3,
    xpCost: [2, 4, 7],
    appliesTo: 'both',
  },
  {
    type: 'fortune',
    name: 'Fortune',
    description: 'Chance to double ore drops',
    maxLevel: 3,
    xpCost: [4, 6, 10],
    appliesTo: 'pickaxe',
  },
  {
    type: 'sharpness',
    name: 'Sharpness',
    description: 'Increases damage',
    maxLevel: 3,
    xpCost: [3, 5, 8],
    appliesTo: 'sword',
  },
];

function getEnchantmentDef(type: EnchantmentType): EnchantmentDef | undefined {
  return ENCHANTMENT_DEFS.find((d) => d.type === type);
}

function canApplyTo(def: EnchantmentDef, blockType: BlockType): boolean {
  if (def.appliesTo === 'pickaxe') return isToolPickaxe(blockType);
  if (def.appliesTo === 'sword') return isSword(blockType);
  // 'both'
  return isToolPickaxe(blockType) || isSword(blockType);
}

interface EnchantmentState {
  // Map from inventory slot index to enchantments
  slotEnchantments: Record<number, Enchantment[]>;
  enchantingOpen: boolean;

  openEnchanting: () => void;
  closeEnchanting: () => void;
  toggleEnchanting: () => void;

  // Apply enchantment to a slot (costs XP from combatStore)
  enchant: (slotIndex: number, enchType: EnchantmentType) => boolean;

  // Get enchantments for a slot
  getEnchantments: (slotIndex: number) => Enchantment[];

  // Check if slot has specific enchantment, returns level or 0
  getEnchantmentLevel: (slotIndex: number, type: EnchantmentType) => number;

  // Remove enchantment when item is removed/moved
  clearSlot: (slotIndex: number) => void;
  moveEnchantments: (from: number, to: number) => void;
}

export const useEnchantmentStore = create<EnchantmentState>((set, get) => ({
  slotEnchantments: {},
  enchantingOpen: false,

  openEnchanting: () => set({ enchantingOpen: true }),
  closeEnchanting: () => set({ enchantingOpen: false }),
  toggleEnchanting: () => set((s) => ({ enchantingOpen: !s.enchantingOpen })),

  enchant: (slotIndex: number, enchType: EnchantmentType): boolean => {
    const def = getEnchantmentDef(enchType);
    if (!def) return false;

    // Check if the slot has a valid tool
    const invSlot = useInventoryStore.getState().slots[slotIndex];
    if (!invSlot) return false;
    if (!canApplyTo(def, invSlot.blockType)) return false;

    // Check current enchantment level
    const state = get();
    const existing = state.slotEnchantments[slotIndex] || [];
    const current = existing.find((e) => e.type === enchType);
    const currentLevel = current ? current.level : 0;

    if (currentLevel >= def.maxLevel) return false;

    // Get XP cost for next level
    const cost = def.xpCost[currentLevel]; // currentLevel is 0-indexed for next level cost
    if (cost === undefined) return false;

    // Check player has enough XP levels
    const combat = useCombatStore.getState();
    if (combat.level < cost) return false;

    // Deduct XP levels
    const newLevel = combat.level - cost;
    const newXpToNextLevel = Math.floor(10 * Math.pow(1.3, newLevel - 1));
    useCombatStore.setState({
      level: Math.max(1, newLevel),
      xp: 0,
      xpToNextLevel: Math.max(10, newXpToNextLevel),
    });

    // Apply enchantment
    const newEnchantments = [...existing];
    if (current) {
      const idx = newEnchantments.findIndex((e) => e.type === enchType);
      newEnchantments[idx] = { type: enchType, level: currentLevel + 1 };
    } else {
      newEnchantments.push({ type: enchType, level: 1 });
    }

    set({
      slotEnchantments: {
        ...state.slotEnchantments,
        [slotIndex]: newEnchantments,
      },
    });

    return true;
  },

  getEnchantments: (slotIndex: number): Enchantment[] => {
    return get().slotEnchantments[slotIndex] || [];
  },

  getEnchantmentLevel: (slotIndex: number, type: EnchantmentType): number => {
    const enchantments = get().slotEnchantments[slotIndex] || [];
    const found = enchantments.find((e) => e.type === type);
    return found ? found.level : 0;
  },

  clearSlot: (slotIndex: number) => {
    const state = get();
    const newMap = { ...state.slotEnchantments };
    delete newMap[slotIndex];
    set({ slotEnchantments: newMap });
  },

  moveEnchantments: (from: number, to: number) => {
    const state = get();
    const newMap = { ...state.slotEnchantments };
    const fromEnch = newMap[from];
    const toEnch = newMap[to];

    if (fromEnch) {
      newMap[to] = fromEnch;
    } else {
      delete newMap[to];
    }

    if (toEnch) {
      newMap[from] = toEnch;
    } else {
      delete newMap[from];
    }

    set({ slotEnchantments: newMap });
  },
}));
