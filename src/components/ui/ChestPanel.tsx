import { useState, useCallback } from 'react';
import { useChestStore, CHEST_SIZE } from '../../stores/chestStore';
import { useInventoryStore, InventorySlot } from '../../stores/inventoryStore';
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
      // Pick up item
      const slot = source === 'chest' ? chestSlots[index] : invSlots[index];
      if (slot) {
        setDragItem({ source, index });
      }
    } else {
      // Put down / swap
      if (dragItem.source === source && dragItem.index === index) {
        // Same slot - deselect
        setDragItem(null);
        return;
      }

      if (dragItem.source === 'chest' && source === 'chest') {
        // Move within chest
        useChestStore.getState().moveChestSlot(dragItem.index, index);
      } else if (dragItem.source === 'inventory' && source === 'inventory') {
        // Move within inventory
        useInventoryStore.getState().moveSlot(dragItem.index, index);
      } else if (dragItem.source === 'chest' && source === 'inventory') {
        // Take from chest to inventory slot
        const chestItem = chestSlots[dragItem.index];
        const invItem = invSlots[index];
        if (chestItem) {
          // Take from chest
          const taken = useChestStore.getState().takeFromChest(dragItem.index);
          if (taken) {
            if (invItem) {
              // Swap: put inventory item into chest
              useInventoryStore.getState().removeBlock(index, invItem.count);
              useChestStore.getState().putInChest(dragItem.index, invItem);
              // Put chest item into inventory slot
              const invSlotsNow = [...useInventoryStore.getState().slots];
              invSlotsNow[index] = taken;
              useInventoryStore.setState({ slots: invSlotsNow });
            } else {
              // Empty inv slot - just put there
              const invSlotsNow = [...useInventoryStore.getState().slots];
              invSlotsNow[index] = taken;
              useInventoryStore.setState({ slots: invSlotsNow });
            }
          }
        }
      } else if (dragItem.source === 'inventory' && source === 'chest') {
        // Put from inventory to chest slot
        const invItem = invSlots[dragItem.index];
        const chestItem = chestSlots[index];
        if (invItem) {
          if (chestItem) {
            // Swap: take chest item, put inv item into chest
            const taken = useChestStore.getState().takeFromChest(index);
            useChestStore.getState().putInChest(index, { ...invItem });
            const invSlotsNow = [...useInventoryStore.getState().slots];
            invSlotsNow[dragItem.index] = taken;
            useInventoryStore.setState({ slots: invSlotsNow });
          } else {
            // Empty chest slot
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
          border: isSelected ? '2px solid #ffcc00' : '1px solid #444',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? 'rgba(255,204,0,0.15)' : 'rgba(0,0,0,0.4)',
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
              border: '1px solid rgba(255,255,255,0.15)',
              opacity: isSelected ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ItemIcon iconId={getBlock(slot.blockType).icon} size="60%" color="#fff" />
            </div>
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
  };

  // Chest rows (3 rows of 9)
  const chestRows: (InventorySlot | null)[][] = [];
  for (let i = 0; i < CHEST_SIZE; i += 9) {
    chestRows.push(chestSlots.slice(i, i + 9));
  }

  // Inventory rows (3 rows of 9, slots 9-35)
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
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 200,
      padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) { setDragItem(null); closeChest(); } }}
    >
      <div style={{
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 12,
        padding: 'clamp(12px, 3vw, 20px)',
        border: '1px solid #555',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Chest section */}
        <div style={{
          color: '#b8945a',
          fontSize: 'clamp(13px, 4vw, 16px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(6px, 1.5vw, 10px)',
          textAlign: 'center',
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
            border: '1px solid #b8945a',
            background: 'rgba(184,148,90,0.2)',
            color: '#b8945a',
            fontSize: 'clamp(11px, 3vw, 13px)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            touchAction: 'manipulation',
          }}
        >
          Zabierz wszystko
        </button>

        {/* Separator */}
        <div style={{ borderTop: '1px solid #555', margin: '10px 0' }} />

        {/* Player inventory section */}
        <div style={{
          color: '#aaa',
          fontSize: 'clamp(12px, 3.5vw, 14px)',
          fontWeight: 'bold',
          marginBottom: 'clamp(6px, 1.5vw, 10px)',
          textAlign: 'center',
        }}>
          Ekwipunek
        </div>

        {invRows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 'clamp(2px, 0.5vw, 4px)', marginBottom: 'clamp(2px, 0.5vw, 4px)', justifyContent: 'center' }}>
            {row.map((slot, si) => renderSlot(slot, 'inventory', HOTBAR_SIZE + ri * 9 + si))}
          </div>
        ))}

        {/* Hotbar */}
        <div style={{ borderTop: '1px solid #444', marginTop: 6, paddingTop: 6 }}>
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
