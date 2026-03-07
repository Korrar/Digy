import { BlockType } from '../core/voxel/BlockRegistry';
import { useWorldStore } from '../stores/worldStore';
import { CHUNK_HEIGHT } from '../utils/constants';

const GRAVITY_BLOCKS = new Set([BlockType.SAND, BlockType.GRAVEL]);

export function isGravityBlock(type: BlockType): boolean {
  return GRAVITY_BLOCKS.has(type);
}

/**
 * Process gravity for blocks around a position.
 * Called after a block is broken or placed.
 * Simulates blocks falling one step at a time with delays for visual effect.
 */
export function processGravity(wx: number, wy: number, wz: number) {
  const store = useWorldStore.getState();

  // Check blocks above the changed position
  const pendingFalls: { x: number; y: number; z: number; type: BlockType }[] = [];

  for (let y = wy + 1; y < CHUNK_HEIGHT; y++) {
    const block = store.getBlock(wx, y, wz);
    if (block === BlockType.AIR) break;
    if (isGravityBlock(block)) {
      pendingFalls.push({ x: wx, y, z: wz, type: block });
    } else {
      break; // Non-gravity block stops the chain
    }
  }

  // Also check at the exact position (for world gen settling)
  const atPos = store.getBlock(wx, wy, wz);
  if (isGravityBlock(atPos)) {
    const below = store.getBlock(wx, wy - 1, wz);
    if (below === BlockType.AIR) {
      pendingFalls.unshift({ x: wx, y: wy, z: wz, type: atPos });
    }
  }

  if (pendingFalls.length === 0) return;

  // Process falls with small delays for visual effect
  let delay = 0;
  for (const fall of pendingFalls) {
    delay += 50;
    setTimeout(() => dropBlock(fall.x, fall.y, fall.z), delay);
  }
}

function dropBlock(wx: number, wy: number, wz: number) {
  const store = useWorldStore.getState();
  const block = store.getBlock(wx, wy, wz);
  if (!isGravityBlock(block)) return;

  // Find landing position
  let landY = wy - 1;
  while (landY >= 0 && store.getBlock(wx, landY, wz) === BlockType.AIR) {
    landY--;
  }
  landY++; // One above the solid block

  if (landY >= wy) return; // No fall needed

  store.setBlock(wx, wy, wz, BlockType.AIR);
  store.setBlock(wx, landY, wz, block);
}

/**
 * Scan and settle all gravity blocks in the loaded world.
 * Called once after world generation.
 */
export function settleWorld() {
  const store = useWorldStore.getState();
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const [, entry] of store.chunks) {
      const ox = entry.data.cx * 16;
      const oz = entry.data.cz * 16;

      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          for (let y = 1; y < CHUNK_HEIGHT; y++) {
            const block = entry.data.getBlock(x, y, z);
            if (!isGravityBlock(block)) continue;

            const below = store.getBlock(ox + x, y - 1, oz + z);
            if (below === BlockType.AIR) {
              store.setBlock(ox + x, y, oz + z, BlockType.AIR);
              store.setBlock(ox + x, y - 1, oz + z, block);
              changed = true;
            }
          }
        }
      }
    }
  }
}
