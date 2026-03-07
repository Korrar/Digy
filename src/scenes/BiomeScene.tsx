import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '../stores/gameStore';
import { useWorldStore } from '../stores/worldStore';
import { createBiome } from '../core/terrain/biomes';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { WorldInteraction } from '../components/3d/WorldInteraction';
import { MiningParticles } from '../components/3d/MiningParticles';
import { DayNightCycle } from '../components/3d/DayNightCycle';
import { Hotbar } from '../components/ui/Hotbar';
import { HUD } from '../components/ui/HUD';
import { InventoryPanel } from '../components/ui/InventoryPanel';
import { MobileControls } from '../components/ui/MobileControls';
import { useInventoryStore } from '../stores/inventoryStore';
import { CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../utils/constants';

export function BiomeScene() {
  const biomeType = useGameStore((s) => s.currentBiome);
  const biomeSeed = useGameStore((s) => s.biomeSeed);
  const generateWorld = useWorldStore((s) => s.generateWorld);
  const clearWorld = useWorldStore((s) => s.clearWorld);
  const chunks = useWorldStore((s) => s.chunks);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);

  const biome = useMemo(() => createBiome(biomeType, biomeSeed), [biomeType, biomeSeed]);

  useEffect(() => {
    generateWorld(biomeType, biomeSeed, 2);
    return () => clearWorld();
  }, [biomeType, biomeSeed, generateWorld, clearWorld]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') toggleInventory();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleInventory]);

  const chunkEntries = useMemo(() => {
    const result: { key: string; cx: number; cz: number; geometry: THREE.BufferGeometry }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({ key, cx, cz, geometry: entry.geometry });
    });
    return result;
  }, [chunks]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        camera={{ position: [20, 25, 20], fov: 50, near: 0.1, far: 500 }}
        style={{ background: biome.config.skyColor }}
      >
        <DayNightCycle cycleDuration={120} baseAmbient={biome.config.ambientLight} />

        <OrbitControls
          target={[0, 8, 0]}
          minDistance={CAMERA_MIN_DISTANCE}
          maxDistance={CAMERA_MAX_DISTANCE}
          minPolarAngle={CAMERA_MIN_POLAR}
          maxPolarAngle={CAMERA_MAX_POLAR}
          enablePan={true}
          panSpeed={0.8}
        />

        {chunkEntries.map((c) => (
          <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
        ))}

        <WorldInteraction mode="mine" />
        <MiningParticles />

        <fog attach="fog" args={[biome.config.fogColor, 30, 80]} />
      </Canvas>

      <HUD />
      <Hotbar />
      <InventoryPanel />
      <MobileControls />
    </div>
  );
}
