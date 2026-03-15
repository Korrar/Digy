import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType } from '../../core/voxel/BlockRegistry';
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
  type: 'smoke' | 'lava_spark' | 'rail_spark' | 'ember' | 'tnt_spark' | 'explosion' | 'explosion_smoke' | 'explosion_flash' | 'shockwave';
}

const MAX_AMBIENT_PARTICLES = 500;
const EMIT_INTERVAL = 0.15; // seconds between emission checks

export function AmbientParticles({ center }: { center: [number, number, number] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<AmbientParticle[]>([]);
  const emitTimerRef = useRef(0);
  const chunks = useWorldStore((s) => s.chunks);

  const positionArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES * 3), []);
  const colorArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES * 3), []);
  const sizeArray = useMemo(() => new Float32Array(MAX_AMBIENT_PARTICLES), []);

  // Cache emitter positions (recalculate when chunks change)
  const emitters = useMemo(() => {
    const result: { x: number; y: number; z: number; type: 'smoke' | 'lava_spark' | 'rail_spark' | 'ember' }[] = [];
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
              result.push({ x: ox + lx + 0.5, y: ly + 0.85, z: oz + lz + 0.5, type: 'ember' });
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

  // Listen for TNT fuse events - spawn sparks over fuse duration
  useEffect(() => {
    const handleFuse = (e: Event) => {
      const { x, y, z, duration } = (e as CustomEvent).detail;
      const intervalMs = 60;
      const ticks = Math.floor(duration / intervalMs);
      let tick = 0;
      const iv = setInterval(() => {
        if (tick >= ticks) { clearInterval(iv); return; }
        tick++;
        const particles = particlesRef.current;
        // Spawn 2-3 sparks per tick
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          if (particles.length >= MAX_AMBIENT_PARTICLES) break;
          particles.push({
            x: x + (Math.random() - 0.5) * 0.15,
            y: y,
            z: z + (Math.random() - 0.5) * 0.15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.5 + Math.random() * 2.5,
            vz: (Math.random() - 0.5) * 1.5,
            life: 0.3 + Math.random() * 0.4,
            maxLife: 0.7,
            type: 'tnt_spark',
          });
        }
      }, intervalMs);
    };

    const handleExplosion = (e: Event) => {
      const { x, y, z, radius } = (e as CustomEvent).detail;
      const particles = particlesRef.current;

      // Central flash - bright white burst
      for (let i = 0; i < 8; i++) {
        if (particles.length >= MAX_AMBIENT_PARTICLES) break;
        particles.push({
          x: x + (Math.random() - 0.5) * 0.3,
          y: y + (Math.random() - 0.5) * 0.3,
          z: z + (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          vz: (Math.random() - 0.5) * 0.5,
          life: 0.15 + Math.random() * 0.1,
          maxLife: 0.25,
          type: 'explosion_flash',
        });
      }

      // Shockwave ring - expands outward horizontally
      const ringCount = 16;
      for (let i = 0; i < ringCount; i++) {
        if (particles.length >= MAX_AMBIENT_PARTICLES) break;
        const angle = (i / ringCount) * Math.PI * 2;
        const speed = radius * 4;
        particles.push({
          x, y, z,
          vx: Math.cos(angle) * speed,
          vy: 0,
          vz: Math.sin(angle) * speed,
          life: 0.3 + Math.random() * 0.1,
          maxLife: 0.4,
          type: 'shockwave',
        });
      }

      // Burst of explosion debris particles
      const debrisCount = 50;
      for (let i = 0; i < debrisCount; i++) {
        if (particles.length >= MAX_AMBIENT_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.3) * Math.PI;
        const speed = 4 + Math.random() * radius * 3;
        particles.push({
          x: x + (Math.random() - 0.5) * 0.5,
          y: y + (Math.random() - 0.5) * 0.5,
          z: z + (Math.random() - 0.5) * 0.5,
          vx: Math.cos(angle) * Math.cos(elevation) * speed,
          vy: Math.sin(elevation) * speed + 3,
          vz: Math.sin(angle) * Math.cos(elevation) * speed,
          life: 0.5 + Math.random() * 0.8,
          maxLife: 1.3,
          type: 'explosion',
        });
      }
      // Smoke cloud particles - slower, longer-lived, more of them
      const smokeCount = 30;
      for (let i = 0; i < smokeCount; i++) {
        if (particles.length >= MAX_AMBIENT_PARTICLES) break;
        particles.push({
          x: x + (Math.random() - 0.5) * radius,
          y: y + (Math.random() - 0.5) * radius * 0.5,
          z: z + (Math.random() - 0.5) * radius,
          vx: (Math.random() - 0.5) * 3,
          vy: 0.8 + Math.random() * 2.5,
          vz: (Math.random() - 0.5) * 3,
          life: 1.5 + Math.random() * 1.5,
          maxLife: 3.0,
          type: 'explosion_smoke',
        });
      }
    };

    window.addEventListener('digy:tnt-fuse', handleFuse);
    window.addEventListener('digy:explosion', handleExplosion);
    return () => {
      window.removeEventListener('digy:tnt-fuse', handleFuse);
      window.removeEventListener('digy:explosion', handleExplosion);
    };
  }, []);

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
              x: emitter.x + (Math.random() - 0.5) * 0.1,
              y: emitter.y,
              z: emitter.z + (Math.random() - 0.5) * 0.1,
              vx: (Math.random() - 0.5) * 0.15,
              vy: 0.3 + Math.random() * 0.4,
              vz: (Math.random() - 0.5) * 0.15,
              life: 1.5 + Math.random() * 1.0,
              maxLife: 2.5,
              type: 'smoke',
            });
            break;
          case 'ember':
            if (Math.random() < 0.35) {
              particles.push({
                x: emitter.x + (Math.random() - 0.5) * 0.1,
                y: emitter.y,
                z: emitter.z + (Math.random() - 0.5) * 0.1,
                vx: (Math.random() - 0.5) * 0.4,
                vy: 0.8 + Math.random() * 1.2,
                vz: (Math.random() - 0.5) * 0.4,
                life: 0.6 + Math.random() * 0.8,
                maxLife: 1.4,
                type: 'ember',
              });
            }
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
        p.vy *= 0.97; // decelerate slowly - rises longer
        p.vx += (Math.random() - 0.5) * 0.3 * delta; // gentle drift
        p.vz += (Math.random() - 0.5) * 0.3 * delta;
        // Slight lateral expansion as smoke rises
        p.vx *= 1.0 + 0.3 * delta;
        p.vz *= 1.0 + 0.3 * delta;
      } else if (p.type === 'rail_spark') {
        p.vy -= 8 * delta;
      } else if (p.type === 'ember') {
        p.vy -= 1.5 * delta; // light gravity
        p.vx += (Math.random() - 0.5) * 1.5 * delta; // erratic drift
        p.vz += (Math.random() - 0.5) * 1.5 * delta;
      } else if (p.type === 'tnt_spark') {
        p.vy -= 6 * delta; // medium gravity
        p.vx += (Math.random() - 0.5) * 2 * delta;
        p.vz += (Math.random() - 0.5) * 2 * delta;
      } else if (p.type === 'explosion') {
        p.vy -= 10 * delta; // heavy gravity
        p.vx *= 0.96; // air resistance
        p.vz *= 0.96;
      } else if (p.type === 'explosion_smoke') {
        p.vy *= 0.95; // decelerate
        p.vx += (Math.random() - 0.5) * 0.5 * delta;
        p.vz += (Math.random() - 0.5) * 0.5 * delta;
        p.vx *= 1.0 + 0.4 * delta; // expand outward
        p.vz *= 1.0 + 0.4 * delta;
      } else if (p.type === 'explosion_flash') {
        // Flash stays roughly in place, just fades
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.vz *= 0.9;
      } else if (p.type === 'shockwave') {
        // Expands outward, slight deceleration
        p.vx *= 0.92;
        p.vz *= 0.92;
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
          // Fade: bright start (hot smoke) -> gray -> transparent
          const alpha = Math.sin(t * Math.PI) * 0.7; // bell curve fade
          const warmth = t * t; // warm tint fades as smoke cools
          colAttr.array[i * 3] = (0.45 + warmth * 0.3) * alpha;
          colAttr.array[i * 3 + 1] = (0.42 + warmth * 0.1) * alpha;
          colAttr.array[i * 3 + 2] = 0.4 * alpha;
          sizeAttr.array[i] = 0.1 + (1 - t) * 0.25; // grows as it rises
        } else if (p.type === 'ember') {
          // Bright orange-yellow fading to red
          const fade = t * t;
          colAttr.array[i * 3] = 1.0 * fade;
          colAttr.array[i * 3 + 1] = (0.6 * t) * fade;
          colAttr.array[i * 3 + 2] = (0.1 * t * t) * fade;
          sizeAttr.array[i] = 0.04 * fade;
        } else if (p.type === 'lava_spark') {
          colAttr.array[i * 3] = 1.0 * t;
          colAttr.array[i * 3 + 1] = 0.4 * t;
          colAttr.array[i * 3 + 2] = 0.0;
          sizeAttr.array[i] = 0.06 * t;
        } else if (p.type === 'tnt_spark') {
          // Bright white-yellow sparks
          const flash = 0.5 + Math.random() * 0.5; // flickering
          colAttr.array[i * 3] = 1.0 * t * flash;
          colAttr.array[i * 3 + 1] = (0.8 + Math.random() * 0.2) * t * flash;
          colAttr.array[i * 3 + 2] = (0.2 + Math.random() * 0.3) * t * flash;
          sizeAttr.array[i] = 0.05 * t;
        } else if (p.type === 'explosion') {
          // Hot debris: white -> orange -> dark red
          const hot = t * t;
          colAttr.array[i * 3] = (0.4 + 0.6 * hot);
          colAttr.array[i * 3 + 1] = (0.15 + 0.55 * hot) * hot;
          colAttr.array[i * 3 + 2] = 0.05 * hot;
          sizeAttr.array[i] = 0.08 + 0.12 * hot;
        } else if (p.type === 'explosion_smoke') {
          // Dark smoke cloud
          const alpha = Math.sin(t * Math.PI) * 0.6;
          const gray = 0.2 + 0.15 * t;
          colAttr.array[i * 3] = gray * alpha;
          colAttr.array[i * 3 + 1] = gray * alpha * 0.9;
          colAttr.array[i * 3 + 2] = gray * alpha * 0.8;
          sizeAttr.array[i] = 0.15 + (1 - t) * 0.35; // grows as it dissipates
        } else if (p.type === 'explosion_flash') {
          // Bright white-yellow flash that fades quickly
          colAttr.array[i * 3] = 1.0 * t;
          colAttr.array[i * 3 + 1] = 0.95 * t;
          colAttr.array[i * 3 + 2] = 0.7 * t;
          sizeAttr.array[i] = 0.6 + (1 - t) * 1.5; // starts big, shrinks
        } else if (p.type === 'shockwave') {
          // White-gray expanding ring
          const fade = t * t;
          colAttr.array[i * 3] = 0.8 * fade;
          colAttr.array[i * 3 + 1] = 0.75 * fade;
          colAttr.array[i * 3 + 2] = 0.65 * fade;
          sizeAttr.array[i] = 0.12 + (1 - t) * 0.2;
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
