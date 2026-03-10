import { IconPickaxe, IconHammer, IconHand } from './Icons';

export type GameMode = 'build' | 'mine' | 'adventure';

interface ModeToggleProps {
  mode: GameMode;
  onToggle: () => void;
}

const MODE_CONFIG: Record<GameMode, { border: string; bg: string; label: string; Icon: typeof IconPickaxe }> = {
  build: { border: '#44cc66', bg: 'rgba(40,140,60,0.7)', label: 'Budowanie', Icon: IconHammer },
  mine: { border: '#ff6644', bg: 'rgba(180,60,30,0.7)', label: 'Niszczenie', Icon: IconPickaxe },
  adventure: { border: '#44aaff', bg: 'rgba(40,120,200,0.7)', label: 'Klikanie', Icon: IconHand },
};

export function cycleMode(current: GameMode): GameMode {
  if (current === 'build') return 'mine';
  if (current === 'mine') return 'adventure';
  return 'build';
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const config = MODE_CONFIG[mode];
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'fixed',
        bottom: 64,
        right: 12,
        zIndex: 100,
        width: 44,
        height: 44,
        borderRadius: 22,
        border: `2px solid ${config.border}`,
        background: config.bg,
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'manipulation',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      title={`Tryb: ${config.label} (Tab)`}
    >
      <config.Icon size={20} color="#fff" />
    </button>
  );
}
