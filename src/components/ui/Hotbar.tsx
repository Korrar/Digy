import { useEffect } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { HOTBAR_SIZE } from '../../utils/constants';

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
      bottom: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 2,
      padding: 4,
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      zIndex: 100,
      maxWidth: 'calc(100vw - 16px)',
    }}>
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        const isSelected = i === selected;
        return (
          <div
            key={i}
            style={{
              width: 'clamp(34px, 9vw, 48px)',
              height: 'clamp(34px, 9vw, 48px)',
              border: isSelected ? '2px solid #fff' : '1px solid #555',
              boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
              userSelect: 'none',
              backgroundColor: 'rgba(0,0,0,0.5)',
              touchAction: 'manipulation',
            }}
            onClick={() => setSelected(i)}
          >
            {slot && (
              <>
                <div style={{
                  width: 'clamp(22px, 6vw, 32px)',
                  height: 'clamp(22px, 6vw, 32px)',
                  backgroundColor: blockColor(slot.blockType),
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.2)',
                }} />
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 2,
                  fontSize: 'clamp(8px, 2.5vw, 11px)',
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
  );
}
