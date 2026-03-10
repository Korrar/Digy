import { useState } from 'react';
import { useDevStore } from '../../stores/devStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType, getBlock } from '../../core/voxel/BlockRegistry';

const TIME_PRESETS = [
  { label: 'Auto', value: null },
  { label: 'Wschód', value: 0.25 },
  { label: 'Rano', value: 0.35 },
  { label: 'Południe', value: 0.5 },
  { label: 'Zachód', value: 0.75 },
  { label: 'Noc', value: 0.0 },
] as const;

interface ItemEntry {
  type: BlockType;
  name: string;
  count: number;
  colorHex: string;
}

interface ItemCategory {
  label: string;
  items: ItemEntry[];
}

function colorToHex(c: { r: number; g: number; b: number }): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgb(${r},${g},${b})`;
}

function buildCategories(): ItemCategory[] {
  const terrain: ItemEntry[] = [];
  const vegetation: ItemEntry[] = [];
  const building: ItemEntry[] = [];
  const slabsFencesStairs: ItemEntry[] = [];
  const doors: ItemEntry[] = [];
  const rails: ItemEntry[] = [];
  const redstone: ItemEntry[] = [];
  const tools: ItemEntry[] = [];
  const weapons: ItemEntry[] = [];
  const materials: ItemEntry[] = [];
  const food: ItemEntry[] = [];
  const special: ItemEntry[] = [];

  const makeEntry = (bt: BlockType, count = 16): ItemEntry => {
    const def = getBlock(bt);
    return { type: bt, name: def.name, count, colorHex: colorToHex(def.color) };
  };

  // Terrain
  terrain.push(makeEntry(BlockType.GRASS, 64));
  terrain.push(makeEntry(BlockType.DIRT, 64));
  terrain.push(makeEntry(BlockType.STONE, 64));
  terrain.push(makeEntry(BlockType.COBBLESTONE, 64));
  terrain.push(makeEntry(BlockType.SAND, 64));
  terrain.push(makeEntry(BlockType.SANDSTONE, 64));
  terrain.push(makeEntry(BlockType.GRAVEL, 64));
  terrain.push(makeEntry(BlockType.WOOD, 64));
  terrain.push(makeEntry(BlockType.LEAVES, 64));
  terrain.push(makeEntry(BlockType.SNOW, 64));
  terrain.push(makeEntry(BlockType.ICE, 64));
  terrain.push(makeEntry(BlockType.CACTUS, 64));
  terrain.push(makeEntry(BlockType.CLAY, 64));
  terrain.push(makeEntry(BlockType.MUD, 64));

  // Ores
  terrain.push(makeEntry(BlockType.COAL_ORE, 32));
  terrain.push(makeEntry(BlockType.IRON_ORE, 32));
  terrain.push(makeEntry(BlockType.GOLD_ORE, 32));
  terrain.push(makeEntry(BlockType.DIAMOND_ORE, 16));

  // Vegetation
  vegetation.push(makeEntry(BlockType.TALL_GRASS, 16));
  vegetation.push(makeEntry(BlockType.FLOWER_RED, 16));
  vegetation.push(makeEntry(BlockType.FLOWER_YELLOW, 16));
  vegetation.push(makeEntry(BlockType.MUSHROOM, 16));
  vegetation.push(makeEntry(BlockType.DEAD_BUSH, 16));
  vegetation.push(makeEntry(BlockType.LILY_PAD, 16));
  vegetation.push(makeEntry(BlockType.FERN, 16));

  // Building
  building.push(makeEntry(BlockType.PLANKS, 64));
  building.push(makeEntry(BlockType.GLASS, 64));
  building.push(makeEntry(BlockType.STONE_BRICKS, 64));
  building.push(makeEntry(BlockType.BOOKSHELF, 64));
  building.push(makeEntry(BlockType.TORCH, 32));
  building.push(makeEntry(BlockType.LAMP, 16));
  building.push(makeEntry(BlockType.FURNACE, 4));
  building.push(makeEntry(BlockType.CRAFTING_TABLE, 4));
  building.push(makeEntry(BlockType.CHEST, 4));
  building.push(makeEntry(BlockType.ENCHANTING_TABLE, 4));

  // Slabs, fences, stairs
  slabsFencesStairs.push(makeEntry(BlockType.PLANKS_SLAB, 32));
  slabsFencesStairs.push(makeEntry(BlockType.COBBLESTONE_SLAB, 32));
  slabsFencesStairs.push(makeEntry(BlockType.STONE_BRICKS_SLAB, 32));
  slabsFencesStairs.push(makeEntry(BlockType.FENCE_OAK, 32));
  slabsFencesStairs.push(makeEntry(BlockType.OAK_STAIRS, 16));
  slabsFencesStairs.push(makeEntry(BlockType.COBBLE_STAIRS, 16));

  // Doors
  doors.push(makeEntry(BlockType.DOOR_OAK, 8));

  // Rails & transport
  rails.push(makeEntry(BlockType.RAIL, 64));
  rails.push(makeEntry(BlockType.POWERED_RAIL, 32));
  rails.push(makeEntry(BlockType.DETECTOR_RAIL, 32));
  rails.push(makeEntry(BlockType.MINECART, 1));
  rails.push(makeEntry(BlockType.WARNING_LIGHT, 1));

  // Redstone / cables / levers / pistons
  redstone.push(makeEntry(BlockType.LEVER, 16));
  redstone.push(makeEntry(BlockType.BUTTON, 16));
  redstone.push(makeEntry(BlockType.PRESSURE_PLATE, 16));
  redstone.push(makeEntry(BlockType.CABLE, 64));
  redstone.push(makeEntry(BlockType.PISTON, 16));
  redstone.push(makeEntry(BlockType.STICKY_PISTON, 16));
  redstone.push(makeEntry(BlockType.TNT, 16));
  redstone.push(makeEntry(BlockType.REPEATER, 16));
  redstone.push(makeEntry(BlockType.COMPARATOR, 16));

  // Tools
  tools.push(makeEntry(BlockType.WOODEN_PICKAXE, 1));
  tools.push(makeEntry(BlockType.STONE_PICKAXE, 1));
  tools.push(makeEntry(BlockType.IRON_PICKAXE, 1));
  tools.push(makeEntry(BlockType.DIAMOND_PICKAXE, 1));

  // Weapons
  weapons.push(makeEntry(BlockType.WOODEN_SWORD, 1));
  weapons.push(makeEntry(BlockType.STONE_SWORD, 1));
  weapons.push(makeEntry(BlockType.IRON_SWORD, 1));
  weapons.push(makeEntry(BlockType.DIAMOND_SWORD, 1));

  // Materials
  materials.push(makeEntry(BlockType.STICK, 64));
  materials.push(makeEntry(BlockType.COAL, 64));
  materials.push(makeEntry(BlockType.IRON_INGOT, 64));
  materials.push(makeEntry(BlockType.GOLD_INGOT, 64));
  materials.push(makeEntry(BlockType.DIAMOND, 64));

  // Food
  food.push(makeEntry(BlockType.APPLE, 16));
  food.push(makeEntry(BlockType.BREAD, 16));
  food.push(makeEntry(BlockType.RAW_MEAT, 16));
  food.push(makeEntry(BlockType.COOKED_MEAT, 16));

  // Special (non-obtainable normally)
  special.push(makeEntry(BlockType.WATER, 1));
  special.push(makeEntry(BlockType.LAVA, 1));

  return [
    { label: 'Teren', items: terrain },
    { label: 'Roślinność', items: vegetation },
    { label: 'Budowanie', items: building },
    { label: 'Płyty/Schody/Ogrodzenia', items: slabsFencesStairs },
    { label: 'Drzwi', items: doors },
    { label: 'Tory & Transport', items: rails },
    { label: 'Kable & Dźwignie', items: redstone },
    { label: 'Narzędzia', items: tools },
    { label: 'Broń', items: weapons },
    { label: 'Materiały', items: materials },
    { label: 'Jedzenie', items: food },
    { label: 'Specjalne', items: special },
  ];
}

const CATEGORIES = buildCategories();

export function DevTools() {
  const open = useDevStore((s) => s.devToolsOpen);
  const fixedTime = useDevStore((s) => s.fixedTimeOfDay);
  const setFixedTime = useDevStore((s) => s.setFixedTimeOfDay);
  const fastMining = useDevStore((s) => s.fastMining);
  const toggleFastMining = useDevStore((s) => s.toggleFastMining);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  if (!open) return null;

  const handleGive = (item: ItemEntry) => {
    addBlock(item.type, item.count);
    const key = `${item.type}`;
    setFlash(key);
    setTimeout(() => setFlash(null), 300);
  };

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

      {/* Item categories */}
      <div style={{ ...sectionStyle, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
        <div style={labelStyle}>Przedmioty (kliknij kategorię)</div>
        <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'hidden' }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 2 }}>
              <button
                onClick={() => setExpandedCat(expandedCat === cat.label ? null : cat.label)}
                style={{
                  ...catHeaderBtn,
                  background: expandedCat === cat.label ? 'rgba(80,160,255,0.3)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <span>{expandedCat === cat.label ? '▾' : '▸'} {cat.label}</span>
                <span style={{ fontSize: 9, color: '#888' }}>{cat.items.length}</span>
              </button>
              {expandedCat === cat.label && (
                <div style={{ padding: '2px 0' }}>
                  {cat.items.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleGive(item)}
                      style={{
                        ...itemBtn,
                        background: flash === `${item.type}` ? 'rgba(80,255,80,0.3)' : 'rgba(255,255,255,0.05)',
                      }}
                      title={`+${item.count} ${item.name}`}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: item.colorHex,
                          border: '1px solid rgba(255,255,255,0.3)',
                          marginRight: 6,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, textAlign: 'left' }}>{item.name}</span>
                      <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>+{item.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
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
  width: 240,
  background: 'rgba(0,0,0,0.9)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: 12,
  zIndex: 200,
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: 12,
  maxHeight: 'calc(100vh - 70px)',
  overflowY: 'auto',
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

const catHeaderBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 8px',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  color: '#ddd',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontWeight: 'bold',
};

const itemBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '3px 8px 3px 16px',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  color: '#eee',
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: 'monospace',
  transition: 'background 0.15s',
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
