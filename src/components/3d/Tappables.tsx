import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTappablesStore, TAPPABLE_COLORS } from '../../stores/tappablesStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCombatStore } from '../../stores/combatStore';
import { soundManager } from '../../systems/SoundManager';

const TYPE_SHAPES: Record<string, 'box' | 'diamond' | 'sphere'> = {
  chest: 'box',
  crystal: 'diamond',
  mushroom: 'sphere',
  flower_patch: 'sphere',
  ore_nugget: 'diamond',
};

function TappableMesh({ id, type, position, collected }: {
  id: string;
  type: string;
  position: [number, number, number];
  collected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectTappable = useTappablesStore((s) => s.collectTappable);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const addXp = useCombatStore((s) => s.addXp);
  const scaleRef = useRef(collected ? 0 : 1);

  const color = TAPPABLE_COLORS[type as keyof typeof TAPPABLE_COLORS] || 0xaaaaaa;
  const shape = TYPE_SHAPES[type] || 'box';

  const geometry = useMemo(() => {
    switch (shape) {
      case 'diamond': return new THREE.OctahedronGeometry(0.35);
      case 'sphere': return new THREE.SphereGeometry(0.3, 8, 8);
      default: return new THREE.BoxGeometry(0.5, 0.4, 0.5);
    }
  }, [shape]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    meshRef.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.15;
    meshRef.current.rotation.y = t * 0.8;

    if (collected && scaleRef.current > 0) {
      scaleRef.current = Math.max(0, scaleRef.current - 0.08);
    }
    meshRef.current.scale.setScalar(scaleRef.current);
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    if (collected) return;
    const loot = collectTappable(id);
    if (loot.length > 0) {
      for (const item of loot) {
        addBlock(item.type, item.count);
      }
      addXp(3);
      soundManager.playPlaceSound();
    }
  }, [id, collected, collectTappable, addBlock, addXp]);

  if (collected && scaleRef.current <= 0) return null;

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      geometry={geometry}
      onClick={handleClick}
      castShadow
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.2}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

export function TappablesRenderer({ biomeType, center }: { biomeType: string; center: [number, number, number] }) {
  const tappables = useTappablesStore((s) => s.tappables);
  const spawnTappables = useTappablesStore((s) => s.spawnTappables);
  const spawnedRef = useRef(false);

  if (!spawnedRef.current && tappables.length === 0) {
    spawnedRef.current = true;
    spawnTappables(biomeType, center);
  }

  return (
    <group>
      {tappables.map((t) => (
        <TappableMesh
          key={t.id}
          id={t.id}
          type={t.type}
          position={t.position}
          collected={t.collected}
        />
      ))}
    </group>
  );
}
