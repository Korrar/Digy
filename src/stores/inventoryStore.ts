import { create } from 'zustand';
import { BlockType, getBlock } from '../core/voxel/BlockRegistry';
import { INVENTORY_SIZE, HOTBAR_SIZE } from '../utils/constants';

export interface InventorySlot {
  blockType: BlockType;
  count: number;
  durability?: number; // current durability for tools/weapons
  maxDurability?: number; // max durability for tools/weapons
}

interface InventoryState {
  slots: (InventorySlot | null)[];
  selectedHotbarIndex: number;
  inventoryOpen: boolean;

  addBlock: (type: BlockType, count?: number) => boolean;
  addTool: (type: BlockType) => boolean;
  removeBlock: (slotIndex: number, count?: number) => void;
  getSelectedBlock: () => BlockType | null;
  setSelectedHotbar: (index: number) => void;
  toggleInventory: () => void;
  moveSlot: (from: number, to: number) => void;
  splitStack: (slotIndex: number) => void;
  dropItem: (slotIndex: number, count?: number) => void;
  sortInventory: () => void;
  consumeDurability: (slotIndex: number, amount?: number) => boolean; // returns true if tool broke
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  slots: new Array(INVENTORY_SIZE).fill(null),
  selectedHotbarIndex: 0,
  inventoryOpen: false,

  addBlock: (type, count = 1) => {
    const state = get();
    const def = getBlock(type);

    // Tools/weapons (stackSize 0) — use addTool instead
    if (def.stackSize === 0) {
      // Add each tool individually
      for (let t = 0; t < count; t++) {
        if (!get().addTool(type)) return false;
      }
      return true;
    }

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

  addTool: (type) => {
    const state = get();
    const def = getBlock(type);
    const newSlots = [...state.slots];
    for (let i = 0; i < newSlots.length; i++) {
      if (!newSlots[i]) {
        const dur = def.durability ?? 100;
        newSlots[i] = { blockType: type, count: 1, durability: dur, maxDurability: dur };
        set({ slots: newSlots });
        return true;
      }
    }
    return false;
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

  splitStack: (slotIndex) => {
    const state = get();
    const slot = state.slots[slotIndex];
    if (!slot || slot.count < 2) return;
    const half = Math.floor(slot.count / 2);
    const remainder = slot.count - half;
    // Find empty slot for the split half
    const newSlots = [...state.slots];
    let placed = false;
    for (let i = 0; i < newSlots.length; i++) {
      if (!newSlots[i]) {
        newSlots[i] = { blockType: slot.blockType, count: half };
        newSlots[slotIndex] = { blockType: slot.blockType, count: remainder };
        placed = true;
        break;
      }
    }
    if (placed) set({ slots: newSlots });
  },

  dropItem: (slotIndex, count = 1) => {
    const state = get();
    const slot = state.slots[slotIndex];
    if (!slot) return;
    const newSlots = [...state.slots];
    const toDrop = Math.min(count, slot.count);
    if (slot.count - toDrop <= 0) {
      newSlots[slotIndex] = null;
    } else {
      newSlots[slotIndex] = { blockType: slot.blockType, count: slot.count - toDrop };
    }
    set({ slots: newSlots });
  },

  sortInventory: () => {
    const state = get();
    const newSlots = [...state.slots];
    // Merge stacks first
    for (let i = 0; i < newSlots.length; i++) {
      const a = newSlots[i];
      if (!a) continue;
      const def = getBlock(a.blockType);
      for (let j = i + 1; j < newSlots.length; j++) {
        const b = newSlots[j];
        if (!b || b.blockType !== a.blockType) continue;
        const canAdd = Math.min(b.count, def.stackSize - a.count);
        if (canAdd > 0) {
          a.count += canAdd;
          b.count -= canAdd;
          if (b.count <= 0) newSlots[j] = null;
          newSlots[i] = { ...a };
        }
      }
    }
    // Sort non-null slots by blockType, keeping hotbar separate
    const hotbar = newSlots.slice(0, HOTBAR_SIZE);
    const inv = newSlots.slice(HOTBAR_SIZE).filter(Boolean).sort((a, b) => a!.blockType - b!.blockType);
    const invPadded = [...inv, ...new Array(INVENTORY_SIZE - HOTBAR_SIZE - inv.length).fill(null)];
    set({ slots: [...hotbar, ...invPadded] });
  },

  consumeDurability: (slotIndex, amount = 1) => {
    const state = get();
    const slot = state.slots[slotIndex];
    if (!slot || slot.durability === undefined) return false;
    const newDur = slot.durability - amount;
    const newSlots = [...state.slots];
    if (newDur <= 0) {
      // Tool broke
      newSlots[slotIndex] = null;
      set({ slots: newSlots });
      return true;
    }
    newSlots[slotIndex] = { ...slot, durability: newDur };
    set({ slots: newSlots });
    return false;
  },
}));
