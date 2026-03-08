import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';
import { updateVoxelShaderUniforms } from '../../core/voxel/VoxelShader';
import type { PointLightData } from '../../core/voxel/VoxelShader';
import { minecartLightsRef } from './Minecarts';

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
            const isLava = block === BlockType.LAVA;
            const isCablePowered = block === BlockType.CABLE_POWERED;

            let colorR = 1.0, colorG = 0.87, colorB = 0.53;
            let intensity = 0.6;
            let yOffset = 0.5;

            if (isTorch) { colorR = 1.0; colorG = 0.67; colorB = 0.2; yOffset = 0.8; }
            else if (isLamp) { intensity = 1.2; }
            else if (isLava) { colorR = 1.0; colorG = 0.3; colorB = 0.05; intensity = 1.0; }
            else if (isCablePowered) { colorR = 0.2; colorG = 0.5; colorB = 1.0; intensity = 0.4; }

            result.push({
              x: ox + x + 0.5,
              y: y + yOffset,
              z: oz + z + 0.5,
              colorR, colorG, colorB,
              intensity,
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
    const camPos = state.camera.position;

    // Combine block lights + minecart warning lights
    const allLights: (LightEntry & { distSq: number })[] = lights.map((l) => ({
      ...l,
      distSq: (l.x - camPos.x) ** 2 + (l.y - camPos.y) ** 2 + (l.z - camPos.z) ** 2,
    }));

    // Add minecart warning lights (dynamic, moving)
    for (const mc of minecartLightsRef.current) {
      if (!mc.hasWarningLight) continue;
      const distSq = (mc.x - camPos.x) ** 2 + (mc.y - camPos.y) ** 2 + (mc.z - camPos.z) ** 2;
      // Two alternating lights on each minecart
      const phase = (t * 4) % 2;
      // Left light
      allLights.push({
        x: mc.x - 0.25, y: mc.y + 0.45, z: mc.z,
        colorR: 1.0, colorG: 0.8, colorB: 0.0,
        intensity: phase < 1 ? 1.5 : 0.1,
        distance: 12,
        isTorch: false,
        phaseOffset: 0,
        distSq,
      });
      // Right light
      allLights.push({
        x: mc.x + 0.25, y: mc.y + 0.45, z: mc.z,
        colorR: 1.0, colorG: 0.8, colorB: 0.0,
        intensity: phase < 1 ? 0.1 : 1.5,
        distance: 12,
        isTorch: false,
        phaseOffset: 0,
        distSq,
      });
    }

    // Sort by distance to camera, take closest 16
    const sorted = allLights
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, 16);

    const pointLights: PointLightData[] = [];
    for (const light of sorted) {
      let intensity = light.intensity;
      if (light.isTorch) {
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
