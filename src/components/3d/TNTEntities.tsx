import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock, isSolid, needsSupportFromBelow } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';
import { CHUNK_HEIGHT } from '../../utils/constants';

interface TNTEntity {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseTime: number; // remaining fuse in seconds
  flashPhase: number; // for blinking effect
  grounded: boolean;
}

let tntIdCounter = 0;

const TNT_RADIUS = 3;
const TNT_PUSH_FORCE = 8;
const GRAVITY = 20;
const BOUNCE_DAMPING = 0.4;
const FRICTION = 0.98;

// Global registry of active TNT entities for chain reactions
const activeTNTEntities: { current: TNTEntity[] } = { current: [] };

export function buildTNTGeometry(): THREE.BufferGeometry {
  const allPos: number[] = [];
  const allNorm: number[] = [];
  const allCol: number[] = [];
  const allIdx: number[] = [];
  let vOff = 0;

  const bodyColor = new THREE.Color(0xcc2222);
  const bandColor = new THREE.Color(0x222222);
  const topColor = new THREE.Color(0xdddddd);

  // Main TNT body
  const body = new THREE.BoxGeometry(0.85, 0.85, 0.85);

  // Dark bands around TNT
  const bandH = new THREE.BoxGeometry(0.87, 0.1, 0.87);
  bandH.translate(0, 0.2, 0);
  const bandH2 = new THREE.BoxGeometry(0.87, 0.1, 0.87);
  bandH2.translate(0, -0.2, 0);

  // Top circle (fuse area)
  const top = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8);
  top.translate(0, 0.44, 0);

  const parts: [THREE.BufferGeometry, THREE.Color][] = [
    [body, bodyColor],
    [bandH, bandColor],
    [bandH2, bandColor],
    [top, topColor],
  ];

  for (const [geo, col] of parts) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const idx = geo.index!;
    for (let i = 0; i < pos.count; i++) {
      allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      const v = (Math.random() - 0.5) * 0.03;
      allCol.push(
        Math.max(0, Math.min(1, col.r + v)),
        Math.max(0, Math.min(1, col.g + v)),
        Math.max(0, Math.min(1, col.b + v)),
      );
    }
    for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
    vOff += pos.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  merged.setIndex(allIdx);
  merged.computeBoundingSphere();
  return merged;
}

function TNTMesh({ tnt }: { tnt: TNTEntity }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshLambertMaterial>(null);

  const geometry = useMemo(() => buildTNTGeometry(), []);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(tnt.position);

    // Blinking white effect as fuse burns - faster as it gets closer to detonation
    const blinkRate = 4 + (1.5 - tnt.fuseTime) * 8;
    const blink = Math.sin(tnt.fuseTime * blinkRate * Math.PI * 2) > 0.3;
    if (materialRef.current) {
      materialRef.current.emissive.setHex(blink ? 0xffffff : 0x000000);
      materialRef.current.emissiveIntensity = blink ? 0.6 : 0;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow>
        <meshLambertMaterial ref={materialRef} vertexColors />
      </mesh>
    </group>
  );
}

function explodeTNT(tnt: TNTEntity, store: ReturnType<typeof useWorldStore.getState>) {
  const tx = Math.floor(tnt.position.x);
  const ty = Math.floor(tnt.position.y);
  const tz = Math.floor(tnt.position.z);
  const cx = tnt.position.x;
  const cy = tnt.position.y;
  const cz = tnt.position.z;

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
        const block = store.getBlock(bx, by, bz);
        if (block === BlockType.AIR) continue;
        const def = getBlock(block);
        if (def.hardness === Infinity) continue;
        // Chain TNT: spawn new TNT entity
        if (def.isTNT) {
          window.dispatchEvent(new CustomEvent('digy:spawnTNTEntity', {
            detail: {
              x: bx + 0.5, y: by + 0.5, z: bz + 0.5,
              fuseTime: 0.3 + Math.random() * 0.4,
              // Push away from explosion center
              vx: (bx + 0.5 - cx) * 3,
              vy: 4 + Math.random() * 3,
              vz: (bz + 0.5 - cz) * 3,
            }
          }));
          store.setBlock(bx, by, bz, BlockType.AIR);
          continue;
        }
        store.setBlock(bx, by, bz, BlockType.AIR);
      }
    }
  }

  // Destroy unsupported blocks above
  for (let dx = -TNT_RADIUS; dx <= TNT_RADIUS; dx++) {
    for (let dz = -TNT_RADIUS; dz <= TNT_RADIUS; dz++) {
      for (let dy = -TNT_RADIUS; dy <= TNT_RADIUS; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > TNT_RADIUS) continue;
        const checkX = tx + dx;
        const checkZ = tz + dz;
        let curY = ty + dy + 1;
        while (curY < CHUNK_HEIGHT) {
          const above = store.getBlock(checkX, curY, checkZ);
          if (!needsSupportFromBelow(above)) break;
          store.setBlock(checkX, curY, checkZ, BlockType.AIR);
          const aboveDef = getBlock(above);
          if (aboveDef.isDoor && !aboveDef.doorUpper) {
            store.setBlock(checkX, curY + 1, checkZ, BlockType.AIR);
            curY += 2;
          } else {
            curY++;
          }
        }
      }
    }
  }

  // Push other TNT entities away
  for (const other of activeTNTEntities.current) {
    if (other === tnt) continue;
    const dx = other.position.x - cx;
    const dy = other.position.y - cy;
    const dz = other.position.z - cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const maxDist = TNT_RADIUS + 3;
    if (distSq < maxDist * maxDist && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      const force = TNT_PUSH_FORCE * (1 - dist / maxDist);
      other.velocity.x += (dx / dist) * force;
      other.velocity.y += (dy / dist) * force * 0.7 + 3;
      other.velocity.z += (dz / dist) * force;
    }
  }

  // Spawn explosion particles + shockwave
  window.dispatchEvent(new CustomEvent('digy:explosion', {
    detail: { x: cx, y: cy, z: cz, radius: TNT_RADIUS }
  }));
}

export function TNTEntities() {
  const tntRef = useRef<TNTEntity[]>([]);
  const [, setVersion] = useState(0);

  // Keep global ref in sync
  activeTNTEntities.current = tntRef.current;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const entity: TNTEntity = {
        id: tntIdCounter++,
        position: new THREE.Vector3(detail.x, detail.y, detail.z),
        velocity: new THREE.Vector3(
          detail.vx ?? (Math.random() - 0.5) * 2,
          detail.vy ?? 5 + Math.random() * 2,
          detail.vz ?? (Math.random() - 0.5) * 2,
        ),
        fuseTime: detail.fuseTime ?? 1.5,
        flashPhase: 0,
        grounded: false,
      };
      tntRef.current.push(entity);
      setVersion((v) => v + 1);
    };

    window.addEventListener('digy:spawnTNTEntity', handler);
    return () => window.removeEventListener('digy:spawnTNTEntity', handler);
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const store = useWorldStore.getState();
    let changed = false;

    for (let i = tntRef.current.length - 1; i >= 0; i--) {
      const tnt = tntRef.current[i];

      // Update fuse
      tnt.fuseTime -= delta;
      tnt.flashPhase += delta;

      if (tnt.fuseTime <= 0) {
        // Explode!
        explodeTNT(tnt, store);
        tntRef.current.splice(i, 1);
        changed = true;
        continue;
      }

      // Gravity
      tnt.velocity.y -= GRAVITY * delta;

      // Air friction
      tnt.velocity.x *= FRICTION;
      tnt.velocity.z *= FRICTION;

      // Move
      const newX = tnt.position.x + tnt.velocity.x * delta;
      const newY = tnt.position.y + tnt.velocity.y * delta;
      const newZ = tnt.position.z + tnt.velocity.z * delta;

      // Simple collision with world blocks
      const bx = Math.floor(newX);
      const by = Math.floor(newY - 0.42);
      const bz = Math.floor(newZ);

      // Ground collision
      const blockBelow = store.getBlock(bx, by, bz);
      if (isSolid(blockBelow) && tnt.velocity.y < 0) {
        tnt.position.y = by + 1 + 0.43;
        tnt.velocity.y = -tnt.velocity.y * BOUNCE_DAMPING;
        if (Math.abs(tnt.velocity.y) < 0.5) {
          tnt.velocity.y = 0;
          tnt.grounded = true;
        }
        tnt.position.x = newX;
        tnt.position.z = newZ;
      } else {
        tnt.position.x = newX;
        tnt.position.y = newY;
        tnt.position.z = newZ;
        tnt.grounded = false;
      }

      // Horizontal wall collisions
      const wallCheckX = Math.floor(tnt.position.x + Math.sign(tnt.velocity.x) * 0.43);
      const wallCheckY = Math.floor(tnt.position.y);
      const wallCheckZ = Math.floor(tnt.position.z);
      if (isSolid(store.getBlock(wallCheckX, wallCheckY, wallCheckZ))) {
        tnt.velocity.x = -tnt.velocity.x * BOUNCE_DAMPING;
        tnt.position.x -= tnt.velocity.x * delta;
      }

      const wallCheckZ2 = Math.floor(tnt.position.z + Math.sign(tnt.velocity.z) * 0.43);
      if (isSolid(store.getBlock(Math.floor(tnt.position.x), wallCheckY, wallCheckZ2))) {
        tnt.velocity.z = -tnt.velocity.z * BOUNCE_DAMPING;
        tnt.position.z -= tnt.velocity.z * delta;
      }

      // TNT-to-TNT collision
      for (let j = i + 1; j < tntRef.current.length; j++) {
        const other = tntRef.current[j];
        const dx = other.position.x - tnt.position.x;
        const dy = other.position.y - tnt.position.y;
        const dz = other.position.z - tnt.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = 0.85;
        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          // Separate
          const overlap = (minDist - dist) * 0.5;
          tnt.position.x -= nx * overlap;
          tnt.position.y -= ny * overlap;
          tnt.position.z -= nz * overlap;
          other.position.x += nx * overlap;
          other.position.y += ny * overlap;
          other.position.z += nz * overlap;

          // Elastic bounce
          const relVelN =
            (tnt.velocity.x - other.velocity.x) * nx +
            (tnt.velocity.y - other.velocity.y) * ny +
            (tnt.velocity.z - other.velocity.z) * nz;
          if (relVelN > 0) {
            tnt.velocity.x -= relVelN * nx * 0.5;
            tnt.velocity.y -= relVelN * ny * 0.5;
            tnt.velocity.z -= relVelN * nz * 0.5;
            other.velocity.x += relVelN * nx * 0.5;
            other.velocity.y += relVelN * ny * 0.5;
            other.velocity.z += relVelN * nz * 0.5;
          }
        }
      }

      // Remove if fell out of world
      if (tnt.position.y < -20) {
        tntRef.current.splice(i, 1);
        changed = true;
      }
    }

    if (changed) setVersion((v) => v + 1);
  });

  return (
    <group>
      {tntRef.current.map((tnt) => (
        <TNTMesh key={tnt.id} tnt={tnt} />
      ))}
    </group>
  );
}
