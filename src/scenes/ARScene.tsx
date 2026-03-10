import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, IfInSessionMode } from '@react-three/xr';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { BlockLights } from '../components/3d/BlockLights';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType } from '../core/voxel/BlockRegistry';
import { loadHideout, saveARPositions, loadARPositions, type ARModelPosition } from '../utils/storage';
import { PLATE_POSITIONS } from '../core/hideout/HideoutPlates';
import { useHideoutPlateStore } from '../stores/hideoutPlateStore';
import { createBiome } from '../core/terrain/biomes';
import { placeStructures } from '../core/terrain/StructureGenerator';
import { CHUNK_SIZE } from '../utils/constants';
import { updateVoxelShaderUniforms } from '../core/voxel/VoxelShader';

const xrStore = createXRStore({
  domOverlay: true,
  hitTest: true,
});

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

type ARModelId = 'hideout' | 'biome';

interface PlacedModel {
  id: ARModelId;
  matrix: THREE.Matrix4;
  scale: number;
  rotation: number;
  chunks: Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>;
}

// ──────────────────────────────────────────────────────
// AR Hit Test Reticle
// ──────────────────────────────────────────────────────

function HitTestReticle({ onHitUpdate }: { onHitUpdate: (matrix: THREE.Matrix4 | null) => void }) {
  const reticleRef = useRef<THREE.Mesh>(null);
  const matHelper = useMemo(() => new THREE.Matrix4(), []);

  useXRHitTest((results, getWorldMatrix) => {
    if (results.length === 0 || !reticleRef.current) {
      onHitUpdate(null);
      if (reticleRef.current) reticleRef.current.visible = false;
      return;
    }
    if (getWorldMatrix(matHelper, results[0])) {
      reticleRef.current.visible = true;
      reticleRef.current.position.setFromMatrixPosition(matHelper);
      reticleRef.current.quaternion.setFromRotationMatrix(matHelper);
      onHitUpdate(matHelper.clone());
    }
  }, 'viewer');

  return (
    <mesh ref={reticleRef} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.08, 0.1, 32]} />
      <meshBasicMaterial color="#44ff88" side={THREE.DoubleSide} transparent opacity={0.7} />
    </mesh>
  );
}

// ──────────────────────────────────────────────────────
// Shadow Plane - receives shadow for realism
// ──────────────────────────────────────────────────────

function ShadowPlane({ matrix }: { matrix: THREE.Matrix4 }) {
  const pos = useMemo(() => {
    const p = new THREE.Vector3().setFromMatrixPosition(matrix);
    return [p.x, p.y - 0.001, p.z] as [number, number, number];
  }, [matrix]);

  return (
    <mesh position={pos} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[4, 4]} />
      <shadowMaterial transparent opacity={0.35} />
    </mesh>
  );
}

// ──────────────────────────────────────────────────────
// AR Model Renderer (single placed model)
// ──────────────────────────────────────────────────────

function ARModelRenderer({ model }: { model: PlacedModel }) {
  const groupRef = useRef<THREE.Group>(null);

  const chunkEntries = useMemo(() => {
    const result: { key: string; cx: number; cz: number; geometry: THREE.BufferGeometry }[] = [];
    model.chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({ key, cx, cz, geometry: entry.geometry });
    });
    return result;
  }, [model.chunks]);

  const { position, quaternion } = useMemo(() => {
    const pos = new THREE.Vector3().setFromMatrixPosition(model.matrix);
    const quat = new THREE.Quaternion().setFromRotationMatrix(model.matrix);
    const userRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation);
    quat.multiply(userRot);
    return {
      position: pos.toArray() as [number, number, number],
      quaternion: [quat.x, quat.y, quat.z, quat.w] as [number, number, number, number],
    };
  }, [model.matrix, model.rotation]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.setScalar(model.scale);
    }
  }, [model.scale]);

  const centerOffset = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    model.chunks.forEach((_, key) => {
      const [cx, cz] = key.split(',').map(Number);
      minX = Math.min(minX, cx * 16);
      maxX = Math.max(maxX, (cx + 1) * 16);
      minZ = Math.min(minZ, cz * 16);
      maxZ = Math.max(maxZ, (cz + 1) * 16);
    });
    if (!isFinite(minX)) return [0, 0, 0] as [number, number, number];
    return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2] as [number, number, number];
  }, [model.chunks]);

  return (
    <group ref={groupRef} position={position} quaternion={quaternion} scale={model.scale}>
      <group position={centerOffset}>
        {chunkEntries.map((c) => (
          <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
        ))}
        <BlockLights />
      </group>
    </group>
  );
}

// ──────────────────────────────────────────────────────
// 3D Preview Component (pre-AR, orbitable preview)
// ──────────────────────────────────────────────────────

function PreviewModel({ chunks }: { chunks: Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }> }) {
  const chunkEntries = useMemo(() => {
    const result: { key: string; cx: number; cz: number; geometry: THREE.BufferGeometry }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({ key, cx, cz, geometry: entry.geometry });
    });
    return result;
  }, [chunks]);

  const centerOffset = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      minX = Math.min(minX, cx * 16);
      maxX = Math.max(maxX, (cx + 1) * 16);
      minZ = Math.min(minZ, cz * 16);
      maxZ = Math.max(maxZ, (cz + 1) * 16);
      // Estimate max height from geometry bounding box
      entry.geometry.computeBoundingBox();
      const bb = entry.geometry.boundingBox;
      if (bb) {
        maxY = Math.max(maxY, bb.max.y);
      }
    });
    if (!isFinite(minX)) return [0, 0, 0] as [number, number, number];
    return [-(minX + maxX) / 2, -maxY / 2, -(minZ + maxZ) / 2] as [number, number, number];
  }, [chunks]);

  return (
    <group position={centerOffset}>
      {chunkEntries.map((c) => (
        <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
      ))}
      <BlockLights />
    </group>
  );
}

function AutoRotate() {
  const { scene } = useThree();
  useFrame((_, delta) => {
    const group = scene.children.find(c => c.userData.autoRotateTarget);
    if (group) {
      group.rotation.y += delta * 0.3;
    }
  });
  return null;
}

/**
 * Fix for biome blurring/stair artifact in AR:
 * The VoxelShader uses fog based on view depth. At AR scale (0.03x),
 * the fog near/far distances create visible banding. This component
 * disables fog and keeps the shader time updated for AR rendering.
 */
function ARShaderFix() {
  useEffect(() => {
    // Push fog distances very far to effectively disable it in AR
    updateVoxelShaderUniforms({
      fogNear: 9999,
      fogFar: 99999,
      fogColor: new THREE.Color(0x000000),
      // Good AR lighting
      ambientIntensity: 0.9,
      lightIntensity: 0.7,
      lightDirection: new THREE.Vector3(0.3, 0.8, 0.5),
    });
  }, []);

  useFrame((state) => {
    updateVoxelShaderUniforms({ time: state.clock.elapsedTime });
  });

  return null;
}

// ──────────────────────────────────────────────────────
// Pinch-to-Scale Hook
// ──────────────────────────────────────────────────────

function usePinchToScale(
  enabled: boolean,
  currentScale: number,
  onScaleChange: (scale: number) => void,
  min: number = 0.005,
  max: number = 0.1,
) {
  const initialDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(currentScale);

  useEffect(() => {
    if (!enabled) return;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return null;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getDistance(e.touches);
        if (dist !== null) {
          initialDistRef.current = dist;
          initialScaleRef.current = currentScale;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistRef.current !== null) {
        const dist = getDistance(e.touches);
        if (dist !== null) {
          const ratio = dist / initialDistRef.current;
          const newScale = Math.max(min, Math.min(max, initialScaleRef.current * ratio));
          onScaleChange(newScale);
        }
      }
    };

    const handleTouchEnd = () => {
      initialDistRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, currentScale, onScaleChange, min, max]);
}

// ──────────────────────────────────────────────────────
// Main AR Scene
// ──────────────────────────────────────────────────────

export function ARScene() {
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const currentBiome = useGameStore((s) => s.currentBiome);
  const biomeSeed = useGameStore((s) => s.biomeSeed);

  // Models state: multiple placed models
  const [placedModels, setPlacedModels] = useState<PlacedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<ARModelId | null>(null);
  const [placingModelId, setPlacingModelId] = useState<ARModelId | null>(null);

  // Scale/rotation for the currently selected model
  const [arScale, setArScale] = useState(0.03);
  const [rotation, setRotation] = useState(0);

  const hitMatrixRef = useRef<THREE.Matrix4 | null>(null);
  const [arSessionActive, setArSessionActive] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(true);

  // Chunk data for each model type
  const hideoutChunksRef = useRef<Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>>(new Map());
  const biomeChunksRef = useRef<Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>>(new Map());

  // Preview tab
  const [previewTab, setPreviewTab] = useState<'hideout' | 'biome'>('hideout');
  const [previewChunks, setPreviewChunks] = useState<Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>>(new Map());

  // Pinch-to-scale
  const handlePinchScale = useCallback((newScale: number) => {
    setArScale(newScale);
    if (selectedModelId) {
      setPlacedModels(prev => prev.map(m =>
        m.id === selectedModelId ? { ...m, scale: newScale } : m
      ));
    }
  }, [selectedModelId]);

  usePinchToScale(arSessionActive && selectedModelId !== null, arScale, handlePinchScale);

  // Load data on mount
  useEffect(() => {
    loadAllData().then(() => setLoadingChunks(false));
  }, []);

  async function loadAllData() {
    // Load hideout
    const hideoutChunks = await loadHideoutChunks();
    hideoutChunksRef.current = hideoutChunks;

    // Generate biome
    const biomeChunks = generateBiomeChunks(currentBiome, biomeSeed);
    biomeChunksRef.current = biomeChunks;

    // Set preview to hideout by default
    setPreviewChunks(hideoutChunks.size > 0 ? hideoutChunks : biomeChunks);
    if (hideoutChunks.size === 0) setPreviewTab('biome');

    // Load saved AR positions
    const saved = await loadARPositions();
    if (saved && saved.length > 0) {
      const restored: PlacedModel[] = [];
      for (const pos of saved) {
        const mat = new THREE.Matrix4();
        mat.fromArray(pos.matrixElements);
        const chunks = pos.id === 'hideout' ? hideoutChunks : biomeChunks;
        if (chunks.size > 0) {
          restored.push({
            id: pos.id as ARModelId,
            matrix: mat,
            scale: pos.scale,
            rotation: pos.rotation,
            chunks,
          });
        }
      }
      setPlacedModels(restored);
    }
  }

  // Update preview when tab changes
  useEffect(() => {
    if (previewTab === 'hideout') {
      setPreviewChunks(hideoutChunksRef.current);
    } else {
      setPreviewChunks(biomeChunksRef.current);
    }
  }, [previewTab]);

  const handleHitUpdate = useCallback((matrix: THREE.Matrix4 | null) => {
    hitMatrixRef.current = matrix;
  }, []);

  const handlePlace = useCallback(() => {
    if (!hitMatrixRef.current || !placingModelId) return;
    const chunks = placingModelId === 'hideout' ? hideoutChunksRef.current : biomeChunksRef.current;
    if (chunks.size === 0) return;

    const newModel: PlacedModel = {
      id: placingModelId,
      matrix: hitMatrixRef.current.clone(),
      scale: arScale,
      rotation: rotation,
      chunks,
    };

    setPlacedModels(prev => {
      // Replace existing model of same type or add new
      const existing = prev.findIndex(m => m.id === placingModelId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newModel;
        return updated;
      }
      return [...prev, newModel];
    });
    setSelectedModelId(placingModelId);
    setPlacingModelId(null);
  }, [placingModelId, arScale, rotation]);

  const handleStartPlacing = useCallback((id: ARModelId) => {
    setPlacingModelId(id);
    setSelectedModelId(null);
  }, []);

  const handleResetModel = useCallback((id: ARModelId) => {
    setPlacedModels(prev => prev.filter(m => m.id !== id));
    setSelectedModelId(null);
    setPlacingModelId(id);
  }, []);

  const handleSelectModel = useCallback((id: ARModelId) => {
    const model = placedModels.find(m => m.id === id);
    if (model) {
      setSelectedModelId(id);
      setArScale(model.scale);
      setRotation(model.rotation);
    }
  }, [placedModels]);

  // Persist AR positions whenever models change
  useEffect(() => {
    if (placedModels.length > 0) {
      const positions: ARModelPosition[] = placedModels.map(m => ({
        id: m.id,
        matrixElements: m.matrix.toArray(),
        scale: m.scale,
        rotation: m.rotation,
      }));
      saveARPositions(positions);
    }
  }, [placedModels]);

  // Update selected model when scale/rotation changes
  useEffect(() => {
    if (selectedModelId) {
      setPlacedModels(prev => prev.map(m =>
        m.id === selectedModelId ? { ...m, scale: arScale, rotation } : m
      ));
    }
  }, [arScale, rotation, selectedModelId]);

  const handleStartAR = useCallback(async () => {
    try {
      // Load chunks into worldStore for BlockLights
      const allChunks = new Map<string, { data: ChunkData; geometry: THREE.BufferGeometry; dirty: boolean }>();
      hideoutChunksRef.current.forEach((entry, key) => {
        allChunks.set('h_' + key, { ...entry, dirty: false });
      });
      useWorldStore.setState({ chunks: allChunks as any });

      await xrStore.enterAR();
      setArSessionActive(true);
    } catch (e) {
      console.warn('Failed to start AR session:', e);
      alert('AR nie jest wspierane na tym urzadzeniu. Wymagana przegladarka z WebXR (Chrome Android).');
    }
  }, []);

  const handleExit = useCallback(() => {
    xrStore.getState().session?.end();
    setArSessionActive(false);
    useWorldStore.getState().clearWorld();
    returnToMenu();
  }, [returnToMenu]);

  const hasHideout = hideoutChunksRef.current.size > 0;
  const hasBiome = biomeChunksRef.current.size > 0;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 1.6, 0], fov: 70 }}
        shadows
      >
        <XR store={xrStore}>
          {/* AR lighting with shadows */}
          <ambientLight intensity={0.8} />
          <directionalLight
            position={[3, 8, 5]}
            intensity={1.0}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.1}
            shadow-camera-far={20}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
          />

          {/* Fix fog/shader for AR to prevent biome blurring */}
          <ARShaderFix />

          <IfInSessionMode allow="immersive-ar">
            {/* Reticle when placing */}
            {placingModelId && <HitTestReticle onHitUpdate={handleHitUpdate} />}

            {/* Render all placed models */}
            {placedModels.map((model) => (
              <group key={model.id}>
                <ARModelRenderer model={model} />
                <ShadowPlane matrix={model.matrix} />
              </group>
            ))}
          </IfInSessionMode>

          <XRDomOverlay>
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none',
              zIndex: 1000,
            }}>
              {/* Top bar */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                padding: 'env(safe-area-inset-top, 8px) 12px 8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'auto',
              }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  AR Digy
                </span>
                <button onClick={handleExit} style={arBtnStyle('#cc4444')}>
                  Zamknij
                </button>
              </div>

              {/* Bottom controls */}
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '12px 16px env(safe-area-inset-bottom, 16px) 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'center',
                pointerEvents: 'auto',
              }}>
                {placingModelId ? (
                  /* Placing mode */
                  <>
                    <span style={{ ...labelStyle, fontSize: 13 }}>
                      Postaw: {placingModelId === 'hideout' ? 'Kryjowka' : 'Biom'}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handlePlace} style={arBtnStyle('#44aa66')}>
                        Postaw tutaj
                      </button>
                      <button onClick={() => setPlacingModelId(null)} style={arBtnStyle('#666')}>
                        Anuluj
                      </button>
                    </div>
                  </>
                ) : selectedModelId ? (
                  /* Edit mode for selected model */
                  <>
                    <span style={{ ...labelStyle, fontSize: 13, color: '#aaffcc' }}>
                      {selectedModelId === 'hideout' ? 'Kryjowka' : 'Biom'}
                    </span>

                    {/* Scale slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300 }}>
                      <span style={labelStyle}>Skala</span>
                      <input
                        type="range"
                        min="0.005"
                        max="0.1"
                        step="0.001"
                        value={arScale}
                        onChange={(e) => setArScale(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={labelStyle}>{Math.round(arScale * 1000)}mm</span>
                    </div>

                    {/* Rotation slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300 }}>
                      <span style={labelStyle}>Obrot</span>
                      <input
                        type="range"
                        min="0"
                        max={String(Math.PI * 2)}
                        step="0.05"
                        value={rotation}
                        onChange={(e) => setRotation(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={labelStyle}>{Math.round(rotation * 180 / Math.PI)}°</span>
                    </div>

                    <span style={{ ...labelStyle, fontSize: 10, color: '#8899aa' }}>
                      Szczypnij aby skalowac
                    </span>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button onClick={() => handleResetModel(selectedModelId)} style={arBtnStyle('#aa8844')}>
                        Przeloz
                      </button>
                      <button onClick={() => setSelectedModelId(null)} style={arBtnStyle('#5577aa')}>
                        OK
                      </button>
                    </div>
                  </>
                ) : (
                  /* Model selection / placement menu */
                  <>
                    {/* Show placed models for editing */}
                    {placedModels.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        {placedModels.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            style={arBtnStyle('#335577')}
                          >
                            {m.id === 'hideout' ? 'Edytuj Kryjowke' : 'Edytuj Biom'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Place new models */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {hasHideout && !placedModels.find(m => m.id === 'hideout') && (
                        <button onClick={() => handleStartPlacing('hideout')} style={arBtnStyle('#44aa66')}>
                          Postaw Kryjowke
                        </button>
                      )}
                      {hasBiome && !placedModels.find(m => m.id === 'biome') && (
                        <button onClick={() => handleStartPlacing('biome')} style={arBtnStyle('#4488aa')}>
                          Postaw Biom
                        </button>
                      )}
                    </div>

                    <button onClick={handleExit} style={arBtnStyle('#cc4444')}>
                      Zakoncz
                    </button>
                  </>
                )}
              </div>
            </div>
          </XRDomOverlay>
        </XR>
      </Canvas>

      {/* Pre-AR overlay with 3D preview */}
      {!arSessionActive && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 2000,
          padding: '16px 16px 0 16px',
          overflow: 'hidden',
        }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '8px 0 4px 0', textAlign: 'center' }}>
            AR Podglad
          </h2>

          {loadingChunks ? (
            <p style={{ color: '#aaa', fontSize: 14, marginTop: 40 }}>Ladowanie danych...</p>
          ) : (
            <>
              {/* Tab selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {hasHideout && (
                  <button
                    onClick={() => setPreviewTab('hideout')}
                    style={{
                      ...tabStyle,
                      background: previewTab === 'hideout' ? 'rgba(68,170,102,0.5)' : 'rgba(255,255,255,0.08)',
                      borderColor: previewTab === 'hideout' ? 'rgba(100,255,200,0.4)' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    Kryjowka
                  </button>
                )}
                {hasBiome && (
                  <button
                    onClick={() => setPreviewTab('biome')}
                    style={{
                      ...tabStyle,
                      background: previewTab === 'biome' ? 'rgba(68,136,170,0.5)' : 'rgba(255,255,255,0.08)',
                      borderColor: previewTab === 'biome' ? 'rgba(100,200,255,0.4)' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    Biom ({currentBiome})
                  </button>
                )}
              </div>

              {/* 3D Preview */}
              <div style={{
                flex: 1,
                width: '100%',
                maxHeight: '55vh',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
                marginBottom: 12,
              }}>
                {previewChunks.size > 0 && (
                  <Canvas
                    camera={{ position: [20, 25, 20], fov: 50 }}
                    style={{ width: '100%', height: '100%' }}
                    shadows
                  >
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
                    <group userData={{ autoRotateTarget: true }}>
                      <PreviewModel chunks={previewChunks} />
                    </group>
                    <AutoRotate />
                    <OrbitControls
                      enablePan={false}
                      minDistance={10}
                      maxDistance={60}
                      target={[0, 5, 0]}
                    />
                  </Canvas>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingBottom: 24 }}>
                <button onClick={handleStartAR} style={{
                  padding: '14px 32px',
                  border: '2px solid rgba(100,255,200,0.4)',
                  borderRadius: 12,
                  background: 'rgba(40,120,80,0.5)',
                  color: '#aaffcc',
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  Uruchom AR
                </button>

                <button onClick={returnToMenu} style={{
                  padding: '10px 24px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  color: '#8899aa',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  Powrot do menu
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────

const arBtnStyle = (bg: string): React.CSSProperties => ({
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  background: bg,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
});

const labelStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 12,
  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  minWidth: 40,
};

const tabStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#ccc',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// ──────────────────────────────────────────────────────
// Data Loading
// ──────────────────────────────────────────────────────

async function loadHideoutChunks(): Promise<Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>> {
  const plateStore = useHideoutPlateStore.getState();
  const saved = await loadHideout();

  if (saved && saved.length > 0) {
    const chunks = new Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>();
    for (const sc of saved) {
      const chunk = new ChunkData(sc.cx, sc.cz);
      chunk.blocks.set(new Uint8Array(sc.blocks));
      const geometry = buildChunkMesh(chunk);
      chunks.set(chunkKey(sc.cx, sc.cz), { data: chunk, geometry });
    }

    for (const pos of PLATE_POSITIONS) {
      const key = chunkKey(pos.originCx, pos.originCz);
      if (chunks.has(key)) {
        plateStore.markOccupied(pos);
      }
    }
    return chunks;
  }

  // Default platform if no saved data
  const chunks = new Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>();
  for (let cx = 0; cx <= 1; cx++) {
    for (let cz = 0; cz <= 1; cz++) {
      const chunk = new ChunkData(cx, cz);
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          chunk.setBlock(x, 0, z, BlockType.STONE);
          chunk.setBlock(x, 1, z, BlockType.DIRT);
          chunk.setBlock(x, 2, z, BlockType.GRASS);
        }
      }
      const geometry = buildChunkMesh(chunk);
      chunks.set(chunkKey(cx, cz), { data: chunk, geometry });
    }
  }
  return chunks;
}

function generateBiomeChunks(biomeType: string, seed: number): Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }> {
  const biome = createBiome(biomeType as any, seed);
  const chunks = new Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>();
  const radius = 1;

  // First pass: generate terrain
  const tempChunks = new Map<string, { data: ChunkData; geometry: THREE.BufferGeometry }>();
  for (let cx = -radius; cx <= radius; cx++) {
    for (let cz = -radius; cz <= radius; cz++) {
      const chunk = new ChunkData(cx, cz);
      biome.generate(chunk);
      placeStructures(chunk, biomeType as any, biome.noiseGen);

      const getNeighborBlock = (wx: number, wy: number, wz: number): BlockType => {
        const ncx = Math.floor(wx / CHUNK_SIZE);
        const ncz = Math.floor(wz / CHUNK_SIZE);
        const key = chunkKey(ncx, ncz);
        const neighbor = tempChunks.get(key);
        if (!neighbor) return BlockType.AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return neighbor.data.getBlock(lx, wy, lz);
      };

      const geometry = buildChunkMesh(chunk, getNeighborBlock);
      tempChunks.set(chunkKey(cx, cz), { data: chunk, geometry });
    }
  }

  // Second pass: rebuild with neighbor info
  for (const [key, entry] of tempChunks) {
    const getNeighborBlock = (wx: number, wy: number, wz: number): BlockType => {
      const ncx = Math.floor(wx / CHUNK_SIZE);
      const ncz = Math.floor(wz / CHUNK_SIZE);
      const nkey = chunkKey(ncx, ncz);
      const neighbor = tempChunks.get(nkey);
      if (!neighbor) return BlockType.AIR;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return neighbor.data.getBlock(lx, wy, lz);
    };
    entry.geometry.dispose();
    entry.geometry = buildChunkMesh(entry.data, getNeighborBlock);
    chunks.set(key, entry);
  }

  return chunks;
}
