import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface AnimalConfig {
  count: number;
  bodyColor: number;
  headColor: number;
  legColor: number;
  size: number;
  speed: number;
  bounceHeight: number;
  bodyScale: [number, number, number]; // w, h, d
  headScale: [number, number, number];
  headOffset: [number, number, number];
  legLength: number;
}

const BIOME_ANIMALS: Record<string, AnimalConfig> = {
  forest: {
    // Rabbits - small body, round head, short legs
    count: 6, bodyColor: 0xb8945a, headColor: 0xc9a56b, legColor: 0x8b7340,
    size: 0.35, speed: 0.5, bounceHeight: 0.15,
    bodyScale: [0.5, 0.45, 0.7], headScale: [0.35, 0.35, 0.3],
    headOffset: [0, 0.25, 0.4], legLength: 0.2,
  },
  desert: {
    // Lizards - flat body, small head, very short legs
    count: 4, bodyColor: 0x8b7355, headColor: 0x9e8560, legColor: 0x6b5340,
    size: 0.25, speed: 0.7, bounceHeight: 0.03,
    bodyScale: [0.35, 0.15, 0.9], headScale: [0.2, 0.15, 0.25],
    headOffset: [0, 0.02, 0.55], legLength: 0.1,
  },
  mountains: {
    // Goats - stocky body, blocky head
    count: 4, bodyColor: 0xd0d0d0, headColor: 0xc0b8a8, legColor: 0x8a8070,
    size: 0.4, speed: 0.35, bounceHeight: 0.12,
    bodyScale: [0.5, 0.55, 0.8], headScale: [0.3, 0.35, 0.35],
    headOffset: [0, 0.15, 0.5], legLength: 0.35,
  },
  swamp: {
    // Frogs - wide body, big head, tiny legs
    count: 5, bodyColor: 0x4a8a2d, headColor: 0x5aaa3d, legColor: 0x3a6a1d,
    size: 0.3, speed: 0.4, bounceHeight: 0.25,
    bodyScale: [0.55, 0.3, 0.5], headScale: [0.45, 0.25, 0.3],
    headOffset: [0, 0.05, 0.35], legLength: 0.15,
  },
  tundra: {
    // Arctic foxes - sleek body, pointy head
    count: 3, bodyColor: 0xf0ece0, headColor: 0xf5f0e8, legColor: 0xd0c8b8,
    size: 0.35, speed: 0.5, bounceHeight: 0.08,
    bodyScale: [0.4, 0.4, 0.75], headScale: [0.28, 0.28, 0.35],
    headOffset: [0, 0.1, 0.48], legLength: 0.25,
  },
  jungle: {
    // Parrots - small colorful birds
    count: 5, bodyColor: 0x22aa44, headColor: 0xcc2222, legColor: 0x444444,
    size: 0.25, speed: 0.6, bounceHeight: 0.2,
    bodyScale: [0.3, 0.35, 0.5], headScale: [0.22, 0.22, 0.2],
    headOffset: [0, 0.2, 0.3], legLength: 0.12,
  },
  mushroom: {
    // Mooshrooms - cow-like, mushroom colored
    count: 3, bodyColor: 0xcc3333, headColor: 0xcc4444, legColor: 0x666666,
    size: 0.5, speed: 0.2, bounceHeight: 0.05,
    bodyScale: [0.6, 0.55, 0.9], headScale: [0.4, 0.4, 0.4],
    headOffset: [0, 0.15, 0.55], legLength: 0.35,
  },
  savanna: {
    // Zebras - tall, striped (shown by colors)
    count: 4, bodyColor: 0xf0f0f0, headColor: 0xe0e0e0, legColor: 0x333333,
    size: 0.5, speed: 0.45, bounceHeight: 0.08,
    bodyScale: [0.45, 0.55, 0.9], headScale: [0.3, 0.4, 0.45],
    headOffset: [0, 0.25, 0.6], legLength: 0.45,
  },
  cherry: {
    // Butterflies - tiny, colorful
    count: 8, bodyColor: 0xff88aa, headColor: 0xffaacc, legColor: 0x664444,
    size: 0.15, speed: 0.3, bounceHeight: 0.3,
    bodyScale: [0.2, 0.1, 0.3], headScale: [0.12, 0.1, 0.12],
    headOffset: [0, 0.02, 0.18], legLength: 0.05,
  },
};

/**
 * Build a merged geometry for a voxel-style animal (body + head + 4 legs).
 */
function buildAnimalGeometry(config: AnimalConfig): THREE.BufferGeometry {
  const parts: THREE.BoxGeometry[] = [];
  const matrices: THREE.Matrix4[] = [];

  // Body
  const body = new THREE.BoxGeometry(config.bodyScale[0], config.bodyScale[1], config.bodyScale[2]);
  const bodyMat = new THREE.Matrix4().makeTranslation(0, config.legLength + config.bodyScale[1] / 2, 0);
  parts.push(body);
  matrices.push(bodyMat);

  // Head
  const head = new THREE.BoxGeometry(config.headScale[0], config.headScale[1], config.headScale[2]);
  const headMat = new THREE.Matrix4().makeTranslation(
    config.headOffset[0],
    config.legLength + config.bodyScale[1] / 2 + config.headOffset[1],
    config.headOffset[2]
  );
  parts.push(head);
  matrices.push(headMat);

  // 4 Legs (corners of body)
  const legGeo = new THREE.BoxGeometry(0.1, config.legLength, 0.1);
  const offsets = [
    [-config.bodyScale[0] * 0.35, 0, -config.bodyScale[2] * 0.3],
    [config.bodyScale[0] * 0.35, 0, -config.bodyScale[2] * 0.3],
    [-config.bodyScale[0] * 0.35, 0, config.bodyScale[2] * 0.3],
    [config.bodyScale[0] * 0.35, 0, config.bodyScale[2] * 0.3],
  ];
  for (const off of offsets) {
    const leg = legGeo.clone();
    const legM = new THREE.Matrix4().makeTranslation(off[0], config.legLength / 2, off[2]);
    parts.push(leg);
    matrices.push(legM);
  }

  // Merge all parts
  const merged = new THREE.BufferGeometry();
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allColors: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  const bodyCol = new THREE.Color(config.bodyColor);
  const headCol = new THREE.Color(config.headColor);
  const legCol = new THREE.Color(config.legColor);

  for (let p = 0; p < parts.length; p++) {
    const geo = parts[p].clone();
    geo.applyMatrix4(matrices[p]);

    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const idx = geo.index!;

    const col = p === 0 ? bodyCol : p === 1 ? headCol : legCol;

    for (let i = 0; i < pos.count; i++) {
      allPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      // Per-vertex color with slight variation for texture feel
      const variation = (Math.random() - 0.5) * 0.08;
      allColors.push(
        Math.max(0, Math.min(1, col.r + variation)),
        Math.max(0, Math.min(1, col.g + variation)),
        Math.max(0, Math.min(1, col.b + variation)),
      );
    }

    for (let i = 0; i < idx.count; i++) {
      allIndices.push(idx.getX(i) + vertexOffset);
    }
    vertexOffset += pos.count;

    geo.dispose();
  }

  // Dispose originals
  for (const g of parts) g.dispose();

  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
  merged.setIndex(allIndices);
  merged.computeBoundingSphere();

  return merged;
}

interface Animal {
  position: THREE.Vector3;
  target: THREE.Vector3;
  phase: number;
  speed: number;
}

export function useAnimals(biomeType: string, center: [number, number, number]) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const config = BIOME_ANIMALS[biomeType];

  const geometry = useMemo(() => {
    if (!config) return null;
    return buildAnimalGeometry(config);
  }, [config]);

  const animals = useMemo(() => {
    if (!config) return [];
    const list: Animal[] = [];
    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2;
      const radius = 3 + Math.random() * 5;
      const pos = new THREE.Vector3(
        center[0] + Math.cos(angle) * radius,
        center[1] + 1,
        center[2] + Math.sin(angle) * radius
      );
      list.push({
        position: pos.clone(),
        target: pos.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: config.speed * (0.8 + Math.random() * 0.4),
      });
    }
    return list;
  }, [config, center[0], center[1], center[2]]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !config) return;

    const t = state.clock.elapsedTime;

    for (let i = 0; i < animals.length; i++) {
      const animal = animals[i];

      // Random walk: pick new target when close
      const distToTarget = animal.position.distanceTo(animal.target);
      if (distToTarget < 0.3) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * 4;
        animal.target.set(
          center[0] + Math.cos(angle) * dist,
          center[1] + 1,
          center[2] + Math.sin(angle) * dist
        );
      }

      // Move toward target
      const dir = animal.target.clone().sub(animal.position).normalize();
      animal.position.addScaledVector(dir, animal.speed * 0.016);

      // Bounce animation
      const bounce = Math.abs(Math.sin(t * 4 + animal.phase)) * config.bounceHeight;

      dummy.position.set(
        animal.position.x,
        animal.position.y + bounce,
        animal.position.z
      );

      // Face movement direction
      if (dir.lengthSq() > 0.001) {
        dummy.lookAt(
          animal.position.x + dir.x,
          animal.position.y + bounce,
          animal.position.z + dir.z
        );
      }

      dummy.scale.setScalar(config.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return { meshRef, geometry, count: config?.count ?? 0 };
}

export function getAnimalName(biomeType: string): string {
  switch (biomeType) {
    case 'forest': return 'Króliki';
    case 'desert': return 'Jaszczurki';
    case 'mountains': return 'Kozy';
    case 'swamp': return 'Żaby';
    case 'tundra': return 'Lisy polarne';
    default: return '';
  }
}

export { BIOME_ANIMALS };
