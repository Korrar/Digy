import * as THREE from 'three';
import { useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useWorldStore } from '../../stores/worldStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType, getBlock, isSolid } from '../../core/voxel/BlockRegistry';

interface HitResult {
  position: [number, number, number];
  normal: [number, number, number];
  blockType: BlockType;
}

interface BlockHighlightProps {
  mode: 'mine' | 'build';
}

export function BlockHighlight({ mode }: BlockHighlightProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hit, setHit] = useState<HitResult | null>(null);
  const [_miningProgress, setMiningProgress] = useState(0);
  const miningStartRef = useRef<number | null>(null);
  const lastBlockRef = useRef<string | null>(null);
  const { camera, raycaster, pointer, scene } = useThree();

  const getBlockW = useWorldStore((s) => s.getBlock);
  const setBlockW = useWorldStore((s) => s.setBlock);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const getSelectedBlock = useInventoryStore((s) => s.getSelectedBlock);
  const removeBlock = useInventoryStore((s) => s.removeBlock);
  const selectedIdx = useInventoryStore((s) => s.selectedHotbarIndex);

  const doRaycast = useCallback((): HitResult | null => {
    raycaster.setFromCamera(pointer, camera);
    // Find all meshes in the scene that are chunk meshes
    const meshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry?.attributes?.color) {
        meshes.push(obj);
      }
    });

    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    const intersect = intersects[0];
    if (!intersect.face) return null;

    const normal = intersect.face.normal.clone();
    // Transform to world space
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
    normal.applyMatrix3(normalMatrix).normalize();

    const point = intersect.point.clone();
    // Step slightly into the block
    const blockPos: [number, number, number] = [
      Math.floor(point.x - normal.x * 0.01),
      Math.floor(point.y - normal.y * 0.01),
      Math.floor(point.z - normal.z * 0.01),
    ];

    const blockType = getBlockW(blockPos[0], blockPos[1], blockPos[2]);
    if (blockType === BlockType.AIR) return null;

    return {
      position: blockPos,
      normal: [Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)] as [number, number, number],
      blockType,
    };
  }, [camera, raycaster, pointer, scene, getBlockW]);

  useFrame(() => {
    const result = doRaycast();
    setHit(result);

    if (meshRef.current) {
      if (result) {
        meshRef.current.visible = true;
        if (mode === 'mine') {
          meshRef.current.position.set(
            result.position[0] + 0.5,
            result.position[1] + 0.5,
            result.position[2] + 0.5
          );
        } else {
          // Build mode: show on adjacent face
          meshRef.current.position.set(
            result.position[0] + result.normal[0] + 0.5,
            result.position[1] + result.normal[1] + 0.5,
            result.position[2] + result.normal[2] + 0.5
          );
        }
      } else {
        meshRef.current.visible = false;
      }
    }
  });

  const handlePointerDown = useCallback(() => {
    if (!hit) return;

    if (mode === 'mine') {
      const blockKey = hit.position.join(',');
      if (lastBlockRef.current !== blockKey) {
        miningStartRef.current = performance.now();
        lastBlockRef.current = blockKey;
      }

      const def = getBlock(hit.blockType);
      const elapsed = miningStartRef.current
        ? (performance.now() - miningStartRef.current) / 1000
        : 0;

      if (elapsed >= def.hardness || def.hardness <= 0.3) {
        // Mine the block
        const [bx, by, bz] = hit.position;
        setBlockW(bx, by, bz, BlockType.AIR);
        if (def.drops !== BlockType.AIR) {
          addBlock(def.drops, 1);
        }
        miningStartRef.current = null;
        lastBlockRef.current = null;
        setMiningProgress(0);
      } else {
        setMiningProgress(elapsed / def.hardness);
      }
    } else {
      // Build mode
      const selectedBlock = getSelectedBlock();
      if (!selectedBlock) return;

      const [bx, by, bz] = hit.position;
      const px = bx + hit.normal[0];
      const py = by + hit.normal[1];
      const pz = bz + hit.normal[2];

      if (!isSolid(getBlockW(px, py, pz))) {
        setBlockW(px, py, pz, selectedBlock);
        removeBlock(selectedIdx, 1);
      }
    }
  }, [hit, mode, setBlockW, addBlock, getSelectedBlock, removeBlock, selectedIdx, getBlockW]);

  return (
    <>
      <mesh
        ref={meshRef}
        visible={false}
        onPointerDown={handlePointerDown}
      >
        <boxGeometry args={[1.01, 1.01, 1.01]} />
        <meshBasicMaterial
          color={mode === 'mine' ? '#ffffff' : '#00ff88'}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* Invisible click catcher for the whole scene */}
      <mesh
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}
