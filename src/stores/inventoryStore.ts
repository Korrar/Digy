import { create } from 'zustand';
import { BlockType, getBlock } from '../core/voxel/BlockRegistry';
import { INVENTORY_SIZE, HOTBAR_SIZE } from '../utils/constants';

export interface InventorySlot {
  blockType: BlockType;
  count: number;
}

interface InventoryState {
  slots: (InventorySlot | null)[];
  selectedHotbarIndex: number;
  inventoryOpen: boolean;

  addBlock: (type: BlockType, count?: number) => boolean;
  removeBlock: (slotIndex: number, count?: number) => void;
  getSelectedBlock: () => BlockType | null;
  setSelectedHotbar: (index: number) => void;
  toggleInventory: () => void;
  moveSlot: (from: number, to: number) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  slots: new Array(INVENTORY_SIZE).fill(null),
  selectedHotbarIndex: 0,
  inventoryOpen: false,

  addBlock: (type, count = 1) => {
    const state = get();
    const def = getBlock(type);
    if (def.stackSize === 0) return false;

    const newSlots = [...state.slots];

    // Try to stack on existing
    for (let i = 0; i < newSlots.length; i++) {
      const slot = newSlots[i];
      if (slot && slot.blockType === type && slot.count < def.stackSize) {
        const canAdd = Math.min(count, def.stackSize - slot.count);
        newSlots[i] = { blockType: type, count: slot.count + canAdd };
        count -= canAdd;
        if (count <= 0) { set({ slots: newSlots }); return true; }
      }
    }

    // Find empty slot
    for (let i = 0; i < newSlots.length; i++) {
      if (!newSlots[i]) {
        const canAdd = Math.min(count, def.stackSize);
        newSlots[i] = { blockType: type, count: canAdd };
        count -= canAdd;
        if (count <= 0) { set({ slots: newSlots }); return true; }
      }
    }

    set({ slots: newSlots });
    return count <= 0;
  },

  removeBlock: (slotIndex, count = 1) => {
    const state = get();
    const newSlots = [...state.slots];
    const slot = newSlots[slotIndex];
    if (!slot) return;

    slot.count -= count;
    if (slot.count <= 0) {
      newSlots[slotIndex] = null;
    } else {
      newSlots[slotIndex] = { ...slot };
    }
    set({ slots: newSlots });
  },

  getSelectedBlock: () => {
    const state = get();
    const slot = state.slots[state.selectedHotbarIndex];
    return slot ? slot.blockType : null;
  },

  setSelectedHotbar: (index) => {
    if (index >= 0 && index < HOTBAR_SIZE) {
      set({ selectedHotbarIndex: index });
    }
  },

  toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),

  moveSlot: (from, to) => {
    const state = get();
    const newSlots = [...state.slots];
    const temp = newSlots[to];
    newSlots[to] = newSlots[from];
    newSlots[from] = temp;
    set({ slots: newSlots });
  },
}));
