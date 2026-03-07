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
      padding: 8,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}
    >
      <div style={{
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 12,
        padding: 'clamp(10px, 3vw, 20px)',
        border: '1px solid #555',
        maxWidth: 'calc(100vw - 16px)',
        overflow: 'auto',
      }}>
        <div style={{ color: '#fff', fontSize: 'clamp(13px, 4vw, 16px)', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
          Ekwipunek
        </div>

        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 3, marginBottom: 3, justifyContent: 'center' }}>
            {row.map((slot, si) => {
              const idx = HOTBAR_SIZE + ri * 9 + si;
              return (
                <div key={idx} style={slotStyle}>
                  {slot && (
                    <>
                      <div style={{
                        width: 'clamp(20px, 5vw, 28px)',
                        height: 'clamp(20px, 5vw, 28px)',
                        backgroundColor: blockColor(slot.blockType),
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.15)',
                      }} title={getBlock(slot.blockType).name} />
                      <span style={countStyle}>{slot.count}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ borderTop: '1px solid #555', marginTop: 6, paddingTop: 6 }}>
          <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {slots.slice(0, HOTBAR_SIZE).map((slot, i) => (
              <div key={i} style={{ ...slotStyle, border: '1px solid #666' }}>
                {slot && (
                  <>
                    <div style={{
                      width: 'clamp(20px, 5vw, 28px)',
                      height: 'clamp(20px, 5vw, 28px)',
                      backgroundColor: blockColor(slot.blockType),
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }} title={getBlock(slot.blockType).name} />
                    <span style={countStyle}>{slot.count}</span>
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
            margin: '8px auto 0',
            padding: '6px 20px',
            border: '1px solid #555',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.1)',
            color: '#aaa',
            fontSize: 12,
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

const slotStyle: React.CSSProperties = {
  width: 'clamp(32px, 8vw, 44px)',
  height: 'clamp(32px, 8vw, 44px)',
  border: '1px solid #444',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.4)',
  position: 'relative',
};

const countStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 2,
  fontSize: 'clamp(8px, 2.5vw, 10px)',
  color: '#fff',
  fontWeight: 'bold',
  textShadow: '1px 1px 2px black',
};
