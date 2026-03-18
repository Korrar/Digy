import { useCallback } from 'react';
import { useHideoutPlateStore, PLATE_TEMPLATES, PLATE_POSITIONS } from '../../stores/hideoutPlateStore';
import type { PlateTemplate, PlatePosition } from '../../stores/hideoutPlateStore';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(26,20,12,0.95)',
  border: '1px solid rgba(201,168,76,0.25)',
  borderRadius: 8,
  padding: '10px 14px',
  zIndex: 200,
  color: '#e8dcc8',
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
  border: selected ? '2px solid #c9a84c' : '1px solid rgba(201,168,76,0.25)',
  borderRadius: 6,
  background: selected ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.05)',
  color: selected ? '#c9a84c' : '#e8dcc8',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Cinzel', serif",
  textAlign: 'center' as const,
  minWidth: 70,
  transition: 'all 0.15s',
});

const positionBtnStyle = (occupied: boolean, hovered: boolean, disabled: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  border: hovered ? '2px solid #6b8e68' : occupied ? '1px solid #c4613a' : '1px solid rgba(201,168,76,0.25)',
  borderRadius: 6,
  background: occupied ? 'rgba(196,97,58,0.2)' : hovered ? 'rgba(107,142,104,0.2)' : 'rgba(201,168,76,0.05)',
  color: occupied ? '#d8907a' : '#e8dcc8',
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
      <div style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'center', fontFamily: "'Cinzel', serif", color: '#c9a84c', letterSpacing: 1 }}>
        Dekoracyjne Platformy
      </div>

      {/* Template selection */}
      <div style={{ fontSize: 11, color: '#8a7a5a', textAlign: 'center' }}>
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
      <div style={{ fontSize: 11, color: '#8a7a5a', textAlign: 'center' }}>
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
            width: 36, height: 36, background: 'rgba(201,168,76,0.2)',
            border: '1px solid rgba(201,168,76,0.4)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: '#c9a84c',
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

      <div style={{ fontSize: 10, color: '#5a5040', textAlign: 'center', fontStyle: 'italic' }}>
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
