import { useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '../stores/worldStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useHideoutPlateStore, PLATE_POSITIONS } from '../stores/hideoutPlateStore';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { WorldInteraction } from '../components/3d/WorldInteraction';
import { ParticleSystem } from '../components/3d/DiggingParticles';
import { BlockLights } from '../components/3d/BlockLights';
import { MinecartRenderer } from '../components/3d/Minecarts';
import { DayNightCycle } from '../components/3d/DayNightCycle';
import { PlateGhost } from '../components/3d/PlateGhost';
import { ambientMusic } from '../systems/AmbientMusic';
import { Hotbar } from '../components/ui/Hotbar';
import { HUD } from '../components/ui/HUD';
import { InventoryPanel } from '../components/ui/InventoryPanel';
import { ChestPanel } from '../components/ui/ChestPanel';
import { CraftingPanel } from '../components/ui/CraftingPanel';
import { PlateSelector } from '../components/ui/PlateSelector';
import { MobileControls, useTouchDetect } from '../components/ui/MobileControls';
import { FurnacePanel } from '../components/ui/FurnacePanel';
import { EnchantmentPanel } from '../components/ui/EnchantmentPanel';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType } from '../core/voxel/BlockRegistry';
import { applyPlateTemplate } from '../core/hideout/HideoutPlates';
import { HIDEOUT_SIZE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../utils/constants';
import { saveHideout, loadHideout } from '../utils/storage';
import { updateVoxelShaderUniforms } from '../core/voxel/VoxelShader';
import type { PlateTemplate, PlatePosition } from '../stores/hideoutPlateStore';

function getTimeEmoji(timeOfDay: number): string {
  if (timeOfDay > 0.2 && timeOfDay < 0.3) return '🌅';
  if (timeOfDay >= 0.3 && timeOfDay < 0.7) return '☀️';
  if (timeOfDay >= 0.7 && timeOfDay < 0.8) return '🌇';
  return '🌙';
}

export function HideoutScene() {
  const [mode, setMode] = useState<'mine' | 'build' | 'adventure'>('build');
  const chunks = useWorldStore((s) => s.chunks);
  const clearWorld = useWorldStore((s) => s.clearWorld);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);
  const placementMode = useHideoutPlateStore((s) => s.placementMode);
  const togglePlacementMode = useHideoutPlateStore((s) => s.togglePlacementMode);
  const isTouch = useTouchDetect();
  const [timeIndicator, setTimeIndicator] = useState('☀️');
  const [skyColor, setSkyColor] = useState('#2a3a4a');
  const [showSaved, setShowSaved] = useState(false);

  const handleTimeChange = useCallback((timeOfDay: number, sunIntensity: number) => {
    setTimeIndicator(getTimeEmoji(timeOfDay));
    const base = new THREE.Color(0x2a3a4a);
    const night = new THREE.Color(0x0a0a1a);
    const result = new THREE.Color().lerpColors(night, base, Math.max(0.1, sunIntensity));
    const newSkyColor = '#' + result.getHexString();
    setSkyColor(newSkyColor);
    updateVoxelShaderUniforms({ fogColor: new THREE.Color(newSkyColor) });
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => m === 'mine' ? 'build' : m === 'build' ? 'adventure' : 'mine');
  }, []);

  useEffect(() => {
    initHideout();
    ambientMusic.start('cave');
    return () => {
      clearWorld();
      ambientMusic.stop();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') toggleInventory();
      if (e.key === 'p' || e.key === 'P') togglePlacementMode();
      if (e.key === 'Tab') {
        e.preventDefault();
        if (placementMode) {
          togglePlacementMode();
        } else {
          toggleMode();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleInventory, toggleMode, placementMode, togglePlacementMode]);

  // Auto-save every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useWorldStore.getState();
      const chunkDataArray: { cx: number; cz: number; blocks: number[] }[] = [];
      state.chunks.forEach((entry, key) => {
        const [cx, cz] = key.split(',').map(Number);
        chunkDataArray.push({
          cx, cz,
          blocks: Array.from(entry.data.blocks),
        });
      });
      saveHideout(chunkDataArray);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const chunkEntries = useMemo(() => {
    const result: { key: string; cx: number; cz: number; geometry: THREE.BufferGeometry }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({ key, cx, cz, geometry: entry.geometry });
    });
    return result;
  }, [chunks]);

  const handlePlacePlate = useCallback((template: PlateTemplate, position: PlatePosition) => {
    const store = useWorldStore.getState();
    const plateStore = useHideoutPlateStore.getState();

    if (plateStore.isOccupied(position)) return;

    const plateChunks = applyPlateTemplate(template, position.originCx, position.originCz);
    const newChunks = new Map(store.chunks);

    for (const chunk of plateChunks) {
      const key = chunkKey(chunk.cx, chunk.cz);
      const existing = newChunks.get(key);
      if (existing) {
        existing.geometry.dispose();
      }
      const geometry = buildChunkMesh(chunk);
      newChunks.set(key, { data: chunk, geometry, dirty: false });
    }

    useWorldStore.setState({ chunks: newChunks });
    plateStore.markOccupied(position);
  }, []);

  const handleRemovePlate = useCallback((position: PlatePosition) => {
    const store = useWorldStore.getState();
    const plateStore = useHideoutPlateStore.getState();

    if (!plateStore.isOccupied(position)) return;

    const newChunks = new Map(store.chunks);

    // Remove the 4 chunks of this plate
    for (let dcx = 0; dcx < 2; dcx++) {
      for (let dcz = 0; dcz < 2; dcz++) {
        const key = chunkKey(position.originCx + dcx, position.originCz + dcz);
        const existing = newChunks.get(key);
        if (existing) {
          existing.geometry.dispose();
          newChunks.delete(key);
        }
      }
    }

    useWorldStore.setState({ chunks: newChunks });
    plateStore.removeOccupied(position);
  }, []);

  const handleDigStart = useCallback(() => {
    (window as any).__digyPointer?.startDig();
  }, []);
  const handleDigEnd = useCallback(() => {
    (window as any).__digyPointer?.stopDig();
  }, []);

  // Calculate camera target and grid size based on existing chunks
  const cameraMaxDist = placementMode ? 120 : CAMERA_MAX_DISTANCE;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        camera={{ position: [15, 20, 15], fov: 50, near: 0.1, far: 300 }}
        style={{ background: skyColor }}
      >
        <DayNightCycle cycleDuration={120} onTimeChange={handleTimeChange} />
        <pointLight position={[0, 15, 0]} intensity={0.3} />

        <OrbitControls
          target={[16, 3, 16]}
          minDistance={CAMERA_MIN_DISTANCE}
          maxDistance={cameraMaxDist}
          minPolarAngle={CAMERA_MIN_POLAR}
          maxPolarAngle={CAMERA_MAX_POLAR}
          enablePan={true}
          panSpeed={0.8}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />

        {chunkEntries.map((c) => (
          <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
        ))}

        {!placementMode && <WorldInteraction mode={mode} />}
        <BlockLights />
        <MinecartRenderer center={[16, 3, 16]} />
        <ParticleSystem />
        <PlateGhost />

        <gridHelper args={[HIDEOUT_SIZE, HIDEOUT_SIZE, '#334455', '#223344']} position={[HIDEOUT_SIZE / 2, 0, HIDEOUT_SIZE / 2]} />

        <fog attach="fog" args={[skyColor, 60, 140]} />
      </Canvas>

      <HUD mode={mode} onModeToggle={toggleMode} timeIndicator={timeIndicator} onPlateToggle={togglePlacementMode} placementMode={placementMode} showSaveIndicator={showSaved} />
      <Hotbar />
      <InventoryPanel />
      <ChestPanel />
      <CraftingPanel />
      <FurnacePanel />
      <EnchantmentPanel />
      <PlateSelector onPlacePlate={handlePlacePlate} onRemovePlate={handleRemovePlate} />
      {isTouch && (
        <MobileControls
          onDigStart={handleDigStart}
          onDigEnd={handleDigEnd}
          onInventoryToggle={toggleInventory}
          onModeToggle={toggleMode}
          mode={mode}
        />
      )}
    </div>
  );
}

async function initHideout() {
  const store = useWorldStore.getState();
  store.clearWorld();

  // Detect occupied plate positions from saved data
  const plateStore = useHideoutPlateStore.getState();

  const saved = await loadHideout();

  if (saved && saved.length > 0) {
    const chunks = new Map();
    for (const sc of saved) {
      const chunk = new ChunkData(sc.cx, sc.cz);
      chunk.blocks.set(new Uint8Array(sc.blocks));
      const geometry = buildChunkMesh(chunk);
      chunks.set(chunkKey(sc.cx, sc.cz), { data: chunk, geometry, dirty: false });
    }
    useWorldStore.setState({ chunks });

    // Detect which plate positions are occupied (any chunk outside main 0,0-1,1 range)
    for (const pos of PLATE_POSITIONS) {
      const key = chunkKey(pos.originCx, pos.originCz);
      if (chunks.has(key)) {
        plateStore.markOccupied(pos);
      }
    }
  } else {
    const radius = 1;
    const newChunks = new Map();

    for (let cx = 0; cx <= radius; cx++) {
      for (let cz = 0; cz <= radius; cz++) {
        const chunk = new ChunkData(cx, cz);
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            chunk.setBlock(x, 0, z, BlockType.STONE);
            chunk.setBlock(x, 1, z, BlockType.DIRT);
            chunk.setBlock(x, 2, z, BlockType.GRASS);
          }
        }
        const geometry = buildChunkMesh(chunk);
        newChunks.set(chunkKey(cx, cz), { data: chunk, geometry, dirty: false });
      }
    }

    useWorldStore.setState({ chunks: newChunks, biomeType: null });
  }
}
