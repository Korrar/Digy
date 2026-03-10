import { useEffect, useRef, useMemo } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

const MAP_SIZE = 96;
const PIXEL_SIZE = 2;

/** Simple top-down minimap showing chunk layout from above */
export function Minimap({ center }: { center: [number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chunks = useWorldStore((s) => s.chunks);

  // Pre-compute a color map for block types
  const blockColors = useMemo(() => {
    const map = new Map<BlockType, string>();
    for (let t = 0; t <= 200; t++) {
      try {
        const def = getBlock(t as BlockType);
        if (def && def.color) {
          map.set(t as BlockType, '#' + (def.topColor ?? def.color).getHexString());
        }
      } catch { /* skip */ }
    }
    return map;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    const halfView = Math.floor(MAP_SIZE / PIXEL_SIZE / 2);

    chunks.forEach((entry, key) => {
      const [cx, cz] = key.split(',').map(Number);
      const chunk = entry.data;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const px = Math.floor((wx - center[0]) + halfView);
          const pz = Math.floor((wz - center[1]) + halfView);

          if (px < 0 || px >= MAP_SIZE / PIXEL_SIZE || pz < 0 || pz >= MAP_SIZE / PIXEL_SIZE) continue;

          // Find top block
          let topBlock = BlockType.AIR;
          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const b = chunk.getBlock(lx, y, lz);
            if (b !== BlockType.AIR) { topBlock = b; break; }
          }

          const color = blockColors.get(topBlock) || '#222';
          ctx.fillStyle = color;
          ctx.fillRect(px * PIXEL_SIZE, pz * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
      }
    });

    // Draw center marker
    const cx = Math.floor(MAP_SIZE / 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 1, cx - 1, 3, 3);
  }, [chunks, center, blockColors]);

  return (
    <canvas
      ref={canvasRef}
      width={MAP_SIZE}
      height={MAP_SIZE}
      style={{
        position: 'fixed',
        bottom: 56,
        right: 8,
        width: MAP_SIZE,
        height: MAP_SIZE,
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.6)',
        zIndex: 90,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}
