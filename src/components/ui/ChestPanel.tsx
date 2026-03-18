import { useState } from 'react';
import { useChestStore, CHEST_SIZE } from '../../stores/chestStore';
import { useInventoryStore, type InventorySlot } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../../utils/constants';
import { ItemIcon } from './Icons';

function blockColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

interface DragItem {
  source: 'chest' | 'inventory';
  index: number;
}

export function ChestPanel() {
  const openChestKey = useChestStore((s) => s.openChestKey);
  const chests = useChestStore((s) => s.chests);
  const closeChest = useChestStore((s) => s.closeChest);
  const invSlots = useInventoryStore((s) => s.slots);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  const chest = openChestKey ? chests.get(openChestKey) : null;
  if (!openChestKey || !chest) return null;

  const chestSlots = chest.slots;

  const handleTakeAll = () => {
    const items = useChestStore.getState().takeAll();
    for (const item of items) {
      addBlock(item.blockType, item.count);
    }
  };

  const handleSlotClick = (source: 'chest' | 'inventory', index: number) => {
    if (dragItem === null) {
      const slot = source === 'chest' ? chestSlots[index] : invSlots[index];
      if (slot) {
        setDragItem({ source, index });
      }
    } else {
      if (dragItem.source === source && dragItem.index === index) {
        setDragItem(null);
        return;
      }

      if (dragItem.source === 'chest' && source === 'chest') {
        useChestStore.getState().moveChestSlot(dragItem.index, index);
      } else if (dragItem.source === 'inventory' && source === 'inventory') {
        useInventoryStore.getState().moveSlot(dragItem.index, index);
      } else if (dragItem.source === 'chest' && source === 'inventory') {
        const chestItem = chestSlots[dragItem.index];
        const invItem = invSlots[index];
        if (chestItem) {
          const taken = useChestStore.getState().takeFromChest(dragItem.index);
          if (taken) {
            if (invItem) {
              useInventoryStore.getState().removeBlock(index, invItem.count);
              useChestStore.getState().putInChest(dragItem.index, invItem);
              const invSlotsNow = [...useInventoryStore.getState().slots];
              invSlotsNow[index] = taken;
              useInventoryStore.setState({ slots: invSlotsNow });
            } else {
              const invSlotsNow = [...useInventoryStore.getState().slots];
              invSlotsNow[index] = taken;
              useInventoryStore.setState({ slots: invSlotsNow });
            }
          }
        }
      } else if (dragItem.source === 'inventory' && source === 'chest') {
        const invItem = invSlots[dragItem.index];
        const chestItem = chestSlots[index];
        if (invItem) {
          if (chestItem) {
            const taken = useChestStore.getState().takeFromChest(index);
            useChestStore.getState().putInChest(index, { ...invItem });
            const invSlotsNow = [...useInventoryStore.getState().slots];
            invSlotsNow[dragItem.index] = taken;
            useInventoryStore.setState({ slots: invSlotsNow });
          } else {
            useChestStore.getState().putInChest(index, { ...invItem });
            useInventoryStore.getState().removeBlock(dragItem.index, invItem.count);
          }
        }
      }
      setDragItem(null);
    }
  };

  const slotSize = 'clamp(34px, 9vw, 44px)';
  const blockSize = 'clamp(22px, 6vw, 28px)';

  const renderSlot = (slot: InventorySlot | null, source: 'chest' | 'inventory', idx: number) => {
    const isSelected = dragItem !== null && dragItem.source === source && dragItem.index === idx;
    return (
      <div
        key={`${source}-${idx}`}
        onClick={() => handleSlotClick(source, idx)}
        style={{
          width: slotSize,
          height: slotSize,
          border: isSelected ? '2px solid #c9a84c' : '1px solid rgba(201,168,76,0.15)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? 'rgba(201,168,76,0.15)' : 'rgba(13,10,6,0.5)',
          position: 'relative',
          flexShrink: 0,
          cursor: slot || dragItem ? 'pointer' : 'default',
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
            }}>
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

  const chestRows: (InventorySlot | null)[][] = [];
  for (let i = 0; i < CHEST_SIZE; i += 9) {
    chestRows.push(chestSlots.slice(i, i + 9));
  }

  const invRows: (InventorySlot | null)[][] = [];
  for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i += 9) {
    invRows.push(invSlots.slice(i, i + 9));
  }

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
      onClick={(e) => { if (e.target === e.currentTarget) { setDragItem(null); closeChest(); } }}
    >
      <div style={{
        background: 'rgba(26,20,12,0.95)',
        borderRadius: 8,
        padding: 'clamp(12px, 3vw, 20px)',
        border: '1px solid rgba(201,168,76,0.25)',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Chest section */}
        <div style={{
          color: '#c9a84c',
          fontSize: 'clamp(13px, 4vw, 16px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(6px, 1.5vw, 10px)',
          textAlign: 'center',
          fontFamily: "'Cinzel', serif",
          letterSpacing: 2,
        }}>
          Skrzynia
        </div>

        {chestRows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', marginBottom: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {row.map((slot, si) => renderSlot(slot, 'chest', ri * 9 + si))}
          </div>
        ))}

        <button
          onClick={handleTakeAll}
          style={{
            display: 'block',
            margin: '8px auto',
            padding: '6px 18px',
            borderRadius: 6,
            border: '1px solid rgba(201,168,76,0.3)',
            background: 'rgba(201,168,76,0.1)',
            color: '#c9a84c',
            fontSize: 'clamp(11px, 3vw, 13px)',
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
            touchAction: 'manipulation',
            letterSpacing: 1,
          }}
        >
          Zabierz wszystko
        </button>

        {/* Separator */}
        <div style={{ borderTop: '1px solid rgba(201,168,76,0.2)', margin: '10px 0' }} />

        {/* Player inventory section */}
        <div style={{
          color: '#8a7a5a',
          fontSize: 'clamp(12px, 3.5vw, 14px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(6px, 1.5vw, 10px)',
          textAlign: 'center',
          fontFamily: "'Cinzel', serif",
          letterSpacing: 1,
        }}>
          Ekwipunek
        </div>

        {invRows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', marginBottom: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {row.map((slot, si) => renderSlot(slot, 'inventory', HOTBAR_SIZE + ri * 9 + si))}
          </div>
        ))}

        {/* Hotbar */}
        <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', marginTop: 6, paddingTop: 6 }}>
          <div style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {invSlots.slice(0, HOTBAR_SIZE).map((slot, i) => renderSlot(slot, 'inventory', i))}
          </div>
        </div>

        <button
          onClick={() => { setDragItem(null); closeChest(); }}
          style={{
            display: 'block',
            margin: '10px auto 0',
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
  );
}
