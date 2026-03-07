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

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 200,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}
    >
      <div style={{
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 12,
        padding: 20,
        border: '1px solid #555',
      }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
          Ekwipunek
        </div>

        {/* Inventory rows */}
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {row.map((slot, si) => {
              const idx = HOTBAR_SIZE + ri * 9 + si;
              return (
                <div key={idx} style={{
                  width: 44,
                  height: 44,
                  border: '1px solid #444',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  position: 'relative',
                }}>
                  {slot && (
                    <>
                      <div style={{
                        width: 28,
                        height: 28,
                        backgroundColor: blockColor(slot.blockType),
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }} title={getBlock(slot.blockType).name} />
                      <span style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 3,
                        fontSize: 10,
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
          <div style={{ display: 'flex', gap: 4 }}>
            {slots.slice(0, HOTBAR_SIZE).map((slot, i) => (
              <div key={i} style={{
                width: 44,
                height: 44,
                border: '1px solid #666',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.4)',
                position: 'relative',
              }}>
                {slot && (
                  <>
                    <div style={{
                      width: 28,
                      height: 28,
                      backgroundColor: blockColor(slot.blockType),
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }} title={getBlock(slot.blockType).name} />
                    <span style={{
                      position: 'absolute',
                      bottom: 1,
                      right: 3,
                      fontSize: 10,
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

        <div style={{ color: '#888', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
          Naciśnij E aby zamknąć
        </div>
      </div>
    </div>
  );
}
