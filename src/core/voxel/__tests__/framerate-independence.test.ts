import { describe, it, expect } from 'vitest';

/**
 * Tests that physics/movement calculations are frame-rate independent.
 *
 * The core principle: whether we simulate 1 second as 60 steps of 1/60s
 * or 30 steps of 1/30s, the result should be approximately the same.
 */
describe('Frame-rate independence', () => {
  describe('friction decay', () => {
    it('should produce same result at different framerates using Math.pow(friction, dt)', () => {
      const friction = 0.97;
      let velocity60fps = 10;
      let velocity30fps = 10;

      // Simulate 1 second at 60fps
      for (let i = 0; i < 60; i++) {
        const dt = (1 / 60) * 60; // dt = 1
        velocity60fps *= Math.pow(friction, dt);
      }

      // Simulate 1 second at 30fps
      for (let i = 0; i < 30; i++) {
        const dt = (1 / 30) * 60; // dt = 2
        velocity30fps *= Math.pow(friction, dt);
      }

      // Both should give approximately the same result
      expect(velocity30fps).toBeCloseTo(velocity60fps, 5);
    });

    it('should NOT be frame-rate independent with naive per-frame friction', () => {
      const friction = 0.97;
      let velocity60fps = 10;
      let velocity30fps = 10;

      // Simulate 1 second at 60fps (naive: multiply by friction each frame)
      for (let i = 0; i < 60; i++) {
        velocity60fps *= friction;
      }

      // Simulate 1 second at 30fps (naive: multiply by friction each frame)
      for (let i = 0; i < 30; i++) {
        velocity30fps *= friction;
      }

      // These should NOT be equal - demonstrating the bug
      expect(Math.abs(velocity60fps - velocity30fps)).toBeGreaterThan(0.5);
    });
  });

  describe('movement with delta time', () => {
    it('should move same distance at different framerates using delta scaling', () => {
      const speed = 5; // units per second
      let position60fps = 0;
      let position30fps = 0;

      // Simulate 1 second at 60fps
      for (let i = 0; i < 60; i++) {
        const delta = 1 / 60;
        position60fps += speed * delta;
      }

      // Simulate 1 second at 30fps
      for (let i = 0; i < 30; i++) {
        const delta = 1 / 30;
        position30fps += speed * delta;
      }

      expect(position30fps).toBeCloseTo(position60fps, 5);
      expect(position60fps).toBeCloseTo(5, 5); // 5 units/s * 1s = 5 units
    });

    it('should NOT move same distance with hardcoded 0.016', () => {
      const speed = 5;
      let position60fps = 0;
      let position30fps = 0;

      // Simulate 1 second at 60fps (hardcoded 0.016 per frame)
      for (let i = 0; i < 60; i++) {
        position60fps += speed * 0.016;
      }

      // Simulate 1 second at 30fps (hardcoded 0.016 per frame)
      for (let i = 0; i < 30; i++) {
        position30fps += speed * 0.016;
      }

      // 30fps moves only half the distance - demonstrating the bug
      expect(position30fps).toBeCloseTo(position60fps * 0.5, 5);
    });
  });

  describe('delta clamping', () => {
    it('should clamp large delta values to prevent physics jumps', () => {
      const maxDelta = 0.1; // 100ms clamp (equivalent to 10fps minimum)

      // Simulate a frame spike of 500ms
      const spikeDelta = 0.5;
      const clampedDelta = Math.min(spikeDelta, maxDelta);

      expect(clampedDelta).toBe(0.1);
      expect(clampedDelta).toBeLessThanOrEqual(maxDelta);
    });

    it('should not clamp normal frame deltas', () => {
      const maxDelta = 0.1;

      const delta60fps = 1 / 60; // ~0.0167
      const delta30fps = 1 / 30; // ~0.0333

      expect(Math.min(delta60fps, maxDelta)).toBeCloseTo(delta60fps, 10);
      expect(Math.min(delta30fps, maxDelta)).toBeCloseTo(delta30fps, 10);
    });
  });

  describe('minecart physics dt normalization', () => {
    it('should produce consistent boost at different framerates', () => {
      const boostPerFrame = 0.04; // original per-frame boost at 60fps
      let velocity60fps = 1;
      let velocity30fps = 1;

      // Simulate 1 second of boosting at 60fps
      for (let i = 0; i < 60; i++) {
        const dt = (1 / 60) * 60; // = 1
        velocity60fps += boostPerFrame * dt;
      }

      // Simulate 1 second of boosting at 30fps
      for (let i = 0; i < 30; i++) {
        const dt = (1 / 30) * 60; // = 2
        velocity30fps += boostPerFrame * dt;
      }

      expect(velocity30fps).toBeCloseTo(velocity60fps, 5);
    });
  });
});
