import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNPCStore, ROLE_COLORS, generateBridgeBlueprint, type NPC, type NPCRole } from '../../stores/npcStore';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, isSolid } from '../../core/voxel/BlockRegistry';
import { CHUNK_HEIGHT } from '../../utils/constants';

const SAPLING_GROW_TIME = 30; // seconds until sapling becomes a tree

const GRAVITY = 20;
const NPC_HEIGHT = 1.8; // total NPC height in blocks
const NPC_WIDTH = 0.4;  // half-width for collision
const GROUND_FRICTION = 0.85;
const AIR_FRICTION = 0.98;
const JUMP_VELOCITY = 6;
const MAX_FALL_SPEED = 30;
const STUCK_THRESHOLD = 1.5; // seconds before NPC is considered stuck
const STUCK_DISTANCE = 0.3; // minimum distance to count as "made progress"
const MAX_STUCK_COUNT = 3;   // abandon target after this many stuck events
const WAYPOINT_REACH_DIST = 0.8; // distance to consider waypoint reached
const JUMP_COOLDOWN = 0.6; // seconds between jumps
const PATH_RECALC_INTERVAL = 3.0; // seconds between A* path recalculations
const ASTAR_MAX_NODES = 200; // max nodes to explore in A*
const ASTAR_MAX_RANGE = 16; // max Manhattan distance for A*
const BREAK_REACH = 2.5; // max distance NPC can break a block
const BREAK_COOLDOWN = 1.0; // seconds between breaking blocks

/** Blocks NPCs are allowed to break to clear a path */
const BREAKABLE_BLOCKS = new Set([
  BlockType.DIRT, BlockType.GRASS, BlockType.SAND, BlockType.GRAVEL,
  BlockType.WOOD, BlockType.LEAVES, BlockType.SNOW,
  BlockType.COBBLESTONE, BlockType.STONE,
]);

/** Build a humanoid geometry for NPC (body + head + 2 arms + 2 legs) */
function buildNPCGeometry(role: NPCRole): THREE.BufferGeometry {
  const colors = ROLE_COLORS[role];
  const parts: THREE.BoxGeometry[] = [];
  const matrices: THREE.Matrix4[] = [];
  const partColors: THREE.Color[] = [];

  const skinCol = new THREE.Color(colors.body);
  const shirtCol = new THREE.Color(colors.shirt);
  const pantsCol = new THREE.Color(colors.pants);

  // Body (shirt)
  const body = new THREE.BoxGeometry(0.5, 0.6, 0.3);
  matrices.push(new THREE.Matrix4().makeTranslation(0, 0.9, 0));
  parts.push(body);
  partColors.push(shirtCol);

  // Head (skin)
  const head = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  matrices.push(new THREE.Matrix4().makeTranslation(0, 1.4, 0));
  parts.push(head);
  partColors.push(skinCol);

  // Left arm
  const armL = new THREE.BoxGeometry(0.15, 0.5, 0.15);
  matrices.push(new THREE.Matrix4().makeTranslation(-0.35, 0.85, 0));
  parts.push(armL);
  partColors.push(shirtCol);

  // Right arm
  const armR = new THREE.BoxGeometry(0.15, 0.5, 0.15);
  matrices.push(new THREE.Matrix4().makeTranslation(0.35, 0.85, 0));
  parts.push(armR);
  partColors.push(shirtCol);

  // Left leg
  const legL = new THREE.BoxGeometry(0.18, 0.5, 0.18);
  matrices.push(new THREE.Matrix4().makeTranslation(-0.13, 0.3, 0));
  parts.push(legL);
  partColors.push(pantsCol);

  // Right leg
  const legR = new THREE.BoxGeometry(0.18, 0.5, 0.18);
  matrices.push(new THREE.Matrix4().makeTranslation(0.13, 0.3, 0));
  parts.push(legR);
  partColors.push(pantsCol);

  // Merge
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allColors: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (let p = 0; p < parts.length; p++) {
    const geo = parts[p].clone();
    geo.applyMatrix4(matrices[p]);
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const idx = geo.index!;
    const col = partColors[p];

    for (let i = 0; i < pos.count; i++) {
      allPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      const v = (Math.random() - 0.5) * 0.06;
      allColors.push(
        Math.max(0, Math.min(1, col.r + v)),
        Math.max(0, Math.min(1, col.g + v)),
        Math.max(0, Math.min(1, col.b + v)),
      );
    }
    for (let i = 0; i < idx.count; i++) {
      allIndices.push(idx.getX(i) + vertexOffset);
    }
    vertexOffset += pos.count;
    geo.dispose();
  }
  for (const g of parts) g.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
  merged.setIndex(allIndices);
  merged.computeBoundingSphere();
  return merged;
}

/** Scan downward to find ground Y at given X,Z */
function getTerrainHeight(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, z: number
): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const block = getBlock(bx, y, bz);
    if (isSolid(block)) {
      return y + 1;
    }
  }
  return 1;
}

/** Check if a block position is solid (for collision) */
function isSolidAt(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number
): boolean {
  return isSolid(getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
}

/** Gather target: find a nearby block of the given type */
function findNearbyBlock(
  getBlock: (x: number, y: number, z: number) => BlockType,
  cx: number, cy: number, cz: number,
  targetType: BlockType[],
  radius: number,
  exclude?: Set<string>,
): [number, number, number] | null {
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dy = -2; dy <= 4; dy++) {
          const bx = Math.floor(cx) + dx;
          const by = Math.floor(cy) + dy;
          const bz = Math.floor(cz) + dz;
          const bt = getBlock(bx, by, bz);
          if (targetType.includes(bt)) {
            if (exclude && exclude.has(`${bx},${by},${bz}`)) continue;
            return [bx, by, bz];
          }
        }
      }
    }
  }
  return null;
}

function getGatherTargets(role: NPCRole): BlockType[] {
  switch (role) {
    case 'lumberjack': return [BlockType.WOOD];
    case 'miner': return [BlockType.STONE, BlockType.COBBLESTONE, BlockType.COAL_ORE];
    case 'farmer': return [BlockType.WHEAT];
    case 'builder': return [BlockType.WOOD, BlockType.PLANKS];
  }
}

function getDropType(role: NPCRole): BlockType {
  switch (role) {
    case 'lumberjack': return BlockType.PLANKS;
    case 'miner': return BlockType.COBBLESTONE;
    case 'farmer': return BlockType.BREAD;
    case 'builder': return BlockType.PLANKS;
  }
}

/** Find a flat grass spot near the NPC for farming */
function findFarmSpot(
  getBlock: (x: number, y: number, z: number) => BlockType,
  cx: number, cy: number, cz: number,
  radius: number,
  exclude?: Set<string>,
): [number, number, number] | null {
  for (let r = 2; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const bx = Math.floor(cx) + dx;
        const bz = Math.floor(cz) + dz;
        for (let dy = -2; dy <= 2; dy++) {
          const by = Math.floor(cy) + dy;
          if (getBlock(bx, by, bz) === BlockType.GRASS &&
              getBlock(bx, by + 1, bz) === BlockType.AIR &&
              getBlock(bx, by + 2, bz) === BlockType.AIR) {
            if (exclude && exclude.has(`${bx},${by},${bz}`)) continue;
            return [bx, by, bz];
          }
        }
      }
    }
  }
  return null;
}

/** Find a spot where lumberjack just chopped wood to plant a sapling */
function findSaplingSpot(
  getBlock: (x: number, y: number, z: number) => BlockType,
  cx: number, cy: number, cz: number,
  radius: number
): [number, number, number] | null {
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const bx = Math.floor(cx) + dx;
        const bz = Math.floor(cz) + dz;
        for (let dy = -2; dy <= 2; dy++) {
          const by = Math.floor(cy) + dy;
          if ((getBlock(bx, by, bz) === BlockType.GRASS || getBlock(bx, by, bz) === BlockType.DIRT) &&
              getBlock(bx, by + 1, bz) === BlockType.AIR &&
              getBlock(bx, by + 2, bz) === BlockType.AIR &&
              getBlock(bx, by + 3, bz) === BlockType.AIR) {
            return [bx, by + 1, bz];
          }
        }
      }
    }
  }
  return null;
}

/** Scan for water gap to build a bridge */
function findBridgeLocation(
  getBlock: (x: number, y: number, z: number) => BlockType,
  cx: number, cy: number, cz: number,
  radius: number
): { startX: number; endX: number; bridgeY: number; bridgeZ: number } | null {
  for (let dz = -radius; dz <= radius; dz++) {
    const bz = Math.floor(cz) + dz;
    let waterStart = -1;
    let waterEnd = -1;
    let waterY = -1;
    for (let dx = -radius; dx <= radius; dx++) {
      const bx = Math.floor(cx) + dx;
      let foundWater = false;
      for (let dy = -2; dy <= 4; dy++) {
        const by = Math.floor(cy) + dy;
        if (getBlock(bx, by, bz) === BlockType.WATER) {
          foundWater = true;
          waterY = by;
          break;
        }
      }
      if (foundWater) {
        if (waterStart === -1) waterStart = bx;
        waterEnd = bx;
      } else if (waterStart !== -1) {
        break; // end of water gap
      }
    }
    const span = waterEnd - waterStart;
    if (waterStart !== -1 && span >= 2 && span <= 12) {
      return { startX: waterStart, endX: waterEnd, bridgeY: waterY + 1, bridgeZ: bz };
    }
  }
  return null;
}

/** Grow a sapling into a tree (simplified version) */
function growSaplingToTree(
  setBlock: (x: number, y: number, z: number, type: BlockType) => void,
  sx: number, sy: number, sz: number
): void {
  // Remove sapling
  setBlock(sx, sy, sz, BlockType.AIR);
  // Trunk (4 blocks)
  for (let ty = 0; ty < 4; ty++) {
    setBlock(sx, sy + ty, sz, BlockType.WOOD);
  }
  // Leaves (simple canopy)
  const leafBase = sy + 3;
  for (let ly = 0; ly < 3; ly++) {
    const r = ly < 2 ? 2 : 1;
    for (let lx = -r; lx <= r; lx++) {
      for (let lz = -r; lz <= r; lz++) {
        if (lx === 0 && lz === 0 && ly < 1) continue;
        if (Math.abs(lx) === r && Math.abs(lz) === r && ly === 0) continue;
        setBlock(sx + lx, leafBase + ly, sz + lz, BlockType.LEAVES);
      }
    }
  }
}

/** Check if a position is walkable (has ground below, air at feet+head level) */
function isWalkable(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number
): boolean {
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bz = Math.floor(z);
  // Need solid below, air at feet and head
  return isSolid(getBlock(bx, by - 1, bz)) &&
    !isSolid(getBlock(bx, by, bz)) &&
    !isSolid(getBlock(bx, by + 1, bz));
}

/** Check if position is dangerous (water or cliff) */
function isDangerous(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, z: number, currentY: number
): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  // Check for water at or below current level
  for (let dy = 0; dy >= -3; dy--) {
    const by = Math.floor(currentY) + dy;
    if (getBlock(bx, by, bz) === BlockType.WATER) return true;
  }
  // Check for cliff (no solid block within 3 below)
  const groundY = getTerrainHeight(getBlock, x, z);
  if (currentY - groundY > 3) return true;
  return false;
}

/** A* pathfinding on block grid. Returns waypoints or empty array if no path. */
function findPathAStar(
  getBlock: (x: number, y: number, z: number) => BlockType,
  startX: number, startY: number, startZ: number,
  goalX: number, goalZ: number,
): [number, number, number][] {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const sz = Math.floor(startZ);
  const gx = Math.floor(goalX);
  const gz = Math.floor(goalZ);

  // Already at goal
  if (sx === gx && sz === gz) return [];

  // Too far for A*
  if (Math.abs(gx - sx) + Math.abs(gz - sz) > ASTAR_MAX_RANGE) return [];

  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

  // Open set as a simple sorted array (small search space)
  interface ANode {
    x: number; y: number; z: number;
    g: number; f: number;
    parent: ANode | null;
    jumped: boolean; // did we need a jump to get here?
  }

  const open: ANode[] = [];
  const closed = new Set<string>();

  const heuristic = (x: number, z: number) =>
    Math.abs(x - gx) + Math.abs(z - gz);

  const startNode: ANode = {
    x: sx, y: sy, z: sz,
    g: 0, f: heuristic(sx, sz),
    parent: null, jumped: false,
  };
  open.push(startNode);

  // 4-directional neighbors
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let explored = 0;
  while (open.length > 0 && explored < ASTAR_MAX_NODES) {
    // Find lowest f-score
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);
    explored++;

    const ck = key(current.x, current.y, current.z);
    if (closed.has(ck)) continue;
    closed.add(ck);

    // Goal reached?
    if (current.x === gx && current.z === gz) {
      // Reconstruct path
      const path: [number, number, number][] = [];
      let node: ANode | null = current;
      while (node && node.parent) {
        path.push([node.x + 0.5, node.y, node.z + 0.5]);
        node = node.parent;
      }
      path.reverse();
      // Simplify path: remove intermediate points on straight lines
      return simplifyPath(path);
    }

    for (const [ddx, ddz] of dirs) {
      const nx = current.x + ddx;
      const nz = current.z + ddz;

      // Same level: walkable at current Y
      const sameY = current.y;
      if (!closed.has(key(nx, sameY, nz)) && isWalkableGrid(getBlock, nx, sameY, nz)) {
        if (!isDangerousGrid(getBlock, nx, nz, sameY)) {
          const ng = current.g + 1;
          const nf = ng + heuristic(nx, nz);
          open.push({ x: nx, y: sameY, z: nz, g: ng, f: nf, parent: current, jumped: false });
        }
      }

      // Step up: solid block at current Y feet level, walkable at Y+1
      const upY = current.y + 1;
      if (!closed.has(key(nx, upY, nz)) && isWalkableGrid(getBlock, nx, upY, nz)) {
        // Check head clearance at current position for jump
        if (!isSolid(getBlock(current.x, current.y + 2, current.z)) &&
            !isDangerousGrid(getBlock, nx, nz, upY)) {
          const ng = current.g + 2; // jumping costs more
          const nf = ng + heuristic(nx, nz);
          open.push({ x: nx, y: upY, z: nz, g: ng, f: nf, parent: current, jumped: true });
        }
      }

      // Step down: no ground at same level, walkable at Y-1
      const downY = current.y - 1;
      if (downY >= 0 && !closed.has(key(nx, downY, nz)) && isWalkableGrid(getBlock, nx, downY, nz)) {
        if (!isDangerousGrid(getBlock, nx, nz, downY)) {
          const ng = current.g + 1.2; // slight cost for dropping
          const nf = ng + heuristic(nx, nz);
          open.push({ x: nx, y: downY, z: nz, g: ng, f: nf, parent: current, jumped: false });
        }
      }
    }
  }

  return []; // no path found
}

/** Grid-based walkability check for A* (integer coords) */
function isWalkableGrid(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number,
): boolean {
  return isSolid(getBlock(x, y - 1, z)) &&
    !isSolid(getBlock(x, y, z)) &&
    !isSolid(getBlock(x, y + 1, z));
}

/** Grid-based danger check for A* (integer coords) */
function isDangerousGrid(
  getBlock: (x: number, y: number, z: number) => BlockType,
  x: number, z: number, y: number,
): boolean {
  // Check for water
  for (let dy = 0; dy >= -3; dy--) {
    if (getBlock(x, y + dy, z) === BlockType.WATER) return true;
  }
  return false;
}

/** Remove intermediate waypoints on straight lines */
function simplifyPath(path: [number, number, number][]): [number, number, number][] {
  if (path.length <= 2) return path;
  const result: [number, number, number][] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    // Keep waypoint if direction changes or height changes
    const dx1 = curr[0] - prev[0];
    const dz1 = curr[2] - prev[2];
    const dx2 = next[0] - curr[0];
    const dz2 = next[2] - curr[2];
    if (dx1 !== dx2 || dz1 !== dz2 || curr[1] !== prev[1] || curr[1] !== next[1]) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

/** Generate avoidance waypoints when NPC is stuck */
function generateAvoidanceWaypoints(
  getBlock: (x: number, y: number, z: number) => BlockType,
  px: number, _py: number, pz: number,
  tx: number, tz: number
): [number, number, number][] {
  const dx = tx - px;
  const dz = tz - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.5) return [];

  const dirX = dx / dist;
  const dirZ = dz / dist;
  // Perpendicular directions (left and right)
  const perpLX = -dirZ;
  const perpLZ = dirX;
  const perpRX = dirZ;
  const perpRZ = -dirX;

  const waypoints: [number, number, number][] = [];
  // Try both sides, pick the one that's walkable and not dangerous
  const offsets = [3, 5, 7];
  for (const off of offsets) {
    // Try left
    const lx = px + perpLX * off;
    const lz = pz + perpLZ * off;
    const lGroundY = getTerrainHeight(getBlock, lx, lz);
    if (isWalkable(getBlock, lx, lGroundY, lz) && !isDangerous(getBlock, lx, lz, lGroundY)) {
      waypoints.push([lx, lGroundY, lz]);
      // Add a point closer to target from the side
      const forwardX = lx + dirX * off;
      const forwardZ = lz + dirZ * off;
      const fGroundY = getTerrainHeight(getBlock, forwardX, forwardZ);
      if (!isDangerous(getBlock, forwardX, forwardZ, fGroundY)) {
        waypoints.push([forwardX, fGroundY, forwardZ]);
      }
      return waypoints;
    }

    // Try right
    const rx = px + perpRX * off;
    const rz = pz + perpRZ * off;
    const rGroundY = getTerrainHeight(getBlock, rx, rz);
    if (isWalkable(getBlock, rx, rGroundY, rz) && !isDangerous(getBlock, rx, rz, rGroundY)) {
      waypoints.push([rx, rGroundY, rz]);
      const forwardX = rx + dirX * off;
      const forwardZ = rz + dirZ * off;
      const fGroundY = getTerrainHeight(getBlock, forwardX, forwardZ);
      if (!isDangerous(getBlock, forwardX, forwardZ, fGroundY)) {
        waypoints.push([forwardX, fGroundY, forwardZ]);
      }
      return waypoints;
    }
  }
  return waypoints;
}

/** Find a position adjacent to a block where NPC can stand to work on it.
 *  Returns null if no walkable position found. */
function findStandPosition(
  getBlock: (x: number, y: number, z: number) => BlockType,
  bx: number, _by: number, bz: number,
  npcX: number, _npcY: number, npcZ: number,
): [number, number, number] | null {
  const candidates: [number, number, number, number][] = []; // [x, y, z, dist]
  // Cardinal + diagonal + 2-block-away positions
  const offsets: [number, number][] = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2],
  ];

  for (const [ox, oz] of offsets) {
    const cx = bx + ox;
    const cz = bz + oz;
    const groundY = getTerrainHeight(getBlock, cx + 0.5, cz + 0.5);
    if (isWalkable(getBlock, cx + 0.5, groundY, cz + 0.5) &&
        !isDangerous(getBlock, cx + 0.5, cz + 0.5, groundY)) {
      const dx = (cx + 0.5) - npcX;
      const dz = (cz + 0.5) - npcZ;
      candidates.push([cx + 0.5, groundY, cz + 0.5, dx * dx + dz * dz]);
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a[3] - b[3]);
    return [candidates[0][0], candidates[0][1], candidates[0][2]];
  }

  return null;
}

/** Try to break a blocking block ahead. Returns true if a block was broken. */
function tryBreakBlockingBlock(
  getBlock: (x: number, y: number, z: number) => BlockType,
  setBlock: (x: number, y: number, z: number, type: BlockType) => void,
  px: number, py: number, pz: number,
  targetX: number, targetZ: number,
): boolean {
  const dx = targetX - px;
  const dz = targetZ - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return false;

  const ndx = dx / dist;
  const ndz = dz / dist;

  // Check blocks at feet and head level ahead
  for (const checkDist of [0.8, 1.2]) {
    const checkX = Math.floor(px + ndx * checkDist);
    const checkZ = Math.floor(pz + ndz * checkDist);
    for (const yOff of [0, 1]) {
      const checkY = Math.floor(py) + yOff;
      const block = getBlock(checkX, checkY, checkZ);
      if (isSolid(block) && BREAKABLE_BLOCKS.has(block)) {
        setBlock(checkX, checkY, checkZ, BlockType.AIR);
        return true;
      }
    }
  }
  return false;
}

/** Apply physics: gravity, ground collision, wall sliding */
function applyPhysics(
  npc: NPC,
  dt: number,
  getBlock: (x: number, y: number, z: number) => BlockType,
  elapsedTime: number,
): Partial<NPC> {
  const updates: Partial<NPC> = {};
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

  // Wall collision X with sliding: stop X motion but keep Z
  if (vx !== 0) {
    const checkX = newX + (vx > 0 ? NPC_WIDTH : -NPC_WIDTH);
    if (isSolidAt(getBlock, checkX, newY + 0.2, newZ) ||
        isSolidAt(getBlock, checkX, newY + 1.0, newZ)) {
      newX = px;
      vx = 0;
    }
  }

  // Wall collision Z with sliding: stop Z motion but keep X
  if (vz !== 0) {
    const checkZ = newZ + (vz > 0 ? NPC_WIDTH : -NPC_WIDTH);
    if (isSolidAt(getBlock, newX, newY + 0.2, checkZ) ||
        isSolidAt(getBlock, newX, newY + 1.0, checkZ)) {
      newZ = pz;
      vz = 0;
    }
  }

  // Step-up / jump: only when grounded, path requires it, and cooldown elapsed
  if (grounded && (elapsedTime - npc.lastJumpTime) >= JUMP_COOLDOWN) {
    const activeTarget = npc.waypoints.length > 0 ? npc.waypoints[0] : npc.target;
    const moveX = activeTarget[0] - px;
    const moveZ = activeTarget[2] - pz;
    const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveDist > 0.3) {
      const ndirX = moveX / moveDist;
      const ndirZ = moveZ / moveDist;
      const aheadX = newX + ndirX * 0.6;
      const aheadZ = newZ + ndirZ * 0.6;

      // Only jump when there's an actual solid block at feet level ahead
      const blockAtFeet = isSolidAt(getBlock, aheadX, newY + 0.2, aheadZ);
      const spaceAbove = !isSolidAt(getBlock, aheadX, newY + 1.2, aheadZ) &&
                         !isSolidAt(getBlock, aheadX, newY + 2.0, aheadZ);

      if (blockAtFeet && spaceAbove) {
        vy = JUMP_VELOCITY;
        // Give horizontal velocity so NPC clears the obstacle instead of jumping in place
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

/** Compute next AI state for the NPC */
function tickAI(
  npc: NPC,
  dt: number,
  elapsedTime: number,
  getBlock: (x: number, y: number, z: number) => BlockType,
  setBlock: (x: number, y: number, z: number, type: BlockType) => void,
  buildProjects: { id: string; blocks: { x: number; y: number; z: number; type: BlockType }[]; placedCount: number; completed: boolean }[],
  completeBuildBlock: (id: string) => void,
  addBuildProject: (project: { id: string; blocks: { x: number; y: number; z: number; type: BlockType }[]; placedCount: number; completed: boolean }) => void,
  addSapling: (x: number, y: number, z: number, time: number) => void,
): Partial<NPC> {
  const updates: Partial<NPC> = {};
  const [px, py, pz] = npc.position;

  // Only do movement AI when grounded
  if (!npc.grounded) return updates;

  // --- Stuck detection ---
  const movedDist = Math.sqrt(
    (px - npc.lastPos[0]) ** 2 + (pz - npc.lastPos[2]) ** 2
  );
  let newStuckTimer = npc.stuckTimer;
  if (movedDist < STUCK_DISTANCE * dt * 2) {
    newStuckTimer += dt;
  } else {
    newStuckTimer = 0;
  }
  updates.stuckTimer = newStuckTimer;
  updates.lastPos = [px, py, pz];

  // If stuck for too long, try solutions in order: break block > A* > avoidance > abandon
  const isMovingState = npc.state === 'walking' || npc.state === 'idle' ||
    npc.state === 'building' || npc.state === 'gathering' ||
    npc.state === 'planting' || npc.state === 'farming';
  if (newStuckTimer >= STUCK_THRESHOLD && isMovingState) {
    const newStuckCount = npc.stuckCount + 1;
    updates.stuckCount = newStuckCount;
    updates.stuckTimer = 0;

    // Try breaking a blocking block first
    if ((elapsedTime - npc.lastBreakTime) >= BREAK_COOLDOWN) {
      const activeTarget = npc.waypoints.length > 0 ? npc.waypoints[0] : npc.target;
      if (tryBreakBlockingBlock(getBlock, setBlock, px, py, pz, activeTarget[0], activeTarget[2])) {
        updates.lastBreakTime = elapsedTime;
        updates.stuckCount = Math.max(0, newStuckCount - 1); // breaking counts as progress
        return updates;
      }
    }

    if (newStuckCount >= MAX_STUCK_COUNT) {
      // Remember this target as failed so we don't retry it immediately
      const newFailed = [...npc.failedTargets];
      if (npc.workTarget) {
        const [fx, fy, fz] = npc.workTarget;
        newFailed.push({ key: `${fx},${fy},${fz}`, time: elapsedTime });
      }
      // Also remember the target position area
      const tx = Math.floor(npc.target[0]);
      const tz = Math.floor(npc.target[2]);
      newFailed.push({ key: `${tx},${Math.floor(py)},${tz}`, time: elapsedTime });
      updates.failedTargets = newFailed;

      // Abandon current target, go back home and reset
      updates.target = [npc.homePosition[0], py, npc.homePosition[2]];
      updates.state = 'idle';
      updates.workTarget = null;
      updates.waypoints = [];
      updates.pathCache = [];
      updates.stuckCount = 0;
      return updates;
    }

    // Try A* pathfinding around the obstacle
    const finalTarget = npc.target;
    const astarPath = findPathAStar(getBlock, px, py, pz, finalTarget[0], finalTarget[2]);
    if (astarPath.length > 0) {
      updates.waypoints = astarPath;
      updates.pathCache = astarPath;
      updates.pathCacheTime = elapsedTime;
      return updates;
    }

    // Fallback: try simple avoidance waypoints
    const avoidWaypoints = generateAvoidanceWaypoints(
      getBlock, px, py, pz, finalTarget[0], finalTarget[2]
    );
    if (avoidWaypoints.length > 0) {
      updates.waypoints = [...avoidWaypoints, finalTarget];
      return updates;
    }
  }

  // --- Proactive A* path planning ---
  // If we have a target far enough and no waypoints (or path is stale), plan a path
  const distToTarget = Math.sqrt((px - npc.target[0]) ** 2 + (pz - npc.target[2]) ** 2);
  if (distToTarget > 2 && npc.waypoints.length === 0 &&
      (elapsedTime - npc.pathCacheTime) > PATH_RECALC_INTERVAL) {
    const astarPath = findPathAStar(getBlock, px, py, pz, npc.target[0], npc.target[2]);
    if (astarPath.length > 0) {
      updates.waypoints = astarPath;
      updates.pathCache = astarPath;
      updates.pathCacheTime = elapsedTime;
    } else {
      // No A* path - just update cache time to avoid recalculating every frame
      updates.pathCacheTime = elapsedTime;
    }
  }

  // --- Waypoint following ---
  const currentWaypoints = updates.waypoints ?? npc.waypoints;
  const activeTarget = currentWaypoints.length > 0 ? currentWaypoints[0] : npc.target;
  const tx = activeTarget[0];
  const tz = activeTarget[2];
  const dist = Math.sqrt((px - tx) ** 2 + (pz - tz) ** 2);

  // Move toward current target
  if (dist > WAYPOINT_REACH_DIST) {
    const dx = (tx - px) / dist;
    const dz = (tz - pz) / dist;

    // Check if next step would be dangerous (water/cliff)
    const nextX = px + dx * 0.5;
    const nextZ = pz + dz * 0.5;
    if (isDangerous(getBlock, nextX, nextZ, py)) {
      // Don't walk into danger - try A* first, then avoidance
      const astarPath = findPathAStar(getBlock, px, py, pz, npc.target[0], npc.target[2]);
      if (astarPath.length > 0) {
        updates.waypoints = astarPath;
        updates.pathCache = astarPath;
        updates.pathCacheTime = elapsedTime;
      } else {
        const avoidWaypoints = generateAvoidanceWaypoints(
          getBlock, px, py, pz, npc.target[0], npc.target[2]
        );
        if (avoidWaypoints.length > 0) {
          updates.waypoints = [...avoidWaypoints, npc.target];
        } else {
          // Can't avoid - remember failed target and go home
          if (npc.workTarget) {
            const [ftx, fty, ftz] = npc.workTarget;
            const dangerFailed = [...npc.failedTargets, { key: `${ftx},${fty},${ftz}`, time: elapsedTime }];
            updates.failedTargets = dangerFailed;
          }
          updates.target = [npc.homePosition[0], py, npc.homePosition[2]];
          updates.state = 'idle';
          updates.workTarget = null;
          updates.waypoints = [];
          updates.pathCache = [];
        }
      }
      return updates;
    }

    updates.velocity = [
      dx * npc.speed,
      npc.velocity[1],
      dz * npc.speed,
    ];
    if (npc.state === 'idle') {
      updates.state = 'walking';
    }
    return updates;
  }

  // Reached current waypoint - advance to next
  if (currentWaypoints.length > 0) {
    const remaining = currentWaypoints.slice(1);
    updates.waypoints = remaining;
    if (remaining.length > 0) {
      return updates;
    }
    // All waypoints consumed, reset stuck count
    updates.stuckCount = 0;
  }

  // Arrived at final target - stop horizontal movement
  updates.velocity = [0, npc.velocity[1], 0];
  updates.stuckCount = 0;

  const totalItems = npc.inventory.reduce((s, i) => s + i.count, 0);

  // Prune expired failed targets (older than 60s)
  const FAILED_TARGET_TIMEOUT = 60;
  const activeFailedTargets = npc.failedTargets.filter(
    (ft) => elapsedTime - ft.time < FAILED_TARGET_TIMEOUT
  );
  if (activeFailedTargets.length !== npc.failedTargets.length) {
    updates.failedTargets = activeFailedTargets;
  }
  const excludeSet = new Set(activeFailedTargets.map((ft) => ft.key));

  switch (npc.state) {
    case 'idle':
    case 'walking': {
      // === BUILDER: build houses or bridges ===
      if (npc.role === 'builder') {
        const project = buildProjects.find((p) => !p.completed);
        if (project && project.placedCount < project.blocks.length) {
          const block = project.blocks[project.placedCount];
          // Stand near the block, not on it - find best adjacent position
          const standPos = findStandPosition(getBlock, block.x, block.y, block.z, px, py, pz);
          if (standPos) {
            updates.target = standPos;
            updates.state = 'building';
            updates.workTarget = [block.x, block.y, block.z];
            updates.buildIndex = project.placedCount;
            updates.waypoints = [];
            updates.pathCache = [];
            return updates;
          }
        }
        // No active project - look for a river to bridge
        const hasBridge = buildProjects.some((p) => p.id.startsWith('bridge_'));
        if (!hasBridge) {
          const bridgeLoc = findBridgeLocation(getBlock, px, py, pz, 15);
          if (bridgeLoc) {
            const bridge = generateBridgeBlueprint(
              bridgeLoc.startX, bridgeLoc.endX,
              bridgeLoc.bridgeY, bridgeLoc.bridgeZ, 0
            );
            addBuildProject(bridge);
            return updates; // will pick up bridge next tick
          }
        }
      }

      // === LUMBERJACK: chop wood, then plant sapling ===
      if (npc.role === 'lumberjack') {
        // After chopping (has items), try to plant a sapling
        if (totalItems > 0 && totalItems % 3 === 0) {
          const spot = findSaplingSpot(getBlock, px, py, pz, 6);
          if (spot) {
            updates.target = [spot[0] + 0.5, py, spot[2] + 0.5];
            updates.state = 'planting';
            updates.workTarget = spot;
            return updates;
          }
        }
        // Chop wood
        if (totalItems < npc.inventoryCapacity) {
          const found = findNearbyBlock(getBlock, px, py, pz, [BlockType.WOOD], 12, excludeSet);
          if (found) {
            const standPos = findStandPosition(getBlock, found[0], found[1], found[2], px, py, pz);
            if (standPos) {
              updates.target = standPos;
              updates.state = 'gathering';
              updates.workTarget = found;
              return updates;
            }
          }
        }
      }

      // === FARMER: create farmland and plant wheat ===
      if (npc.role === 'farmer') {
        // Look for existing farmland to plant wheat on
        const farmland = findNearbyBlock(getBlock, px, py, pz, [BlockType.FARMLAND], 8, excludeSet);
        if (farmland) {
          const above = getBlock(farmland[0], farmland[1] + 1, farmland[2]);
          if (above === BlockType.AIR) {
            const farmStand = findStandPosition(getBlock, farmland[0], farmland[1], farmland[2], px, py, pz);
            if (farmStand) {
              updates.target = farmStand;
              updates.state = 'farming';
              updates.workTarget = [farmland[0], farmland[1] + 1, farmland[2]];
              return updates;
            }
          }
        }
        // Find grass to convert to farmland
        const grassSpot = findFarmSpot(getBlock, px, py, pz, 8, excludeSet);
        if (grassSpot) {
          const grassStand = findStandPosition(getBlock, grassSpot[0], grassSpot[1], grassSpot[2], px, py, pz);
          if (grassStand) {
            updates.target = grassStand;
            updates.state = 'farming';
            updates.workTarget = grassSpot;
            return updates;
          }
        }
        // Harvest mature wheat
        const wheat = findNearbyBlock(getBlock, px, py, pz, [BlockType.WHEAT], 8, excludeSet);
        if (wheat) {
          const wheatStand = findStandPosition(getBlock, wheat[0], wheat[1], wheat[2], px, py, pz);
          if (wheatStand) {
            updates.target = wheatStand;
            updates.state = 'gathering';
            updates.workTarget = wheat;
            return updates;
          }
        }
      }

      // === MINER: gather stone/ores ===
      if (npc.role === 'miner') {
        if (totalItems < npc.inventoryCapacity) {
          const targets = getGatherTargets(npc.role);
          const found = findNearbyBlock(getBlock, px, py, pz, targets, 8, excludeSet);
          if (found) {
            const mineStand = findStandPosition(getBlock, found[0], found[1], found[2], px, py, pz);
            if (mineStand) {
              updates.target = mineStand;
              updates.state = 'gathering';
              updates.workTarget = found;
              return updates;
            }
          }
        }
      }

      // If full inventory, return home
      if (totalItems >= npc.inventoryCapacity) {
        updates.target = [npc.homePosition[0], py, npc.homePosition[2]];
        updates.state = 'returning';
        return updates;
      }

      // Wander randomly
      const angle = Math.random() * Math.PI * 2;
      const wanderDist = 2 + Math.random() * 3;
      updates.target = [
        npc.homePosition[0] + Math.cos(angle) * wanderDist,
        py,
        npc.homePosition[2] + Math.sin(angle) * wanderDist,
      ];
      updates.state = 'walking';
      return updates;
    }

    case 'gathering': {
      if (!npc.workTarget) {
        updates.state = 'idle';
        return updates;
      }
      // Check if close enough to work target
      const [gx, gy, gz] = npc.workTarget;
      const gatherDist = Math.sqrt((px - (gx + 0.5)) ** 2 + (pz - (gz + 0.5)) ** 2);
      if (gatherDist > BREAK_REACH) {
        const gatherStand = findStandPosition(getBlock, gx, gy, gz, px, py, pz);
        if (!gatherStand) {
          updates.workTarget = null;
          updates.state = 'idle';
          return updates;
        }
        updates.target = gatherStand;
        updates.waypoints = [];
        updates.pathCache = [];
        return updates;
      }
      const newTimer = npc.gatherTimer + dt;
      if (newTimer >= 1.5) {
        const [bx, by, bz] = npc.workTarget;
        const bt = getBlock(bx, by, bz);
        if (bt !== BlockType.AIR) {
          setBlock(bx, by, bz, BlockType.AIR);
          const drop = getDropType(npc.role);
          const inv = [...npc.inventory];
          const existingSlot = inv.find((i) => i.type === drop);
          if (existingSlot) {
            existingSlot.count++;
          } else {
            inv.push({ type: drop, count: 1 });
          }
          updates.inventory = inv;
          // Successful gather - clear failed targets since terrain may have changed
          updates.failedTargets = [];
        }
        updates.gatherTimer = 0;
        updates.workTarget = null;
        updates.state = 'idle';
      } else {
        updates.gatherTimer = newTimer;
      }
      return updates;
    }

    case 'building': {
      if (!npc.workTarget) {
        updates.state = 'idle';
        return updates;
      }
      // Check if close enough to work target to build
      const [wx, wy, wz] = npc.workTarget;
      const workDist = Math.sqrt((px - (wx + 0.5)) ** 2 + (pz - (wz + 0.5)) ** 2);
      if (workDist > BREAK_REACH) {
        // Not close enough - recalculate stand position and walk there
        const standPos = findStandPosition(getBlock, wx, wy, wz, px, py, pz);
        if (!standPos) {
          updates.workTarget = null;
          updates.state = 'idle';
          return updates;
        }
        updates.target = standPos;
        updates.waypoints = [];
        updates.pathCache = [];
        return updates;
      }
      const newBuildTimer = npc.buildTimer + dt;
      if (newBuildTimer >= 1.0) {
        const project = buildProjects.find((p) => !p.completed);
        if (project && project.placedCount < project.blocks.length) {
          const block = project.blocks[project.placedCount];
          setBlock(block.x, block.y, block.z, block.type);
          completeBuildBlock(project.id);
        }
        updates.buildTimer = 0;
        updates.workTarget = null;
        updates.state = 'idle';
      } else {
        updates.buildTimer = newBuildTimer;
      }
      return updates;
    }

    case 'planting': {
      // Lumberjack plants a sapling
      if (!npc.workTarget) {
        updates.state = 'idle';
        return updates;
      }
      const plantTimer = npc.buildTimer + dt;
      if (plantTimer >= 1.0) {
        const [sx, sy, sz] = npc.workTarget;
        if (getBlock(sx, sy, sz) === BlockType.AIR) {
          setBlock(sx, sy, sz, BlockType.SAPLING);
          addSapling(sx, sy, sz, elapsedTime);
        }
        updates.buildTimer = 0;
        updates.workTarget = null;
        updates.state = 'idle';
      } else {
        updates.buildTimer = plantTimer;
      }
      return updates;
    }

    case 'farming': {
      // Farmer: convert grass to farmland or plant wheat on farmland
      if (!npc.workTarget) {
        updates.state = 'idle';
        return updates;
      }
      // Check if close enough to work target
      const [farmX, farmY, farmZ] = npc.workTarget;
      const farmDist = Math.sqrt((px - (farmX + 0.5)) ** 2 + (pz - (farmZ + 0.5)) ** 2);
      if (farmDist > BREAK_REACH) {
        const farmStand = findStandPosition(getBlock, farmX, farmY, farmZ, px, py, pz);
        if (!farmStand) {
          updates.workTarget = null;
          updates.state = 'idle';
          return updates;
        }
        updates.target = farmStand;
        updates.waypoints = [];
        updates.pathCache = [];
        return updates;
      }
      const farmTimer = npc.buildTimer + dt;
      if (farmTimer >= 1.2) {
        const [fx, fy, fz] = npc.workTarget;
        const blockHere = getBlock(fx, fy, fz);
        if (blockHere === BlockType.GRASS) {
          // Convert grass to farmland
          setBlock(fx, fy, fz, BlockType.FARMLAND);
        } else if (blockHere === BlockType.AIR) {
          // Plant wheat above farmland
          const below = getBlock(fx, fy - 1, fz);
          if (below === BlockType.FARMLAND) {
            setBlock(fx, fy, fz, BlockType.WHEAT);
          }
        }
        updates.buildTimer = 0;
        updates.workTarget = null;
        updates.state = 'idle';
      } else {
        updates.buildTimer = farmTimer;
      }
      return updates;
    }

    case 'returning': {
      updates.inventory = [];
      updates.state = 'idle';
      return updates;
    }
  }

  return updates;
}

// NPC label by role
const ROLE_LABELS: Record<NPCRole, string> = {
  lumberjack: 'Drwal',
  miner: 'Górnik',
  builder: 'Budowniczy',
  farmer: 'Rolnik',
};

export function VillageNPCs() {
  const npcs = useNPCStore((s) => s.npcs);
  const buildProjects = useNPCStore((s) => s.buildProjects);
  const saplings = useNPCStore((s) => s.saplings);
  const updateNPC = useNPCStore((s) => s.updateNPC);
  const completeBuildBlock = useNPCStore((s) => s.completeBuildBlock);
  const addBuildProject = useNPCStore((s) => s.addBuildProject);
  const addSapling = useNPCStore((s) => s.addSapling);
  const removeSapling = useNPCStore((s) => s.removeSapling);
  const getBlock = useWorldStore((s) => s.getBlock);
  const setBlock = useWorldStore((s) => s.setBlock);

  const meshRefs = useRef<Map<NPCRole, THREE.InstancedMesh>>(new Map());
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geometries = useMemo(() => {
    const map = new Map<NPCRole, THREE.BufferGeometry>();
    const roles: NPCRole[] = ['lumberjack', 'miner', 'builder', 'farmer'];
    for (const role of roles) {
      map.set(role, buildNPCGeometry(role));
    }
    return map;
  }, []);

  // Group NPCs by role for instanced rendering
  const npcsByRole = useMemo(() => {
    const map = new Map<NPCRole, NPC[]>();
    for (const npc of npcs) {
      const list = map.get(npc.role) || [];
      list.push(npc);
      map.set(npc.role, list);
    }
    return map;
  }, [npcs]);

  const setMeshRef = useCallback((role: NPCRole) => (el: THREE.InstancedMesh | null) => {
    if (el) {
      meshRefs.current.set(role, el);
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05); // cap dt for stability
    const t = state.clock.elapsedTime;

    // Sapling growth system: check if any saplings are ready to grow
    for (const sapling of saplings) {
      if (t - sapling.plantedAt >= SAPLING_GROW_TIME) {
        const bt = getBlock(sapling.x, sapling.y, sapling.z);
        if (bt === BlockType.SAPLING) {
          growSaplingToTree(setBlock, sapling.x, sapling.y, sapling.z);
        }
        removeSapling(sapling.x, sapling.y, sapling.z);
      }
    }

    for (const npc of npcs) {
      // Apply physics first (gravity, collision, ground detection)
      const physUpdates = applyPhysics(npc, dt, getBlock, t);

      // Then apply AI logic
      const mergedNPC = { ...npc, ...physUpdates };
      const aiUpdates = tickAI(
        mergedNPC, dt, t, getBlock, setBlock,
        buildProjects, completeBuildBlock, addBuildProject, addSapling
      );

      // Merge AI velocity with physics velocity (AI sets horizontal, physics keeps vertical)
      if (aiUpdates.velocity && physUpdates.velocity) {
        aiUpdates.velocity = [
          aiUpdates.velocity[0],
          physUpdates.velocity[1],
          aiUpdates.velocity[2],
        ];
      }

      const allUpdates = { ...physUpdates, ...aiUpdates };
      if (Object.keys(allUpdates).length > 0) {
        updateNPC(npc.id, allUpdates);
      }
    }

    // Update instanced mesh transforms
    for (const [role, roleNPCs] of npcsByRole) {
      const mesh = meshRefs.current.get(role);
      if (!mesh) continue;

      for (let i = 0; i < roleNPCs.length; i++) {
        const npc = roleNPCs[i];
        const [px, py, pz] = npc.position;
        const [tx, , tz] = npc.target;

        // Walking bounce only when grounded and moving
        const isMoving = npc.grounded && (npc.state === 'walking' || npc.state === 'returning');
        const bounce = isMoving ? Math.abs(Math.sin(t * 8 + npc.phase)) * 0.06 : 0;

        // Working bob when gathering/building/planting/farming
        const workBob = npc.grounded && (npc.state === 'gathering' || npc.state === 'building' || npc.state === 'planting' || npc.state === 'farming')
          ? Math.sin(t * 8 + npc.phase) * 0.05 : 0;

        dummy.position.set(px, py + bounce + workBob, pz);

        // Face target direction
        const dx = tx - px;
        const dz = tz - pz;
        if (dx * dx + dz * dz > 0.01) {
          dummy.rotation.y = Math.atan2(dx, dz);
        }

        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (npcs.length === 0) return null;

  return (
    <>
      {Array.from(npcsByRole.entries()).map(([role, roleNPCs]) => {
        const geo = geometries.get(role);
        if (!geo || roleNPCs.length === 0) return null;
        return (
          <instancedMesh
            key={role}
            ref={setMeshRef(role)}
            args={[geo, undefined, roleNPCs.length]}
          >
            <meshLambertMaterial vertexColors />
          </instancedMesh>
        );
      })}

      {/* Floating name labels */}
      {npcs.map((npc) => (
        <NPCLabel key={npc.id} npc={npc} />
      ))}
    </>
  );
}

function NPCLabel({ npc }: { npc: NPC }) {
  const ref = useRef<THREE.Sprite>(null);
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(0, 0, 128, 32, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ROLE_LABELS[npc.role], 64, 16);
    return c;
  }, [npc.role]);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [canvas]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.set(npc.position[0], npc.position[1] + 2.0, npc.position[2]);
    }
  });

  return (
    <sprite ref={ref} scale={[1.2, 0.3, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.8} depthTest={false} />
    </sprite>
  );
}
