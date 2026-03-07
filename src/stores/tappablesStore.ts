import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';

export interface TappableItem {
  type: BlockType;
  count: number;
}

export interface Tappable {
  id: string;
  type: 'chest' | 'crystal' | 'mushroom' | 'flower_patch' | 'ore_nugget';
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

const TAPPABLE_TYPES: Tappable['type'][] = ['chest', 'crystal', 'mushroom', 'flower_patch', 'ore_nugget'];

// Color per type for 3D rendering
export const TAPPABLE_COLORS: Record<Tappable['type'], number> = {
  chest: 0xb8945a,
  crystal: 0x66aaff,
  mushroom: 0xcc5544,
  flower_patch: 0xffcc44,
  ore_nugget: 0xaaaaaa,
};

function generateLoot(_type: Tappable['type'], biome: string): TappableItem[] {
  const loot: TappableItem[] = [];
  const count = 1 + Math.floor(Math.random() * 2); // 1-2 items

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
    loot.push({ type: itemType, count: 1 + Math.floor(Math.random() * 2) });
  }

  // Occasional diamond from any tappable
  if (Math.random() < 0.08) {
    loot.push({ type: BlockType.DIAMOND, count: 1 });
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
    const count = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 2 + Math.random() * 6;
      const type = TAPPABLE_TYPES[Math.floor(Math.random() * TAPPABLE_TYPES.length)];

      tappables.push({
        id: `tap_${tappableId++}`,
        type,
        position: [
          center[0] + Math.cos(angle) * radius,
          center[1] + 1,
          center[2] + Math.sin(angle) * radius,
        ],
        collected: false,
        spawnTime: Date.now(),
        loot: generateLoot(type, biomeType),
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
