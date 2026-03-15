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
import { ChestPanel } from '../components/ui/ChestPanel';
import { MobileControls, useTouchDetect } from '../components/ui/MobileControls';
import { useInventoryStore } from '../stores/inventoryStore';
import { CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../utils/constants';
import { settleWorld } from '../systems/SandPhysics';
import { updateVoxelShaderUniforms } from '../core/voxel/VoxelShader';
import { useFireflies, FIREFLY_COUNT } from '../components/3d/Fireflies';
import { useAnimals, BIOME_ANIMALS } from '../components/3d/Animals';
import { useWeather } from '../components/3d/Weather';
import { TappablesRenderer } from '../components/3d/Tappables';
import { EnemiesRenderer } from '../components/3d/Enemies';
import { CraftingPanel } from '../components/ui/CraftingPanel';
import { LootPopup } from '../components/ui/LootPopup';
import { HealthBar } from '../components/ui/HealthBar';
import { useTappablesStore } from '../stores/tappablesStore';
import { useCombatStore, BIOME_DIFFICULTY } from '../stores/combatStore';
import { useCraftingStore } from '../stores/craftingStore';
import { ambientMusic } from '../systems/AmbientMusic';
import { MinecartRenderer } from '../components/3d/Minecarts';
import { BlockLights } from '../components/3d/BlockLights';
import { StarrySky } from '../components/3d/StarrySky';
import { ModeToggle, cycleMode } from '../components/ui/ModeToggle';
import type { GameMode } from '../components/ui/ModeToggle';
import { AmbientParticles } from '../components/3d/AmbientParticles';
import { TNTEntities } from '../components/3d/TNTEntities';
import { WaterPlane } from '../components/3d/WaterPlane';
import { Minimap } from '../components/ui/Minimap';
import { FloatingText } from '../components/ui/FloatingText';
import { VillageNPCs } from '../components/3d/VillageNPCs';
import { useNPCStore } from '../stores/npcStore';

/** Water color per biome */
const BIOME_WATER_COLOR: Record<string, string> = {
  forest: '#2a6090',
  desert: '#4090a0',
  mountains: '#3070a0',
  swamp: '#304030',
  tundra: '#5080a0',
  jungle: '#206050',
  mushroom: '#3a4060',
  volcanic: '#402010',
  savanna: '#4090a0',
  cherry: '#5070a0',
  village: '#3080a0',
};

function getTimeIndicator(timeOfDay: number): string {
  if (timeOfDay > 0.2 && timeOfDay < 0.3) return 'sunrise';
  if (timeOfDay >= 0.3 && timeOfDay < 0.7) return 'day';
  if (timeOfDay >= 0.7 && timeOfDay < 0.8) return 'sunset';
  return 'night';
}

function getSkyColor(baseSkyColor: string, sunIntensity: number): string {
  const base = new THREE.Color(baseSkyColor);
  // Brighter night sky (dark blue, not black)
  const nightSky = new THREE.Color(0x0e1428);
  // Golden hour tint
  const goldenSky = new THREE.Color(0xffcc66);
  // Use higher minimum so night is never fully black
  const minBrightness = 0.12;
  const result = new THREE.Color().lerpColors(nightSky, base, Math.max(minBrightness, sunIntensity));
  // Add golden tint during sunrise/sunset (sunIntensity between 0.15-0.5)
  if (sunIntensity > 0.1 && sunIntensity < 0.5) {
    const goldenBlend = 1.0 - Math.abs(sunIntensity - 0.25) / 0.25;
    if (goldenBlend > 0) {
      result.lerp(goldenSky, goldenBlend * 0.35);
    }
  }
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
  const [timeIndicator, setTimeIndicator] = useState('day');
  const [gameMode, setGameMode] = useState<GameMode>('mine');
  const [skyColor, setSkyColor] = useState(biome.config.skyColor);
  const [sunIntensity, setSunIntensity] = useState(1.0);

  const handleTimeChange = useCallback((timeOfDay: number, intensity: number) => {
    setTimeIndicator(getTimeIndicator(timeOfDay));
    setSunIntensity(intensity);
    const newSkyColor = getSkyColor(biome.config.skyColor, intensity);
    setSkyColor(newSkyColor);
    updateVoxelShaderUniforms({ fogColor: new THREE.Color(newSkyColor) });
  }, [biome.config.skyColor]);

  const clearTappables = useTappablesStore((s) => s.clearTappables);
  const resetCombat = useCombatStore((s) => s.resetCombat);
  const setDifficulty = useCombatStore((s) => s.setDifficulty);
  const spawnVillageNPCs = useNPCStore((s) => s.spawnVillageNPCs);
  const clearNPCs = useNPCStore((s) => s.clearNPCs);
  const isGameOver = useCombatStore((s) => s.isGameOver);
  const respawn = useCombatStore((s) => s.respawn);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  useEffect(() => {
    setDifficulty(BIOME_DIFFICULTY[biomeType] ?? 1.0);
    generateWorld(biomeType, biomeSeed, biomeType === 'village' ? 2 : 1);
    settleWorld();
    // Spawn village NPCs
    if (biomeType === 'village') {
      spawnVillageNPCs(8, 10, 8);
    }
    // Start ambient music for biome
    ambientMusic.start(biomeType as any);
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
    return () => {
      clearWorld();
      clearTappables();
      resetCombat();
      clearNPCs();
      ambientMusic.stop();
    };
  }, [biomeType, biomeSeed, generateWorld, clearWorld, biome, clearTappables, resetCombat, spawnVillageNPCs, clearNPCs]);

  const toggleCrafting = useCraftingStore((s) => s.toggleCrafting);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') toggleInventory();
      if (e.key === 'c' || e.key === 'C') toggleCrafting();
      if (e.key === 'Tab') {
        e.preventDefault();
        setGameMode((m) => cycleMode(m));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleInventory, toggleCrafting]);

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

        <WorldInteraction mode={gameMode} />
        <MinecartRenderer center={[8, 8, 8]} />
        <TNTEntities />
        <BlockLights />
        {biomeType !== 'cave' && <StarrySky sunIntensity={sunIntensity} />}
        <ParticleSystem />
        <AmbientParticles center={[8, 8, 8]} />
        {(biomeType === 'forest' || biomeType === 'swamp') && (
          <FirefliesRenderer center={[8, 0, 8]} />
        )}
        {biomeType !== 'cave' && BIOME_ANIMALS[biomeType] && (
          <AnimalRenderer biomeType={biomeType} center={[8, 8, 8]} />
        )}
        <WeatherRenderer biomeType={biomeType} center={[8, 8, 8]} />
        <TappablesRenderer biomeType={biomeType} center={[8, 8, 8]} />
        <EnemiesRenderer biomeType={biomeType} center={[8, 8, 8]} />
        {biomeType === 'village' && <VillageNPCs />}

        {biomeType !== 'cave' && (
          <WaterPlane
            waterLevel={3.4}
            size={biomeType === 'village' ? 160 : 80}
            position={[8, 8]}
            color={BIOME_WATER_COLOR[biomeType] || '#2a6090'}
          />
        )}

        <fog attach="fog" args={[skyColor, biomeType === 'village' ? 50 : 30, biomeType === 'village' ? 140 : 80]} />
      </Canvas>

      <HUD timeIndicator={biomeType !== 'cave' ? timeIndicator : undefined} />
      <HealthBar />
      <ModeToggle mode={gameMode} onToggle={() => setGameMode((m) => cycleMode(m))} />
      <Hotbar />
      <InventoryPanel />
      <ChestPanel />
      <CraftingPanel />
      <LootPopup />
      <Minimap center={[8, 8]} />
      <FloatingText />
      {isTouch && (
        <MobileControls
          onDigStart={handleDigStart}
          onDigEnd={handleDigEnd}
          onInventoryToggle={toggleInventory}
          mode={gameMode}
        />
      )}

      {/* Game Over overlay */}
      {isGameOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(80,0,0,0.8)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <h1 style={{ color: '#ff4444', fontSize: 36, fontWeight: 900, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            Game Over
          </h1>
          <p style={{ color: '#ffaaaa', fontSize: 14, margin: 0 }}>Zostales pokonany!</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={respawn} style={{
              padding: '12px 28px', border: '2px solid rgba(100,255,100,0.4)', borderRadius: 10,
              background: 'rgba(40,120,40,0.6)', color: '#aaffaa', fontSize: 16,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Odrodzenie
            </button>
            <button onClick={returnToMenu} style={{
              padding: '12px 28px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10,
              background: 'rgba(255,255,255,0.1)', color: '#ccc', fontSize: 16,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Menu
            </button>
          </div>
        </div>
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
  const { meshRef, geometry, count } = useAnimals(biomeType, center);
  if (count === 0 || !geometry) return null;
  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshLambertMaterial vertexColors />
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
