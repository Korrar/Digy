import { useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '../stores/worldStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { WorldInteraction } from '../components/3d/WorldInteraction';
import { Hotbar } from '../components/ui/Hotbar';
import { HUD } from '../components/ui/HUD';
import { InventoryPanel } from '../components/ui/InventoryPanel';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType } from '../core/voxel/BlockRegistry';
import { HIDEOUT_SIZE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR } from '../utils/constants';
import { saveHideout, loadHideout } from '../utils/storage';

export function HideoutScene() {
  const [mode, setMode] = useState<'mine' | 'build'>('build');
  const chunks = useWorldStore((s) => s.chunks);
  const clearWorld = useWorldStore((s) => s.clearWorld);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);

  const toggleMode = useCallback(() => {
    setMode((m) => m === 'mine' ? 'build' : 'mine');
  }, []);

  useEffect(() => {
    // Generate flat hideout platform
    initHideout();
    return () => clearWorld();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') toggleInventory();
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleInventory, toggleMode]);

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

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        camera={{ position: [15, 20, 15], fov: 50, near: 0.1, far: 300 }}
        style={{ background: '#2a3a4a' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 30, 15]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={80}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <pointLight position={[0, 15, 0]} intensity={0.3} />

        <OrbitControls
          target={[8, 3, 8]}
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

        <WorldInteraction mode={mode} />

        {/* Grid helper for building area */}
        <gridHelper args={[HIDEOUT_SIZE, HIDEOUT_SIZE, '#334455', '#223344']} position={[HIDEOUT_SIZE / 2, 0, HIDEOUT_SIZE / 2]} />

        <fog attach="fog" args={['#2a3a4a', 40, 80]} />
      </Canvas>

      <HUD mode={mode} onModeToggle={toggleMode} />
      <Hotbar />
      <InventoryPanel />
    </div>
  );
}

async function initHideout() {
  const store = useWorldStore.getState();
  store.clearWorld();

  // Try loading saved hideout
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
  } else {
    // Generate flat platform
    const radius = 1; // 2x2 chunks = 32x32 blocks
    const newChunks = new Map();

    for (let cx = 0; cx <= radius; cx++) {
      for (let cz = 0; cz <= radius; cz++) {
        const chunk = new ChunkData(cx, cz);
        // Flat stone floor at y=0
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
