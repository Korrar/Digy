import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE } from '../../utils/constants';

interface AmbientParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  type: 'smoke' | 'lava_spark' | 'rail_spark';
}

const MAX_AMBIENT_PARTICLES = 300;
const EMIT_INTERVAL = 0.15; // seconds between emission checks

export function AmbientParticles({ center }: { center: [number, number, number] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<AmbientParticle[]>([]);
  const emitTimerRef = useRef(0);
  const getBlock_ = useWorldStore((s) => s.getBlock);
  const chunks = useWorldStore((s) => s.chunks);

  const positionArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES * 3), []);
  const colorArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES * 3), []);
  const sizeArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES), []);

  // Cache emitter positions (recalculate when chunks change)
  const emitters = useMemo(() => {
    const result: { x: number; y: number; z: number; type: 'smoke' | 'lava_spark' | 'rail_spark' }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      const ox = cx * CHUNK_SIZE;
      const oz = cz * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let ly = 0; ly < 32; ly++) {
            const bt = entry.data.getBlock(lx, ly, lz);
            if (bt === BlockType.TORCH) {
              result.push({ x: ox + lx + 0.5, y: ly + 0.9, z: oz + lz + 0.5, type: 'smoke' });
            } else if (bt === BlockType.LAVA) {
              // Only emit from surface lava (air above)
              const above = ly < 31 ? entry.data.getBlock(lx, ly + 1, lz) : BlockType.AIR;
              if (above === BlockType.AIR) {
                result.push({ x: ox + lx + 0.5, y: ly + 1.0, z: oz + lz + 0.5, type: 'lava_spark' });
              }
            } else if (bt === BlockType.POWERED_RAIL) {
              result.push({ x: ox + lx + 0.5, y: ly + 0.1, z: oz + lz + 0.5, type: 'rail_spark' });
            } else if (bt === BlockType.MAGMA) {
              const above = ly < 31 ? entry.data.getBlock(lx, ly + 1, lz) : BlockType.AIR;
              if (above === BlockType.AIR) {
                result.push({ x: ox + lx + 0.5, y: ly + 1.0, z: oz + lz + 0.5, type: 'lava_spark' });
              }
            }
          }
        }
      }
    });
    return result;
  }, [chunks]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const points = pointsRef.current;
    if (!points) return;

    const particles = particlesRef.current;

    // Emit new particles
    emitTimerRef.current += delta;
    if (emitTimerRef.current >= EMIT_INTERVAL && emitters.length > 0) {
      emitTimerRef.current = 0;

      // Pick random emitters to spawn from
      const maxSpawn = Math.min(3, MAX_AMBIENT_PARTICLES - particles.length);
      for (let i = 0; i < maxSpawn; i++) {
        const emitter = emitters[Math.floor(Math.random() * emitters.length)];
        // Only emit if close to center (optimization)
        const dx = emitter.x - center[0];
        const dz = emitter.z - center[2];
        if (dx * dx + dz * dz > 20 * 20) continue;

        switch (emitter.type) {
          case 'smoke':
            particles.push({
              x: emitter.x + (Math.random() - 0.5) * 0.15,
              y: emitter.y,
              z: emitter.z + (Math.random() - 0.5) * 0.15,
              vx: (Math.random() - 0.5) * 0.2,
              vy: 0.5 + Math.random() * 0.5,
              vz: (Math.random() - 0.5) * 0.2,
              life: 1.0 + Math.random() * 0.5,
              maxLife: 1.5,
              type: 'smoke',
            });
            break;
          case 'lava_spark':
            if (Math.random() < 0.3) { // Less frequent
              particles.push({
                x: emitter.x + (Math.random() - 0.5) * 0.8,
                y: emitter.y,
                z: emitter.z + (Math.random() - 0.5) * 0.8,
                vx: (Math.random() - 0.5) * 1.5,
                vy: 1.5 + Math.random() * 2,
                vz: (Math.random() - 0.5) * 1.5,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                type: 'lava_spark',
              });
            }
            break;
          case 'rail_spark':
            if (Math.random() < 0.15) { // Rare
              particles.push({
                x: emitter.x + (Math.random() - 0.5) * 0.3,
                y: emitter.y,
                z: emitter.z + (Math.random() - 0.5) * 0.3,
                vx: (Math.random() - 0.5) * 2,
                vy: 0.5 + Math.random() * 1,
                vz: (Math.random() - 0.5) * 2,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5,
                type: 'rail_spark',
              });
            }
            break;
        }
      }
    }

    // Update particles
    const geo = points.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const sizeAttr = geo.attributes.size as THREE.BufferAttribute;

    let alive = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Physics
      if (p.type === 'lava_spark') {
        p.vy -= 5 * delta; // gravity
      } else if (p.type === 'smoke') {
        p.vy *= 0.98; // decelerate
        p.vx += (Math.random() - 0.5) * 0.5 * delta; // drift
        p.vz += (Math.random() - 0.5) * 0.5 * delta;
      } else if (p.type === 'rail_spark') {
        p.vy -= 8 * delta;
      }

      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
    }

    // Write to buffers
    for (let i = 0; i < MAX_AMBIENT_PARTICLES; i++) {
      if (i < particles.length) {
        const p = particles[i];
        const t = p.life / p.maxLife;
        posAttr.array[i * 3] = p.x;
        posAttr.array[i * 3 + 1] = p.y;
        posAttr.array[i * 3 + 2] = p.z;

        if (p.type === 'smoke') {
          const alpha = t * 0.6;
          colAttr.array[i * 3] = 0.3 * alpha;
          colAttr.array[i * 3 + 1] = 0.3 * alpha;
          colAttr.array[i * 3 + 2] = 0.35 * alpha;
          sizeAttr.array[i] = 0.08 + (1 - t) * 0.12;
        } else if (p.type === 'lava_spark') {
          colAttr.array[i * 3] = 1.0 * t;
          colAttr.array[i * 3 + 1] = 0.4 * t;
          colAttr.array[i * 3 + 2] = 0.0;
          sizeAttr.array[i] = 0.06 * t;
        } else {
          colAttr.array[i * 3] = 1.0 * t;
          colAttr.array[i * 3 + 1] = 0.8 * t;
          colAttr.array[i * 3 + 2] = 0.2 * t;
          sizeAttr.array[i] = 0.04 * t;
        }
        alive++;
      } else {
        posAttr.array[i * 3] = 0;
        posAttr.array[i * 3 + 1] = -1000;
        posAttr.array[i * 3 + 2] = 0;
        colAttr.array[i * 3] = 0;
        colAttr.array[i * 3 + 1] = 0;
        colAttr.array[i * 3 + 2] = 0;
        sizeAttr.array[i] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positionArray, 3]} />
        <bufferAttribute attach="attributes-color" args={[colorArray, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizeArray, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.1}
        transparent
        opacity={0.8}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
