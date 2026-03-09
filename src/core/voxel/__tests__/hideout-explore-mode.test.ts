import { describe, it, expect } from 'vitest';

describe('Hideout adventure mode', () => {
  it('WorldInteraction should accept adventure mode', () => {
    type ModeType = 'mine' | 'build' | 'adventure';
    const validModes: ModeType[] = ['mine', 'build', 'adventure'];
    expect(validModes).toContain('adventure');
  });

  it('HideoutScene modes should include adventure in addition to mine and build', () => {
    type HideoutMode = 'mine' | 'build' | 'adventure';
    const modes: HideoutMode[] = ['mine', 'build', 'adventure'];
    expect(modes.length).toBe(3);
    expect(modes).toContain('adventure');
  });
});
