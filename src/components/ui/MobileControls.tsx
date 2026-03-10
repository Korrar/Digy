import { useRef, useCallback, useEffect, useState } from 'react';
import { useInventoryStore } from '../../stores/inventoryStore';
import { HOTBAR_SIZE } from '../../utils/constants';

interface MobileControlsProps {
  onDigStart: () => void;
  onDigEnd: () => void;
  onInventoryToggle: () => void;
  onModeToggle?: () => void;
  mode?: 'build' | 'mine' | 'adventure';
}

export function useTouchDetect(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    check();
    window.addEventListener('touchstart', () => setIsTouch(true), { once: true });
  }, []);
  return isTouch;
}

export function MobileControls({ onDigStart, onDigEnd, onInventoryToggle, onModeToggle, mode }: MobileControlsProps) {
  const digBtnRef = useRef<HTMLButtonElement>(null);
  const isDigging = useRef(false);

  const handleDigTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDigging.current = true;
    onDigStart();
  }, [onDigStart]);

  const handleDigTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDigging.current = false;
    onDigEnd();
  }, [onDigEnd]);

  return (
    <>
      {/* Dig / Place button - bottom right */}
      <button
        ref={digBtnRef}
        onTouchStart={handleDigTouchStart}
        onTouchEnd={handleDigTouchEnd}
        onTouchCancel={handleDigTouchEnd}
        style={{
          position: 'fixed',
          bottom: 90,
          right: 16,
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: `3px solid ${mode === 'build' ? 'rgba(100,255,150,0.6)' : mode === 'adventure' ? 'rgba(100,150,255,0.6)' : 'rgba(255,100,100,0.6)'}`,
          background: mode === 'build' ? 'rgba(40,100,60,0.6)' : mode === 'adventure' ? 'rgba(30,60,100,0.6)' : 'rgba(100,30,30,0.6)',
          color: '#fff',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        {mode === 'build' ? '🔨' : mode === 'adventure' ? '👆' : '⛏'}
      </button>

      {/* Inventory button - bottom left */}
      <button
        onTouchStart={(e) => { e.stopPropagation(); onInventoryToggle(); }}
        style={{
          position: 'fixed',
          bottom: 90,
          left: 16,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          fontSize: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        🎒
      </button>

      {/* Mode toggle (hideout only) */}
      {onModeToggle && (
        <button
          onTouchStart={(e) => { e.stopPropagation(); onModeToggle(); }}
          style={{
            position: 'fixed',
            bottom: 170,
            right: 20,
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          {mode === 'build' ? '🔨' : mode === 'adventure' ? '👆' : '⛏'}
        </button>
      )}

      {/* Hotbar scroll arrows */}
      <div style={{
        position: 'fixed',
        bottom: 4,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 0,
        zIndex: 160,
        pointerEvents: 'none',
      }}>
        <HotbarArrow direction="left" />
        <div style={{ width: '68vw' }} />
        <HotbarArrow direction="right" />
      </div>
    </>
  );
}

function HotbarArrow({ direction }: { direction: 'left' | 'right' }) {
  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const store = useInventoryStore.getState();
    const current = store.selectedHotbarIndex;
    const next = direction === 'left'
      ? ((current - 1) % HOTBAR_SIZE + HOTBAR_SIZE) % HOTBAR_SIZE
      : (current + 1) % HOTBAR_SIZE;
    store.setSelectedHotbar(next);
  }, [direction]);

  return (
    <button
      onTouchStart={handleTouch}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(0,0,0,0.5)',
        color: '#fff',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {direction === 'left' ? '◀' : '▶'}
    </button>
  );
}
