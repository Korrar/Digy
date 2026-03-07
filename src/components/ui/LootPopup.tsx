import { useEffect } from 'react';
import { useTappablesStore } from '../../stores/tappablesStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';

function itemColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function LootPopup() {
  const showLoot = useTappablesStore((s) => s.showLootPopup);
  const currentLoot = useTappablesStore((s) => s.currentLoot);
  const closeLoot = useTappablesStore((s) => s.closeLootPopup);

  // Auto-close after 3 seconds
  useEffect(() => {
    if (!showLoot) return;
    const timer = setTimeout(closeLoot, 3000);
    return () => clearTimeout(timer);
  }, [showLoot, closeLoot]);

  if (!showLoot || currentLoot.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 250,
        animation: 'lootPopIn 0.3s ease-out',
      }}
      onClick={closeLoot}
    >
      <div style={{
        background: 'rgba(20,20,30,0.92)',
        border: '2px solid rgba(255,215,0,0.5)',
        borderRadius: 12,
        padding: '14px 20px',
        minWidth: 160,
        textAlign: 'center',
      }}>
        <div style={{ color: '#ffd700', fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
          Loot!
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentLoot.map((item, i) => {
            const def = getBlock(item.type);
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 0',
              }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 3,
                  backgroundColor: itemColor(item.type),
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                }}>
                  {def.emoji || ''}
                </div>
                <span style={{ color: '#ddd', fontSize: 12 }}>
                  {def.name}
                </span>
                <span style={{ color: '#aaa', fontSize: 11, marginLeft: 'auto' }}>
                  x{item.count}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ color: '#666', fontSize: 10, marginTop: 8 }}>
          Tap to close
        </div>
      </div>
      <style>{`
        @keyframes lootPopIn {
          from { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
