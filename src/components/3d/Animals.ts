import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface AnimalConfig {
  count: number;
  color: number;
  size: number;
  speed: number;
  bounceHeight: number;
}

const BIOME_ANIMALS: Record<string, AnimalConfig> = {
  forest: { count: 6, color: 0xb8945a, size: 0.25, speed: 0.4, bounceHeight: 0.1 }, // rabbits
  desert: { count: 4, color: 0x8b7355, size: 0.15, speed: 0.6, bounceHeight: 0.05 }, // lizards
  mountains: { count: 4, color: 0xdedede, size: 0.3, speed: 0.3, bounceHeight: 0.15 }, // goats
  swamp: { count: 5, color: 0x4a8a2d, size: 0.2, speed: 0.5, bounceHeight: 0.2 }, // frogs
  tundra: { count: 3, color: 0xf0f0f0, size: 0.25, speed: 0.45, bounceHeight: 0.08 }, // arctic foxes
};

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

  return { meshRef, count: config?.count ?? 0, color: config?.color ?? 0xffffff };
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
