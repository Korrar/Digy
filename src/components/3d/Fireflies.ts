import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FIREFLY_COUNT = 40;

interface Firefly {
  basePosition: THREE.Vector3;
  phase: number;
  speed: number;
  radius: number;
  heightOffset: number;
}

const LIGHT_COUNT = 5;

export function useFireflies(center: [number, number, number], enabled: boolean) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRefs = useRef<(THREE.PointLight | null)[]>(new Array(LIGHT_COUNT).fill(null));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fireflies = useMemo(() => {
    if (!enabled) return [];
    const flies: Firefly[] = [];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      flies.push({
        basePosition: new THREE.Vector3(
          center[0] + (Math.random() - 0.5) * 14,
          center[1] + 2 + Math.random() * 10,
          center[2] + (Math.random() - 0.5) * 14
        ),
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        radius: 0.5 + Math.random() * 1.5,
        heightOffset: Math.random() * Math.PI * 2,
      });
    }
    return flies;
  }, [center[0], center[1], center[2], enabled]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !enabled) return;

    const t = state.clock.elapsedTime;
    const color = new THREE.Color();

    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];

      // Circular floating motion
      const x = f.basePosition.x + Math.sin(t * f.speed + f.phase) * f.radius;
      const y = f.basePosition.y + Math.sin(t * f.speed * 0.7 + f.heightOffset) * 0.8;
      const z = f.basePosition.z + Math.cos(t * f.speed + f.phase) * f.radius;

      // Pulsing glow (blink on/off)
      const glow = Math.pow(Math.max(0, Math.sin(t * 2.5 + f.phase * 3)), 2);
      const scale = 0.04 + glow * 0.06;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Yellow-green glow color
      color.setRGB(0.6 + glow * 0.4, 0.8 + glow * 0.2, 0.1);
      mesh.setColorAt(i, color);

      // Update point lights for the first LIGHT_COUNT fireflies
      if (i < LIGHT_COUNT) {
        const light = lightRefs.current[i];
        if (light) {
          light.position.set(x, y, z);
          light.intensity = glow * 0.6;
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return { meshRef, lightRefs, count: enabled ? FIREFLY_COUNT : 0 };
}

export { FIREFLY_COUNT };
