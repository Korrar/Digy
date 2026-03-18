import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCraftingStore } from '../../stores/craftingStore';
import { DevTools, DevToolsToggle } from './DevTools';
import { ambientMusic } from '../../systems/AmbientMusic';
import { IconSpeakerOn, IconSpeakerOff, IconWrench, IconBackpack, IconClose, IconSun, IconMoon, IconSunrise, IconSunset } from './Icons';
import { useDestructionStore } from '../../stores/destructionStore';

interface HUDProps {
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

export function HUD({ timeIndicator, onPlateToggle, placementMode, showSaveIndicator }: HUDProps) {
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
        background: 'linear-gradient(180deg, rgba(13,10,6,0.7) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.15)',
        zIndex: 100,
        pointerEvents: 'none',
      }}>
        <div style={{
          color: '#c9a84c',
          fontSize: 'clamp(11px, 3vw, 14px)',
          fontWeight: 'bold',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: "'Cinzel', serif",
          letterSpacing: 1,
        }}>
          {scene === 'biome' && `${biomeNames[biome] || biome}`}
          {scene === 'hideout' && 'Kryjowka'}
          {timeIndicator && <TimeIcon indicator={timeIndicator} />}
        </div>
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          <button onClick={() => setMusicOn(ambientMusic.toggle())} style={btnStyle} title={musicOn ? 'Wycisz muzyke' : 'Wlacz muzyke'}>
            {musicOn ? <IconSpeakerOn size={18} color="#c9a84c" /> : <IconSpeakerOff size={18} color="#8a7a5a" />}
          </button>
          {scene === 'hideout' && onPlateToggle && (
            <button onClick={onPlateToggle} style={{ ...btnStyle, background: placementMode ? 'rgba(201,168,76,0.3)' : 'rgba(13,10,6,0.6)' }} title="Platformy dekoracyjne (P)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          )}
          {(scene === 'biome' || scene === 'hideout') && (
            <button onClick={enterAR} style={btnStyle} title="AR Podglad">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2">
                <path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10S2 17.5 2 12z" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </button>
          )}
          <button onClick={toggleCrafting} style={btnStyle} title="Crafting (C)">
            <IconWrench size={18} color="#c9a84c" />
          </button>
          <DevToolsToggle />
          <button onClick={toggleInventory} style={btnStyle} title="Inwentarz (E)">
            <IconBackpack size={18} color="#c9a84c" />
          </button>
          <button onClick={returnToMenu} style={{ ...btnStyle, background: 'rgba(140,50,40,0.6)', borderColor: 'rgba(180,80,60,0.4)' }} title="Menu glowne">
            <IconClose size={18} color="#e8dcc8" />
          </button>
        </div>
      </div>
      <DevTools />

      {/* Save indicator */}
      {showSaveIndicator && (
        <div style={{
          position: 'fixed', bottom: 60, right: 12, zIndex: 150,
          padding: '4px 10px', borderRadius: 4,
          background: 'rgba(107,142,104,0.6)', color: '#d4e8d0',
          fontSize: 11, fontWeight: 600, pointerEvents: 'none',
          border: '1px solid rgba(107,142,104,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          Zapisano
        </div>
      )}

      {/* Destruction counter - only in village biome */}
      {scene === 'biome' && biome === 'village' && <DestructionCounter />}

      {/* Pause menu */}
      {showPause && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,8,4,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowPause(false); }}>
          <div style={{
            fontSize: 24, marginBottom: 4,
            filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.3))',
          }}>🏛️</div>
          <h2 style={{
            color: '#c9a84c', fontSize: 22, fontWeight: 700, margin: 0,
            fontFamily: "'Cinzel', serif", letterSpacing: 3,
          }}>Pauza</h2>
          <button onClick={() => setShowPause(false)} style={pauseBtnStyle}>Kontynuuj</button>
          <button onClick={() => { setShowPause(false); setShowHelp(true); }} style={pauseBtnStyle}>Pomoc (F1)</button>
          <button onClick={returnToMenu} style={{ ...pauseBtnStyle, background: 'rgba(140,50,40,0.5)', borderColor: 'rgba(180,80,60,0.3)' }}>Menu glowne</button>
        </div>
      )}

      {/* Help screen */}
      {showHelp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,8,4,0.9)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div style={{
            background: 'rgba(26,20,12,0.95)', borderRadius: 8,
            border: '1px solid rgba(201,168,76,0.25)',
            padding: '16px 24px', maxWidth: 420, width: '90vw', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{
                color: '#c9a84c', margin: 0, fontSize: 18,
                fontFamily: "'Cinzel', serif", letterSpacing: 1,
              }}>Skroty klawiszowe</h3>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', color: '#8a7a5a', fontSize: 20, cursor: 'pointer' }}>×</button>
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
                    background: 'rgba(201,168,76,0.15)', borderRadius: 4,
                    padding: '2px 8px', color: '#c9a84c', fontSize: 12, fontWeight: 700,
                    minWidth: 40, textAlign: 'center',
                    border: '1px solid rgba(201,168,76,0.2)',
                    fontFamily: "'Cinzel', serif",
                  }}>{key}</span>
                  <span style={{ color: '#b8a888', fontSize: 13 }}>{desc}</span>
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
  padding: '10px 32px', border: '1px solid rgba(201,168,76,0.25)',
  borderRadius: 8, background: 'rgba(201,168,76,0.1)', color: '#e8dcc8',
  fontSize: 15, cursor: 'pointer', fontFamily: "'Cinzel', serif", fontWeight: 600, minWidth: 180,
  letterSpacing: 1,
};

const btnStyle: React.CSSProperties = {
  padding: 'clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 14px)',
  border: '1px solid rgba(201,168,76,0.25)',
  borderRadius: 6,
  background: 'rgba(13,10,6,0.6)',
  color: '#c9a84c',
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

/** Destruction counter widget for village biome */
function DestructionCounter() {
  const level = useDestructionStore((s) => s.getDestructionLevel());
  const tier = useDestructionStore((s) => s.getDestructionTier());
  const blocksDestroyed = useDestructionStore((s) => s.blocksDestroyed);
  const npcsTerrorized = useDestructionStore((s) => s.npcsTerrorized);
  const lightningStrikes = useDestructionStore((s) => s.lightningStrikes);
  const explosions = useDestructionStore((s) => s.explosions);

  // Color from green (0%) through yellow to red (100%)
  const r = Math.min(255, Math.floor(level * 5.1));
  const g = Math.min(255, Math.floor((100 - level) * 2.55));
  const barColor = `rgb(${r},${g},40)`;

  return (
    <div style={{
      position: 'fixed', top: 50, left: 8, zIndex: 110,
      background: 'rgba(13,10,6,0.7)', borderRadius: 8, padding: '6px 10px',
      pointerEvents: 'none', minWidth: 140,
      border: '1px solid rgba(201,168,76,0.15)',
    }}>
      <div style={{ color: '#c9a84c', fontSize: 10, fontWeight: 700, marginBottom: 3, fontFamily: "'Cinzel', serif" }}>
        Zniszczenia Polis
      </div>
      {/* Progress bar */}
      <div style={{
        width: '100%', height: 6, background: 'rgba(201,168,76,0.1)',
        borderRadius: 3, overflow: 'hidden', marginBottom: 3,
      }}>
        <div style={{
          width: `${level}%`, height: '100%', background: barColor,
          borderRadius: 3, transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ color: barColor, fontSize: 11, fontWeight: 700 }}>
        {tier} ({level}%)
      </div>
      <div style={{ color: '#8a7a5a', fontSize: 9, marginTop: 2 }}>
        {blocksDestroyed > 0 && <span>Bloki: {blocksDestroyed} </span>}
        {lightningStrikes > 0 && <span>Pioruny: {lightningStrikes} </span>}
        {explosions > 0 && <span>Wybuchy: {explosions} </span>}
        {npcsTerrorized > 0 && <span>Strach: {npcsTerrorized}</span>}
      </div>
    </div>
  );
}
