import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createXRStore, XR, XRDomOverlay, useXRHitTest, IfInSessionMode } from '@react-three/xr';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { ChunkMesh } from '../components/3d/ChunkMesh';
import { BlockLights } from '../components/3d/BlockLights';
import { ChunkData, chunkKey } from '../core/voxel/ChunkData';
import { buildChunkMesh } from '../core/voxel/ChunkMesher';
import { BlockType } from '../core/voxel/BlockRegistry';
import { loadHideout } from '../utils/storage';
import { applyPlateTemplate, PLATE_TEMPLATES, PLATE_POSITIONS } from '../core/hideout/HideoutPlates';
import { useHideoutPlateStore } from '../stores/hideoutPlateStore';

const xrStore = createXRStore({
  domOverlay: true,
  hitTest: true,
});

/** Reticle that follows the AR hit test position */
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

/** Renders the placed hideout model in AR at the given transform */
function ARModel({ matrix, scale }: { matrix: THREE.Matrix4; scale: number }) {
  const chunks = useWorldStore((s) => s.chunks);
  const groupRef = useRef<THREE.Group>(null);

  const chunkEntries = useMemo(() => {
    const result: { key: string; cx: number; cz: number; geometry: THREE.BufferGeometry }[] = [];
    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      result.push({ key, cx, cz, geometry: entry.geometry });
    });
    return result;
  }, [chunks]);

  // Center the model around its origin and apply world matrix
  useFrame(() => {
    if (!groupRef.current) return;
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
    groupRef.current.position.copy(pos);
    const quat = new THREE.Quaternion().setFromRotationMatrix(matrix);
    groupRef.current.quaternion.copy(quat);
    groupRef.current.scale.setScalar(scale);
  });

  // Calculate center offset to place model centered on the hit point
  const centerOffset = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    chunks.forEach((_, key) => {
      const [cx, cz] = key.split(',').map(Number);
      minX = Math.min(minX, cx * 16);
      maxX = Math.max(maxX, (cx + 1) * 16);
      minZ = Math.min(minZ, cz * 16);
      maxZ = Math.max(maxZ, (cz + 1) * 16);
    });
    if (!isFinite(minX)) return [0, 0, 0];
    return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2];
  }, [chunks]);

  return (
    <group ref={groupRef}>
      <group position={centerOffset as [number, number, number]}>
        {chunkEntries.map((c) => (
          <ChunkMesh key={c.key} cx={c.cx} cz={c.cz} geometry={c.geometry} />
        ))}
        <BlockLights />
      </group>
    </group>
  );
}

/** Rotation controls component */
function RotationUpdater({ rotation, targetRef }: { rotation: number; targetRef: React.RefObject<THREE.Group | null> }) {
  useFrame(() => {
    if (targetRef.current) {
      targetRef.current.rotation.y = rotation;
    }
  });
  return null;
}

export function ARScene() {
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const clearWorld = useWorldStore((s) => s.clearWorld);
  const [placed, setPlaced] = useState(false);
  const [placedMatrix, setPlacedMatrix] = useState<THREE.Matrix4 | null>(null);
  const [arScale, setArScale] = useState(0.03); // default: ~3cm per block (1m = ~32 blocks)
  const [rotation, setRotation] = useState(0);
  const hitMatrixRef = useRef<THREE.Matrix4 | null>(null);
  const [arSessionActive, setArSessionActive] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(true);

  // Load hideout data
  useEffect(() => {
    loadHideoutForAR().then(() => setLoadingChunks(false));
    return () => {
      clearWorld();
    };
  }, []);

  const handleHitUpdate = useCallback((matrix: THREE.Matrix4 | null) => {
    hitMatrixRef.current = matrix;
  }, []);

  const handlePlace = useCallback(() => {
    if (hitMatrixRef.current) {
      setPlacedMatrix(hitMatrixRef.current.clone());
      setPlaced(true);
    }
  }, []);

  const handleReset = useCallback(() => {
    setPlaced(false);
    setPlacedMatrix(null);
  }, []);

  const handleStartAR = useCallback(async () => {
    try {
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
    returnToMenu();
  }, [returnToMenu]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 1.6, 0], fov: 70 }}
      >
        <XR store={xrStore}>
          <ambientLight intensity={1.0} />
          <directionalLight position={[5, 10, 5]} intensity={0.8} />

          <IfInSessionMode allow="immersive-ar">
            {!placed && <HitTestReticle onHitUpdate={handleHitUpdate} />}
            {placed && placedMatrix && (
              <ARModel matrix={placedMatrix} scale={arScale} />
            )}
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
                gap: 10,
                alignItems: 'center',
                pointerEvents: 'auto',
              }}>
                {!placed ? (
                  <button onClick={handlePlace} style={arBtnStyle('#44aa66')}>
                    Postaw tutaj
                  </button>
                ) : (
                  <>
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

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleReset} style={arBtnStyle('#aa8844')}>
                        Przeloz
                      </button>
                      <button onClick={handleExit} style={arBtnStyle('#cc4444')}>
                        Zakoncz
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </XRDomOverlay>
        </XR>
      </Canvas>

      {/* Pre-AR overlay (shown before AR session starts) */}
      {!arSessionActive && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          zIndex: 2000,
          padding: 24,
        }}>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' }}>
            AR Podglad
          </h2>
          <p style={{ color: '#8899aa', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
            Poloz swoja kryjowke i biomy na prawdziwej podlodze!
            Wymaga przegladarki z WebXR (Chrome na Android).
          </p>

          {loadingChunks ? (
            <p style={{ color: '#aaa', fontSize: 14 }}>Ladowanie danych...</p>
          ) : (
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
          )}

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
      )}
    </div>
  );
}

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

async function loadHideoutForAR() {
  const store = useWorldStore.getState();
  store.clearWorld();

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

    // Detect occupied plate positions
    for (const pos of PLATE_POSITIONS) {
      const key = chunkKey(pos.originCx, pos.originCz);
      if (chunks.has(key)) {
        plateStore.markOccupied(pos);
      }
    }
  } else {
    // Create default platform
    const newChunks = new Map();
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
        newChunks.set(chunkKey(cx, cz), { data: chunk, geometry, dirty: false });
      }
    }
    useWorldStore.setState({ chunks: newChunks, biomeType: null });
  }
}
