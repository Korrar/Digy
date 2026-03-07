import { useCallback, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType, getBlock, isSolid } from '../../core/voxel/BlockRegistry';

interface WorldInteractionProps {
  mode: 'mine' | 'build';
}

export function WorldInteraction({ mode }: WorldInteractionProps) {
  const highlightRef = useRef<THREE.Mesh>(null);
  const miningTimeRef = useRef(0);
  const miningBlockRef = useRef<string | null>(null);
  const isPointerDownRef = useRef(false);
  const [miningProgress, setMiningProgress] = useState(0);

  const { raycaster, pointer, camera, scene } = useThree();
  const getBlockW = useWorldStore((s) => s.getBlock);
  const setBlockW = useWorldStore((s) => s.setBlock);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const getSelectedBlock = useInventoryStore((s) => s.getSelectedBlock);
  const removeBlock = useInventoryStore((s) => s.removeBlock);
  const selectedIdx = useInventoryStore((s) => s.selectedHotbarIndex);

  const raycast = useCallback((): {
    blockPos: [number, number, number];
    normal: [number, number, number];
    blockType: BlockType;
  } | null => {
    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.userData.isChunk) {
        meshes.push(obj as THREE.Mesh);
      }
    });

    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    if (!hit.face) return null;

    const normal = hit.face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    normal.applyMatrix3(normalMatrix).normalize();

    const point = hit.point.clone();
    const bx = Math.floor(point.x - normal.x * 0.01);
    const by = Math.floor(point.y - normal.y * 0.01);
    const bz = Math.floor(point.z - normal.z * 0.01);

    const blockType = getBlockW(bx, by, bz);
    if (blockType === BlockType.AIR) return null;

    return {
      blockPos: [bx, by, bz],
      normal: [Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)] as [number, number, number],
      blockType,
    };
  }, [raycaster, pointer, camera, scene, getBlockW]);

  useFrame((_, delta) => {
    const result = raycast();

    if (highlightRef.current) {
      if (result) {
        highlightRef.current.visible = true;
        if (mode === 'build') {
          highlightRef.current.position.set(
            result.blockPos[0] + result.normal[0] + 0.5,
            result.blockPos[1] + result.normal[1] + 0.5,
            result.blockPos[2] + result.normal[2] + 0.5
          );
        } else {
          highlightRef.current.position.set(
            result.blockPos[0] + 0.5,
            result.blockPos[1] + 0.5,
            result.blockPos[2] + 0.5
          );
        }

        // Mining with hold
        if (isPointerDownRef.current && mode === 'mine' && result) {
          const blockKey = result.blockPos.join(',');
          if (miningBlockRef.current !== blockKey) {
            miningBlockRef.current = blockKey;
            miningTimeRef.current = 0;
          }

          const def = getBlock(result.blockType);
          miningTimeRef.current += delta;
          const progress = Math.min(miningTimeRef.current / Math.max(def.hardness, 0.1), 1);
          setMiningProgress(progress);

          if (progress >= 1) {
            const [bx, by, bz] = result.blockPos;
            setBlockW(bx, by, bz, BlockType.AIR);
            if (def.drops !== BlockType.AIR) {
              addBlock(def.drops, 1);
            }
            miningTimeRef.current = 0;
            miningBlockRef.current = null;
            setMiningProgress(0);
          }
        }
      } else {
        highlightRef.current.visible = false;
        miningBlockRef.current = null;
        miningTimeRef.current = 0;
        setMiningProgress(0);
      }
    }
  });

  const handlePointerDown = useCallback(() => {
    isPointerDownRef.current = true;
    if (mode === 'build') {
      const result = raycast();
      if (!result) return;
      const selectedBlock = getSelectedBlock();
      if (!selectedBlock) return;

      const [bx, by, bz] = result.blockPos;
      const px = bx + result.normal[0];
      const py = by + result.normal[1];
      const pz = bz + result.normal[2];

      if (!isSolid(getBlockW(px, py, pz))) {
        setBlockW(px, py, pz, selectedBlock);
        removeBlock(selectedIdx, 1);
      }
    }
  }, [mode, raycast, getSelectedBlock, getBlockW, setBlockW, removeBlock, selectedIdx]);

  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    miningTimeRef.current = 0;
    miningBlockRef.current = null;
    setMiningProgress(0);
  }, []);

  return (
    <>
      {/* Highlight cube */}
      <mesh ref={highlightRef} visible={false}>
        <boxGeometry args={[1.02, 1.02, 1.02]} />
        <meshBasicMaterial
          color={mode === 'mine' ? '#ff4444' : '#44ff88'}
          wireframe={false}
          transparent
          opacity={0.25}
          depthTest={true}
        />
      </mesh>

      {/* Invisible interaction plane */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        position={[0, 15, 0]}
        visible={false}
      >
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} visible={false} />
      </mesh>

      {/* Mining progress indicator */}
      {miningProgress > 0 && highlightRef.current?.visible && (
        <mesh position={highlightRef.current.position.clone().add(new THREE.Vector3(0, 0.7, 0))}>
          <planeGeometry args={[miningProgress, 0.1]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      )}
    </>
  );
}
