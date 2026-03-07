import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { DevTools, DevToolsToggle } from './DevTools';

interface HUDProps {
  mode?: 'mine' | 'build';
  onModeToggle?: () => void;
  timeIndicator?: string;
}

export function HUD({ mode, onModeToggle, timeIndicator }: HUDProps) {
  const scene = useGameStore((s) => s.scene);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const biome = useGameStore((s) => s.currentBiome);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);

  const biomeNames: Record<string, string> = {
    forest: 'Las',
    desert: 'Pustynia',
    cave: 'Jaskinia',
    mountains: 'Góry',
    swamp: 'Bagno',
    tundra: 'Tundra',
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
        padding: 'env(safe-area-inset-top, 4px) 8px 4px 8px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        zIndex: 100,
        pointerEvents: 'none',
      }}>
        <div style={{
          color: '#fff',
          fontSize: 'clamp(11px, 3vw, 14px)',
          fontWeight: 'bold',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {scene === 'biome' && `${biomeNames[biome] || biome}`}
          {scene === 'hideout' && 'Kryjówka'}
          {timeIndicator && (
            <span style={{ fontSize: 'clamp(14px, 4vw, 18px)' }}>{timeIndicator}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {scene === 'hideout' && onModeToggle && (
            <button onClick={onModeToggle} style={btnStyle}>
              {mode === 'mine' ? '⛏' : '🔨'}
            </button>
          )}
          <DevToolsToggle />
          <button onClick={toggleInventory} style={btnStyle}>
            🎒
          </button>
          <button onClick={returnToMenu} style={{ ...btnStyle, background: 'rgba(180,40,40,0.7)' }}>
            ✕
          </button>
        </div>
      </div>
      <DevTools />
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: 'clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 14px)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontSize: 'clamp(14px, 4vw, 18px)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  touchAction: 'manipulation',
  minWidth: 36,
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
