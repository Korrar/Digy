import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNPCStore, ROLE_COLORS, type NPC, type NPCRole, type NPCState } from '../../stores/npcStore';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType } from '../../core/voxel/BlockRegistry';

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

/** Gather target: find a nearby block of the given type */
function findNearbyBlock(
  getBlock: (x: number, y: number, z: number) => BlockType,
  cx: number, cy: number, cz: number,
  targetType: BlockType[],
  radius: number
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
    case 'farmer': return [BlockType.TALL_GRASS, BlockType.FLOWER_RED, BlockType.FLOWER_YELLOW];
    case 'builder': return [BlockType.WOOD, BlockType.PLANKS];
  }
}

function getDropType(role: NPCRole): BlockType {
  switch (role) {
    case 'lumberjack': return BlockType.PLANKS;
    case 'miner': return BlockType.COBBLESTONE;
    case 'farmer': return BlockType.APPLE;
    case 'builder': return BlockType.PLANKS;
  }
}

/** Compute next state for the NPC AI */
function tickNPC(
  npc: NPC,
  dt: number,
  getBlock: (x: number, y: number, z: number) => BlockType,
  setBlock: (x: number, y: number, z: number, type: BlockType) => void,
  buildProjects: { id: string; blocks: { x: number; y: number; z: number; type: BlockType }[]; placedCount: number; completed: boolean }[],
  completeBuildBlock: (id: string) => void,
): Partial<NPC> {
  const updates: Partial<NPC> = {};
  const [px, py, pz] = npc.position;
  const [tx, ty, tz] = npc.target;

  const dist = Math.sqrt((px - tx) ** 2 + (pz - tz) ** 2);

  // Move toward target
  if (dist > 0.3) {
    const dx = (tx - px) / dist;
    const dz = (tz - pz) / dist;
    const step = npc.speed * dt;
    updates.position = [
      px + dx * Math.min(step, dist),
      py,
      pz + dz * Math.min(step, dist),
    ];
    if (npc.state === 'idle') {
      updates.state = 'walking';
    }
    return updates;
  }

  const totalItems = npc.inventory.reduce((s, i) => s + i.count, 0);

  switch (npc.state) {
    case 'idle':
    case 'walking': {
      // Builders try to build if there's a project
      if (npc.role === 'builder') {
        const project = buildProjects.find((p) => !p.completed);
        if (project && project.placedCount < project.blocks.length) {
          const block = project.blocks[project.placedCount];
          updates.target = [block.x + 0.5, py, block.z + 0.5];
          updates.state = 'building';
          updates.workTarget = [block.x, block.y, block.z];
          updates.buildIndex = project.placedCount;
          return updates;
        }
      }

      // Others gather materials
      if (totalItems < npc.inventoryCapacity) {
        const targets = getGatherTargets(npc.role);
        const found = findNearbyBlock(getBlock, px, py, pz, targets, 8);
        if (found) {
          updates.target = [found[0] + 0.5, py, found[2] + 0.5];
          updates.state = 'gathering';
          updates.workTarget = found;
          return updates;
        }
      }

      // If full inventory, return home
      if (totalItems >= npc.inventoryCapacity) {
        updates.target = [...npc.homePosition] as [number, number, number];
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
      // Gathering animation timer
      const newTimer = npc.gatherTimer + dt;
      if (newTimer >= 1.5) {
        // Harvest the block
        const [bx, by, bz] = npc.workTarget;
        const bt = getBlock(bx, by, bz);
        if (bt !== BlockType.AIR) {
          setBlock(bx, by, bz, BlockType.AIR);
          const drop = getDropType(npc.role);
          const existingSlot = npc.inventory.find((i) => i.type === drop);
          if (existingSlot) {
            existingSlot.count++;
          } else {
            npc.inventory.push({ type: drop, count: 1 });
          }
          updates.inventory = [...npc.inventory];
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

    case 'returning': {
      // Drop off items at home
      updates.inventory = [];
      updates.state = 'idle';
      return updates;
    }
  }

  return updates;
}

// NPC label colors by role
const ROLE_LABELS: Record<NPCRole, string> = {
  lumberjack: 'Drwal',
  miner: 'Górnik',
  builder: 'Budowniczy',
  farmer: 'Rolnik',
};

export function VillageNPCs({ center }: { center: [number, number, number] }) {
  const npcs = useNPCStore((s) => s.npcs);
  const buildProjects = useNPCStore((s) => s.buildProjects);
  const updateNPC = useNPCStore((s) => s.updateNPC);
  const completeBuildBlock = useNPCStore((s) => s.completeBuildBlock);
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
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;

    for (const npc of npcs) {
      const updates = tickNPC(npc, dt, getBlock, setBlock, buildProjects, completeBuildBlock);
      if (Object.keys(updates).length > 0) {
        updateNPC(npc.id, updates);
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

        // Walking bounce
        const isMoving = npc.state === 'walking' || npc.state === 'gathering' || npc.state === 'returning';
        const bounce = isMoving ? Math.abs(Math.sin(t * 6 + npc.phase)) * 0.08 : 0;

        // Working bob
        const workBob = (npc.state === 'gathering' || npc.state === 'building')
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
