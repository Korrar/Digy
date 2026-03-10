import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCraftingStore } from '../../stores/craftingStore';
import { DevTools, DevToolsToggle } from './DevTools';
import { ambientMusic } from '../../systems/AmbientMusic';
import { IconPickaxe, IconHammer, IconSpeakerOn, IconSpeakerOff, IconWrench, IconBackpack, IconClose, IconSun, IconMoon, IconSunrise, IconSunset } from './Icons';

interface HUDProps {
  mode?: 'mine' | 'build' | 'adventure' | 'explore';
  onModeToggle?: () => void;
  timeIndicator?: string;
  onPlateToggle?: () => void;
  placementMode?: boolean;
  showSaveIndicator?: boolean;
}

function TimeIcon({ indicator }: { indicator: string }) {
  switch (indicator) {
    case 'sunrise': return <IconSunrise size="clamp(14px, 4vw, 18px)" />;
    case 'day': return <IconSun size="clamp(14px, 4vw, 18px)" />;
    case 'sunset': return <IconSunset size="clamp(14px, 4vw, 18px)" />;
    case 'night': return <IconMoon size="clamp(14px, 4vw, 18px)" />;
    default: return null;
  }
}

export function HUD({ mode, onModeToggle, timeIndicator, onPlateToggle, placementMode, showSaveIndicator }: HUDProps) {
  const scene = useGameStore((s) => s.scene);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const enterAR = useGameStore((s) => s.enterAR);
  const biome = useGameStore((s) => s.currentBiome);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);
  const toggleCrafting = useCraftingStore((s) => s.toggleCrafting);
  const [musicOn, setMusicOn] = useState(ambientMusic.isEnabled());
  const [showPause, setShowPause] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowHelp(false);
      setShowPause((p) => !p);
    }
    if (e.key === 'F1') {
      e.preventDefault();
      setShowPause(false);
      setShowHelp((h) => !h);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const biomeNames: Record<string, string> = {
    forest: 'Las',
    desert: 'Pustynia',
    cave: 'Jaskinia',
    mountains: 'Gory',
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
          {scene === 'hideout' && 'Kryjowka'}
          {timeIndicator && <TimeIcon indicator={timeIndicator} />}
        </div>
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {scene === 'hideout' && onModeToggle && (
            <button onClick={onModeToggle} style={btnStyle} title={`Tryb: ${mode === 'mine' ? 'Kopanie' : mode === 'build' ? 'Budowanie' : 'Przygoda'}`}>
              {mode === 'mine' ? <IconPickaxe size={18} color="#fff" /> : mode === 'build' ? <IconHammer size={18} color="#fff" /> : <span style={{ fontSize: 16 }}>👁</span>}
            </button>
          )}
          <button onClick={() => setMusicOn(ambientMusic.toggle())} style={btnStyle} title={musicOn ? 'Wycisz muzyke' : 'Wlacz muzyke'}>
            {musicOn ? <IconSpeakerOn size={18} color="#fff" /> : <IconSpeakerOff size={18} color="#fff" />}
          </button>
          {scene === 'hideout' && onPlateToggle && (
            <button onClick={onPlateToggle} style={{ ...btnStyle, background: placementMode ? 'rgba(68,170,255,0.5)' : 'rgba(0,0,0,0.5)' }} title="Platformy dekoracyjne (P)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          )}
          {(scene === 'biome' || scene === 'hideout') && (
            <button onClick={enterAR} style={btnStyle} title="AR Podglad">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10S2 17.5 2 12z" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </button>
          )}
          <button onClick={toggleCrafting} style={btnStyle} title="Crafting (C)">
            <IconWrench size={18} color="#fff" />
          </button>
          <DevToolsToggle />
          <button onClick={toggleInventory} style={btnStyle} title="Inwentarz (E)">
            <IconBackpack size={18} color="#fff" />
          </button>
          <button onClick={returnToMenu} style={{ ...btnStyle, background: 'rgba(180,40,40,0.7)' }} title="Menu glowne">
            <IconClose size={18} color="#fff" />
          </button>
        </div>
      </div>
      <DevTools />

      {/* Save indicator */}
      {showSaveIndicator && (
        <div style={{
          position: 'fixed', bottom: 60, right: 12, zIndex: 150,
          padding: '4px 10px', borderRadius: 4,
          background: 'rgba(40,120,40,0.8)', color: '#aaffaa',
          fontSize: 11, fontWeight: 600, pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease',
        }}>
          Zapisano
        </div>
      )}

      {/* Pause menu */}
      {showPause && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowPause(false); }}>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Pauza</h2>
          <button onClick={() => setShowPause(false)} style={pauseBtnStyle}>Kontynuuj</button>
          <button onClick={() => { setShowPause(false); setShowHelp(true); }} style={pauseBtnStyle}>Pomoc (F1)</button>
          <button onClick={returnToMenu} style={{ ...pauseBtnStyle, background: 'rgba(180,40,40,0.7)' }}>Menu glowne</button>
        </div>
      )}

      {/* Help screen */}
      {showHelp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div style={{
            background: 'rgba(30,30,40,0.95)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '16px 24px', maxWidth: 420, width: '90vw', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Skroty klawiszowe</h3>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Esc', 'Pauza'],
                ['F1', 'Pomoc'],
                ['Tab', 'Przelacz tryb (kopanie/budowanie/przygoda)'],
                ['E', 'Inwentarz'],
                ['C', 'Crafting'],
                ['P', 'Platformy dekoracyjne (kryjowka)'],
                ['Q', 'Wyrzuc przedmiot'],
                ['1-9', 'Wybor slotu hotbar'],
                ['LPM', 'Kopanie / Atak'],
                ['PPM', 'Stawianie bloku / Dzielenie stacka'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    background: 'rgba(255,255,255,0.1)', borderRadius: 4,
                    padding: '2px 8px', color: '#aaa', fontSize: 12, fontWeight: 700,
                    minWidth: 40, textAlign: 'center',
                  }}>{key}</span>
                  <span style={{ color: '#ccc', fontSize: 13 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const pauseBtnStyle: React.CSSProperties = {
  padding: '10px 32px', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: '#fff',
  fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, minWidth: 180,
};

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
