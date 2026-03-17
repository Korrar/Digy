import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useWorldStore } from '../../stores/worldStore';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';
import { getVoxelMaterial } from '../../core/voxel/VoxelShader';

const material = getVoxelMaterial();

// Reusable frustum objects to avoid per-frame allocations
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _box = new THREE.Box3();

export function VoxelWorld() {
  const chunks = useWorldStore((s) => s.chunks);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

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

  // Frustum culling per chunk each frame
  useFrame(() => {
    if (!groupRef.current) return;

    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);

    for (const child of groupRef.current.children) {
      const mesh = child as THREE.Mesh;
      const pos = mesh.position;
      _box.min.set(pos.x, 0, pos.z);
      _box.max.set(pos.x + CHUNK_SIZE, CHUNK_HEIGHT, pos.z + CHUNK_SIZE);
      mesh.visible = _frustum.intersectsBox(_box);
    }
  });

  return (
    <group ref={groupRef}>
      {meshes.map((m) => (
        <mesh
          key={m.key}
          geometry={m.geometry}
          material={material}
          position={m.position}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
