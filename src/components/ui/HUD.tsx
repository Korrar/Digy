import { useGameStore } from '../../stores/gameStore';

interface HUDProps {
  mode?: 'mine' | 'build';
  onModeToggle?: () => void;
}

export function HUD({ mode }: HUDProps) {
  const scene = useGameStore((s) => s.scene);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  const biomeNames: Record<string, string> = {
    forest: 'Las',
    desert: 'Pustynia',
    cave: 'Jaskinia',
    mountains: 'Góry',
  };
  const biome = useGameStore((s) => s.currentBiome);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 8px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#fff', fontSize: 'clamp(11px, 3vw, 14px)', fontWeight: 'bold', pointerEvents: 'auto' }}>
        {scene === 'biome' && `${biomeNames[biome] || biome}`}
        {scene === 'hideout' && (mode === 'mine' ? '⛏ Kopanie' : '🔨 Budowanie')}
      </div>
      <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
        <button onClick={returnToMenu} style={btnStyle}>
          ✕
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 8,
  background: 'rgba(180,40,40,0.7)',
  color: '#fff',
  fontSize: 16,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
};
