import { create } from 'zustand';

export interface Enemy {
  id: string;
  type: 'zombie' | 'skeleton' | 'spider' | 'creeper';
  position: [number, number, number];
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackCooldown: number;
  lastAttackTime: number;
  target: [number, number, number];
  isDead: boolean;
  deathTime: number;
}

interface CombatState {
  playerHp: number;
  maxPlayerHp: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  enemies: Enemy[];
  lastDamageTime: number;
  damageFlash: boolean;

  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addXp: (amount: number) => void;
  spawnEnemy: (type: Enemy['type'], position: [number, number, number]) => void;
  removeEnemy: (id: string) => void;
  damageEnemy: (id: string, amount: number) => void;
  updateEnemy: (id: string, updates: Partial<Enemy>) => void;
  resetCombat: () => void;
}

let enemyIdCounter = 0;

const ENEMY_STATS: Record<Enemy['type'], { hp: number; damage: number; speed: number }> = {
  zombie: { hp: 10, damage: 1.5, speed: 0.3 },
  skeleton: { hp: 8, damage: 2, speed: 0.25 },
  spider: { hp: 8, damage: 1, speed: 0.5 },
  creeper: { hp: 10, damage: 4, speed: 0.35 },
};

function xpForLevel(level: number): number {
  return Math.floor(10 * Math.pow(1.3, level - 1));
}

export const useCombatStore = create<CombatState>((set, get) => ({
  playerHp: 20,
  maxPlayerHp: 20,
  xp: 0,
  level: 1,
  xpToNextLevel: 10,
  enemies: [],
  lastDamageTime: 0,
  damageFlash: false,

  takeDamage: (amount) => {
    const now = Date.now();
    const state = get();
    if (now - state.lastDamageTime < 500) return; // 0.5s invincibility
    const newHp = Math.max(0, state.playerHp - amount);
    set({ playerHp: newHp, lastDamageTime: now, damageFlash: true });
    setTimeout(() => set({ damageFlash: false }), 200);
  },

  heal: (amount) => {
    const state = get();
    set({ playerHp: Math.min(state.maxPlayerHp, state.playerHp + amount) });
  },

  addXp: (amount) => {
    const state = get();
    let xp = state.xp + amount;
    let level = state.level;
    let needed = state.xpToNextLevel;
    while (xp >= needed) {
      xp -= needed;
      level++;
      needed = xpForLevel(level);
    }
    set({ xp, level, xpToNextLevel: needed });
  },

  spawnEnemy: (type, position) => {
    const stats = ENEMY_STATS[type];
    const enemy: Enemy = {
      id: `enemy_${enemyIdCounter++}`,
      type,
      position: [...position],
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      speed: stats.speed,
      attackCooldown: type === 'creeper' ? 3 : 1.5,
      lastAttackTime: 0,
      target: [position[0] + (Math.random() - 0.5) * 6, position[1], position[2] + (Math.random() - 0.5) * 6],
      isDead: false,
      deathTime: 0,
    };
    set((s) => ({ enemies: [...s.enemies, enemy] }));
  },

  removeEnemy: (id) => {
    set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) }));
  },

  damageEnemy: (id, amount) => {
    set((s) => {
      const enemies = s.enemies.map((e) => {
        if (e.id !== id) return e;
        const newHp = e.hp - amount;
        if (newHp <= 0) {
          return { ...e, hp: 0, isDead: true, deathTime: Date.now() };
        }
        return { ...e, hp: newHp };
      });
      return { enemies };
    });
  },

  updateEnemy: (id, updates) => {
    set((s) => ({
      enemies: s.enemies.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  resetCombat: () => {
    set({
      playerHp: 20,
      maxPlayerHp: 20,
      enemies: [],
      lastDamageTime: 0,
      damageFlash: false,
    });
  },
}));
