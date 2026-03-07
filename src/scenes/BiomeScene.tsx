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
import { settleWorld } from '../systems/SandPhysics';
import { updateVoxelShaderUniforms } from '../core/voxel/VoxelShader';
import { useFireflies, FIREFLY_COUNT } from '../components/3d/Fireflies';
import { useAnimals, BIOME_ANIMALS } from '../components/3d/Animals';
import { useWeather } from '../components/3d/Weather';

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
    const newSkyColor = getSkyColor(biome.config.skyColor, sunIntensity);
    setSkyColor(newSkyColor);
    updateVoxelShaderUniforms({ fogColor: new THREE.Color(newSkyColor) });
  }, [biome.config.skyColor]);

  useEffect(() => {
    generateWorld(biomeType, biomeSeed, 1);
    settleWorld();
    // Set shader uniforms for cave (static lighting, no DayNightCycle)
    if (biomeType === 'cave') {
      updateVoxelShaderUniforms({
        ambientColor: new THREE.Color(0x4466aa),
        ambientIntensity: biome.config.ambientLight,
        lightColor: new THREE.Color(0xff9944),
        lightIntensity: 0.3,
        lightDirection: new THREE.Vector3(0.5, 0.7, 0.3),
        fogColor: new THREE.Color(biome.config.skyColor),
      });
    }
    return () => clearWorld();
  }, [biomeType, biomeSeed, generateWorld, clearWorld, biome]);

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
        camera={{ position: [24, 25, 24], fov: 50, near: 0.1, far: 500 }}
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
            <pointLight position={[8, 20, 8]} intensity={0.5} color="#ff9944" distance={40} />
          </>
        )}

        <OrbitControls
          target={[8, 8, 8]}
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
        {(biomeType === 'forest' || biomeType === 'swamp') && (
          <FirefliesRenderer center={[8, 0, 8]} />
        )}
        {biomeType !== 'cave' && BIOME_ANIMALS[biomeType] && (
          <AnimalRenderer biomeType={biomeType} center={[8, 8, 8]} />
        )}
        <WeatherRenderer biomeType={biomeType} center={[8, 8, 8]} />

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

function FirefliesRenderer({ center }: { center: [number, number, number] }) {
  const { meshRef, lightRefs, count } = useFireflies(center, true);
  if (count === 0) return null;
  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, FIREFLY_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#aaff44" transparent opacity={0.9} />
      </instancedMesh>
      {Array.from({ length: 5 }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => { lightRefs.current[i] = el; }}
          color="#aaff44"
          intensity={0}
          distance={6}
          decay={2}
        />
      ))}
    </>
  );
}

function AnimalRenderer({ biomeType, center }: { biomeType: string; center: [number, number, number] }) {
  const { meshRef, count, color } = useAnimals(biomeType, center);
  if (count === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 0.7, 1.4]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}

function WeatherRenderer({ biomeType, center }: { biomeType: string; center: [number, number, number] }) {
  const { pointsRef, positionArray, config, count } = useWeather(biomeType, center);
  if (count === 0 || !config || config.type === 'none') return null;
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionArray, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={config.color}
        size={config.size}
        transparent
        opacity={config.type === 'fog' ? 0.3 : 0.7}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
