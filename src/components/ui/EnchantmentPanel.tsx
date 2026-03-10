import { useEnchantmentStore, ENCHANTMENT_DEFS } from '../../stores/enchantmentStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useCombatStore } from '../../stores/combatStore';
import { getBlock, BlockType, isToolPickaxe, isSword } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';
import { ItemIcon, IconClose } from './Icons';
import type { EnchantmentType } from '../../stores/enchantmentStore';

function itemColor(type: BlockType): string {
  const def = getBlock(type);
  return '#' + (def.topColor ?? def.color).getHexString();
}

export function EnchantmentPanel() {
  const enchantingOpen = useEnchantmentStore((s) => s.enchantingOpen);
  const toggleEnchanting = useEnchantmentStore((s) => s.toggleEnchanting);
  const enchant = useEnchantmentStore((s) => s.enchant);
  const getEnchantments = useEnchantmentStore((s) => s.getEnchantments);
  const getEnchantmentLevel = useEnchantmentStore((s) => s.getEnchantmentLevel);
  const slots = useInventoryStore((s) => s.slots);
  const selectedIdx = useInventoryStore((s) => s.selectedHotbarIndex);
  const level = useCombatStore((s) => s.level);

  if (!enchantingOpen) return null;

  const selectedSlot = slots[selectedIdx];
  const hasTool = selectedSlot && (isToolPickaxe(selectedSlot.blockType) || isSword(selectedSlot.blockType));
  const isPickaxe = selectedSlot && isToolPickaxe(selectedSlot.blockType);
  const isSwordType = selectedSlot && isSword(selectedSlot.blockType);

  const currentEnchantments = hasTool ? getEnchantments(selectedIdx) : [];

  const handleEnchant = (enchType: EnchantmentType) => {
    const ok = enchant(selectedIdx, enchType);
    if (ok) {
      soundManager.playEnchantSound();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) toggleEnchanting(); }}
    >
      <div style={{
        width: 'min(400px, 92vw)', maxHeight: '80vh',
        background: 'rgba(15,10,30,0.95)', borderRadius: 12,
        border: '1px solid rgba(140,80,200,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid rgba(140,80,200,0.2)',
        }}>
          <span style={{ color: '#b080e0', fontWeight: 'bold', fontSize: 16 }}>
            Enchanting Table
          </span>
          <button onClick={toggleEnchanting} style={{
            background: 'rgba(180,40,40,0.7)', border: 'none', borderRadius: 4,
            color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 14,
          }}>
            <IconClose size={14} color="#fff" />
          </button>
        </div>

        {/* Selected tool */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(140,80,200,0.15)' }}>
          <div style={{ color: '#aaa', fontSize: 10, marginBottom: 6 }}>
            Selected tool (hotbar slot {selectedIdx + 1}) | Player Level: {level}
          </div>
          {hasTool && selectedSlot ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 6,
                backgroundColor: itemColor(selectedSlot.blockType),
                border: '2px solid rgba(140,80,200,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ItemIcon iconId={getBlock(selectedSlot.blockType).icon} size={20} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                  {getBlock(selectedSlot.blockType).name}
                </div>
                {currentEnchantments.length > 0 && (
                  <div style={{ color: '#b080e0', fontSize: 11 }}>
                    {currentEnchantments.map((e) => `${e.type} ${e.level}`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: 12 }}>
              Select a tool/weapon in your hotbar first
            </div>
          )}
        </div>

        {/* Enchantment options */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ENCHANTMENT_DEFS.map((def) => {
            const appliesToThis = hasTool && (
              def.appliesTo === 'both' ||
              (def.appliesTo === 'pickaxe' && isPickaxe) ||
              (def.appliesTo === 'sword' && isSwordType)
            );
            const currentLevel = hasTool ? getEnchantmentLevel(selectedIdx, def.type) : 0;
            const canEnchant = appliesToThis && currentLevel < def.maxLevel;
            const nextLevel = currentLevel + 1;
            const cost = canEnchant ? def.xpCost[currentLevel] : 0;
            const canAfford = level >= cost;

            return (
              <div key={def.type} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: canEnchant && canAfford ? 'rgba(140,80,200,0.12)' : 'rgba(0,0,0,0.2)',
                borderRadius: 6, opacity: appliesToThis ? 1 : 0.35,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e0c0ff', fontSize: 13, fontWeight: 'bold' }}>
                    {def.name} {currentLevel > 0 ? `(Lv.${currentLevel})` : ''}
                  </div>
                  <div style={{ color: '#888', fontSize: 11 }}>
                    {def.description}
                  </div>
                  {canEnchant && (
                    <div style={{ color: canAfford ? '#8a8' : '#a66', fontSize: 10, marginTop: 2 }}>
                      Cost: {cost} levels → Level {nextLevel}
                    </div>
                  )}
                  {currentLevel >= def.maxLevel && appliesToThis && (
                    <div style={{ color: '#b080e0', fontSize: 10, marginTop: 2 }}>MAX</div>
                  )}
                </div>
                <button
                  onClick={() => handleEnchant(def.type)}
                  disabled={!canEnchant || !canAfford}
                  style={{
                    padding: '4px 12px', border: 'none', borderRadius: 4,
                    background: canEnchant && canAfford ? '#7040a0' : '#333',
                    color: '#fff', fontSize: 11, cursor: canEnchant && canAfford ? 'pointer' : 'default',
                    fontWeight: 'bold',
                  }}
                >
                  Enchant
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
