import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 200;
const PARTICLES_PER_HIT = 8;
const PARTICLES_PER_BREAK = 24;

export function DiggingParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particlesRef = useRef<Particle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorArray = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const particles = particlesRef.current;
    let visibleCount = 0;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Gravity
      p.velocity.y -= 12 * delta;
      p.position.addScaledVector(p.velocity, delta);

      const scale = Math.max(0.05, (p.life / p.maxLife) * 0.15);
      dummy.position.copy(p.position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(visibleCount, dummy.matrix);
      visibleCount++;
    }

    // Hide remaining instances
    for (let i = visibleCount; i < MAX_PARTICLES; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_PARTICLES;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial vertexColors={false} />
    </instancedMesh>
  );
}

export function emitDigParticles(
  particlesRef: React.MutableRefObject<Particle[]>,
  meshRef: React.MutableRefObject<THREE.InstancedMesh | null>,
  position: [number, number, number],
  blockType: BlockType,
  isFinalBreak: boolean
) {
  const def = getBlock(blockType);
  const color = def.topColor ?? def.color;
  const count = isFinalBreak ? PARTICLES_PER_BREAK : PARTICLES_PER_HIT;

  for (let i = 0; i < count; i++) {
    if (particlesRef.current.length >= MAX_PARTICLES) break;

    const speed = isFinalBreak ? 4 : 2;
    const life = isFinalBreak ? 0.6 + Math.random() * 0.4 : 0.3 + Math.random() * 0.2;

    particlesRef.current.push({
      position: new THREE.Vector3(
        position[0] + 0.5 + (Math.random() - 0.5) * 0.6,
        position[1] + 0.5 + (Math.random() - 0.5) * 0.6,
        position[2] + 0.5 + (Math.random() - 0.5) * 0.6
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 1,
        (Math.random() - 0.5) * speed
      ),
      life,
      maxLife: life,
    });
  }

  // Update instanced mesh colors
  if (meshRef.current) {
    const tempColor = new THREE.Color();
    for (let i = 0; i < particlesRef.current.length; i++) {
      // Slight color variation
      tempColor.copy(color);
      tempColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      meshRef.current.setColorAt(i, tempColor);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }
}

// Standalone component that manages its own particles
export function ParticleSystem() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particlesRef = useRef<Particle[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const particles = particlesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 12 * delta;
      p.position.addScaledVector(p.velocity, delta);
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < particles.length) {
        const p = particles[i];
        const scale = Math.max(0.05, (p.life / p.maxLife) * 0.15);
        dummy.position.copy(p.position);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // Expose refs globally for the interaction system to use
  (window as any).__digyParticles = { meshRef, particlesRef };

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

// Helper to spawn particles from anywhere
export function spawnParticles(
  position: [number, number, number],
  blockType: BlockType,
  isFinalBreak: boolean
) {
  const sys = (window as any).__digyParticles;
  if (!sys) return;
  emitDigParticles(sys.particlesRef, sys.meshRef, position, blockType, isFinalBreak);
}
