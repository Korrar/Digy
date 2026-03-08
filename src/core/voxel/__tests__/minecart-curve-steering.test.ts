import { describe, it, expect } from 'vitest';

/**
 * Tests for minecart curve-following physics.
 *
 * Simulates the steering algorithm from Minecarts.tsx to verify
 * that carts correctly follow curved rails at various speeds.
 *
 * Coordinate system:
 *   North = -Z, South = +Z, East = +X, West = -X
 */

interface Vec2 {
  x: number;
  z: number;
}

interface CurveConfig {
  pivotX: number;
  pivotZ: number;
}

const CURVE_PIVOTS: Record<string, CurveConfig> = {
  curve_ne: { pivotX: 1, pivotZ: 0 },
  curve_nw: { pivotX: 0, pivotZ: 0 },
  curve_se: { pivotX: 1, pivotZ: 1 },
  curve_sw: { pivotX: 0, pivotZ: 1 },
};

/**
 * Simulates the FIXED arc-based minecart steering.
 * Cart position advances along the arc. Steering only applies while
 * the cart is within the curve block [0,1] x [0,1]. After exiting,
 * no more curve steering is applied (simulating transition to straight rail).
 */
function simulateCurveSteering(
  shape: string,
  startLocalPos: Vec2,
  startVelocity: Vec2,
  frames: number
): { pos: Vec2; vel: Vec2 } {
  const { pivotX, pivotZ } = CURVE_PIVOTS[shape];
  const pos = { ...startLocalPos };
  const vel = { ...startVelocity };
  const idealR = 0.5;
  let onCurve = true;

  for (let f = 0; f < frames; f++) {
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speed < 0.00001) break;

    // Only apply curve steering if cart is within the block
    if (onCurve && pos.x >= -0.05 && pos.x <= 1.05 && pos.z >= -0.05 && pos.z <= 1.05) {
      const dx = pos.x - pivotX;
      const dz = pos.z - pivotZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.01) {
        // Snap position to ideal radius
        const snappedX = pivotX + (dx / dist) * idealR;
        const snappedZ = pivotZ + (dz / dist) * idealR;

        // Current angle on the arc
        const angle = Math.atan2(dz, dx);

        // Determine rotation direction from velocity
        const tangentX = -Math.sin(angle);
        const tangentZ = Math.cos(angle);
        const dot = tangentX * vel.x + tangentZ * vel.z;
        const sign = dot >= 0 ? 1 : -1;

        // Angular speed = linear speed / radius
        const angularSpeed = speed / idealR;
        const nextAngle = angle + sign * angularSpeed;

        // Next position on arc
        const nextX = pivotX + Math.cos(nextAngle) * idealR;
        const nextZ = pivotZ + Math.sin(nextAngle) * idealR;

        // Set velocity as chord from snapped position to next arc position
        vel.x = nextX - snappedX;
        vel.z = nextZ - snappedZ;

        // Apply snapped position
        pos.x = snappedX;
        pos.z = snappedZ;
      }
    } else {
      onCurve = false;
    }

    // Move
    pos.x += vel.x;
    pos.z += vel.z;
  }

  return { pos, vel };
}

describe('Minecart curve steering', () => {
  it('curve_ne: cart entering from north (heading south) should exit heading east', () => {
    const result = simulateCurveSteering(
      'curve_ne',
      { x: 0.5, z: 0.05 },
      { x: 0, z: 0.08 },
      30
    );

    expect(result.vel.x).toBeGreaterThan(0.05); // heading east
    expect(Math.abs(result.vel.z)).toBeLessThan(result.vel.x); // more east than south
  });

  it('curve_ne: cart entering from east (heading west) should exit heading north', () => {
    const result = simulateCurveSteering(
      'curve_ne',
      { x: 0.95, z: 0.5 },
      { x: -0.08, z: 0 },
      30
    );

    expect(result.vel.z).toBeLessThan(-0.05); // heading north
    expect(Math.abs(result.vel.x)).toBeLessThan(Math.abs(result.vel.z)); // more north than west
  });

  it('curve_nw: cart entering from north should exit heading west', () => {
    const result = simulateCurveSteering(
      'curve_nw',
      { x: 0.5, z: 0.05 },
      { x: 0, z: 0.08 },
      30
    );

    expect(result.vel.x).toBeLessThan(-0.05); // heading west
  });

  it('curve_se: cart entering from south should exit heading east', () => {
    const result = simulateCurveSteering(
      'curve_se',
      { x: 0.5, z: 0.95 },
      { x: 0, z: -0.08 },
      30
    );

    expect(result.vel.x).toBeGreaterThan(0.05); // heading east
  });

  it('curve_sw: cart entering from south should exit heading west', () => {
    const result = simulateCurveSteering(
      'curve_sw',
      { x: 0.5, z: 0.95 },
      { x: 0, z: -0.08 },
      30
    );

    expect(result.vel.x).toBeLessThan(-0.05); // heading west
  });

  it('curve_ne at HIGH SPEED: should still turn correctly', () => {
    const result = simulateCurveSteering(
      'curve_ne',
      { x: 0.5, z: 0.05 },
      { x: 0, z: 0.3 },
      10
    );

    expect(result.vel.x).toBeGreaterThan(0.1); // heading east significantly
  });

  it('curve_nw at HIGH SPEED: should still turn correctly', () => {
    const result = simulateCurveSteering(
      'curve_nw',
      { x: 0.5, z: 0.05 },
      { x: 0, z: 0.3 },
      10
    );

    expect(result.vel.x).toBeLessThan(-0.1); // heading west significantly
  });

  it('curve_se at HIGH SPEED: cart from east should exit heading south', () => {
    const result = simulateCurveSteering(
      'curve_se',
      { x: 0.95, z: 0.5 },
      { x: -0.3, z: 0 },
      10
    );

    expect(result.vel.z).toBeGreaterThan(0.1); // heading south
  });

  it('curve_sw at HIGH SPEED: cart from west should exit heading south', () => {
    const result = simulateCurveSteering(
      'curve_sw',
      { x: 0.05, z: 0.5 },
      { x: 0.3, z: 0 },
      10
    );

    expect(result.vel.z).toBeGreaterThan(0.1); // heading south
  });

  it('speed should be approximately preserved through the curve', () => {
    const initialSpeed = 0.15;
    const result = simulateCurveSteering(
      'curve_ne',
      { x: 0.5, z: 0.05 },
      { x: 0, z: initialSpeed },
      20
    );

    const finalSpeed = Math.sqrt(result.vel.x * result.vel.x + result.vel.z * result.vel.z);
    // Speed should be roughly preserved (chord vs arc causes slight difference)
    expect(finalSpeed).toBeGreaterThan(initialSpeed * 0.80);
    expect(finalSpeed).toBeLessThan(initialSpeed * 1.20);
  });
});
