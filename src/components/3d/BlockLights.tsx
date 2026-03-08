import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';
import { updateVoxelShaderUniforms } from '../../core/voxel/VoxelShader';
import type { PointLightData } from '../../core/voxel/VoxelShader';

interface LightEntry {
  x: number;
  y: number;
  z: number;
  colorR: number;
  colorG: number;
  colorB: number;
  intensity: number;
  distance: number;
  isTorch: boolean;
  phaseOffset: number;
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
            const isLamp = block === BlockType.LAMP;
            result.push({
              x: ox + x + 0.5,
              y: y + (isTorch ? 0.8 : 0.5),
              z: oz + z + 0.5,
              colorR: isTorch ? 1.0 : 1.0,
              colorG: isTorch ? 0.67 : 0.87,
              colorB: isTorch ? 0.2 : 0.53,
              intensity: isLamp ? 1.2 : 0.6,
              distance: 12,
              isTorch,
              phaseOffset: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    });

    return result;
  }, [chunks]);

  // Push light data to the voxel shader every frame (with flickering)
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pointLights: PointLightData[] = [];

    // Sort by distance to camera, take closest 16
    const camPos = state.camera.position;
    const sorted = lights
      .map((l) => ({
        ...l,
        distSq: (l.x - camPos.x) ** 2 + (l.y - camPos.y) ** 2 + (l.z - camPos.z) ** 2,
      }))
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, 16);

    for (const light of sorted) {
      let intensity = light.intensity;
      if (light.isTorch) {
        // Gentle flickering
        const flicker = 0.85 + 0.15 * Math.sin(t * 6 + light.phaseOffset) * Math.sin(t * 9.3 + light.phaseOffset * 2);
        intensity *= flicker;
      }
      pointLights.push({
        position: [light.x, light.y, light.z],
        color: [light.colorR, light.colorG, light.colorB],
        intensity,
        distance: light.distance,
      });
    }

    updateVoxelShaderUniforms({ pointLights });
  });

  // No more Three.js pointLight nodes needed - the shader handles it all
  return null;
}
