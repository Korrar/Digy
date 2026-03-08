import { useMemo } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

export function BlockLights() {
  const chunks = useWorldStore((s) => s.chunks);

  const lights = useMemo(() => {
    const result: { x: number; y: number; z: number; color: string }[] = [];

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

            const color = block === BlockType.LAMP ? '#ffdd88' : '#ffaa33';
            result.push({
              x: ox + x + 0.5,
              y: y + 0.5,
              z: oz + z + 0.5,
              color,
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
        <pointLight
          key={`${light.x}-${light.y}-${light.z}`}
          position={[light.x, light.y, light.z]}
          color={light.color}
          intensity={light.color === '#ffdd88' ? 1.2 : 0.6}
          distance={12}
          decay={2}
        />
      ))}
    </>
  );
}
