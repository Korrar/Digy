import { BlockType, getBlock } from '../core/voxel/BlockRegistry';
import { useWorldStore } from '../stores/worldStore';

const MAX_CABLE_DISTANCE = 16;

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
