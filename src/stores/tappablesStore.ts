import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';

export type TappableRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface TappableItem {
  type: BlockType;
  count: number;
}

export interface Tappable {
  id: string;
  type: 'chest' | 'crystal' | 'mushroom' | 'flower_patch' | 'ore_nugget';
  rarity: TappableRarity;
  position: [number, number, number];
  collected: boolean;
  spawnTime: number;
  loot: TappableItem[];
}

interface TappablesState {
  tappables: Tappable[];
  showLootPopup: boolean;
  currentLoot: TappableItem[];
  totalCollected: number;

  spawnTappables: (biomeType: string, center: [number, number, number]) => void;
  collectTappable: (id: string) => TappableItem[];
  closeLootPopup: () => void;
  clearTappables: () => void;
}

let tappableId = 0;

const RARITY_WEIGHTS: TappableRarity[] = [
  'common', 'common', 'common', 'common', 'common',
  'uncommon', 'uncommon', 'uncommon',
  'rare', 'rare',
  'epic',
];

const RARITY_COLORS: Record<TappableRarity, string> = {
  common: '#aaaaaa',
  uncommon: '#55cc55',
  rare: '#5555ff',
  epic: '#aa44cc',
};

const TAPPABLE_TYPES: Tappable['type'][] = ['chest', 'crystal', 'mushroom', 'flower_patch', 'ore_nugget'];

function randomRarity(): TappableRarity {
  return RARITY_WEIGHTS[Math.floor(Math.random() * RARITY_WEIGHTS.length)];
}

function generateLoot(_type: Tappable['type'], rarity: TappableRarity, biome: string): TappableItem[] {
  const loot: TappableItem[] = [];
  const count = rarity === 'common' ? 1 : rarity === 'uncommon' ? 2 : rarity === 'rare' ? 2 : 3;
  const rarityMult = rarity === 'common' ? 1 : rarity === 'uncommon' ? 2 : rarity === 'rare' ? 3 : 5;

  // Biome-specific base loot
  const biomeLoot: Record<string, BlockType[]> = {
    forest: [BlockType.WOOD, BlockType.LEAVES, BlockType.APPLE, BlockType.STICK],
    desert: [BlockType.SAND, BlockType.SANDSTONE, BlockType.CACTUS, BlockType.GOLD_ORE],
    cave: [BlockType.STONE, BlockType.COAL, BlockType.IRON_ORE, BlockType.GOLD_ORE],
    mountains: [BlockType.STONE, BlockType.COBBLESTONE, BlockType.IRON_ORE, BlockType.SNOW],
    swamp: [BlockType.MUD, BlockType.CLAY, BlockType.MUSHROOM, BlockType.LILY_PAD],
    tundra: [BlockType.SNOW, BlockType.ICE, BlockType.IRON_ORE, BlockType.COAL],
  };

  const pool = biomeLoot[biome] || biomeLoot.forest;

  for (let i = 0; i < count; i++) {
    const itemType = pool[Math.floor(Math.random() * pool.length)];
    loot.push({ type: itemType, count: Math.ceil(Math.random() * rarityMult) });
  }

  // Rare bonus: rubies
  if (rarity === 'rare' && Math.random() < 0.3) {
    loot.push({ type: BlockType.RUBY, count: 1 });
  }
  if (rarity === 'epic') {
    loot.push({ type: BlockType.RUBY, count: 1 + Math.floor(Math.random() * 3) });
    if (Math.random() < 0.3) {
      loot.push({ type: BlockType.DIAMOND, count: 1 });
    }
  }

  return loot;
}

export const useTappablesStore = create<TappablesState>((set, get) => ({
  tappables: [],
  showLootPopup: false,
  currentLoot: [],
  totalCollected: 0,

  spawnTappables: (biomeType, center) => {
    const tappables: Tappable[] = [];
    const count = 5 + Math.floor(Math.random() * 4); // 5-8 tappables

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 2 + Math.random() * 6;
      const rarity = randomRarity();
      const type = TAPPABLE_TYPES[Math.floor(Math.random() * TAPPABLE_TYPES.length)];

      tappables.push({
        id: `tap_${tappableId++}`,
        type,
        rarity,
        position: [
          center[0] + Math.cos(angle) * radius,
          center[1] + 1,
          center[2] + Math.sin(angle) * radius,
        ],
        collected: false,
        spawnTime: Date.now(),
        loot: generateLoot(type, rarity, biomeType),
      });
    }

    set({ tappables });
  },

  collectTappable: (id) => {
    const state = get();
    const tappable = state.tappables.find((t) => t.id === id);
    if (!tappable || tappable.collected) return [];

    const loot = tappable.loot;
    set({
      tappables: state.tappables.map((t) => (t.id === id ? { ...t, collected: true } : t)),
      showLootPopup: true,
      currentLoot: loot,
      totalCollected: state.totalCollected + 1,
    });
    return loot;
  },

  closeLootPopup: () => set({ showLootPopup: false, currentLoot: [] }),

  clearTappables: () => set({ tappables: [], showLootPopup: false, currentLoot: [] }),
}));

export { RARITY_COLORS };
