import { IconPickaxe, IconHammer, IconHand } from './Icons';

export type GameMode = 'build' | 'mine' | 'adventure';

interface ModeToggleProps {
  mode: GameMode;
  onToggle: () => void;
}

const MODE_CONFIG: Record<GameMode, { border: string; bg: string; label: string; Icon: typeof IconPickaxe }> = {
  build: { border: '#6b8e68', bg: 'rgba(107,142,104,0.6)', label: 'Budowanie', Icon: IconHammer },
  mine: { border: '#c4613a', bg: 'rgba(196,97,58,0.6)', label: 'Niszczenie', Icon: IconPickaxe },
  adventure: { border: '#5a7a9a', bg: 'rgba(90,122,154,0.6)', label: 'Klikanie', Icon: IconHand },
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
        color: '#e8dcc8',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'manipulation',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      title={`Tryb: ${config.label} (Tab)`}
    >
      <config.Icon size={20} color="#e8dcc8" />
    </button>
  );
}
