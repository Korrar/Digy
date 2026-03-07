import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { INVENTORY_SIZE, HOTBAR_SIZE } from '../../utils/constants';

function blockColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function InventoryPanel() {
  const slots = useInventoryStore((s) => s.slots);
  const isOpen = useInventoryStore((s) => s.inventoryOpen);
  const toggle = useInventoryStore((s) => s.toggleInventory);

  if (!isOpen) return null;

  const rows: (typeof slots)[] = [];
  for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i += 9) {
    rows.push(slots.slice(i, i + 9));
  }

  const slotSize = 'clamp(34px, 9vw, 44px)';
  const blockSize = 'clamp(22px, 6vw, 28px)';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 200,
      padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}
    >
      <div style={{
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 12,
        padding: 'clamp(12px, 3vw, 20px)',
        border: '1px solid #555',
        maxWidth: '95vw',
        maxHeight: '85vh',
        overflow: 'auto',
      }}>
        <div style={{
          color: '#fff',
          fontSize: 'clamp(13px, 4vw, 16px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(8px, 2vw, 12px)',
          textAlign: 'center',
        }}>
          Ekwipunek
        </div>

        {/* Inventory rows */}
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', marginBottom: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {row.map((slot, si) => {
              const idx = HOTBAR_SIZE + ri * 9 + si;
              return (
                <div key={idx} style={{
                  width: slotSize,
                  height: slotSize,
                  border: '1px solid #444',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  {slot && (
                    <>
                      <div style={{
                        width: blockSize,
                        height: blockSize,
                        backgroundColor: blockColor(slot.blockType),
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }} title={getBlock(slot.blockType).name} />
                      <span style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 2,
                        fontSize: 'clamp(8px, 2vw, 10px)',
                        color: '#fff',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px black',
                      }}>
                        {slot.count}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Hotbar */}
        <div style={{ borderTop: '1px solid #555', marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {slots.slice(0, HOTBAR_SIZE).map((slot, i) => (
              <div key={i} style={{
                width: slotSize,
                height: slotSize,
                border: '1px solid #666',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.4)',
                position: 'relative',
                flexShrink: 0,
              }}>
                {slot && (
                  <>
                    <div style={{
                      width: blockSize,
                      height: blockSize,
                      backgroundColor: blockColor(slot.blockType),
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }} title={getBlock(slot.blockType).name} />
                    <span style={{
                      position: 'absolute',
                      bottom: 1,
                      right: 2,
                      fontSize: 'clamp(8px, 2vw, 10px)',
                      color: '#fff',
                      fontWeight: 'bold',
                      textShadow: '1px 1px 2px black',
                    }}>
                      {slot.count}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={toggle}
          style={{
            display: 'block',
            margin: '12px auto 0',
            padding: '8px 24px',
            borderRadius: 8,
            border: '1px solid #555',
            background: 'rgba(255,255,255,0.1)',
            color: '#aaa',
            fontSize: 'clamp(12px, 3vw, 14px)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            touchAction: 'manipulation',
          }}
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
