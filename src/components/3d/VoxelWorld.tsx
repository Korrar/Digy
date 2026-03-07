import { useMemo } from 'react';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { CHUNK_SIZE } from '../../utils/constants';
import { getVoxelMaterial } from '../../core/voxel/VoxelShader';

const material = getVoxelMaterial();

export function VoxelWorld() {
  const chunks = useWorldStore((s) => s.chunks);

  const meshes = useMemo(() => {
    const result: { key: string; geometry: THREE.BufferGeometry; position: [number, number, number] }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({
        key,
        geometry: entry.geometry,
        position: [cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE],
      });
    });
    return result;
  }, [chunks]);

  return (
    <group>
      {meshes.map((m) => (
        <mesh
          key={m.key}
          geometry={m.geometry}
          material={material}
          position={m.position}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
