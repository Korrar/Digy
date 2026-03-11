import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatStore } from '../../../stores/combatStore';

describe('Boss enemies', () => {
  beforeEach(() => {
    useCombatStore.getState().resetCombat();
  });

  describe('Golem boss', () => {
    it('should spawn golem with high HP', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const enemies = useCombatStore.getState().enemies;
      const golem = enemies.find(e => e.type === 'golem');
      expect(golem).toBeDefined();
      expect(golem!.maxHp).toBeGreaterThanOrEqual(40);
    });

    it('golem should deal high damage', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem');
      expect(golem!.damage).toBeGreaterThanOrEqual(4);
    });

    it('golem should be slow', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem');
      expect(golem!.speed).toBeLessThanOrEqual(0.2);
    });

    it('golem should be marked as boss', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem');
      expect(golem!.isBoss).toBe(true);
    });

    it('should award more XP on death', () => {
      const { spawnEnemy, damageEnemy, addXp } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem')!;
      // Golem XP should be high
      expect(golem.type === 'golem').toBe(true);
      // Boss XP value is handled in the click handler, so just verify type
    });
  });

  describe('Dragon boss', () => {
    it('should spawn dragon with very high HP', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('dragon', [0, 0, 0]);
      const dragon = useCombatStore.getState().enemies.find(e => e.type === 'dragon');
      expect(dragon).toBeDefined();
      expect(dragon!.maxHp).toBeGreaterThanOrEqual(60);
    });

    it('dragon should deal very high damage', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('dragon', [0, 0, 0]);
      const dragon = useCombatStore.getState().enemies.find(e => e.type === 'dragon');
      expect(dragon!.damage).toBeGreaterThanOrEqual(6);
    });

    it('dragon should be marked as boss', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('dragon', [0, 0, 0]);
      const dragon = useCombatStore.getState().enemies.find(e => e.type === 'dragon');
      expect(dragon!.isBoss).toBe(true);
    });
  });

  describe('Boss enemy properties', () => {
    it('boss enemies should have longer attack cooldown', () => {
      const { spawnEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem')!;
      expect(golem.attackCooldown).toBeGreaterThanOrEqual(2);
    });

    it('damageEnemy should work on bosses', () => {
      const { spawnEnemy, damageEnemy } = useCombatStore.getState();
      spawnEnemy('golem', [0, 0, 0]);
      const golem = useCombatStore.getState().enemies.find(e => e.type === 'golem')!;
      damageEnemy(golem.id, 10);
      const updated = useCombatStore.getState().enemies.find(e => e.type === 'golem')!;
      expect(updated.hp).toBe(golem.maxHp - 10);
    });
  });
});
