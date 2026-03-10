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
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Segoe UI', sans-serif",
      padding: 'clamp(24px, 5vh, 48px) 16px env(safe-area-inset-bottom, 24px) 16px',
      overflow: 'auto',
      boxSizing: 'border-box',
    }}>
      <h1 style={{
        color: '#fff',
        fontSize: 'clamp(32px, 10vw, 48px)',
        fontWeight: 900,
        letterSpacing: 4,
        marginBottom: 4,
        textShadow: '0 0 20px rgba(100,200,255,0.3)',
      }}>
        DIGY
      </h1>
      <p style={{ color: '#8899aa', fontSize: 'clamp(12px, 3vw, 14px)', marginBottom: 'clamp(20px, 5vh, 40px)' }}>
        Kopaj, zbieraj, buduj
      </p>

      <div style={{ marginBottom: 'clamp(16px, 4vh, 32px)', width: '100%', maxWidth: 400 }}>
        <h3 style={{
          color: '#aabbcc',
          fontSize: 'clamp(11px, 3vw, 14px)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 2,
          textAlign: 'center',
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
                e.currentTarget.style.borderColor = '#4488cc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            >
              <span style={{ fontSize: 'clamp(24px, 8vw, 32px)' }}>{b.emoji}</span>
              <span style={{ color: '#fff', fontSize: 'clamp(12px, 3.5vw, 14px)', fontWeight: 600 }}>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={enterHideout}
        style={{
          padding: 'clamp(10px, 2.5vh, 14px) clamp(24px, 8vw, 40px)',
          border: '2px solid rgba(100,255,150,0.3)',
          borderRadius: 12,
          background: 'rgba(40,100,60,0.4)',
          color: '#aaffbb',
          fontSize: 'clamp(14px, 4vw, 16px)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 1,
          transition: 'all 0.2s',
          width: '100%',
          maxWidth: 280,
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

      <button
        onClick={toggleCrafting}
        style={{
          marginTop: 10,
          padding: 'clamp(10px, 2.5vh, 14px) clamp(24px, 8vw, 40px)',
          border: '2px solid rgba(200,160,80,0.3)',
          borderRadius: 12,
          background: 'rgba(120,80,30,0.4)',
          color: '#ffcc88',
          fontSize: 'clamp(14px, 4vw, 16px)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 1,
          transition: 'all 0.2s',
          width: '100%',
          maxWidth: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(120,80,30,0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(120,80,30,0.4)';
        }}
      >
        <IconWrench size={18} color="#ffcc88" /> Crafting
      </button>

      <CraftingPanel />

      <div style={{
        marginTop: 'clamp(16px, 4vh, 40px)',
        color: '#556677',
        fontSize: 'clamp(9px, 2.5vw, 11px)',
        textAlign: 'center',
        padding: '0 16px',
      }}>
        Dotknij biomu aby rozpocząć | Przytrzymaj aby kopać
      </div>
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
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};
