import { IconPickaxe } from './Icons';

interface ModeToggleProps {
  mode: 'mine' | 'explore';
  onToggle: () => void;
}

// Eye icon for explore mode
function IconEye({ size = 16, color = 'currentColor' }: { size?: number | string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 8C1 8 4 3 8 3C12 3 15 8 15 8C15 8 12 13 8 13C4 13 1 8 1 8Z" stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2.5" fill={color} />
    </svg>
  );
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
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
        border: `2px solid ${mode === 'mine' ? '#ff6644' : '#44aaff'}`,
        background: mode === 'mine' ? 'rgba(180,60,30,0.7)' : 'rgba(40,120,200,0.7)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'manipulation',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      title={`Mode: ${mode} (Tab to switch)`}
    >
      {mode === 'mine' ? (
        <IconPickaxe size={20} color="#fff" />
      ) : (
        <IconEye size={20} color="#fff" />
      )}
    </button>
  );
}
