import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCraftingStore } from '../../stores/craftingStore';
import { DevTools, DevToolsToggle } from './DevTools';
import { ambientMusic } from '../../systems/AmbientMusic';
import { IconPickaxe, IconHammer, IconSpeakerOn, IconSpeakerOff, IconWrench, IconBackpack, IconClose, IconSun, IconMoon, IconSunrise, IconSunset } from './Icons';

interface HUDProps {
  mode?: 'mine' | 'build' | 'explore';
  onModeToggle?: () => void;
  timeIndicator?: string;
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

export function HUD({ mode, onModeToggle, timeIndicator }: HUDProps) {
  const scene = useGameStore((s) => s.scene);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const biome = useGameStore((s) => s.currentBiome);
  const toggleInventory = useInventoryStore((s) => s.toggleInventory);
  const toggleCrafting = useCraftingStore((s) => s.toggleCrafting);
  const [musicOn, setMusicOn] = useState(ambientMusic.isEnabled());

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
            <button onClick={onModeToggle} style={btnStyle} title={`Tryb: ${mode === 'mine' ? 'Kopanie' : mode === 'build' ? 'Budowanie' : 'Obserwacja'}`}>
              {mode === 'mine' ? <IconPickaxe size={18} color="#fff" /> : mode === 'build' ? <IconHammer size={18} color="#fff" /> : <span style={{ fontSize: 16 }}>👁</span>}
            </button>
          )}
          <button onClick={() => setMusicOn(ambientMusic.toggle())} style={btnStyle}>
            {musicOn ? <IconSpeakerOn size={18} color="#fff" /> : <IconSpeakerOff size={18} color="#fff" />}
          </button>
          <button onClick={toggleCrafting} style={btnStyle}>
            <IconWrench size={18} color="#fff" />
          </button>
          <DevToolsToggle />
          <button onClick={toggleInventory} style={btnStyle}>
            <IconBackpack size={18} color="#fff" />
          </button>
          <button onClick={returnToMenu} style={{ ...btnStyle, background: 'rgba(180,40,40,0.7)' }}>
            <IconClose size={18} color="#fff" />
          </button>
        </div>
      </div>
      <DevTools />
    </>
  );
}

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
