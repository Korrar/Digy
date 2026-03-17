import { BlockType, isSolid } from '../voxel/BlockRegistry';
import { CHUNK_HEIGHT } from '../../utils/constants';

export const GRAVITY = 20;
export const NPC_HEIGHT = 1.8;
export const NPC_WIDTH = 0.4;
export const GROUND_FRICTION = 0.85;
export const AIR_FRICTION = 0.98;
export const JUMP_VELOCITY = 6;
export const MAX_FALL_SPEED = 30;
export const JUMP_COOLDOWN = 0.6;
export const STEP_UP_HEIGHT = 0.6; // max height NPC can step up smoothly (< 1 block)
export const STEP_UP_SPEED = 8; // vertical speed during step-up (blocks/s)

export type GetBlockFn = (x: number, y: number, z: number) => BlockType;

/** Get terrain height at a position (top of highest solid block) */
export function getTerrainHeight(getBlock: GetBlockFn, x: number, z: number): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const block = getBlock(bx, y, bz);
    if (isSolid(block)) {
      return y + 1;
    }
  }
  return 0;
}

/** Check if a block position is solid (for collision) */
export function isSolidAt(getBlock: GetBlockFn, x: number, y: number, z: number): boolean {
  return isSolid(getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
}

export interface PhysicsNPC {
  position: [number, number, number];
  velocity: [number, number, number];
  grounded: boolean;
  lastJumpTime: number;
  target: [number, number, number];
  waypoints: [number, number, number][];
  speed: number;
}

export interface PhysicsUpdates {
  position?: [number, number, number];
  velocity?: [number, number, number];
  grounded?: boolean;
  lastJumpTime?: number;
}

/** Apply physics: gravity, ground collision, wall sliding, step-up */
export function applyPhysics(
  npc: PhysicsNPC,
  dt: number,
  getBlock: GetBlockFn,
  elapsedTime: number,
): PhysicsUpdates {
  const updates: PhysicsUpdates = {};
  let [vx, vy, vz] = npc.velocity;
  const [px, py, pz] = npc.position;

  // Apply gravity
  vy -= GRAVITY * dt;
  vy = Math.max(vy, -MAX_FALL_SPEED);

  // Apply friction
  const friction = npc.grounded ? GROUND_FRICTION : AIR_FRICTION;
  vx *= friction;
  vz *= friction;

  // Integrate position with collision
  let newX = px + vx * dt;
  let newY = py + vy * dt;
  let newZ = pz + vz * dt;

  // Ground collision: check block below feet
  const groundY = getTerrainHeight(getBlock, newX, newZ);
  let grounded = false;

  if (newY <= groundY) {
    newY = groundY;
    if (vy < 0) {
      if (vy < -8) {
        vy = -vy * 0.3;
      } else {
        vy = 0;
      }
    }
    grounded = true;
  }

  // Ceiling collision
  if (vy > 0 && isSolidAt(getBlock, newX, newY + NPC_HEIGHT, newZ)) {
    vy = 0;
  }

  // Wall collision X with step-up: try stepping up before blocking
  if (vx !== 0) {
    const checkX = newX + (vx > 0 ? NPC_WIDTH : -NPC_WIDTH);
    const blockedAtFeet = isSolidAt(getBlock, checkX, newY + 0.2, newZ);
    const blockedAtBody = isSolidAt(getBlock, checkX, newY + 1.0, newZ);

    if (blockedAtFeet || blockedAtBody) {
      // Try step-up: block only at feet level, space above at stepped-up height
      if (grounded && blockedAtFeet && !blockedAtBody) {
        const stepBlockY = Math.floor(newY + 0.2) + 1; // top of the blocking block
        const stepHeight = stepBlockY - newY;
        const headClear = !isSolidAt(getBlock, checkX, stepBlockY + 1.0, newZ);

        if (stepHeight <= 1.0 && headClear) {
          // Smooth step-up: raise NPC to top of block and advance onto it
          newY = stepBlockY;
          grounded = true;
          vy = 0;
          // Advance NPC onto the step block so they don't fall back
          const blockEdge = Math.floor(checkX) + (vx > 0 ? 0.01 : 0.99);
          newX = blockEdge;
        } else {
          // Can't step up — wall block
          newX = px;
          vx = 0;
        }
      } else {
        // Blocked at body level or airborne — wall block
        newX = px;
        vx = 0;
      }
    }
  }

  // Wall collision Z with step-up: try stepping up before blocking
  if (vz !== 0) {
    const checkZ = newZ + (vz > 0 ? NPC_WIDTH : -NPC_WIDTH);
    const blockedAtFeet = isSolidAt(getBlock, newX, newY + 0.2, checkZ);
    const blockedAtBody = isSolidAt(getBlock, newX, newY + 1.0, checkZ);

    if (blockedAtFeet || blockedAtBody) {
      // Try step-up: block only at feet level, space above
      if (grounded && blockedAtFeet && !blockedAtBody) {
        const stepBlockY = Math.floor(newY + 0.2) + 1;
        const stepHeight = stepBlockY - newY;
        const headClear = !isSolidAt(getBlock, newX, stepBlockY + 1.0, checkZ);

        if (stepHeight <= 1.0 && headClear) {
          newY = stepBlockY;
          grounded = true;
          vy = 0;
          // Advance NPC onto the step block
          const blockEdge = Math.floor(checkZ) + (vz > 0 ? 0.01 : 0.99);
          newZ = blockEdge;
        } else {
          newZ = pz;
          vz = 0;
        }
      } else {
        newZ = pz;
        vz = 0;
      }
    }
  }

  // Jump: only for 2+ block gaps or when step-up is not possible
  // Only jump when grounded and there's no step-up solution
  if (grounded && (elapsedTime - npc.lastJumpTime) >= JUMP_COOLDOWN) {
    const activeTarget = npc.waypoints.length > 0 ? npc.waypoints[0] : npc.target;
    const moveX = activeTarget[0] - px;
    const moveZ = activeTarget[2] - pz;
    const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);

    // Only consider jumping if target is above us (step-up wasn't enough or gap ahead)
    if (moveDist > 0.3 && activeTarget[1] > newY + 0.5) {
      const ndirX = moveX / moveDist;
      const ndirZ = moveZ / moveDist;
      const aheadX = newX + ndirX * 0.6;
      const aheadZ = newZ + ndirZ * 0.6;

      // Check for a 2-block wall (can't step up, need to jump)
      const blockAtFeet = isSolidAt(getBlock, aheadX, newY + 0.2, aheadZ);
      const blockAtBody = isSolidAt(getBlock, aheadX, newY + 1.2, aheadZ);
      const spaceAboveJump = !isSolidAt(getBlock, aheadX, newY + 2.2, aheadZ);

      // Jump only when there's a gap to cross or target is significantly above
      if (blockAtFeet && !blockAtBody && spaceAboveJump) {
        vy = JUMP_VELOCITY;
        vx = ndirX * npc.speed * 0.7;
        vz = ndirZ * npc.speed * 0.7;
        grounded = false;
        updates.lastJumpTime = elapsedTime;
      }
    }
  }

  // Clamp tiny velocities
  if (Math.abs(vx) < 0.01) vx = 0;
  if (Math.abs(vz) < 0.01) vz = 0;

  // Prevent falling into void
  if (newY < -5) {
    newY = 20;
    vy = 0;
  }

  updates.position = [newX, newY, newZ];
  updates.velocity = [vx, vy, vz];
  updates.grounded = grounded;

  return updates;
}
