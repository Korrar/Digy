import { BlockType, getBlock, isSolid, isRepeater, getRepeaterOn, getRepeaterOff, getComparatorOn, getComparatorOff, getDirectionOffsets } from '../core/voxel/BlockRegistry';
import { useWorldStore } from '../stores/worldStore';
import { soundManager } from './SoundManager';

const MAX_CABLE_DISTANCE = 16;

// Stores repeater delay levels: key="x,y,z", value=1-4 (ticks, each tick=100ms)
export const repeaterDelays = new Map<string, number>();

// Stores comparator modes: key="x,y,z", value='compare'|'subtract'
export const comparatorModes = new Map<string, 'compare' | 'subtract'>();

// Active repeater timeouts (for cleanup)
const activeRepeaterTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const TNT_RADIUS = 3;
const TNT_FUSE_TIME = 1500; // ms - fuse duration before explosion
const TNT_CHAIN_FUSE_TIME = 400; // ms - shorter fuse for chain reactions
const fusingTNT = new Set<string>(); // track TNT blocks currently fusing

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
    // Direct activation of adjacent repeaters/comparators from lever/plate
    if (def.isRepeater) {
      activateRepeater(nx, ny, nz, leverX, leverY, leverZ, powerOn);
    }
    if (def.isComparator) {
      activateComparator(nx, ny, nz, leverX, leverY, leverZ, powerOn);
    }
  }

  // BFS through cables - cache neighbor lookups to avoid redundant getBlock calls
  const blockCache = new Map<string, BlockType>();
  const getCachedBlock = (x: number, y: number, z: number): BlockType => {
    const k = `${x},${y},${z}`;
    let b = blockCache.get(k);
    if (b === undefined) {
      b = store.getBlock(x, y, z);
      blockCache.set(k, b);
    }
    return b;
  };

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y},${current.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (current.dist > MAX_CABLE_DISTANCE) continue;

    const block = getCachedBlock(current.x, current.y, current.z);
    const def = getBlock(block);
    if (!def.isCable) continue;

    // Set cable state
    const targetType = powerOn ? BlockType.CABLE_POWERED : BlockType.CABLE;
    if (block !== targetType) {
      store.setBlock(current.x, current.y, current.z, targetType);
      blockCache.set(key, targetType);
    }

    // Continue BFS to neighbors + activate adjacent devices in single pass
    for (const [dx, dy, dz] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nz = current.z + dz;
      const nKey = `${nx},${ny},${nz}`;
      if (visited.has(nKey)) {
        continue;
      }

      const nBlock = getCachedBlock(nx, ny, nz);
      const nDef = getBlock(nBlock);

      if (nDef.isCable) {
        queue.push({ x: nx, y: ny, z: nz, dist: current.dist + 1 });
      }
      if (nDef.isPiston) {
        activatePiston(store, nx, ny, nz, powerOn);
      }
      if (powerOn && nDef.isTNT) {
        detonateTNT(store, nx, ny, nz);
      }
      if (nDef.isRepeater) {
        activateRepeater(nx, ny, nz, current.x, current.y, current.z, powerOn);
      }
      if (nDef.isComparator) {
        activateComparator(nx, ny, nz, current.x, current.y, current.z, powerOn);
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
    const aboveDef = getBlock(aboveBlock);

    if (aboveBlock === BlockType.AIR) {
      // Nothing to push, just extend
      store.setBlock(px, py, pz, extendedType);
      store.setBlock(px, py + 1, pz, headType);
    } else if (above2Block === BlockType.AIR && isSolid(aboveBlock) && aboveDef.hardness !== Infinity && !aboveDef.isPiston && !aboveDef.isPistonHead) {
      // Push the block up (only if pushable: not bedrock, not another piston)
      store.setBlock(px, py + 2, pz, aboveBlock);
      store.setBlock(px, py + 1, pz, headType);
      store.setBlock(px, py, pz, extendedType);
    }
    // Can't extend if blocked or block is unpushable
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
 * Detonate TNT at position, with fuse sparks first then explosion.
 */
export function detonateTNT(_store: ReturnType<typeof useWorldStore.getState>, tx: number, ty: number, tz: number, fuseTime: number = TNT_FUSE_TIME) {
  const key = `${tx},${ty},${tz}`;
  if (fusingTNT.has(key)) return; // already fusing
  fusingTNT.add(key);

  // Fuse phase: sparks + sizzle sound
  const fuseDurationSec = fuseTime / 1000;
  soundManager.playFuseSound(fuseDurationSec);
  window.dispatchEvent(new CustomEvent('digy:tnt-fuse', {
    detail: { x: tx + 0.5, y: ty + 1.0, z: tz + 0.5, duration: fuseTime }
  }));

  // After fuse, explode
  setTimeout(() => {
    fusingTNT.delete(key);
    const s = useWorldStore.getState();
    // Check TNT still there (player might have broken it)
    const currentBlock = s.getBlock(tx, ty, tz);
    const currentDef = getBlock(currentBlock);
    if (!currentDef.isTNT) return;

    // Remove the TNT block
    s.setBlock(tx, ty, tz, BlockType.AIR);

    // Explosion sound
    soundManager.playExplosionSound();

    // Destroy blocks in sphere
    for (let dx = -TNT_RADIUS; dx <= TNT_RADIUS; dx++) {
      for (let dy = -TNT_RADIUS; dy <= TNT_RADIUS; dy++) {
        for (let dz = -TNT_RADIUS; dz <= TNT_RADIUS; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > TNT_RADIUS) continue;
          const bx = tx + dx;
          const by = ty + dy;
          const bz = tz + dz;
          const block = s.getBlock(bx, by, bz);
          if (block === BlockType.AIR) continue;
          const def = getBlock(block);
          // Don't destroy indestructible blocks
          if (def.hardness === Infinity) continue;
          // Chain TNT with shorter fuse
          if (def.isTNT) {
            const chainStore = useWorldStore.getState();
            detonateTNT(chainStore, bx, by, bz, TNT_CHAIN_FUSE_TIME);
            continue;
          }
          s.setBlock(bx, by, bz, BlockType.AIR);
        }
      }
    }

    // Spawn explosion particles
    window.dispatchEvent(new CustomEvent('digy:explosion', {
      detail: { x: tx + 0.5, y: ty + 0.5, z: tz + 0.5, radius: TNT_RADIUS }
    }));
  }, fuseTime);
}

/**
 * Activate a repeater: signal enters from input side, exits from output side with delay.
 * srcX/Y/Z is the position of the block providing the signal (must be at repeater's input side).
 */
function activateRepeater(rx: number, ry: number, rz: number, srcX: number, srcY: number, srcZ: number, powerOn: boolean) {
  const store = useWorldStore.getState();
  const block = store.getBlock(rx, ry, rz);
  const def = getBlock(block);
  if (!def.isRepeater || !def.repeaterDir) return;

  const offsets = getDirectionOffsets(def.repeaterDir);
  // Check if source is at the input side
  const inputX = rx + offsets.input[0];
  const inputZ = rz + offsets.input[2];
  if (srcX !== inputX || srcZ !== inputZ || srcY !== ry) return;

  const key = `${rx},${ry},${rz}`;
  const delay = (repeaterDelays.get(key) ?? 1) * 100; // default 1 tick = 100ms

  // Cancel any pending activation
  const existing = activeRepeaterTimeouts.get(key);
  if (existing) clearTimeout(existing);

  if (powerOn) {
    // Turn ON with delay, then propagate from output side
    const timeout = setTimeout(() => {
      activeRepeaterTimeouts.delete(key);
      const s = useWorldStore.getState();
      const current = s.getBlock(rx, ry, rz);
      if (!isRepeater(current)) return;
      s.setBlock(rx, ry, rz, getRepeaterOn(current));
      // Propagate power from output side
      const outX = rx + offsets.output[0];
      const outZ = rz + offsets.output[2];
      propagateFromOutput(rx, ry, rz, outX, ry, outZ, true);
    }, delay);
    activeRepeaterTimeouts.set(key, timeout);
  } else {
    // Turn OFF with delay
    const timeout = setTimeout(() => {
      activeRepeaterTimeouts.delete(key);
      const s = useWorldStore.getState();
      const current = s.getBlock(rx, ry, rz);
      if (!isRepeater(current)) return;
      s.setBlock(rx, ry, rz, getRepeaterOff(current));
      const outX = rx + offsets.output[0];
      const outZ = rz + offsets.output[2];
      propagateFromOutput(rx, ry, rz, outX, ry, outZ, false);
    }, delay);
    activeRepeaterTimeouts.set(key, timeout);
  }
}

/**
 * Activate a comparator: signal enters from input (back) side.
 * Compare mode: outputs only if no signal from sides.
 * Subtract mode: always passes signal through.
 */
function activateComparator(cx: number, cy: number, cz: number, srcX: number, srcY: number, srcZ: number, powerOn: boolean) {
  const store = useWorldStore.getState();
  const block = store.getBlock(cx, cy, cz);
  const def = getBlock(block);
  if (!def.isComparator || !def.comparatorDir) return;

  const offsets = getDirectionOffsets(def.comparatorDir);
  // Check if source is at the input side
  const inputX = cx + offsets.input[0];
  const inputZ = cz + offsets.input[2];
  if (srcX !== inputX || srcZ !== inputZ || srcY !== cy) return;

  const key = `${cx},${cy},${cz}`;
  const mode = comparatorModes.get(key) ?? 'compare';

  let shouldOutput = false;
  if (powerOn) {
    if (mode === 'subtract') {
      // Subtract mode: always pass through
      shouldOutput = true;
    } else {
      // Compare mode: output only if no powered cable on either side
      const sideABlock = store.getBlock(cx + offsets.sideA[0], cy, cz + offsets.sideA[2]);
      const sideBBlock = store.getBlock(cx + offsets.sideB[0], cy, cz + offsets.sideB[2]);
      const sideAPowered = sideABlock === BlockType.CABLE_POWERED;
      const sideBPowered = sideBBlock === BlockType.CABLE_POWERED;
      shouldOutput = !sideAPowered && !sideBPowered;
    }
  }

  if (shouldOutput) {
    store.setBlock(cx, cy, cz, getComparatorOn(block));
    const outX = cx + offsets.output[0];
    const outZ = cz + offsets.output[2];
    propagateFromOutput(cx, cy, cz, outX, cy, outZ, true);
  } else {
    store.setBlock(cx, cy, cz, getComparatorOff(block));
    const outX = cx + offsets.output[0];
    const outZ = cz + offsets.output[2];
    propagateFromOutput(cx, cy, cz, outX, cy, outZ, false);
  }
}

/**
 * Propagate power from a repeater/comparator output position.
 * srcX/srcY/srcZ is the device that is outputting (used so chained repeaters/comparators
 * can verify the signal comes from their input side).
 */
function propagateFromOutput(srcX: number, srcY: number, srcZ: number, outX: number, outY: number, outZ: number, powerOn: boolean) {
  const store = useWorldStore.getState();
  const outBlock = store.getBlock(outX, outY, outZ);
  const outDef = getBlock(outBlock);

  // If output is a cable, start a new propagation from there
  if (outDef.isCable) {
    const targetType = powerOn ? BlockType.CABLE_POWERED : BlockType.CABLE;
    if (outBlock !== targetType) {
      store.setBlock(outX, outY, outZ, targetType);
    }
    // Continue BFS from this cable
    propagateCablePower(outX, outY, outZ, powerOn);
  }

  // Direct activation of adjacent devices from output
  if (outDef.isPiston) {
    activatePiston(store, outX, outY, outZ, powerOn);
  }
  if (powerOn && outDef.isTNT) {
    detonateTNT(store, outX, outY, outZ);
  }
  // Chain: output into another repeater or comparator
  if (outDef.isRepeater) {
    activateRepeater(outX, outY, outZ, srcX, srcY, srcZ, powerOn);
  }
  if (outDef.isComparator) {
    activateComparator(outX, outY, outZ, srcX, srcY, srcZ, powerOn);
  }
}

/**
 * Cycle repeater delay at position (1→2→3→4→1).
 */
export function cycleRepeaterDelay(rx: number, ry: number, rz: number): number {
  const key = `${rx},${ry},${rz}`;
  const current = repeaterDelays.get(key) ?? 1;
  const next = current >= 4 ? 1 : current + 1;
  repeaterDelays.set(key, next);
  return next;
}

/**
 * Toggle comparator mode at position (compare ↔ subtract).
 */
export function toggleComparatorMode(cx: number, cy: number, cz: number): 'compare' | 'subtract' {
  const key = `${cx},${cy},${cz}`;
  const current = comparatorModes.get(key) ?? 'compare';
  const next = current === 'compare' ? 'subtract' : 'compare';
  comparatorModes.set(key, next);
  return next;
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
