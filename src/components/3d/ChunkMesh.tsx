import * as THREE from 'three';
import { CHUNK_SIZE } from '../../utils/constants';

const material = new THREE.MeshLambertMaterial({ vertexColors: true });

interface ChunkMeshProps {
  cx: number;
  cz: number;
  geometry: THREE.BufferGeometry;
}

export function ChunkMesh({ cx, cz, geometry }: ChunkMeshProps) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}
      castShadow
      receiveShadow
      userData={{ isChunk: true }}
    />
  );
}
