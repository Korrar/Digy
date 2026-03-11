import { useState, useEffect } from 'react';
import { useCraftingStore, type CraftingRecipe } from '../../stores/craftingStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';
import { ItemIcon, IconClose } from './Icons';

type Category = 'all' | 'tools' | 'weapons' | 'blocks' | 'food' | 'smelting';

function itemColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

function canCraft(recipe: CraftingRecipe, slots: any[]): boolean {
  for (const ing of recipe.ingredients) {
    let have = 0;
    for (const slot of slots) {
      if (slot && slot.blockType === ing.type) have += slot.count;
    }
    if (have < ing.count) return false;
  }
  return true;
}

function RecipeRow({ recipe, onCraft, craftable }: {
  recipe: CraftingRecipe;
  onCraft: () => void;
  craftable: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px',
      background: craftable ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)',
      borderRadius: 6,
      opacity: craftable ? 1 : 0.5,
    }}>
      {/* Result icon */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 4,
        backgroundColor: itemColor(recipe.result.type),
        border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        flexShrink: 0,
      }}>
        <ItemIcon iconId={getBlock(recipe.result.type).icon} size={14} color="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
          {recipe.name} {recipe.result.count > 1 ? `x${recipe.result.count}` : ''}
        </div>
        <div style={{ color: '#aaa', fontSize: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {recipe.ingredients.map((ing, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                backgroundColor: itemColor(ing.type),
                display: 'inline-block',
              }} />
              {ing.count}
            </span>
          ))}
          <span style={{ color: '#888' }}>| {recipe.craftTime}s</span>
        </div>
      </div>

      <button
        onClick={onCraft}
        disabled={!craftable}
        style={{
          padding: '4px 10px',
          border: 'none',
          borderRadius: 4,
          background: craftable ? '#44aa44' : '#444',
          color: '#fff',
          fontSize: 11,
          cursor: craftable ? 'pointer' : 'default',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        Craft
      </button>
    </div>
  );
}

function CraftingJobSlot({ job, onCollect }: {
  job: { recipeId: string; startTime: number; endTime: number; result: { type: BlockType; count: number } };
  onCollect: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const done = Date.now() >= job.endTime;

  useEffect(() => {
    if (done) { setProgress(1); return; }
    const interval = setInterval(() => {
      const now = Date.now();
      const duration = job.endTime - job.startTime;
      const p = duration <= 0 ? 1 : Math.min(1, (now - job.startTime) / duration);
      setProgress(p);
      if (p >= 1) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [job.startTime, job.endTime, done]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        background: done ? 'rgba(68,170,68,0.2)' : 'rgba(255,255,255,0.05)',
        borderRadius: 4,
        border: done ? '1px solid #44aa44' : '1px solid rgba(255,255,255,0.1)',
        cursor: done ? 'pointer' : 'default',
      }}
      onClick={done ? onCollect : undefined}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 3,
        backgroundColor: itemColor(job.result.type),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12,
      }}>
        <ItemIcon iconId={getBlock(job.result.type).icon} size={12} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: done ? '#44aa44' : '#4488cc',
            transition: 'width 0.1s',
          }} />
        </div>
      </div>
      <span style={{ color: '#aaa', fontSize: 10 }}>
        {done ? 'Collect!' : `${Math.ceil((job.endTime - Date.now()) / 1000)}s`}
      </span>
    </div>
  );
}

export function CraftingPanel() {
  const craftingOpen = useCraftingStore((s) => s.craftingOpen);
  const toggleCrafting = useCraftingStore((s) => s.toggleCrafting);
  const recipes = useCraftingStore((s) => s.recipes);
  const activeJobs = useCraftingStore((s) => s.activeJobs);
  const maxSlots = useCraftingStore((s) => s.maxSlots);
  const startCraft = useCraftingStore((s) => s.startCraft);
  const collectJob = useCraftingStore((s) => s.collectJob);
  const slots = useInventoryStore((s) => s.slots);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [craftError, setCraftError] = useState<string | null>(null);

  if (!craftingOpen) return null;

  const byCategory = category === 'all' ? recipes : recipes.filter((r) => r.category === category);
  const filtered = search.trim()
    ? byCategory.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : byCategory;

  const handleCraft = (recipe: CraftingRecipe, times = 1) => {
    if (activeJobs.length >= maxSlots) {
      setCraftError('Brak wolnych slotow!');
      setTimeout(() => setCraftError(null), 2000);
      return;
    }
    if (!canCraft(recipe, slots)) {
      setCraftError('Brak materialow!');
      setTimeout(() => setCraftError(null), 2000);
      return;
    }

    const craftCount = Math.min(times, maxSlots - activeJobs.length);
    let crafted = 0;
    for (let c = 0; c < craftCount; c++) {
      const currentSlots = useInventoryStore.getState().slots;
      if (!canCraft(recipe, currentSlots)) break;
      // Remove ingredients
      for (const ing of recipe.ingredients) {
        let remaining = ing.count;
        for (let i = 0; i < currentSlots.length && remaining > 0; i++) {
          const slot = currentSlots[i];
          if (slot && slot.blockType === ing.type) {
            const remove = Math.min(remaining, slot.count);
            useInventoryStore.getState().removeBlock(i, remove);
            remaining -= remove;
          }
        }
      }
      startCraft(recipe.id);
      crafted++;
    }
    if (crafted > 0) soundManager.playPlaceSound();
  };

  const handleCollect = (index: number) => {
    const result = collectJob(index);
    if (result) {
      addBlock(result.type, result.count);
      soundManager.playPlaceSound();
    }
  };

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'tools', label: 'Tools' },
    { key: 'weapons', label: 'Weapons' },
    { key: 'blocks', label: 'Blocks' },
    { key: 'smelting', label: 'Smelt' },
    { key: 'food', label: 'Food' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) toggleCrafting(); }}
    >
      <div style={{
        width: 'min(400px, 92vw)',
        maxHeight: '80vh',
        background: 'rgba(30,30,40,0.95)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Crafting
          </span>
          <button onClick={toggleCrafting} style={{
            background: 'rgba(180,40,40,0.7)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: 14,
          }}>
            <IconClose size={14} color="#fff" />
          </button>
        </div>

        {/* Active jobs */}
        {activeJobs.length > 0 && (
          <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#aaa', fontSize: 10, marginBottom: 4 }}>
              Active ({activeJobs.length}/{maxSlots})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeJobs.map((job, i) => (
                <CraftingJobSlot key={i} job={job} onCollect={() => handleCollect(i)} />
              ))}
            </div>
          </div>
        )}

        {/* Search + Category tabs */}
        <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            type="text"
            placeholder="Szukaj receptury..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4, background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  padding: '3px 8px', border: 'none', borderRadius: 4,
                  background: category === cat.key ? 'rgba(68,136,204,0.5)' : 'rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error toast */}
        {craftError && (
          <div style={{
            padding: '4px 14px', background: 'rgba(180,40,40,0.3)',
            color: '#ffaaaa', fontSize: 11, textAlign: 'center',
          }}>
            {craftError}
          </div>
        )}

        {/* Recipe list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {filtered.map((recipe) => {
            const craftable = canCraft(recipe, slots) && activeJobs.length < maxSlots;
            return (
              <div key={recipe.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <RecipeRow
                    recipe={recipe}
                    craftable={craftable}
                    onCraft={() => handleCraft(recipe)}
                  />
                </div>
                {craftable && maxSlots - activeJobs.length > 1 && (
                  <button
                    onClick={() => handleCraft(recipe, maxSlots - activeJobs.length)}
                    style={{
                      padding: '4px 6px', border: 'none', borderRadius: 4,
                      background: 'rgba(68,136,204,0.4)', color: '#aaccff',
                      fontSize: 10, cursor: 'pointer', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center',
                    }}
                    title={`Craft x${maxSlots - activeJobs.length}`}
                  >
                    x{maxSlots - activeJobs.length}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
