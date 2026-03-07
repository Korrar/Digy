import { useCombatStore } from '../../stores/combatStore';

export function HealthBar() {
  const hp = useCombatStore((s) => s.playerHp);
  const maxHp = useCombatStore((s) => s.maxPlayerHp);
  const xp = useCombatStore((s) => s.xp);
  const level = useCombatStore((s) => s.level);
  const xpToNext = useCombatStore((s) => s.xpToNextLevel);
  const damageFlash = useCombatStore((s) => s.damageFlash);

  const hearts = Math.ceil(maxHp / 2);
  const fullHearts = Math.floor(hp / 2);
  const halfHeart = hp % 2 === 1;

  return (
    <>
      {/* Damage flash overlay */}
      {damageFlash && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255,0,0,0.2)',
          pointerEvents: 'none',
          zIndex: 300,
        }} />
      )}

      {/* Health and XP bar */}
      <div style={{
        position: 'fixed',
        top: 38,
        left: 8,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pointerEvents: 'none',
      }}>
        {/* Hearts row */}
        <div style={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: hearts }, (_, i) => {
            let emoji = '🖤'; // empty
            if (i < fullHearts) emoji = '❤️';
            else if (i === fullHearts && halfHeart) emoji = '💔';
            return (
              <span key={i} style={{
                fontSize: 'clamp(10px, 2.5vw, 14px)',
                filter: i < fullHearts ? 'none' : 'saturate(0.3)',
              }}>
                {emoji}
              </span>
            );
          })}
        </div>

        {/* XP bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{
            color: '#7dff7d',
            fontSize: 'clamp(9px, 2vw, 11px)',
            fontWeight: 'bold',
          }}>
            Lv.{level}
          </span>
          <div style={{
            width: 'clamp(60px, 15vw, 100px)',
            height: 5,
            borderRadius: 3,
            background: 'rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(xp / xpToNext) * 100}%`,
              height: '100%',
              background: '#7dff7d',
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
