import { useMemo } from 'react';
import * as THREE from 'three';
import { useHideoutPlateStore } from '../../stores/hideoutPlateStore';

/**
 * Renders a semi-transparent ghost box showing where a plate will be placed.
 * Visible only when placement mode is active and a position is hovered.
 */
export function PlateGhost() {
  const placementMode = useHideoutPlateStore((s) => s.placementMode);
  const hoveredPosition = useHideoutPlateStore((s) => s.hoveredPosition);
  const selectedTemplate = useHideoutPlateStore((s) => s.selectedTemplate);
  const occupiedPositions = useHideoutPlateStore((s) => s.occupiedPositions);

  const ghostData = useMemo(() => {
    if (!placementMode || !hoveredPosition) return null;

    const key = `${hoveredPosition.originCx},${hoveredPosition.originCz}`;
    const isOccupied = occupiedPositions.has(key);

    // World position: chunk origin * 16 gives block position
    const worldX = hoveredPosition.originCx * 16;
    const worldZ = hoveredPosition.originCz * 16;

    return {
      position: new THREE.Vector3(worldX + 16, 2, worldZ + 16), // center of 32x32 area, at ground level
      color: isOccupied ? '#ff4444' : selectedTemplate ? '#44ff44' : '#4488ff',
      opacity: 0.25,
    };
  }, [placementMode, hoveredPosition, selectedTemplate, occupiedPositions]);

  if (!ghostData) return null;

  return (
    <mesh position={ghostData.position}>
      <boxGeometry args={[32, 4, 32]} />
      <meshBasicMaterial
        color={ghostData.color}
        transparent
        opacity={ghostData.opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
