import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleBurst {
  id: number;
  position: THREE.Vector3;
  color: THREE.Color;
  startTime: number;
}

const PARTICLE_COUNT = 12;
const PARTICLE_LIFE = 0.6;

let nextId = 0;
const activeBursts: ParticleBurst[] = [];

export function spawnParticles(x: number, y: number, z: number, color: THREE.Color) {
  activeBursts.push({
    id: nextId++,
    position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
    color: color.clone(),
    startTime: -1, // set on first frame
  });
  if (activeBursts.length > 8) {
    activeBursts.shift();
  }
}

export function MiningParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particleData = useMemo(() => {
    const velocities: THREE.Vector3[] = [];
    const burstIndices: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT * 8; i++) {
      velocities.push(new THREE.Vector3());
      burstIndices.push(-1);
    }
    return { velocities, burstIndices };
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const time = state.clock.elapsedTime;

    // Init new bursts
    for (const burst of activeBursts) {
      if (burst.startTime < 0) {
        burst.startTime = time;
        const baseIdx = (burst.id % 8) * PARTICLE_COUNT;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const idx = baseIdx + i;
          particleData.burstIndices[idx] = burst.id;
          particleData.velocities[idx].set(
            (Math.random() - 0.5) * 3,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 3,
          );
        }
      }
    }

    let instanceIdx = 0;
    const color = new THREE.Color();

    for (const burst of activeBursts) {
      const elapsed = time - burst.startTime;
      if (elapsed > PARTICLE_LIFE || burst.startTime < 0) continue;

      const baseIdx = (burst.id % 8) * PARTICLE_COUNT;
      const t = elapsed / PARTICLE_LIFE;
      const scale = Math.max(0.05, 0.12 * (1 - t));

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const vel = particleData.velocities[baseIdx + i];
        if (particleData.burstIndices[baseIdx + i] !== burst.id) continue;

        dummy.position.set(
          burst.position.x + vel.x * elapsed,
          burst.position.y + vel.y * elapsed - 4.9 * elapsed * elapsed,
          burst.position.z + vel.z * elapsed,
        );
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(instanceIdx, dummy.matrix);
        color.copy(burst.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        mesh.setColorAt(instanceIdx, color);
        instanceIdx++;
      }
    }

    // Hide remaining instances
    for (let i = instanceIdx; i < PARTICLE_COUNT * 8; i++) {
      dummy.position.set(0, -100, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Cleanup old bursts
    while (activeBursts.length > 0 && time - activeBursts[0].startTime > PARTICLE_LIFE) {
      activeBursts.shift();
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT * 8]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
