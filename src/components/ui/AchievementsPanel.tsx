import { useAchievementStore } from '../../stores/achievementStore';

export function AchievementsPanel() {
  const achievements = useAchievementStore((s) => s.achievements);
  const unlocked = useAchievementStore((s) => s.unlocked);
  const panelOpen = useAchievementStore((s) => s.panelOpen);
  const togglePanel = useAchievementStore((s) => s.togglePanel);
  const stats = useAchievementStore((s) => s.stats);

  if (!panelOpen) return null;

  const unlockedCount = Object.keys(unlocked).length;
  const total = achievements.length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) togglePanel(); }}
    >
      <div style={{
        width: 'min(420px, 92vw)', maxHeight: '80vh',
        background: 'rgba(20,20,35,0.95)', borderRadius: 12,
        border: '1px solid rgba(200,170,100,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid rgba(200,170,100,0.2)',
        }}>
          <span style={{ color: '#ddc870', fontWeight: 'bold', fontSize: 16 }}>
            Achievements ({unlockedCount}/{total})
          </span>
          <button onClick={togglePanel} style={{
            background: 'rgba(180,40,40,0.7)', border: 'none', borderRadius: 4,
            color: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}>
            Close
          </button>
        </div>

        {/* Stats summary */}
        <div style={{
          padding: '6px 14px', borderBottom: '1px solid rgba(200,170,100,0.15)',
          display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: '#aaa',
        }}>
          <span>Mined: {stats.blocksMined}</span>
          <span>Placed: {stats.blocksPlaced}</span>
          <span>Kills: {stats.enemiesKilled}</span>
          <span>Crafted: {stats.itemsCrafted}</span>
          <span>Smelted: {stats.itemsSmelted}</span>
          <span>Biomes: {stats.biomesVisited.length}</span>
        </div>

        {/* Achievement list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {achievements.map((ach) => {
            const isUnlocked = !!unlocked[ach.id];
            return (
              <div key={ach.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                background: isUnlocked ? 'rgba(200,170,100,0.12)' : 'rgba(0,0,0,0.2)',
                borderRadius: 6,
                border: isUnlocked ? '1px solid rgba(200,170,100,0.3)' : '1px solid rgba(255,255,255,0.05)',
                opacity: isUnlocked ? 1 : 0.5,
              }}>
                <span style={{ fontSize: 24, filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
                  {ach.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: isUnlocked ? '#ddc870' : '#888', fontSize: 13, fontWeight: 'bold' }}>
                    {ach.name}
                  </div>
                  <div style={{ color: '#999', fontSize: 11 }}>
                    {ach.description}
                  </div>
                </div>
                {isUnlocked && (
                  <span style={{ color: '#6a6', fontSize: 16 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
