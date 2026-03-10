import { create } from 'zustand';
import { showFloatingText } from '../components/ui/FloatingText';
import { useCombatStore } from '../stores/combatStore';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface AchievementState {
  achievements: Achievement[];
  unlocked: Record<string, number>; // id -> timestamp
  stats: {
    blocksMined: number;
    blocksPlaced: number;
    enemiesKilled: number;
    itemsCrafted: number;
    itemsSmelted: number;
    biomesVisited: string[];
  };

  panelOpen: boolean;

  // Methods
  unlock: (id: string) => void;
  isUnlocked: (id: string) => boolean;
  incrementStat: (stat: string, amount?: number) => void;
  visitBiome: (biome: string) => void;
  checkAchievements: () => void;
  getProgress: () => { unlocked: number; total: number };
  togglePanel: () => void;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_block', name: 'First Block', description: 'Mine your first block', icon: '⛏️' },
  { id: 'miner', name: 'Miner', description: 'Mine 100 blocks', icon: '💎' },
  { id: 'lumberjack', name: 'Lumberjack', description: 'Mine 50 wood blocks', icon: '🪓' },
  { id: 'crafter', name: 'Crafter', description: 'Craft your first item', icon: '🔨' },
  { id: 'master_crafter', name: 'Master Crafter', description: 'Craft 50 items', icon: '⚒️' },
  { id: 'warrior', name: 'Warrior', description: 'Defeat your first enemy', icon: '⚔️' },
  { id: 'slayer', name: 'Slayer', description: 'Defeat 50 enemies', icon: '🗡️' },
  { id: 'level_5', name: 'Apprentice', description: 'Reach level 5', icon: '⭐' },
  { id: 'level_10', name: 'Expert', description: 'Reach level 10', icon: '🌟' },
  { id: 'diamond_find', name: 'Diamond!', description: 'Find your first diamond', icon: '💠' },
  { id: 'iron_age', name: 'Iron Age', description: 'Craft an iron pickaxe', icon: '🔧' },
  { id: 'full_diamond', name: 'Diamond Tier', description: 'Craft a diamond pickaxe', icon: '💎' },
  { id: 'builder', name: 'Builder', description: 'Place 100 blocks', icon: '🧱' },
  { id: 'explorer', name: 'Explorer', description: 'Visit 5 different biomes', icon: '🗺️' },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Defeat the Cave Guardian', icon: '🐉' },
  { id: 'enchanter', name: 'Enchanter', description: 'Enchant your first tool', icon: '✨' },
  { id: 'furnace_master', name: 'Furnace Master', description: 'Smelt 20 items', icon: '🔥' },
  { id: 'survivor', name: 'Survivor', description: 'Survive with 1 HP', icon: '❤️' },
];

export const useAchievementStore = create<AchievementState>((set, get) => ({
  achievements: ACHIEVEMENTS,
  unlocked: {},
  panelOpen: false,
  stats: {
    blocksMined: 0,
    blocksPlaced: 0,
    enemiesKilled: 0,
    itemsCrafted: 0,
    itemsSmelted: 0,
    biomesVisited: [],
  },

  unlock: (id: string) => {
    const state = get();
    if (state.unlocked[id]) return;

    const achievement = state.achievements.find((a) => a.id === id);
    if (!achievement) return;

    set({
      unlocked: { ...state.unlocked, [id]: Date.now() },
    });

    showFloatingText(`${achievement.icon} ${achievement.name}`, '#FFD700');
  },

  isUnlocked: (id: string) => {
    return id in get().unlocked;
  },

  incrementStat: (stat: string, amount = 1) => {
    const state = get();
    const stats = { ...state.stats };

    if (stat in stats && typeof (stats as Record<string, unknown>)[stat] === 'number') {
      (stats as Record<string, number>)[stat] += amount;
      set({ stats });
      get().checkAchievements();
    }
  },

  visitBiome: (biome: string) => {
    const state = get();
    if (state.stats.biomesVisited.includes(biome)) return;

    set({
      stats: {
        ...state.stats,
        biomesVisited: [...state.stats.biomesVisited, biome],
      },
    });
    get().checkAchievements();
  },

  checkAchievements: () => {
    const state = get();
    const { stats } = state;
    const combat = useCombatStore.getState();

    // Mining achievements
    if (stats.blocksMined >= 1) get().unlock('first_block');
    if (stats.blocksMined >= 100) get().unlock('miner');

    // Building achievements
    if (stats.blocksPlaced >= 100) get().unlock('builder');

    // Crafting achievements
    if (stats.itemsCrafted >= 1) get().unlock('crafter');
    if (stats.itemsCrafted >= 50) get().unlock('master_crafter');

    // Combat achievements
    if (stats.enemiesKilled >= 1) get().unlock('warrior');
    if (stats.enemiesKilled >= 50) get().unlock('slayer');

    // Level achievements
    if (combat.level >= 5) get().unlock('level_5');
    if (combat.level >= 10) get().unlock('level_10');

    // Smelting achievements
    if (stats.itemsSmelted >= 20) get().unlock('furnace_master');

    // Explorer achievement
    if (stats.biomesVisited.length >= 5) get().unlock('explorer');

    // Survivor achievement
    if (combat.playerHp === 1) get().unlock('survivor');
  },

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  getProgress: () => {
    const state = get();
    return {
      unlocked: Object.keys(state.unlocked).length,
      total: state.achievements.length,
    };
  },
}));
