import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WeatherConfig {
  type: 'rain' | 'snow' | 'sandstorm' | 'fog' | 'none';
  particleCount: number;
  color: number;
  size: number;
  speed: number;
  spread: number;
  height: number;
}

const BIOME_WEATHER: Record<string, WeatherConfig> = {
  forest: { type: 'rain', particleCount: 200, color: 0x6688cc, size: 0.02, speed: 12, spread: 16, height: 20 },
  desert: { type: 'sandstorm', particleCount: 150, color: 0xd4b86a, size: 0.04, speed: 5, spread: 16, height: 12 },
  mountains: { type: 'fog', particleCount: 80, color: 0xcccccc, size: 0.15, speed: 0.5, spread: 16, height: 25 },
  swamp: { type: 'fog', particleCount: 100, color: 0x556644, size: 0.12, speed: 0.3, spread: 14, height: 10 },
  tundra: { type: 'snow', particleCount: 180, color: 0xffffff, size: 0.04, speed: 2, spread: 16, height: 20 },
  cave: { type: 'none', particleCount: 0, color: 0, size: 0, speed: 0, spread: 0, height: 0 },
};

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
}

export function useWeather(biomeType: string, center: [number, number, number]) {
  const pointsRef = useRef<THREE.Points>(null);
  const config = BIOME_WEATHER[biomeType];

  const particles = useMemo(() => {
    if (!config || config.type === 'none') return [];
    const list: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      list.push({
        x: center[0] + (Math.random() - 0.5) * config.spread,
        y: center[1] + Math.random() * config.height,
        z: center[2] + (Math.random() - 0.5) * config.spread,
        vx: config.type === 'sandstorm' ? 2 + Math.random() * 3 : (Math.random() - 0.5) * 0.3,
        vy: -config.speed * (0.8 + Math.random() * 0.4),
        vz: config.type === 'sandstorm' ? 1 + Math.random() * 2 : (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return list;
  }, [config, center[0], center[1], center[2]]);

  const positionArray = useMemo(() => {
    if (!config || config.type === 'none') return new Float32Array(0);
    return new Float32Array(config.particleCount * 3);
  }, [config]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points || !config || config.type === 'none') return;

    const geo = points.geometry;
    const positions = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (config.type === 'fog') {
        // Fog drifts slowly
        p.x += Math.sin(p.phase + p.y * 0.1) * config.speed * delta;
        p.z += Math.cos(p.phase + p.x * 0.1) * config.speed * delta;
        p.y += Math.sin(p.phase * 2 + p.x * 0.05) * 0.1 * delta;
      } else {
        // Rain/snow/sand falls down
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;

        // Snow sways
        if (config.type === 'snow') {
          p.x += Math.sin(p.phase + p.y * 0.5) * 0.5 * delta;
          p.z += Math.cos(p.phase + p.y * 0.3) * 0.5 * delta;
        }
      }

      // Reset if out of bounds
      if (p.y < center[1] - 1) {
        p.y = center[1] + config.height;
        p.x = center[0] + (Math.random() - 0.5) * config.spread;
        p.z = center[2] + (Math.random() - 0.5) * config.spread;
      }
      if (config.type === 'sandstorm' && p.x > center[0] + config.spread) {
        p.x = center[0] - config.spread / 2;
      }
      // Keep fog contained
      if (config.type === 'fog') {
        const dx = p.x - center[0];
        const dz = p.z - center[2];
        if (Math.abs(dx) > config.spread / 2 || Math.abs(dz) > config.spread / 2) {
          p.x = center[0] + (Math.random() - 0.5) * config.spread;
          p.z = center[2] + (Math.random() - 0.5) * config.spread;
        }
      }

      positions.array[i * 3] = p.x;
      positions.array[i * 3 + 1] = p.y;
      positions.array[i * 3 + 2] = p.z;
    }

    positions.needsUpdate = true;
  });

  return {
    pointsRef,
    positionArray,
    config,
    count: config?.particleCount ?? 0,
  };
}

export { BIOME_WEATHER };
export type { WeatherConfig };
