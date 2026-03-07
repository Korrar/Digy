import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';

interface HUDProps {
  mode?: 'mine' | 'build';
  onModeToggle?: () => void;
}

export function HUD({ mode, onModeToggle }: HUDProps) {
  const scene = useGameStore((s) => s.scene);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const biome = useGameStore((s) => s.currentBiome);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);

  const biomeNames: Record<string, string> = {
    forest: 'Las',
    desert: 'Pustynia',
    cave: 'Jaskinia',
    mountains: 'Góry',
  };

  return (
    <>
      {/* Top bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        zIndex: 100,
        pointerEvents: 'none',
      }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', pointerEvents: 'auto' }}>
          {scene === 'biome' && `Biom: ${biomeNames[biome] || biome}`}
          {scene === 'hideout' && 'Kryjówka'}
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          {scene === 'hideout' && onModeToggle && (
            <button onClick={onModeToggle} style={btnStyle}>
              {mode === 'mine' ? '⛏ Kopanie' : '🔨 Budowanie'}
            </button>
          )}
          <button onClick={toggleInventory} style={btnStyle}>
            Ekwipunek (E)
          </button>
          <button onClick={returnToMenu} style={{ ...btnStyle, background: 'rgba(180,40,40,0.7)' }}>
            Wyjdź
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        textAlign: 'center',
        zIndex: 90,
        pointerEvents: 'none',
      }}>
        {scene === 'biome' && 'Przytrzymaj klik na bloku aby kopać | Scroll = zmiana slotu | E = ekwipunek'}
        {scene === 'hideout' && (mode === 'build'
          ? 'Kliknij aby postawić blok | Scroll = zmiana slotu | Tab = tryb kopania'
          : 'Przytrzymaj klik aby kopać | Scroll = zmiana slotu | Tab = tryb budowania'
        )}
      </div>
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
