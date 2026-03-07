import * as THREE from 'three';
import { BlockType, getBlockColor, isTransparent } from './BlockRegistry';
import { ChunkData } from './ChunkData';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

interface Face {
  dir: [number, number, number];
  corners: [number, number, number][];
  faceName: 'top' | 'bottom' | 'side';
}

const FACES: Face[] = [
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], faceName: 'top' },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], faceName: 'bottom' },
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], faceName: 'side' },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], faceName: 'side' },
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], faceName: 'side' },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], faceName: 'side' },
];

export function buildChunkMesh(
  chunk: ChunkData,
  getNeighborBlock?: (wx: number, wy: number, wz: number) => BlockType
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const block = chunk.getBlock(x, y, z);
        if (block === BlockType.AIR) continue;

        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          let neighborBlock: BlockType;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
            neighborBlock = chunk.getBlock(nx, ny, nz);
          } else if (getNeighborBlock) {
            neighborBlock = getNeighborBlock(ox + nx, ny, oz + nz);
          } else {
            neighborBlock = BlockType.AIR;
          }

          if (!isTransparent(neighborBlock) && neighborBlock !== BlockType.AIR) continue;
          if (neighborBlock === block) continue;

          const color = getBlockColor(block, face.faceName);

          // Add slight AO-like darkening for side/bottom faces
          const brightness = face.faceName === 'top' ? 1.0 : face.faceName === 'side' ? 0.85 : 0.7;

          for (const corner of face.corners) {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);
            colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
          }

          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}
