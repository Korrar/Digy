import { create } from 'zustand';
import { PLATE_TEMPLATES, PLATE_POSITIONS, type PlateTemplate, type PlatePosition } from '../core/hideout/HideoutPlates';

interface HideoutPlateState {
  /** Whether plate placement mode is active */
  placementMode: boolean;
  /** Currently selected plate template (null = none) */
  selectedTemplate: PlateTemplate | null;
  /** Currently hovered position (null = none) */
  hoveredPosition: PlatePosition | null;
  /** Set of occupied positions (serialized as "cx,cz") */
  occupiedPositions: Set<string>;

  togglePlacementMode: () => void;
  setPlacementMode: (active: boolean) => void;
  selectTemplate: (template: PlateTemplate | null) => void;
  setHoveredPosition: (pos: PlatePosition | null) => void;
  markOccupied: (pos: PlatePosition) => void;
  isOccupied: (pos: PlatePosition) => boolean;
  removeOccupied: (pos: PlatePosition) => void;
}

function posKey(pos: PlatePosition): string {
  return `${pos.originCx},${pos.originCz}`;
}

export const useHideoutPlateStore = create<HideoutPlateState>((set, get) => ({
  placementMode: false,
  selectedTemplate: null,
  hoveredPosition: null,
  occupiedPositions: new Set<string>(),

  togglePlacementMode: () => set((s) => ({
    placementMode: !s.placementMode,
    selectedTemplate: s.placementMode ? null : s.selectedTemplate,
    hoveredPosition: null,
  })),

  setPlacementMode: (active) => set({
    placementMode: active,
    selectedTemplate: active ? get().selectedTemplate : null,
    hoveredPosition: null,
  }),

  selectTemplate: (template) => set({ selectedTemplate: template }),

  setHoveredPosition: (pos) => set({ hoveredPosition: pos }),

  markOccupied: (pos) => {
    const newSet = new Set(get().occupiedPositions);
    newSet.add(posKey(pos));
    set({ occupiedPositions: newSet });
  },

  isOccupied: (pos) => get().occupiedPositions.has(posKey(pos)),

  removeOccupied: (pos) => {
    const newSet = new Set(get().occupiedPositions);
    newSet.delete(posKey(pos));
    set({ occupiedPositions: newSet });
  },
}));

/**
 * Check if a world-coordinate block position falls inside a decorative plate.
 * Returns true if the block should be protected from editing.
 */
export function isOnDecorativePlate(wx: number, _wy: number, wz: number): boolean {
  const cx = Math.floor(wx / 16);
  const cz = Math.floor(wz / 16);
  // Main platform is chunks 0,0 to 1,1 - always editable
  if (cx >= 0 && cx <= 1 && cz >= 0 && cz <= 1) return false;

  const { occupiedPositions } = useHideoutPlateStore.getState();
  // Check if this chunk belongs to any occupied plate position
  for (const pos of PLATE_POSITIONS) {
    const key = `${pos.originCx},${pos.originCz}`;
    if (!occupiedPositions.has(key)) continue;
    // Each plate covers 2x2 chunks from origin
    if (cx >= pos.originCx && cx <= pos.originCx + 1 &&
        cz >= pos.originCz && cz <= pos.originCz + 1) {
      return true;
    }
  }
  return false;
}

export { PLATE_TEMPLATES, PLATE_POSITIONS };
export type { PlateTemplate, PlatePosition };
