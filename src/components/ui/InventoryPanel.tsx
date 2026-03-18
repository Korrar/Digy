import { useState } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { INVENTORY_SIZE, HOTBAR_SIZE } from '../../utils/constants';
import { ItemIcon } from './Icons';

function blockColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function InventoryPanel() {
  const slots = useInventoryStore((s) => s.slots);
  const isOpen = useInventoryStore((s) => s.inventoryOpen);
  const toggle = useInventoryStore((s) => s.toggleInventory);
  const moveSlot = useInventoryStore((s) => s.moveSlot);
  const splitStack = useInventoryStore((s) => s.splitStack);
  const sortInventory = useInventoryStore((s) => s.sortInventory);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSlotClick = (idx: number) => {
    if (selectedSlot === null) {
      if (slots[idx]) {
        setSelectedSlot(idx);
      }
    } else {
      if (selectedSlot === idx) {
        setSelectedSlot(null);
      } else {
        moveSlot(selectedSlot, idx);
        setSelectedSlot(null);
      }
    }
  };

  const rows: (typeof slots)[] = [];
  for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i += 9) {
    rows.push(slots.slice(i, i + 9));
  }

  const slotSize = 'clamp(34px, 9vw, 44px)';
  const blockSize = 'clamp(22px, 6vw, 28px)';

  const handleRightClick = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (slots[idx]) splitStack(idx);
  };

  const renderSlot = (slot: typeof slots[0], idx: number, borderColor: string = 'rgba(201,168,76,0.15)') => {
    const isSelected = selectedSlot === idx;
    return (
      <div
        key={idx}
        onClick={() => handleSlotClick(idx)}
        onContextMenu={(e) => handleRightClick(e, idx)}
        style={{
          width: slotSize,
          height: slotSize,
          border: isSelected ? '2px solid #c9a84c' : `1px solid ${borderColor}`,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? 'rgba(201,168,76,0.15)' : 'rgba(13,10,6,0.5)',
          position: 'relative',
          flexShrink: 0,
          cursor: slot || selectedSlot !== null ? 'pointer' : 'default',
        }}
      >
        {slot && (
          <>
            <div style={{
              width: blockSize,
              height: blockSize,
              backgroundColor: blockColor(slot.blockType),
              borderRadius: 3,
              border: '1px solid rgba(201,168,76,0.15)',
              opacity: isSelected ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }} title={getBlock(slot.blockType).name}>
              <ItemIcon iconId={getBlock(slot.blockType).icon} size="60%" color="#e8dcc8" />
            </div>
            <span style={{
              position: 'absolute',
              bottom: 1,
              right: 2,
              fontSize: 'clamp(8px, 2vw, 10px)',
              color: '#e8dcc8',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px black',
            }}>
              {slot.count}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(10,8,4,0.7)',
      zIndex: 200,
      padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) { setSelectedSlot(null); toggle(); } }}
    >
      <div style={{
        background: 'rgba(26,20,12,0.95)',
        borderRadius: 8,
        padding: 'clamp(12px, 3vw, 20px)',
        border: '1px solid rgba(201,168,76,0.25)',
        maxWidth: '95vw',
        maxHeight: '85vh',
        overflow: 'auto',
      }}>
        <div style={{
          color: '#c9a84c',
          fontSize: 'clamp(13px, 4vw, 16px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(8px, 2vw, 12px)',
          textAlign: 'center',
          fontFamily: "'Cinzel', serif",
          letterSpacing: 2,
        }}>
          Ekwipunek
        </div>

        {/* Inventory rows */}
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', marginBottom: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {row.map((slot, si) => {
              const idx = HOTBAR_SIZE + ri * 9 + si;
              return renderSlot(slot, idx);
            })}
          </div>
        ))}

        {/* Hotbar */}
        <div style={{ borderTop: '1px solid rgba(201,168,76,0.2)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {slots.slice(0, HOTBAR_SIZE).map((slot, i) => renderSlot(slot, i, 'rgba(201,168,76,0.25)'))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={sortInventory}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(201,168,76,0.3)',
              background: 'rgba(201,168,76,0.1)',
              color: '#c9a84c',
              fontSize: 'clamp(12px, 3vw, 14px)',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              touchAction: 'manipulation',
              letterSpacing: 1,
            }}
          >
            Sortuj
          </button>
          <button
            onClick={() => { setSelectedSlot(null); toggle(); }}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              border: '1px solid rgba(201,168,76,0.2)',
              background: 'rgba(201,168,76,0.05)',
              color: '#8a7a5a',
              fontSize: 'clamp(12px, 3vw, 14px)',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              touchAction: 'manipulation',
              letterSpacing: 1,
            }}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
