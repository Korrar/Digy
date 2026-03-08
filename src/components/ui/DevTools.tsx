import { useDevStore } from '../../stores/devStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType } from '../../core/voxel/BlockRegistry';

const TIME_PRESETS = [
  { label: 'Auto', value: null },
  { label: 'Wschód', value: 0.25 },
  { label: 'Rano', value: 0.35 },
  { label: 'Południe', value: 0.5 },
  { label: 'Zachód', value: 0.75 },
  { label: 'Noc', value: 0.0 },
] as const;

export function DevTools() {
  const open = useDevStore((s) => s.devToolsOpen);
  const fixedTime = useDevStore((s) => s.fixedTimeOfDay);
  const setFixedTime = useDevStore((s) => s.setFixedTimeOfDay);
  const fastMining = useDevStore((s) => s.fastMining);
  const toggleFastMining = useDevStore((s) => s.toggleFastMining);
  const addBlock = useInventoryStore((s) => s.addBlock);

  if (!open) return null;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Dev Tools</div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Pora dnia</div>
        <div style={presetsRow}>
          {TIME_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFixedTime(p.value)}
              style={{
                ...presetBtn,
                background: (fixedTime === p.value || (p.value === null && fixedTime === null))
                  ? 'rgba(80,160,255,0.6)'
                  : 'rgba(255,255,255,0.1)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={fixedTime ?? 0.5}
          onChange={(e) => setFixedTime(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: 6 }}
        />
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
          {fixedTime !== null ? `${Math.round(fixedTime * 24)}:00` : 'automatyczny cykl'}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Kopanie</div>
        <button
          onClick={toggleFastMining}
          style={{
            ...presetBtn,
            width: '100%',
            padding: '6px 8px',
            background: fastMining ? 'rgba(255,80,80,0.6)' : 'rgba(255,255,255,0.1)',
          }}
        >
          {fastMining ? '⚡ Szybkie kopanie: ON' : '⛏ Szybkie kopanie: OFF'}
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Transport</div>
        <div style={presetsRow}>
          <button onClick={() => addBlock(BlockType.RAIL, 16)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +16 Rail
          </button>
          <button onClick={() => addBlock(BlockType.POWERED_RAIL, 8)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +8 P.Rail
          </button>
          <button onClick={() => addBlock(BlockType.MINECART, 1)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +1 Minecart
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Zasoby</div>
        <div style={presetsRow}>
          <button onClick={() => addBlock(BlockType.IRON_INGOT, 16)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +16 Iron
          </button>
          <button onClick={() => addBlock(BlockType.DIAMOND, 8)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +8 Diamond
          </button>
          <button onClick={() => addBlock(BlockType.COAL, 16)} style={{ ...presetBtn, padding: '4px 8px' }}>
            +16 Coal
          </button>
        </div>
      </div>
    </div>
  );
}

export function DevToolsToggle() {
  const toggle = useDevStore((s) => s.toggleDevTools);
  return (
    <button onClick={toggle} style={toggleBtnStyle} title="Dev Tools">
      DEV
    </button>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 50,
  right: 8,
  width: 220,
  background: 'rgba(0,0,0,0.85)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: 12,
  zIndex: 200,
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: 12,
};

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.2)',
  paddingBottom: 6,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ccc',
  marginBottom: 4,
};

const presetsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
};

const presetBtn: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const toggleBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  background: 'rgba(80,80,120,0.7)',
  color: '#aaf',
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  minWidth: 36,
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
};
