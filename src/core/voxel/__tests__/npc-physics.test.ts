import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import {
  applyPhysics,
  getTerrainHeight,
  isSolidAt,
  type GetBlockFn,
  type PhysicsNPC,
} from '../../npc/npcPhysics';

/** Create a simple world with flat terrain at given height */
function createFlatWorld(groundHeight: number): GetBlockFn {
  return (_x: number, y: number, _z: number) => {
    if (y < groundHeight) return BlockType.STONE;
    return BlockType.AIR;
  };
}

/**
 * Create a world with flat ground and a 1-block step.
 * Ground is solid below groundY. Step block at (wallX, groundY).
 * So the NPC walks on groundY and the step is 1 block higher.
 */
function createWorldWithStep(groundY: number, wallX: number): GetBlockFn {
  return (x: number, y: number, _z: number) => {
    if (y < groundY) return BlockType.STONE;
    if (Math.floor(x) === wallX && y === groundY) return BlockType.STONE;
    return BlockType.AIR;
  };
}

/** Create a world with a 2-block wall (too high to step up) */
function createWorldWith2BlockWall(groundY: number, wallX: number): GetBlockFn {
  return (x: number, y: number, _z: number) => {
    if (y < groundY) return BlockType.STONE;
    if (Math.floor(x) === wallX && (y === groundY || y === groundY + 1)) return BlockType.STONE;
    return BlockType.AIR;
  };
}

function createNPC(overrides: Partial<PhysicsNPC> = {}): PhysicsNPC {
  return {
    position: [5.5, 10, 5.5],
    velocity: [0, 0, 0],
    grounded: true,
    lastJumpTime: -10,
    target: [15, 10, 5.5],
    waypoints: [],
    speed: 3,
    ...overrides,
  };
}

describe('NPC Physics - getTerrainHeight', () => {
  it('should return top of highest solid block', () => {
    const world = createFlatWorld(10);
    expect(getTerrainHeight(world, 5.5, 5.5)).toBe(10);
  });

  it('should return 0 for empty column', () => {
    const world: GetBlockFn = () => BlockType.AIR;
    expect(getTerrainHeight(world, 0, 0)).toBe(0);
  });
});

describe('NPC Physics - isSolidAt', () => {
  it('should detect solid blocks', () => {
    const world = createFlatWorld(10);
    expect(isSolidAt(world, 5.5, 9, 5.5)).toBe(true);
    expect(isSolidAt(world, 5.5, 10, 5.5)).toBe(false);
  });
});

describe('NPC Physics - Step-up mechanic', () => {
  it('should step up over a 1-block obstacle when walking forward', () => {
    // NPC close to wall at x=6 (NPC_WIDTH=0.4, so checkX = 5.6+0.4 = 6.0)
    const world = createWorldWithStep(10, 6);
    const npc = createNPC({
      position: [5.59, 10, 5.5],
      velocity: [3, 0, 0],
      grounded: true,
      target: [10, 10, 5.5],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // NPC should have stepped up to y=11 (top of the step block)
    expect(result.position![1]).toBe(11);
    expect(result.grounded).toBe(true);
    // NPC should retain horizontal velocity (not blocked)
    expect(result.velocity![0]).not.toBe(0);
  });

  it('should NOT jump in place when facing a 1-block wall over multiple frames', () => {
    const world = createWorldWithStep(10, 6);
    const npc = createNPC({
      position: [5.0, 10, 5.5],
      velocity: [3, 0, 0],
      grounded: true,
      target: [10, 10, 5.5],
    });

    // Simulate multiple frames with AI re-applying horizontal velocity
    let currentNPC = { ...npc };
    let jumpCount = 0;

    for (let frame = 0; frame < 120; frame++) {
      // Simulate AI: re-apply velocity toward target (like tickAI does)
      if (currentNPC.grounded) {
        const dx = currentNPC.target[0] - currentNPC.position[0];
        const dist = Math.abs(dx);
        if (dist > 0.3) {
          currentNPC = { ...currentNPC, velocity: [currentNPC.speed * Math.sign(dx), currentNPC.velocity[1], 0] };
        }
      }

      const result = applyPhysics(currentNPC, 0.016, world, frame * 0.016);
      if (result.velocity && result.velocity[1] > 0 && currentNPC.grounded) {
        jumpCount++;
      }
      currentNPC = {
        ...currentNPC,
        position: result.position ?? currentNPC.position,
        velocity: result.velocity ?? currentNPC.velocity,
        grounded: result.grounded ?? currentNPC.grounded,
        lastJumpTime: result.lastJumpTime ?? currentNPC.lastJumpTime,
      };
    }

    // NPC should not jump at all - step-up handles 1-block obstacles
    expect(jumpCount).toBe(0);
    // NPC should have advanced past the wall (x > 6)
    expect(currentNPC.position[0]).toBeGreaterThan(6);
  });

  it('should block movement when facing a 2-block wall', () => {
    // Position NPC right next to the wall
    const world = createWorldWith2BlockWall(10, 6);
    const npc = createNPC({
      position: [5.59, 10, 5.5],
      velocity: [3, 0, 0],
      grounded: true,
      target: [10, 10, 5.5],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // Horizontal velocity should be blocked (2 blocks high, can't step up)
    expect(result.velocity![0]).toBe(0);
    // NPC should stay at original X
    expect(result.position![0]).toBe(5.59);
  });

  it('should preserve Z velocity when X is blocked by 2-block wall (wall sliding)', () => {
    const world = createWorldWith2BlockWall(10, 6);
    const npc = createNPC({
      position: [5.59, 10, 5.5],
      velocity: [3, 0, 2],
      grounded: true,
      target: [10, 10, 10],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // X blocked, but Z should still move (wall sliding)
    expect(result.velocity![0]).toBe(0);
    expect(result.velocity![2]).not.toBe(0);
  });

  it('should handle step-up in Z direction', () => {
    // Wall at z=6
    const world: GetBlockFn = (_x: number, y: number, z: number) => {
      if (y < 10) return BlockType.STONE;
      if (Math.floor(z) === 6 && y === 10) return BlockType.STONE;
      return BlockType.AIR;
    };

    const npc = createNPC({
      position: [5.5, 10, 5.59],
      velocity: [0, 0, 3],
      grounded: true,
      target: [5.5, 10, 10],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // Should step up
    expect(result.position![1]).toBe(11);
    expect(result.grounded).toBe(true);
    expect(result.velocity![2]).not.toBe(0);
  });

  it('should not step up when not grounded (airborne)', () => {
    const world = createWorldWithStep(10, 6);
    const npc = createNPC({
      position: [5.59, 11, 5.5],
      velocity: [3, -2, 0],
      grounded: false,
      target: [10, 10, 5.5],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // Should NOT step up while airborne
    expect(result.position![1]).not.toBe(12);
  });

  it('should not step up when head would be blocked', () => {
    // Step block at x=6 y=10, ceiling at x=6 y=12
    const world: GetBlockFn = (x: number, y: number, _z: number) => {
      if (y < 10) return BlockType.STONE;
      if (Math.floor(x) === 6 && y === 10) return BlockType.STONE;
      // Low ceiling above the step - blocks head at stepped-up position
      if (Math.floor(x) === 6 && y === 12) return BlockType.STONE;
      return BlockType.AIR;
    };

    const npc = createNPC({
      position: [5.59, 10, 5.5],
      velocity: [3, 0, 0],
      grounded: true,
      target: [10, 10, 5.5],
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // Should be blocked (head clearance fail), X stays at original
    expect(result.velocity![0]).toBe(0);
    expect(result.position![0]).toBe(5.59);
  });

  it('should apply gravity when in the air', () => {
    const world = createFlatWorld(10);
    const npc = createNPC({
      position: [5.5, 12, 5.5],
      velocity: [0, 0, 0],
      grounded: false,
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    expect(result.velocity![1]).toBeLessThan(0);
    expect(result.position![1]).toBeLessThan(12);
  });

  it('should land on ground and become grounded', () => {
    const world = createFlatWorld(10);
    const npc = createNPC({
      position: [5.5, 10.01, 5.5],
      velocity: [0, -5, 0],
      grounded: false,
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    expect(result.position![1]).toBe(10);
    expect(result.grounded).toBe(true);
  });

  it('should step up instead of jumping when target is at same height', () => {
    const world = createWorldWithStep(10, 6);
    const npc = createNPC({
      position: [5.59, 10, 5.5],
      velocity: [3, 0, 0],
      grounded: true,
      target: [10, 10, 5.5],
      lastJumpTime: -10,
    });

    const result = applyPhysics(npc, 0.016, world, 1.0);

    // Should step up, NOT jump (vy should be 0)
    expect(result.velocity![1]).toBe(0);
    expect(result.position![1]).toBe(11);
  });
});
