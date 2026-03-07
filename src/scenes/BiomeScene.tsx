import { useEffect, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '../stores/gameStore';
import { useWorldStore } from '../stores/worldStore';
import { createBiome } from '../core/terrain/biomes';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { WorldInteraction } from '../components/3d/WorldInteraction';
import { ParticleSystem } from '../components/3d/DiggingParticles';
import { DayNightCycle } from '../components/3d/DayNightCycle';
import { Hotbar } from '../components/ui/Hotbar';
import { HUD } from '../components/ui/HUD';
import { InventoryPanel } from '../components/ui/InventoryPanel';
import { MobileControls, useTouchDetect } from '../components/ui/MobileControls';
import { useInventoryStore } from '../stores/inventoryStore';
import { CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../utils/constants';

function getTimeEmoji(timeOfDay: number): string {
  // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  if (timeOfDay > 0.2 && timeOfDay < 0.3) return '🌅';
  if (timeOfDay >= 0.3 && timeOfDay < 0.7) return '☀️';
  if (timeOfDay >= 0.7 && timeOfDay < 0.8) return '🌇';
  return '🌙';
}

function getSkyColor(baseSkyColor: string, sunIntensity: number): string {
  const base = new THREE.Color(baseSkyColor);
  const nightSky = new THREE.Color(0x0a0a1a);
  const result = new THREE.Color().lerpColors(nightSky, base, Math.max(0.05, sunIntensity));
  return '#' + result.getHexString();
}

export function BiomeScene() {
  const biomeType = useGameStore((s) => s.currentBiome);
  const biomeSeed = useGameStore((s) => s.biomeSeed);
  const generateWorld = useWorldStore((s) => s.generateWorld);
  const clearWorld = useWorldStore((s) => s.clearWorld);
  const chunks = useWorldStore((s) => s.chunks);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);
  const isTouch = useTouchDetect();

  const biome = useMemo(() => createBiome(biomeType, biomeSeed), [biomeType, biomeSeed]);
  const [timeIndicator, setTimeIndicator] = useState('☀️');
  const [skyColor, setSkyColor] = useState(biome.config.skyColor);

  const handleTimeChange = useCallback((timeOfDay: number, sunIntensity: number) => {
    setTimeIndicator(getTimeEmoji(timeOfDay));
    setSkyColor(getSkyColor(biome.config.skyColor, sunIntensity));
  }, [biome.config.skyColor]);

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

  const handleDigStart = useCallback(() => {
    (window as any).__digyPointer?.startDig();
  }, []);
  const handleDigEnd = useCallback(() => {
    (window as any).__digyPointer?.stopDig();
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        camera={{ position: [20, 25, 20], fov: 50, near: 0.1, far: 500 }}
        style={{ background: skyColor }}
      >
        {/* Day/Night replaces static ambient + directional lights */}
        {biomeType !== 'cave' ? (
          <DayNightCycle cycleDuration={120} onTimeChange={handleTimeChange} />
        ) : (
          <>
            <ambientLight intensity={biome.config.ambientLight} />
            <directionalLight
              position={[30, 40, 20]}
              intensity={0.3}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={100}
              shadow-camera-left={-40}
              shadow-camera-right={40}
              shadow-camera-top={40}
              shadow-camera-bottom={-40}
            />
            <pointLight position={[0, 20, 0]} intensity={0.5} color="#ff9944" distance={40} />
          </>
        )}

        <OrbitControls
          target={[0, 8, 0]}
          minDistance={CAMERA_MIN_DISTANCE}
          maxDistance={CAMERA_MAX_DISTANCE}
          minPolarAngle={CAMERA_MIN_POLAR}
          maxPolarAngle={CAMERA_MAX_POLAR}
          enablePan={true}
          panSpeed={0.8}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />

        {chunkEntries.map((c) => (
          <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
        ))}

        <WorldInteraction mode="mine" />
        <ParticleSystem />

        <fog attach="fog" args={[skyColor, 30, 80]} />
      </Canvas>

      <HUD timeIndicator={biomeType !== 'cave' ? timeIndicator : undefined} />
      <Hotbar />
      <InventoryPanel />
      {isTouch && (
        <MobileControls
          onDigStart={handleDigStart}
          onDigEnd={handleDigEnd}
          onInventoryToggle={toggleInventory}
          mode="mine"
        />
      )}
    </div>
  );
}
