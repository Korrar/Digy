import { useEffect } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { HOTBAR_SIZE } from '../../utils/constants';
import { ItemIcon } from './Icons';

function blockColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function Hotbar() {
  const slots = useInventoryStore((s) => s.slots);
  const selected = useInventoryStore((s) => s.selectedHotbarIndex);
  const setSelected = useInventoryStore((s) => s.setSelectedHotbar);
  const dropItem = useInventoryStore((s) => s.dropItem);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= HOTBAR_SIZE) {
        setSelected(num - 1);
      }
      // Q key to drop 1 item from selected hotbar slot
      if (e.key === 'q' || e.key === 'Q') {
        const idx = useInventoryStore.getState().selectedHotbarIndex;
        dropItem(idx, 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSelected, dropItem]);

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
      bottom: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 'clamp(2px, 0.5vw, 4px)',
      padding: 'clamp(3px, 0.8vw, 6px)',
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      zIndex: 100,
      maxWidth: '94vw',
    }}>
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        const isSelected = i === selected;
        return (
          <div
            key={i}
            style={{
              width: 'clamp(36px, 9vw, 48px)',
              height: 'clamp(36px, 9vw, 48px)',
              border: isSelected ? '2px solid #fff' : '2px solid #555',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
              userSelect: 'none',
              backgroundColor: 'rgba(0,0,0,0.5)',
              boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
              touchAction: 'none',
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ItemIcon iconId={getBlock(slot.blockType).icon} size="60%" color="#fff" />
                </div>
                {slot.durability !== undefined && slot.maxDurability !== undefined && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 3,
                    right: 3,
                    height: 3,
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: 1,
                  }}>
                    <div style={{
                      width: `${(slot.durability / slot.maxDurability) * 100}%`,
                      height: '100%',
                      borderRadius: 1,
                      background: slot.durability / slot.maxDurability > 0.5 ? '#44cc44'
                        : slot.durability / slot.maxDurability > 0.25 ? '#cccc44' : '#cc4444',
                    }} />
                  </div>
                )}
                {!slot.durability && (
                  <span style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 2,
                    fontSize: 'clamp(8px, 2.2vw, 11px)',
                    color: '#fff',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px black',
                  }}>
                    {slot.count}
                  </span>
                )}
              </>
            )}
            <span style={{
              position: 'absolute',
              top: 1,
              left: 2,
              fontSize: 'clamp(7px, 1.8vw, 9px)',
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
