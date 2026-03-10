import { useState, useEffect, useCallback } from 'react';

interface FloatingEntry {
  id: number;
  text: string;
  color: string;
  x: number;
}

let nextId = 0;

/** Floating text popups for XP gains, healing, etc. */
export function FloatingText() {
  const [entries, setEntries] = useState<FloatingEntry[]>([]);

  const handleEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { text: string; color?: string };
    const id = nextId++;
    setEntries((prev) => [
      ...prev,
      { id, text: detail.text, color: detail.color || '#fff', x: 30 + Math.random() * 40 },
    ]);
    setTimeout(() => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    }, 1500);
  }, []);

  useEffect(() => {
    window.addEventListener('digy:float-text', handleEvent);
    return () => window.removeEventListener('digy:float-text', handleEvent);
  }, [handleEvent]);

  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 250 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            position: 'absolute',
            left: `${entry.x}%`,
            top: '40%',
            color: entry.color,
            fontSize: 16,
            fontWeight: 900,
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            animation: 'floatUp 1.5s ease-out forwards',
            pointerEvents: 'none',
          }}
        >
          {entry.text}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-60px); }
        }
      `}</style>
    </div>
  );
}

/** Dispatch a floating text event */
export function showFloatingText(text: string, color?: string) {
  window.dispatchEvent(new CustomEvent('digy:float-text', { detail: { text, color } }));
}
