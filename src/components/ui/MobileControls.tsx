import { useCallback } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { HOTBAR_SIZE } from '../../utils/constants';

interface MobileControlsProps {
  mode?: 'mine' | 'build';
  onModeToggle?: () => void;
}

export function MobileControls({ mode, onModeToggle }: MobileControlsProps) {
  const setSelected = useInventoryStore((s) => s.setSelectedHotbar);
  const selected = useInventoryStore((s) => s.selectedHotbarIndex);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);

  const prevSlot = useCallback(() => {
    const next = ((selected - 1) % HOTBAR_SIZE + HOTBAR_SIZE) % HOTBAR_SIZE;
    setSelected(next);
  }, [selected, setSelected]);

  const nextSlot = useCallback(() => {
    const next = (selected + 1) % HOTBAR_SIZE;
    setSelected(next);
  }, [selected, setSelected]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 70,
      right: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 100,
      pointerEvents: 'auto',
    }}>
      {onModeToggle && (
        <button onClick={onModeToggle} style={mobileBtnStyle}>
          {mode === 'mine' ? '⛏' : '🔨'}
        </button>
      )}
      <button onClick={toggleInventory} style={mobileBtnStyle}>
        📦
      </button>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={prevSlot} style={{ ...mobileBtnStyle, fontSize: 16 }}>◀</button>
        <button onClick={nextSlot} style={{ ...mobileBtnStyle, fontSize: 16 }}>▶</button>
      </div>
    </div>
  );
}

const mobileBtnStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontSize: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  fontFamily: 'inherit',
};
