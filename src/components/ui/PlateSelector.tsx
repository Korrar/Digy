import { useCallback } from 'react';
import { useHideoutPlateStore, PLATE_TEMPLATES, PLATE_POSITIONS } from '../../stores/hideoutPlateStore';
import type { PlateTemplate, PlatePosition } from '../../stores/hideoutPlateStore';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,0.85)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '10px 14px',
  zIndex: 200,
  color: '#fff',
  fontFamily: 'inherit',
  maxWidth: '95vw',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const templateBtnStyle = (selected: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  border: selected ? '2px solid #4af' : '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  background: selected ? 'rgba(68,170,255,0.2)' : 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center' as const,
  minWidth: 70,
  transition: 'all 0.15s',
});

const positionBtnStyle = (occupied: boolean, hovered: boolean, disabled: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  border: hovered ? '2px solid #4f4' : occupied ? '1px solid #f44' : '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  background: occupied ? 'rgba(255,68,68,0.2)' : hovered ? 'rgba(68,255,68,0.2)' : 'rgba(255,255,255,0.05)',
  color: occupied ? '#f88' : '#fff',
  fontSize: 11,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.4 : 1,
  transition: 'all 0.15s',
});

interface PlateSelectorProps {
  onPlacePlate: (template: PlateTemplate, position: PlatePosition) => void;
  onRemovePlate: (position: PlatePosition) => void;
}

export function PlateSelector({ onPlacePlate, onRemovePlate }: PlateSelectorProps) {
  const placementMode = useHideoutPlateStore((s) => s.placementMode);
  const selectedTemplate = useHideoutPlateStore((s) => s.selectedTemplate);
  const hoveredPosition = useHideoutPlateStore((s) => s.hoveredPosition);
  const occupiedPositions = useHideoutPlateStore((s) => s.occupiedPositions);
  const selectTemplate = useHideoutPlateStore((s) => s.selectTemplate);
  const setHoveredPosition = useHideoutPlateStore((s) => s.setHoveredPosition);

  const handlePositionClick = useCallback((pos: PlatePosition) => {
    const key = `${pos.originCx},${pos.originCz}`;
    if (occupiedPositions.has(key)) {
      onRemovePlate(pos);
    } else if (selectedTemplate) {
      onPlacePlate(selectedTemplate, pos);
    }
  }, [selectedTemplate, occupiedPositions, onPlacePlate, onRemovePlate]);

  if (!placementMode) return null;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
        Dekoracyjne Platformy
      </div>

      {/* Template selection */}
      <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>
        Wybierz typ platformy:
      </div>
      <div style={sectionStyle}>
        {PLATE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            style={templateBtnStyle(selectedTemplate?.id === t.id)}
            onClick={() => selectTemplate(selectedTemplate?.id === t.id ? null : t)}
            title={t.description}
          >
            <div>{t.name}</div>
          </button>
        ))}
      </div>

      {/* Position grid */}
      <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>
        {selectedTemplate
          ? 'Kliknij pozycje aby umiescic platforme:'
          : 'Wybierz typ powyzej, potem pozycje ponizej'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gridTemplateRows: 'repeat(4, 36px)', gap: 3 }}>
          {/* Row 1: _, NW, N, NE */}
          <div />
          {renderPosBtn('NW')}
          {renderPosBtn('N')}
          {renderPosBtn('NE')}

          {/* Row 2: _, W, [main], E */}
          <div />
          {renderPosBtn('W')}
          <div style={{
            width: 36, height: 36, background: 'rgba(68,170,255,0.3)',
            border: '1px solid #4af', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: '#4af',
          }}>
            Glowna
          </div>
          {renderPosBtn('E')}

          {/* Row 3: _, SW, S, SE */}
          <div />
          {renderPosBtn('SW')}
          {renderPosBtn('S')}
          {renderPosBtn('SE')}

          {/* Row 4: empty */}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
        Tab = zamknij | Czerwone = zajete (klik usuwa)
      </div>
    </div>
  );

  function renderPosBtn(label: string) {
    const pos = PLATE_POSITIONS.find((p) => p.label === label);
    if (!pos) return <div />;
    const key = `${pos.originCx},${pos.originCz}`;
    const occupied = occupiedPositions.has(key);
    const isHovered = hoveredPosition?.label === label;
    const disabled = !selectedTemplate && !occupied;

    return (
      <button
        style={positionBtnStyle(occupied, isHovered, disabled)}
        onClick={() => handlePositionClick(pos)}
        onMouseEnter={() => setHoveredPosition(pos)}
        onMouseLeave={() => setHoveredPosition(null)}
        disabled={disabled}
        title={occupied ? `${label}: Klik aby usunac` : selectedTemplate ? `${label}: Umiesc ${selectedTemplate.name}` : ''}
      >
        {label}
      </button>
    );
  }
}
