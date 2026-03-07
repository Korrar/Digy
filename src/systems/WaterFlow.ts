import { BlockType } from '../core/voxel/BlockRegistry';
import { useWorldStore } from '../stores/worldStore';

const MAX_FLOW_DISTANCE = 5;
const FLOW_DELAY = 100; // ms between flow steps

/**
 * Process water flow from a source position.
 * Water flows down first, then spreads horizontally up to MAX_FLOW_DISTANCE blocks.
 */
export function processWaterFlow(wx: number, wy: number, wz: number) {
  const store = useWorldStore.getState();

  // Only process if this is water or air next to water
  const block = store.getBlock(wx, wy, wz);
  if (block !== BlockType.WATER && block !== BlockType.AIR) return;

  // BFS to spread water
  const visited = new Set<string>();
  const queue: { x: number; y: number; z: number; dist: number }[] = [];

  // Find water sources above/around
  const dirs = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0]];
  let hasWaterSource = false;

  for (const [dx, dy, dz] of dirs) {
    if (store.getBlock(wx + dx, wy + dy, wz + dz) === BlockType.WATER) {
      hasWaterSource = true;
      break;
    }
  }

  if (!hasWaterSource && block !== BlockType.WATER) return;

  // Start spreading from the changed position
  queue.push({ x: wx, y: wy, z: wz, dist: 0 });
  visited.add(`${wx},${wy},${wz}`);

  let step = 0;
  while (queue.length > 0 && step < 50) {
    const current = queue.shift()!;
    step++;

    // Flow down first (gravity)
    const belowBlock = store.getBlock(current.x, current.y - 1, current.z);
    if (current.y > 0 && belowBlock === BlockType.AIR) {
      const key = `${current.x},${current.y - 1},${current.z}`;
      if (!visited.has(key)) {
        visited.add(key);
        setTimeout(() => {
          const s = useWorldStore.getState();
          if (s.getBlock(current.x, current.y - 1, current.z) === BlockType.AIR) {
            s.setBlock(current.x, current.y - 1, current.z, BlockType.WATER);
          }
        }, step * FLOW_DELAY);
        queue.push({ x: current.x, y: current.y - 1, z: current.z, dist: 0 });
      }
      continue; // Water flows down before spreading
    }

    // Spread horizontally (limited distance)
    if (current.dist >= MAX_FLOW_DISTANCE) continue;

    const horizDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of horizDirs) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const key = `${nx},${current.y},${nz}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const neighborBlock = store.getBlock(nx, current.y, nz);
      if (neighborBlock === BlockType.AIR) {
        const delay = step * FLOW_DELAY;
        setTimeout(() => {
          const s = useWorldStore.getState();
          if (s.getBlock(nx, current.y, nz) === BlockType.AIR) {
            s.setBlock(nx, current.y, nz, BlockType.WATER);
          }
        }, delay);
        queue.push({ x: nx, y: current.y, z: nz, dist: current.dist + 1 });
      }
    }
  }
}

/**
 * Check if removing a block should cause water to drain.
 * Call after breaking a block that was holding water back.
 */
export function checkWaterDrain(wx: number, wy: number, wz: number) {
  const store = useWorldStore.getState();

  // Check adjacent blocks for water that might flow into this space
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
  for (const [dx, dy, dz] of dirs) {
    const nx = wx + dx;
    const ny = wy + dy;
    const nz = wz + dz;
    if (store.getBlock(nx, ny, nz) === BlockType.WATER) {
      processWaterFlow(wx, wy, wz);
      return;
    }
  }
}
