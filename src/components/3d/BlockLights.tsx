import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

interface LightEntry {
  x: number;
  y: number;
  z: number;
  color: string;
  isTorch: boolean;
}

function TorchLight({ light }: { light: LightEntry }) {
  const ref = useRef<THREE.PointLight>(null);
  // Use a stable random offset per torch so they don't all flicker in sync
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current) return;
    if (light.isTorch) {
      const t = state.clock.elapsedTime;
      // Gentle flickering: combine two sine waves for organic feel
      const flicker = 0.85 + 0.15 * Math.sin(t * 6 + phaseOffset) * Math.sin(t * 9.3 + phaseOffset * 2);
      ref.current.intensity = 0.6 * flicker;
    }
  });

  return (
    <pointLight
      ref={ref}
      position={[light.x, light.y, light.z]}
      color={light.color}
      intensity={light.isTorch ? 0.6 : 1.2}
      distance={12}
      decay={2}
    />
  );
}

export function BlockLights() {
  const chunks = useWorldStore((s) => s.chunks);

  const lights = useMemo(() => {
    const result: LightEntry[] = [];

    chunks.forEach((entry) => {
      const chunk = entry.data;
      const ox = chunk.cx * CHUNK_SIZE;
      const oz = chunk.cz * CHUNK_SIZE;

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const block = chunk.getBlock(x, y, z);
            if (block === BlockType.AIR) continue;
            const def = getBlock(block);
            if (!def.emitsLight) continue;

            const isTorch = block === BlockType.TORCH;
            const color = block === BlockType.LAMP ? '#ffdd88' : '#ffaa33';
            result.push({
              x: ox + x + 0.5,
              y: y + 0.5,
              z: oz + z + 0.5,
              color,
              isTorch,
            });
          }
        }
      }
    });

    return result;
  }, [chunks]);

  return (
    <>
      {lights.map((light) => (
        <TorchLight
          key={`${light.x}-${light.y}-${light.z}`}
          light={light}
        />
      ))}
    </>
  );
}
