import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTappablesStore, type TappableRarity } from '../../stores/tappablesStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCombatStore } from '../../stores/combatStore';
import { soundManager } from '../../systems/SoundManager';

const RARITY_HEX: Record<TappableRarity, number> = {
  common: 0xaaaaaa,
  uncommon: 0x55cc55,
  rare: 0x5555ff,
  epic: 0xaa44cc,
};

const TYPE_SHAPES: Record<string, 'box' | 'diamond' | 'sphere'> = {
  chest: 'box',
  crystal: 'diamond',
  mushroom: 'sphere',
  flower_patch: 'sphere',
  ore_nugget: 'diamond',
};

function TappableMesh({ id, type, rarity, position, collected }: {
  id: string;
  type: string;
  rarity: TappableRarity;
  position: [number, number, number];
  collected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const collectTappable = useTappablesStore((s) => s.collectTappable);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const addXp = useCombatStore((s) => s.addXp);
  const scaleRef = useRef(collected ? 0 : 1);

  const color = RARITY_HEX[rarity];
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

    // Floating animation
    meshRef.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.15;
    meshRef.current.rotation.y = t * 0.8;

    // Collect animation
    if (collected && scaleRef.current > 0) {
      scaleRef.current = Math.max(0, scaleRef.current - 0.08);
    }
    meshRef.current.scale.setScalar(scaleRef.current);

    // Glow pulse
    if (glowRef.current) {
      glowRef.current.intensity = 0.5 + Math.sin(t * 3) * 0.3;
      glowRef.current.position.copy(meshRef.current.position);
    }
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    if (collected) return;
    const loot = collectTappable(id);
    if (loot.length > 0) {
      // Add items to inventory
      for (const item of loot) {
        addBlock(item.type, item.count);
      }
      // XP based on rarity
      const xpGain = rarity === 'common' ? 2 : rarity === 'uncommon' ? 5 : rarity === 'rare' ? 10 : 20;
      addXp(xpGain);
      // Play collect sound
      soundManager.playPlaceSound();
    }
  }, [id, collected, collectTappable, addBlock, addXp, rarity]);

  if (collected && scaleRef.current <= 0) return null;

  return (
    <>
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
          emissiveIntensity={0.3}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
      {rarity !== 'common' && (
        <pointLight
          ref={glowRef}
          position={[position[0], position[1], position[2]]}
          color={color}
          intensity={0.5}
          distance={3}
          decay={2}
        />
      )}
    </>
  );
}

export function TappablesRenderer({ biomeType, center }: { biomeType: string; center: [number, number, number] }) {
  const tappables = useTappablesStore((s) => s.tappables);
  const spawnTappables = useTappablesStore((s) => s.spawnTappables);
  const spawnedRef = useRef(false);

  // Spawn tappables once on mount
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
          rarity={t.rarity}
          position={t.position}
          collected={t.collected}
        />
      ))}
    </group>
  );
}
