import { create } from 'zustand';
import { BlockType } from '../core/voxel/BlockRegistry';

export type NPCRole = 'lumberjack' | 'miner' | 'builder' | 'farmer';
export type NPCState = 'idle' | 'walking' | 'gathering' | 'building' | 'returning' | 'planting' | 'farming';

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
}

/** Tracked sapling that will grow into a tree after delay */
export interface TrackedSapling {
  x: number;
  y: number;
  z: number;
  plantedAt: number; // elapsed time when planted
}

export interface NPCStoreState {
  npcs: NPC[];
  /** Active village building projects */
  buildProjects: BuildProject[];
  /** Saplings planted by lumberjacks, tracked for growth */
  saplings: TrackedSapling[];
  spawnVillageNPCs: (centerX: number, centerY: number, centerZ: number) => void;
  updateNPC: (id: string, updates: Partial<NPC>) => void;
  clearNPCs: () => void;
  addBuildProject: (project: BuildProject) => void;
  completeBuildBlock: (projectId: string) => void;
  applyKnockback: (id: string, kx: number, ky: number, kz: number) => void;
  addSapling: (x: number, y: number, z: number, time: number) => void;
  removeSapling: (x: number, y: number, z: number) => void;
}

export interface BuildProject {
  id: string;
  blocks: { x: number; y: number; z: number; type: BlockType }[];
  placedCount: number;
  completed: boolean;
}

const NPC_ROLES: NPCRole[] = ['lumberjack', 'miner', 'builder', 'farmer'];

const ROLE_COLORS: Record<NPCRole, { body: number; shirt: number; pants: number }> = {
  lumberjack: { body: 0xd4a574, shirt: 0xcc4444, pants: 0x554433 },
  miner: { body: 0xc89870, shirt: 0x666688, pants: 0x444455 },
  builder: { body: 0xd0a070, shirt: 0xddaa44, pants: 0x665533 },
  farmer: { body: 0xc8a080, shirt: 0x44aa44, pants: 0x554422 },
};

export { ROLE_COLORS };

function createNPC(id: string, role: NPCRole, cx: number, cy: number, cz: number): NPC {
  const angle = Math.random() * Math.PI * 2;
  const radius = 2 + Math.random() * 4;
  const x = cx + Math.cos(angle) * radius;
  const z = cz + Math.sin(angle) * radius;
  return {
    id,
    role,
    state: 'idle',
    position: [x, cy + 1, z],
    velocity: [0, 0, 0],
    target: [x, cy + 1, z],
    homePosition: [cx, cy + 1, cz],
    inventory: [],
    inventoryCapacity: role === 'builder' ? 32 : 16,
    speed: 1.2 + Math.random() * 0.4,
    gatherTimer: 0,
    buildTimer: 0,
    grounded: false,
    workTarget: null,
    buildIndex: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

/** Generate a small house blueprint at the given position */
export function generateHouseBlueprint(
  bx: number, by: number, bz: number, variant: number
): BuildProject {
  const blocks: BuildProject['blocks'] = [];
  const w = 4 + (variant % 2);
  const d = 4 + ((variant + 1) % 2);
  const h = 3;

  // Floor
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      blocks.push({ x: bx + x, y: by, z: bz + z, type: BlockType.PLANKS });
    }
  }
  // Walls
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
            blocks.push({ x: bx + x, y: by + y, z: bz + z, type: BlockType.PLANKS });
          }
        }
      }
    }
  }
  // Roof
  for (let x = -1; x <= w; x++) {
    for (let z = 0; z < d; z++) {
      blocks.push({ x: bx + x, y: by + h + 1, z: bz + z, type: BlockType.WOOD });
    }
  }
  // Torch inside
  blocks.push({ x: bx + Math.floor(w / 2), y: by + 2, z: bz + Math.floor(d / 2), type: BlockType.TORCH });

  return {
    id: `house_${bx}_${bz}_${variant}`,
    blocks,
    placedCount: 0,
    completed: false,
  };
}

/** Generate a bridge blueprint spanning water at given Z line */
export function generateBridgeBlueprint(
  startX: number, endX: number, bridgeY: number, bridgeZ: number, index: number
): BuildProject {
  const blocks: BuildProject['blocks'] = [];
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  for (let x = minX - 1; x <= maxX + 1; x++) {
    // Bridge deck
    blocks.push({ x, y: bridgeY, z: bridgeZ, type: BlockType.PLANKS });
    blocks.push({ x, y: bridgeY, z: bridgeZ + 1, type: BlockType.PLANKS });
    // Railings on edges
    if (x === minX - 1 || x === maxX + 1) {
      blocks.push({ x, y: bridgeY + 1, z: bridgeZ, type: BlockType.WOOD });
      blocks.push({ x, y: bridgeY + 1, z: bridgeZ + 1, type: BlockType.WOOD });
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
    for (let i = 0; i < NPC_ROLES.length; i++) {
      npcs.push(createNPC(`npc_${i}`, NPC_ROLES[i], cx, cy, cz));
    }
    // Add a second builder and farmer for bigger village feel
    npcs.push(createNPC('npc_4', 'builder', cx, cy, cz));
    npcs.push(createNPC('npc_5', 'farmer', cx, cy, cz));

    // Generate initial build projects
    const projects: BuildProject[] = [];
    const offsets = [
      [4, 3], [-5, 4], [3, -5], [-4, -4],
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
}));
