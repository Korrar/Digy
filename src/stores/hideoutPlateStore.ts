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

export { PLATE_TEMPLATES, PLATE_POSITIONS };
export type { PlateTemplate, PlatePosition };
