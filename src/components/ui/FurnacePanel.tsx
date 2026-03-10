import { useState, useEffect } from 'react';
import { useFurnaceStore } from '../../stores/furnaceStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getBlock, BlockType } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';
import { ItemIcon, IconClose } from './Icons';

function itemColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

function SmeltJobSlot({ job, onCollect }: {
  job: { input: BlockType; output: BlockType; startTime: number; endTime: number };
  onCollect: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const done = Date.now() >= job.endTime;

  useEffect(() => {
    if (done) { setProgress(1); return; }
    const interval = setInterval(() => {
      const now = Date.now();
      const p = Math.min(1, (now - job.startTime) / (job.endTime - job.startTime));
      setProgress(p);
      if (p >= 1) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [job.startTime, job.endTime, done]);

  return (
    <div
      onClick={done ? onCollect : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
        background: done ? 'rgba(255,140,40,0.2)' : 'rgba(255,255,255,0.05)',
        borderRadius: 6, border: done ? '1px solid #ff8c28' : '1px solid rgba(255,255,255,0.1)',
        cursor: done ? 'pointer' : 'default',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        backgroundColor: itemColor(job.input), display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <ItemIcon iconId={getBlock(job.input).icon} size={14} color="#fff" />
      </div>
      <span style={{ color: '#ff8c28', fontSize: 16 }}>→</span>
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        backgroundColor: itemColor(job.output), display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <ItemIcon iconId={getBlock(job.output).icon} size={14} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: done ? '#ff8c28' : '#cc6600',
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

export function FurnacePanel() {
  const furnaceOpen = useFurnaceStore((s) => s.furnaceOpen);
  const closeFurnace = useFurnaceStore((s) => s.closeFurnace);
  const recipes = useFurnaceStore((s) => s.recipes);
  const activeJobs = useFurnaceStore((s) => s.activeJobs);
  const maxJobs = useFurnaceStore((s) => s.maxJobs);
  const startSmelt = useFurnaceStore((s) => s.startSmelt);
  const collectJob = useFurnaceStore((s) => s.collectJob);
  const slots = useInventoryStore((s) => s.slots);
  const addBlock = useInventoryStore((s) => s.addBlock);

  if (!furnaceOpen) return null;

  const hasItem = (type: BlockType) => {
    for (const slot of slots) {
      if (slot && slot.blockType === type) return true;
    }
    return false;
  };

  const handleSmelt = (inputType: BlockType) => {
    if (activeJobs.length >= maxJobs) return;
    const ok = startSmelt(inputType);
    if (ok) soundManager.playPlaceSound();
  };

  const handleCollect = (index: number) => {
    const result = collectJob(index);
    if (result !== null) {
      addBlock(result, 1);
      soundManager.playPlaceSound();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeFurnace(); }}
    >
      <div style={{
        width: 'min(380px, 90vw)', maxHeight: '75vh',
        background: 'rgba(40,25,15,0.95)', borderRadius: 12,
        border: '1px solid rgba(255,140,40,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid rgba(255,140,40,0.2)',
        }}>
          <span style={{ color: '#ff8c28', fontWeight: 'bold', fontSize: 16 }}>
            Furnace
          </span>
          <button onClick={closeFurnace} style={{
            background: 'rgba(180,40,40,0.7)', border: 'none', borderRadius: 4,
            color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 14,
          }}>
            <IconClose size={14} color="#fff" />
          </button>
        </div>

        {/* Active smelting jobs */}
        {activeJobs.length > 0 && (
          <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,140,40,0.15)' }}>
            <div style={{ color: '#aaa', fontSize: 10, marginBottom: 4 }}>
              Smelting ({activeJobs.length}/{maxJobs})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeJobs.map((job, i) => (
                <SmeltJobSlot key={i} job={job} onCollect={() => handleCollect(i)} />
              ))}
            </div>
          </div>
        )}

        {/* Recipes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#aaa', fontSize: 10, marginBottom: 2 }}>Recipes (requires Coal as fuel)</div>
          {recipes.map((recipe) => {
            const canSmelt = hasItem(recipe.input) && hasItem(BlockType.COAL) && activeJobs.length < maxJobs;
            return (
              <div key={recipe.input} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                background: canSmelt ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)',
                borderRadius: 6, opacity: canSmelt ? 1 : 0.5,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 4,
                  backgroundColor: itemColor(recipe.input), display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <ItemIcon iconId={getBlock(recipe.input).icon} size={14} color="#fff" />
                </div>
                <span style={{ color: '#888', fontSize: 14 }}>→</span>
                <div style={{
                  width: 28, height: 28, borderRadius: 4,
                  backgroundColor: itemColor(recipe.output), display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <ItemIcon iconId={getBlock(recipe.output).icon} size={14} color="#fff" />
                </div>
                <div style={{ flex: 1, color: '#ccc', fontSize: 12 }}>
                  {getBlock(recipe.input).name} → {getBlock(recipe.output).name}
                  <span style={{ color: '#888', marginLeft: 4 }}>({recipe.smeltTime}s)</span>
                </div>
                <button
                  onClick={() => handleSmelt(recipe.input)}
                  disabled={!canSmelt}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: 4,
                    background: canSmelt ? '#cc6600' : '#444',
                    color: '#fff', fontSize: 11, cursor: canSmelt ? 'pointer' : 'default',
                    fontWeight: 'bold',
                  }}
                >
                  Smelt
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
