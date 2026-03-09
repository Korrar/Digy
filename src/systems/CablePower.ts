import { BlockType, getBlock, isSolid } from '../core/voxel/BlockRegistry';
import { useWorldStore } from '../stores/worldStore';
import { soundManager } from './SoundManager';

const MAX_CABLE_DISTANCE = 16;
const TNT_RADIUS = 3;

/**
 * Propagate power from a lever through connected cables.
 * When a lever is toggled ON, all connected cables become CABLE_POWERED.
 * When toggled OFF, all connected cables revert to CABLE.
 * Powered rails adjacent to powered cables become active.
 */
export function propagateCablePower(leverX: number, leverY: number, leverZ: number, powerOn: boolean) {
  const store = useWorldStore.getState();

  // BFS from lever position through cables
  const visited = new Set<string>();
  const queue: { x: number; y: number; z: number; dist: number }[] = [];

  // Check all 4 horizontal neighbors of the lever for cables
  const dirs: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];

  const startKey = `${leverX},${leverY},${leverZ}`;
  visited.add(startKey);

  for (const [dx, dy, dz] of dirs) {
    const nx = leverX + dx;
    const ny = leverY + dy;
    const nz = leverZ + dz;
    const block = store.getBlock(nx, ny, nz);
    const def = getBlock(block);
    if (def.isCable) {
      queue.push({ x: nx, y: ny, z: nz, dist: 1 });
    }
    // Direct activation of adjacent pistons and TNT from lever/plate
    if (def.isPiston) {
      activatePiston(store, nx, ny, nz, powerOn);
    }
    if (powerOn && def.isTNT) {
      detonateTNT(store, nx, ny, nz);
    }
  }

  // BFS through cables
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y},${current.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (current.dist > MAX_CABLE_DISTANCE) continue;

    const block = store.getBlock(current.x, current.y, current.z);
    const def = getBlock(block);
    if (!def.isCable) continue;

    // Set cable state
    const targetType = powerOn ? BlockType.CABLE_POWERED : BlockType.CABLE;
    if (block !== targetType) {
      store.setBlock(current.x, current.y, current.z, targetType);
    }

    // Continue BFS to neighbors
    for (const [dx, dy, dz] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nz = current.z + dz;
      const nKey = `${nx},${ny},${nz}`;
      if (visited.has(nKey)) continue;

      const nBlock = store.getBlock(nx, ny, nz);
      const nDef = getBlock(nBlock);
      if (nDef.isCable) {
        queue.push({ x: nx, y: ny, z: nz, dist: current.dist + 1 });
      }
    }

    // Activate/deactivate adjacent pistons and TNT
    for (const [dx, dy, dz] of dirs) {
      const px = current.x + dx;
      const py = current.y + dy;
      const pz = current.z + dz;
      const pBlock = store.getBlock(px, py, pz);
      const pDef = getBlock(pBlock);
      if (pDef.isPiston) {
        activatePiston(store, px, py, pz, powerOn);
      }
      if (powerOn && pDef.isTNT) {
        detonateTNT(store, px, py, pz);
      }
    }
  }
}

/**
 * Activate or deactivate a piston at the given position.
 * When activated, the piston extends upward, pushing the block above.
 * When deactivated, the piston retracts.
 */
function activatePiston(store: ReturnType<typeof useWorldStore.getState>, px: number, py: number, pz: number, extend: boolean) {
  const currentBlock = store.getBlock(px, py, pz);
  const def = getBlock(currentBlock);
  if (!def.isPiston) return;

  const isSticky = def.isStickyPiston === true;
  const extendedType = isSticky ? BlockType.STICKY_PISTON_EXTENDED : BlockType.PISTON_EXTENDED;
  const headType = isSticky ? BlockType.STICKY_PISTON_HEAD : BlockType.PISTON_HEAD;
  const retractedType = isSticky ? BlockType.STICKY_PISTON : BlockType.PISTON;

  if (extend && !def.pistonExtended) {
    // Extend: push block above upward if possible
    const aboveBlock = store.getBlock(px, py + 1, pz);
    const above2Block = store.getBlock(px, py + 2, pz);

    if (aboveBlock === BlockType.AIR) {
      // Nothing to push, just extend
      store.setBlock(px, py, pz, extendedType);
      store.setBlock(px, py + 1, pz, headType);
    } else if (above2Block === BlockType.AIR && isSolid(aboveBlock)) {
      // Push the block up
      store.setBlock(px, py + 2, pz, aboveBlock);
      store.setBlock(px, py + 1, pz, headType);
      store.setBlock(px, py, pz, extendedType);
    }
    // Can't extend if blocked
  } else if (!extend && def.pistonExtended) {
    // Retract: remove piston head
    const headBlock = store.getBlock(px, py + 1, pz);
    const isHead = headBlock === BlockType.PISTON_HEAD || headBlock === BlockType.STICKY_PISTON_HEAD;
    if (isHead) {
      // Sticky piston: pull block above head down
      if (isSticky) {
        const above2 = store.getBlock(px, py + 2, pz);
        if (isSolid(above2)) {
          store.setBlock(px, py + 1, pz, above2);
          store.setBlock(px, py + 2, pz, BlockType.AIR);
        } else {
          store.setBlock(px, py + 1, pz, BlockType.AIR);
        }
      } else {
        store.setBlock(px, py + 1, pz, BlockType.AIR);
      }
    }
    store.setBlock(px, py, pz, retractedType);
  }
}

/**
 * Check if a powered rail at the given position is powered by a cable.
 * Checks 4 horizontal neighbors + below for CABLE_POWERED.
 */
export function isPoweredRailActive(wx: number, wy: number, wz: number): boolean {
  const store = useWorldStore.getState();
  const dirs: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];

  for (const [dx, dy, dz] of dirs) {
    const block = store.getBlock(wx + dx, wy + dy, wz + dz);
    if (block === BlockType.CABLE_POWERED) return true;
    // Also check if lever directly adjacent and ON
    if (block === BlockType.LEVER_ON) return true;
  }
  return false;
}

/**
 * Detonate TNT at position, destroying blocks in a sphere.
 */
export function detonateTNT(store: ReturnType<typeof useWorldStore.getState>, tx: number, ty: number, tz: number) {
  // Remove the TNT block first
  store.setBlock(tx, ty, tz, BlockType.AIR);
  soundManager.playBreakSound('stone');

  // Destroy blocks in sphere
  for (let dx = -TNT_RADIUS; dx <= TNT_RADIUS; dx++) {
    for (let dy = -TNT_RADIUS; dy <= TNT_RADIUS; dy++) {
      for (let dz = -TNT_RADIUS; dz <= TNT_RADIUS; dz++) {
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > TNT_RADIUS) continue;
        const bx = tx + dx;
        const by = ty + dy;
        const bz = tz + dz;
        const block = store.getBlock(bx, by, bz);
        if (block === BlockType.AIR) continue;
        const def = getBlock(block);
        // Don't destroy indestructible blocks
        if (def.hardness === Infinity) continue;
        // Chain TNT
        if (def.isTNT) {
          setTimeout(() => {
            const s = useWorldStore.getState();
            if (s.getBlock(bx, by, bz) === block) {
              detonateTNT(s, bx, by, bz);
            }
          }, 200);
          continue;
        }
        store.setBlock(bx, by, bz, BlockType.AIR);
      }
    }
  }

  // Spawn explosion particles
  window.dispatchEvent(new CustomEvent('digy:explosion', {
    detail: { x: tx + 0.5, y: ty + 0.5, z: tz + 0.5, radius: TNT_RADIUS }
  }));
}

/**
 * Activate a pressure plate: propagate power through adjacent cables.
 */
export function activatePressurePlate(px: number, py: number, pz: number, on: boolean) {
  const store = useWorldStore.getState();
  store.setBlock(px, py, pz, on ? BlockType.PRESSURE_PLATE_ON : BlockType.PRESSURE_PLATE);
  soundManager.playPlaceSound();
  propagateCablePower(px, py, pz, on);
}

/**
 * Activate a detector rail: propagate power through adjacent cables.
 */
export function activateDetectorRail(dx: number, dy: number, dz: number, on: boolean) {
  const store = useWorldStore.getState();
  store.setBlock(dx, dy, dz, on ? BlockType.DETECTOR_RAIL_ON : BlockType.DETECTOR_RAIL);
  propagateCablePower(dx, dy, dz, on);
}
