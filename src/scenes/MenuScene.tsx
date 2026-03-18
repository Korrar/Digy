import { useGameStore } from '../stores/gameStore';
import { BIOME_LIST, type BiomeType } from '../core/terrain/biomes';
import { useCraftingStore } from '../stores/craftingStore';
import { CraftingPanel } from '../components/ui/CraftingPanel';
import { IconWrench } from '../components/ui/Icons';

export function MenuScene() {
  const enterBiome = useGameStore((s) => s.enterBiome);
  const enterHideout = useGameStore((s) => s.enterHideout);
  const toggleCrafting = useCraftingStore((s) => s.toggleCrafting);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      background: 'radial-gradient(ellipse at 50% 20%, #1e2a3a 0%, #0f1520 40%, #0a0d14 100%)',
      fontFamily: "'Philosopher', 'Cinzel', serif",
      padding: 'clamp(24px, 5vh, 48px) 16px env(safe-area-inset-bottom, 24px) 16px',
      overflow: 'auto',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Decorative Greek columns on sides */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `
          linear-gradient(90deg, rgba(201,168,76,0.08) 0%, transparent 15%, transparent 85%, rgba(201,168,76,0.08) 100%),
          radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
      }} />

      {/* Greek meander top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
        opacity: 0.6,
      }} />

      {/* Laurel wreath icon above title */}
      <div style={{
        fontSize: 'clamp(28px, 8vw, 40px)',
        marginBottom: 4,
        filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.3))',
      }}>
        🏛️
      </div>

      <h1 style={{
        color: '#c9a84c',
        fontSize: 'clamp(36px, 12vw, 56px)',
        fontWeight: 900,
        letterSpacing: 8,
        marginBottom: 2,
        textShadow: '0 0 30px rgba(201,168,76,0.4), 0 2px 4px rgba(0,0,0,0.5)',
        fontFamily: "'Cinzel', serif",
      }}>
        DIGY
      </h1>

      <div style={{
        width: 'clamp(80px, 30vw, 160px)', height: 2,
        background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
        marginBottom: 4,
      }} />

      <p style={{
        color: '#8a7a5a',
        fontSize: 'clamp(11px, 3vw, 13px)',
        marginBottom: 'clamp(20px, 5vh, 40px)',
        fontStyle: 'italic',
        letterSpacing: 2,
        fontFamily: "'Philosopher', serif",
      }}>
        Kopaj, zbieraj, buduj
      </p>

      <div style={{ marginBottom: 'clamp(16px, 4vh, 32px)', width: '100%', maxWidth: 420 }}>
        <h3 style={{
          color: '#c9a84c',
          fontSize: 'clamp(11px, 3vw, 14px)',
          marginBottom: 14,
          textTransform: 'uppercase',
          letterSpacing: 3,
          textAlign: 'center',
          fontFamily: "'Cinzel', serif",
          fontWeight: 600,
        }}>
          Wybierz biom
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          padding: '0 8px',
        }}>
          {BIOME_LIST.map((b) => (
            <button
              key={b.type}
              onClick={() => enterBiome(b.type as BiomeType)}
              style={biomeButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.borderColor = '#c9a84c';
                e.currentTarget.style.background = 'rgba(201,168,76,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)';
                e.currentTarget.style.background = 'rgba(201,168,76,0.05)';
              }}
            >
              <span style={{ fontSize: 'clamp(24px, 8vw, 32px)' }}>{b.emoji}</span>
              <span style={{
                color: '#e8dcc8',
                fontSize: 'clamp(12px, 3.5vw, 14px)',
                fontWeight: 600,
                fontFamily: "'Philosopher', serif",
              }}>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={enterHideout}
        style={{
          padding: 'clamp(10px, 2.5vh, 14px) clamp(24px, 8vw, 40px)',
          border: '2px solid rgba(107,142,104,0.4)',
          borderRadius: 8,
          background: 'rgba(107,142,104,0.15)',
          color: '#a8c4a0',
          fontSize: 'clamp(14px, 4vw, 16px)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: "'Cinzel', serif",
          letterSpacing: 2,
          transition: 'all 0.2s',
          width: '100%',
          maxWidth: 280,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(107,142,104,0.3)';
          e.currentTarget.style.borderColor = 'rgba(107,142,104,0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(107,142,104,0.15)';
          e.currentTarget.style.borderColor = 'rgba(107,142,104,0.4)';
        }}
      >
        Kryjówka
      </button>

      <button
        onClick={toggleCrafting}
        style={{
          marginTop: 10,
          padding: 'clamp(10px, 2.5vh, 14px) clamp(24px, 8vw, 40px)',
          border: '2px solid rgba(201,168,76,0.3)',
          borderRadius: 8,
          background: 'rgba(201,168,76,0.1)',
          color: '#c9a84c',
          fontSize: 'clamp(14px, 4vw, 16px)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: "'Cinzel', serif",
          letterSpacing: 2,
          transition: 'all 0.2s',
          width: '100%',
          maxWidth: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(201,168,76,0.2)';
          e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(201,168,76,0.1)';
          e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)';
        }}
      >
        <IconWrench size={18} color="#c9a84c" /> Crafting
      </button>

      <CraftingPanel />

      <div style={{
        marginTop: 'clamp(16px, 4vh, 40px)',
        color: '#5a5040',
        fontSize: 'clamp(9px, 2.5vw, 11px)',
        textAlign: 'center',
        padding: '0 16px',
        fontStyle: 'italic',
      }}>
        Dotknij biomu aby rozpocząć | Przytrzymaj aby kopać
      </div>

      {/* Greek meander bottom border */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
        opacity: 0.4,
      }} />
    </div>
  );
}

const biomeButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 'clamp(70px, 15vh, 100px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: '2px solid rgba(201,168,76,0.2)',
  borderRadius: 8,
  background: 'rgba(201,168,76,0.05)',
  cursor: 'pointer',
  fontFamily: "'Philosopher', serif",
  transition: 'all 0.2s',
};
