import { useGameStore } from '../stores/gameStore';
import { BIOME_LIST, type BiomeType } from '../core/terrain/biomes';

export function MenuScene() {
  const enterBiome = useGameStore((s) => s.enterBiome);
  const enterHideout = useGameStore((s) => s.enterHideout);

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
    }}>
      <h1 style={{
        color: '#fff',
        fontSize: 48,
        fontWeight: 900,
        letterSpacing: 4,
        marginBottom: 8,
        textShadow: '0 0 20px rgba(100,200,255,0.3)',
      }}>
        DIGY
      </h1>
      <p style={{ color: '#8899aa', fontSize: 14, marginBottom: 40 }}>
        Kopaj, zbieraj, buduj
      </p>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#aabbcc', fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 }}>
          Wybierz biom
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {BIOME_LIST.map((b) => (
            <button
              key={b.type}
              onClick={() => enterBiome(b.type as BiomeType)}
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
              <span style={{ fontSize: 32 }}>{b.emoji}</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={enterHideout}
        style={{
          padding: '14px 40px',
          border: '2px solid rgba(100,255,150,0.3)',
          borderRadius: 12,
          background: 'rgba(40,100,60,0.4)',
          color: '#aaffbb',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 1,
          transition: 'all 0.2s',
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

      <div style={{ marginTop: 40, color: '#556677', fontSize: 11 }}>
        Klawisze: 1-9 sloty | E ekwipunek | Scroll zmiana slotu | Tab tryb budowania/kopania
      </div>
    </div>
  );
}

const biomeButtonStyle: React.CSSProperties = {
  width: 120,
  height: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};
