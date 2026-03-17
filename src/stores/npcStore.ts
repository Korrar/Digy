import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';

export type NPCRole = 'philosopher' | 'blacksmith' | 'farmer' | 'merchant' | 'potter' | 'priestess';
export type NPCState = 'idle' | 'walking' | 'gathering' | 'building' | 'returning' | 'planting' | 'farming' | 'praying' | 'trading' | 'crafting' | 'socializing' | 'sleeping' | 'fleeing';

export interface NPC {
  id: string;
  role: NPCRole;
  state: NPCState;
  position: [number, number, number];
  velocity: [number, number, number];
  target: [number, number, number];
  homePosition: [number, number, number];
  inventory: { type: BlockType; count: number }[];
  inventoryCapacity: number;
  speed: number;
  gatherTimer: number;
  buildTimer: number;
  grounded: boolean;
  /** Target block position the NPC is working on */
  workTarget: [number, number, number] | null;
  /** Blueprint block index the builder NPC is currently placing */
  buildIndex: number;
  phase: number;
  /** Time spent stuck (not making progress toward target) */
  stuckTimer: number;
  /** Last recorded position for stuck detection */
  lastPos: [number, number, number];
  /** Waypoints queue for pathfinding around obstacles */
  waypoints: [number, number, number][];
  /** Number of times NPC got stuck on current target - triggers abandon */
  stuckCount: number;
  /** Timestamp of last jump for cooldown */
  lastJumpTime: number;
  /** Timestamp of last block break for cooldown */
  lastBreakTime: number;
  /** Cached A* path, recalculated periodically */
  pathCache: [number, number, number][];
  /** Time when path was last calculated */
  pathCacheTime: number;
  /** Recently failed/unreachable target positions (cleared after timeout) */
  failedTargets: { key: string; time: number }[];
  /** NPC name for display */
  name: string;
  /** Daily schedule phase (0-1 representing time of day) */
  schedulePhase: number;
  /** Mood: affects behavior and dialog (0=terrified, 0.5=neutral, 1=happy) */
  mood: number;
  /** Social target - NPC they're talking to */
  socialTarget: string | null;
  /** Fear level - increases when terrorized by magic (0-1) */
  fear: number;
  /** Petrified (Medusa effect) - NPC cannot move */
  petrified: boolean;
  /** Petrify timer - seconds remaining */
  petrifyTimer: number;
}

/** Tracked sapling that will grow into a tree after delay */
export interface TrackedSapling {
  x: number;
  y: number;
  z: number;
  plantedAt: number;
}

export interface NPCStoreState {
  npcs: NPC[];
  /** Active village building projects */
  buildProjects: BuildProject[];
  /** Saplings planted, tracked for growth */
  saplings: TrackedSapling[];
  spawnVillageNPCs: (centerX: number, centerY: number, centerZ: number) => void;
  updateNPC: (id: string, updates: Partial<NPC>) => void;
  clearNPCs: () => void;
  addBuildProject: (project: BuildProject) => void;
  completeBuildBlock: (projectId: string) => void;
  applyKnockback: (id: string, kx: number, ky: number, kz: number) => void;
  addSapling: (x: number, y: number, z: number, time: number) => void;
  removeSapling: (x: number, y: number, z: number) => void;
  /** Apply fear to all NPCs near a position */
  applyFearNearby: (wx: number, wy: number, wz: number, radius: number, amount: number) => void;
  /** Petrify NPC (Medusa) */
  petrifyNPC: (id: string, duration: number) => void;
}

export interface BuildProject {
  id: string;
  blocks: { x: number; y: number; z: number; type: BlockType }[];
  placedCount: number;
  completed: boolean;
}

// Greek names for NPCs
const GREEK_NAMES: Record<NPCRole, string[]> = {
  philosopher: ['Sokrates', 'Platon', 'Arystoteles', 'Diogenes', 'Epikur'],
  blacksmith: ['Hefajstos', 'Daidalos', 'Brontes', 'Arges', 'Steropes'],
  farmer: ['Demeter', 'Triptolemos', 'Karpos', 'Aristaios', 'Gajus'],
  merchant: ['Hermes', 'Autolikos', 'Krezus', 'Nicias', 'Lyzander'],
  potter: ['Keramikos', 'Exekias', 'Eufronios', 'Amasis', 'Ergotimos'],
  priestess: ['Pytia', 'Kassandra', 'Ifigenia', 'Hestia', 'Atena'],
};

const ROLE_COLORS: Record<NPCRole, { body: number; shirt: number; pants: number }> = {
  philosopher: { body: 0xd4a574, shirt: 0xf0e8d8, pants: 0xe0d4c0 },   // white toga
  blacksmith: { body: 0xc89870, shirt: 0x8b4513, pants: 0x654321 },     // leather apron
  farmer: { body: 0xc8a080, shirt: 0xc8b468, pants: 0x8b7355 },         // tan tunic
  merchant: { body: 0xd0a070, shirt: 0x8b2252, pants: 0x6b1842 },       // purple robes
  potter: { body: 0xc89870, shirt: 0xb06030, pants: 0x8b5a2b },         // clay-stained
  priestess: { body: 0xd4b090, shirt: 0xf8f0e0, pants: 0xe8dcc8 },      // white ceremonial
};

export { ROLE_COLORS };

function createNPC(id: string, role: NPCRole, cx: number, cy: number, cz: number): NPC {
  const angle = Math.random() * Math.PI * 2;
  const radius = 2 + Math.random() * 4;
  const x = cx + Math.cos(angle) * radius;
  const z = cz + Math.sin(angle) * radius;
  const names = GREEK_NAMES[role];
  const name = names[Math.floor(Math.random() * names.length)];
  return {
    id,
    role,
    name,
    state: 'idle',
    position: [x, cy + 1, z],
    velocity: [0, 0, 0],
    target: [x, cy + 1, z],
    homePosition: [cx, cy + 1, cz],
    inventory: [],
    inventoryCapacity: role === 'merchant' ? 32 : 16,
    speed: 1.2 + Math.random() * 0.4,
    gatherTimer: 0,
    buildTimer: 0,
    grounded: false,
    workTarget: null,
    buildIndex: 0,
    phase: Math.random() * Math.PI * 2,
    stuckTimer: 0,
    lastPos: [x, cy + 1, z],
    waypoints: [],
    stuckCount: 0,
    lastJumpTime: 0,
    lastBreakTime: 0,
    pathCache: [],
    pathCacheTime: 0,
    failedTargets: [],
    schedulePhase: Math.random(),
    mood: 0.7 + Math.random() * 0.3,
    socialTarget: null,
    fear: 0,
    petrified: false,
    petrifyTimer: 0,
  };
}

/** Generate a Greek house blueprint (terracotta walls, copper roof, marble threshold) */
export function generateHouseBlueprint(
  bx: number, by: number, bz: number, variant: number
): BuildProject {
  const blocks: BuildProject['blocks'] = [];
  const w = 4 + (variant % 2);
  const d = 4 + ((variant + 1) % 2);
  const h = 3;

  // Floor - mosaic tiles
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      blocks.push({ x: bx + x, y: by, z: bz + z, type: BlockType.MOSAIC_FLOOR });
    }
  }
  // Walls - terracotta/limestone mix
  for (let y = 1; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        if (x === 0 || x === w - 1 || z === 0 || z === d - 1) {
          // Door opening
          if (x === Math.floor(w / 2) && z === 0 && y <= 2) continue;
          // Windows
          if ((x === 0 || x === w - 1) && z === Math.floor(d / 2) && y === 2) {
            blocks.push({ x: bx + x, y: by + y, z: bz + z, type: BlockType.GLASS });
          } else {
            const wallType = y === 1 ? BlockType.LIMESTONE : BlockType.TERRACOTTA;
            blocks.push({ x: bx + x, y: by + y, z: bz + z, type: wallType });
          }
        }
      }
    }
  }
  // Roof - copper
  for (let x = -1; x <= w; x++) {
    for (let z = 0; z < d; z++) {
      blocks.push({ x: bx + x, y: by + h + 1, z: bz + z, type: BlockType.COPPER_ROOF });
    }
  }
  // Torch inside
  blocks.push({ x: bx + Math.floor(w / 2), y: by + 2, z: bz + Math.floor(d / 2), type: BlockType.TORCH });
  // Amphora decoration
  blocks.push({ x: bx + 1, y: by + 1, z: bz + 1, type: BlockType.AMPHORA });

  return {
    id: `house_${bx}_${bz}_${variant}`,
    blocks,
    placedCount: 0,
    completed: false,
  };
}

/** Generate a bridge blueprint spanning water */
export function generateBridgeBlueprint(
  startX: number, endX: number, bridgeY: number, bridgeZ: number, index: number
): BuildProject {
  const blocks: BuildProject['blocks'] = [];
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  for (let x = minX - 1; x <= maxX + 1; x++) {
    // Bridge deck - marble
    blocks.push({ x, y: bridgeY, z: bridgeZ, type: BlockType.MARBLE });
    blocks.push({ x, y: bridgeY, z: bridgeZ + 1, type: BlockType.MARBLE });
    // Marble column railings on edges
    if (x === minX - 1 || x === maxX + 1) {
      blocks.push({ x, y: bridgeY + 1, z: bridgeZ, type: BlockType.MARBLE_COLUMN });
      blocks.push({ x, y: bridgeY + 1, z: bridgeZ + 1, type: BlockType.MARBLE_COLUMN });
    }
  }

  return {
    id: `bridge_${bridgeZ}_${index}`,
    blocks,
    placedCount: 0,
    completed: false,
  };
}

export const useNPCStore = create<NPCStoreState>((set) => ({
  npcs: [],
  buildProjects: [],
  saplings: [],

  spawnVillageNPCs: (cx, cy, cz) => {
    const npcs: NPC[] = [];
    // Spawn 10 NPCs with varied Greek roles
    const roles: NPCRole[] = ['philosopher', 'blacksmith', 'farmer', 'farmer', 'merchant', 'potter', 'priestess', 'farmer', 'merchant', 'potter'];
    for (let i = 0; i < roles.length; i++) {
      npcs.push(createNPC(`npc_${i}`, roles[i], cx, cy, cz));
    }

    // Generate initial build projects (Greek houses)
    const projects: BuildProject[] = [];
    const offsets = [
      [4, 3], [-5, 4], [3, -5], [-4, -4], [6, -2], [-6, 2],
    ];
    for (let i = 0; i < offsets.length; i++) {
      projects.push(generateHouseBlueprint(
        cx + offsets[i][0], cy, cz + offsets[i][1], i
      ));
    }

    set({ npcs, buildProjects: projects });
  },

  updateNPC: (id, updates) => set((state) => ({
    npcs: state.npcs.map((npc) =>
      npc.id === id ? { ...npc, ...updates } : npc
    ),
  })),

  clearNPCs: () => set({ npcs: [], buildProjects: [], saplings: [] }),

  addBuildProject: (project) => set((state) => ({
    buildProjects: [...state.buildProjects, project],
  })),

  completeBuildBlock: (projectId) => set((state) => ({
    buildProjects: state.buildProjects.map((p) => {
      if (p.id !== projectId) return p;
      const newPlaced = p.placedCount + 1;
      return {
        ...p,
        placedCount: newPlaced,
        completed: newPlaced >= p.blocks.length,
      };
    }),
  })),

  applyKnockback: (id, kx, ky, kz) => set((state) => ({
    npcs: state.npcs.map((npc) => {
      if (npc.id !== id) return npc;
      return {
        ...npc,
        velocity: [
          npc.velocity[0] + kx,
          npc.velocity[1] + ky,
          npc.velocity[2] + kz,
        ],
        grounded: false,
      };
    }),
  })),

  addSapling: (x, y, z, time) => set((state) => ({
    saplings: [...state.saplings, { x, y, z, plantedAt: time }],
  })),

  removeSapling: (x, y, z) => set((state) => ({
    saplings: state.saplings.filter((s) => s.x !== x || s.y !== y || s.z !== z),
  })),

  applyFearNearby: (wx, wy, wz, radius, amount) => set((state) => ({
    npcs: state.npcs.map((npc) => {
      const dx = npc.position[0] - wx;
      const dy = npc.position[1] - wy;
      const dz = npc.position[2] - wz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > radius) return npc;
      const fearIncrease = amount * (1 - dist / radius);
      const newFear = Math.min(1, npc.fear + fearIncrease);
      return {
        ...npc,
        fear: newFear,
        mood: Math.max(0, npc.mood - fearIncrease * 0.5),
        state: newFear > 0.5 ? 'fleeing' as NPCState : npc.state,
      };
    }),
  })),

  petrifyNPC: (id, duration) => set((state) => ({
    npcs: state.npcs.map((npc) => {
      if (npc.id !== id) return npc;
      return {
        ...npc,
        petrified: true,
        petrifyTimer: duration,
        state: 'idle' as NPCState,
        velocity: [0, 0, 0],
      };
    }),
  })),
}));
