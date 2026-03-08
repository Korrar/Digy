import { describe, it, expect } from 'vitest';
import { SoundManager } from '../../../systems/SoundManager';

/**
 * Tests for minecart riding sound.
 * The SoundManager should expose a method to play a looping minecart riding
 * sound that simulates metallic rattling on rails.
 */
describe('Minecart riding sound', () => {
  it('SoundManager should have a playMinecartRiding method', () => {
    const sm = new SoundManager();
    expect(typeof sm.playMinecartRiding).toBe('function');
  });

  it('SoundManager should have a stopMinecartRiding method', () => {
    const sm = new SoundManager();
    expect(typeof sm.stopMinecartRiding).toBe('function');
  });
});
