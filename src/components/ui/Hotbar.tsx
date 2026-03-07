import { useEffect } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { HOTBAR_SIZE } from '../../utils/constants';

const slotStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  border: '2px solid #555',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  cursor: 'pointer',
  userSelect: 'none',
  backgroundColor: 'rgba(0,0,0,0.5)',
};

const selectedStyle: React.CSSProperties = {
  ...slotStyle,
  border: '2px solid #fff',
  boxShadow: '0 0 8px rgba(255,255,255,0.5)',
};

function blockColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function Hotbar() {
  const slots = useInventoryStore((s) => s.slots);
  const selected = useInventoryStore((s) => s.selectedHotbarIndex);
  const setSelected = useInventoryStore((s) => s.setSelectedHotbar);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= HOTBAR_SIZE) {
        setSelected(num - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSelected]);

  // Scroll wheel
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      const current = useInventoryStore.getState().selectedHotbarIndex;
      const next = ((current + dir) % HOTBAR_SIZE + HOTBAR_SIZE) % HOTBAR_SIZE;
      setSelected(next);
    };
    window.addEventListener('wheel', handler);
    return () => window.removeEventListener('wheel', handler);
  }, [setSelected]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      padding: 6,
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      zIndex: 100,
    }}>
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        return (
          <div
            key={i}
            style={i === selected ? selectedStyle : slotStyle}
            onClick={() => setSelected(i)}
          >
            {slot && (
              <>
                <div style={{
                  width: 32,
                  height: 32,
                  backgroundColor: blockColor(slot.blockType),
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.2)',
                }} />
                <span style={{
                  position: 'absolute',
                  bottom: 1,
                  right: 3,
                  fontSize: 11,
                  color: '#fff',
                  fontWeight: 'bold',
                  textShadow: '1px 1px 2px black',
                }}>
                  {slot.count}
                </span>
              </>
            )}
            <span style={{
              position: 'absolute',
              top: 1,
              left: 3,
              fontSize: 9,
              color: '#888',
            }}>
              {i + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
