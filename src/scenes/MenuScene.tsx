import { useGameStore } from '../stores/gameStore';
import { BIOME_LIST, type BiomeType } from '../core/terrain/biomes';
import { initAudio } from '../core/audio/SoundEngine';

export function MenuScene() {
  const enterBiome = useGameStore((s) => s.enterBiome);
  const enterHideout = useGameStore((s) => s.enterHideout);

  const handleBiome = (type: BiomeType) => {
    initAudio();
    enterBiome(type);
  };

  const handleHideout = () => {
    initAudio();
    enterHideout();
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Segoe UI', sans-serif",
      padding: '16px',
      overflow: 'auto',
    }}>
      <h1 style={{
        color: '#fff',
        fontSize: 'clamp(32px, 8vw, 48px)',
        fontWeight: 900,
        letterSpacing: 4,
        marginBottom: 4,
        textShadow: '0 0 20px rgba(100,200,255,0.3)',
      }}>
        DIGY
      </h1>
      <p style={{ color: '#8899aa', fontSize: 'clamp(11px, 3vw, 14px)', marginBottom: 'clamp(16px, 4vh, 40px)' }}>
        Kopaj, zbieraj, buduj
      </p>

      <div style={{ marginBottom: 'clamp(16px, 3vh, 32px)' }}>
        <h3 style={{ color: '#aabbcc', fontSize: 'clamp(11px, 3vw, 14px)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}>
          Wybierz biom
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 280 }}>
          {BIOME_LIST.map((b) => (
            <button
              key={b.type}
              onClick={() => handleBiome(b.type as BiomeType)}
              style={biomeButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = '#4488cc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            >
              <span style={{ fontSize: 'clamp(24px, 6vw, 32px)' }}>{b.emoji}</span>
              <span style={{ color: '#fff', fontSize: 'clamp(11px, 3vw, 14px)', fontWeight: 600 }}>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleHideout}
        style={{
          padding: 'clamp(10px, 2vh, 14px) clamp(24px, 6vw, 40px)',
          border: '2px solid rgba(100,255,150,0.3)',
          borderRadius: 12,
          background: 'rgba(40,100,60,0.4)',
          color: '#aaffbb',
          fontSize: 'clamp(13px, 3.5vw, 16px)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 1,
          transition: 'all 0.2s',
          touchAction: 'manipulation',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(40,100,60,0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(40,100,60,0.4)';
        }}
      >
        Kryjówka
      </button>

      <div style={{ marginTop: 'clamp(16px, 3vh, 40px)', color: '#556677', fontSize: 'clamp(9px, 2.5vw, 11px)', textAlign: 'center', padding: '0 16px' }}>
        Dotknij i przytrzymaj aby kopać | Przyciski po prawej do zmiany slotów
      </div>
    </div>
  );
}

const biomeButtonStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 80,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
  touchAction: 'manipulation',
};
