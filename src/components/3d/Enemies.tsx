import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCombatStore, type Enemy } from '../../stores/combatStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType, getBlock, isSword } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';
import { getLastDungeonLayout } from '../../core/terrain/StructureGenerator';

const ENEMY_COLORS: Record<string, { body: number; head: number; limb: number }> = {
  zombie: { body: 0x4a7a3a, head: 0x5a8a4a, limb: 0x3a6a2a },
  skeleton: { body: 0xe8e0d0, head: 0xf0e8d8, limb: 0xd0c8b8 },
  spider: { body: 0x3a3a3a, head: 0x2a2a2a, limb: 0x1a1a1a },
  creeper: { body: 0x4aaa4a, head: 0x3a8a3a, limb: 0x2a7a2a },
  golem: { body: 0x7a7a7a, head: 0x8a8a8a, limb: 0x5a5a5a },
  dragon: { body: 0x2a1a3a, head: 0x4a2a5a, limb: 0x3a1a4a },
};

function buildEnemyGeometry(type: Enemy['type']): THREE.BufferGeometry {
  const colors = ENEMY_COLORS[type];

  if (type === 'spider') {
    // Flat body + small head + 8 legs
    const body = new THREE.BoxGeometry(0.6, 0.3, 0.8);
    body.translate(0, 0.3, 0);
    const head = new THREE.BoxGeometry(0.4, 0.3, 0.35);
    head.translate(0, 0.35, 0.5);

    const merged = new THREE.BufferGeometry();
    const allPos: number[] = [];
    const allNorm: number[] = [];
    const allCol: number[] = [];
    const allIdx: number[] = [];
    let vOff = 0;

    for (const [geo, col] of [[body, colors.body], [head, colors.head]] as [THREE.BufferGeometry, number][]) {
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const idx = geo.index!;
      const c = new THREE.Color(col);
      for (let i = 0; i < pos.count; i++) {
        allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        allCol.push(c.r + (Math.random() - 0.5) * 0.05, c.g + (Math.random() - 0.5) * 0.05, c.b + (Math.random() - 0.5) * 0.05);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += pos.count;
    }

    // Spider legs (8 thin boxes)
    const legCol = new THREE.Color(colors.limb);
    for (let side = -1; side <= 1; side += 2) {
      for (let j = 0; j < 4; j++) {
        const leg = new THREE.BoxGeometry(0.06, 0.35, 0.06);
        const zOff = -0.25 + j * 0.17;
        leg.translate(side * 0.4, 0.15, zOff);
        const pos = leg.attributes.position;
        const norm = leg.attributes.normal;
        const idx = leg.index!;
        for (let i = 0; i < pos.count; i++) {
          allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
          allCol.push(legCol.r, legCol.g, legCol.b);
        }
        for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
        vOff += pos.count;
        leg.dispose();
      }
    }

    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
    merged.setIndex(allIdx);
    merged.computeBoundingSphere();
    body.dispose();
    head.dispose();
    return merged;
  }

  if (type === 'golem') {
    // Large bulky golem: big body, small head, thick arms
    const body = new THREE.BoxGeometry(0.9, 1.0, 0.6);
    body.translate(0, 0.8, 0);
    const head = new THREE.BoxGeometry(0.5, 0.45, 0.45);
    head.translate(0, 1.55, 0);

    const merged = new THREE.BufferGeometry();
    const allPos: number[] = [];
    const allNorm: number[] = [];
    const allCol: number[] = [];
    const allIdx: number[] = [];
    let vOff = 0;

    for (const [geo, col] of [[body, colors.body], [head, colors.head]] as [THREE.BufferGeometry, number][]) {
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const idx = geo.index!;
      const c = new THREE.Color(col);
      for (let i = 0; i < pos.count; i++) {
        allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        allCol.push(c.r + (Math.random() - 0.5) * 0.04, c.g + (Math.random() - 0.5) * 0.04, c.b + (Math.random() - 0.5) * 0.04);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += pos.count;
    }

    // Thick arms and legs
    const limbCol = new THREE.Color(colors.limb);
    const limbs = [
      { w: 0.2, h: 0.7, d: 0.2, x: -0.55, y: 0.65, z: 0 }, // left arm
      { w: 0.2, h: 0.7, d: 0.2, x: 0.55, y: 0.65, z: 0 },  // right arm
      { w: 0.22, h: 0.5, d: 0.22, x: -0.2, y: 0.15, z: 0 }, // left leg
      { w: 0.22, h: 0.5, d: 0.22, x: 0.2, y: 0.15, z: 0 },  // right leg
    ];
    for (const l of limbs) {
      const geo = new THREE.BoxGeometry(l.w, l.h, l.d);
      geo.translate(l.x, l.y, l.z);
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const idx = geo.index!;
      for (let i = 0; i < pos.count; i++) {
        allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        allCol.push(limbCol.r, limbCol.g, limbCol.b);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += pos.count;
      geo.dispose();
    }

    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
    merged.setIndex(allIdx);
    merged.computeBoundingSphere();
    body.dispose();
    head.dispose();
    return merged;
  }

  if (type === 'dragon') {
    // Dragon: long body, wings, horned head
    const body = new THREE.BoxGeometry(0.5, 0.4, 1.2);
    body.translate(0, 0.6, 0);
    const head = new THREE.BoxGeometry(0.35, 0.3, 0.4);
    head.translate(0, 0.8, 0.75);
    const tail = new THREE.BoxGeometry(0.15, 0.12, 0.6);
    tail.translate(0, 0.55, -0.7);

    const merged = new THREE.BufferGeometry();
    const allPos: number[] = [];
    const allNorm: number[] = [];
    const allCol: number[] = [];
    const allIdx: number[] = [];
    let vOff = 0;

    for (const [geo, col] of [[body, colors.body], [head, colors.head], [tail, colors.limb]] as [THREE.BufferGeometry, number][]) {
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const idx = geo.index!;
      const c = new THREE.Color(col);
      for (let i = 0; i < pos.count; i++) {
        allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        allCol.push(c.r + (Math.random() - 0.5) * 0.05, c.g + (Math.random() - 0.5) * 0.05, c.b + (Math.random() - 0.5) * 0.05);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += pos.count;
    }

    // Wings
    const wingCol = new THREE.Color(colors.limb);
    for (const side of [-1, 1]) {
      const wing = new THREE.BoxGeometry(0.6, 0.05, 0.4);
      wing.translate(side * 0.5, 0.8, 0);
      const pos = wing.attributes.position;
      const norm = wing.attributes.normal;
      const idx = wing.index!;
      for (let i = 0; i < pos.count; i++) {
        allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        allCol.push(wingCol.r, wingCol.g, wingCol.b);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += pos.count;
      wing.dispose();
    }

    // Legs
    const legCol = new THREE.Color(colors.limb);
    for (const xOff of [-0.15, 0.15]) {
      for (const zOff of [-0.3, 0.3]) {
        const leg = new THREE.BoxGeometry(0.08, 0.3, 0.08);
        leg.translate(xOff, 0.2, zOff);
        const pos = leg.attributes.position;
        const norm = leg.attributes.normal;
        const idx = leg.index!;
        for (let i = 0; i < pos.count; i++) {
          allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
          allCol.push(legCol.r, legCol.g, legCol.b);
        }
        for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
        vOff += pos.count;
        leg.dispose();
      }
    }

    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
    merged.setIndex(allIdx);
    merged.computeBoundingSphere();
    body.dispose();
    head.dispose();
    tail.dispose();
    return merged;
  }

  // Standard humanoid mob (zombie, skeleton, creeper)
  const bodyW = type === 'creeper' ? 0.4 : 0.45;
  const bodyH = type === 'creeper' ? 0.7 : 0.6;
  const bodyD = type === 'creeper' ? 0.3 : 0.35;
  const legLen = type === 'creeper' ? 0.35 : 0.4;

  const body = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  body.translate(0, legLen + bodyH / 2, 0);

  const head = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  head.translate(0, legLen + bodyH + 0.2, 0);

  const merged = new THREE.BufferGeometry();
  const allPos: number[] = [];
  const allNorm: number[] = [];
  const allCol: number[] = [];
  const allIdx: number[] = [];
  let vOff = 0;

  for (const [geo, col] of [[body, colors.body], [head, colors.head]] as [THREE.BufferGeometry, number][]) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const idx = geo.index!;
    const c = new THREE.Color(col);
    for (let i = 0; i < pos.count; i++) {
      allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      const v = (Math.random() - 0.5) * 0.06;
      allCol.push(Math.max(0, Math.min(1, c.r + v)), Math.max(0, Math.min(1, c.g + v)), Math.max(0, Math.min(1, c.b + v)));
    }
    for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
    vOff += pos.count;
  }

  // Legs
  const legGeo = new THREE.BoxGeometry(0.12, legLen, 0.12);
  const legCol = new THREE.Color(colors.limb);
  const legOffsets = type === 'creeper'
    ? [[-0.12, 0, -0.08], [0.12, 0, -0.08], [-0.12, 0, 0.08], [0.12, 0, 0.08]]
    : [[-0.14, 0, 0], [0.14, 0, 0]];

  for (const off of legOffsets) {
    const leg = legGeo.clone();
    leg.translate(off[0], legLen / 2, off[2]);
    const pos = leg.attributes.position;
    const norm = leg.attributes.normal;
    const idx = leg.index!;
    for (let i = 0; i < pos.count; i++) {
      allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      allCol.push(legCol.r, legCol.g, legCol.b);
    }
    for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
    vOff += pos.count;
    leg.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  merged.setIndex(allIdx);
  merged.computeBoundingSphere();
  body.dispose();
  head.dispose();
  legGeo.dispose();

  return merged;
}

function EnemyMesh({ enemy }: { enemy: Enemy }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const damageEnemy = useCombatStore((s) => s.damageEnemy);
  const addXp = useCombatStore((s) => s.addXp);
  const removeEnemy = useCombatStore((s) => s.removeEnemy);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const getSelectedBlock = useInventoryStore((s) => s.getSelectedBlock);

  const geometry = useMemo(() => buildEnemyGeometry(enemy.type), [enemy.type]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    if (enemy.isDead) return;

    // Check if player has a sword equipped
    const selected = getSelectedBlock();
    let dmg = 1; // Fist damage
    if (selected && isSword(selected)) {
      const def = getBlock(selected);
      dmg = def.damage ?? 1;
    }

    damageEnemy(enemy.id, dmg);
    soundManager.playDigSound(BlockType.STONE);

    // Knockback: push enemy away from click point
    const point = e.point as THREE.Vector3 | undefined;
    if (point) {
      const ex = enemy.position[0];
      const ez = enemy.position[2];
      const dx = ex - point.x;
      const dz = ez - point.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.1;
      const knockStr = 1.5;
      const updateEnemy = useCombatStore.getState().updateEnemy;
      updateEnemy(enemy.id, {
        position: [ex + (dx / dist) * knockStr, enemy.position[1], ez + (dz / dist) * knockStr],
      });
    }

    // Check if enemy died
    if (enemy.hp - dmg <= 0) {
      const xpReward = enemy.isBoss ? (enemy.type === 'dragon' ? 100 : 50) : enemy.type === 'creeper' ? 15 : 10;
      addXp(xpReward);
      // Drop loot
      if (enemy.type === 'zombie') addBlock(BlockType.RAW_MEAT, 1);
      if (enemy.type === 'skeleton') addBlock(BlockType.STICK, Math.ceil(Math.random() * 2));
      if (enemy.type === 'spider') addBlock(BlockType.COBBLESTONE, 1);
      if (enemy.type === 'golem') {
        addBlock(BlockType.IRON_INGOT, 2 + Math.floor(Math.random() * 3));
        addBlock(BlockType.DIAMOND, 1);
      }
      if (enemy.type === 'dragon') {
        addBlock(BlockType.DIAMOND, 2 + Math.floor(Math.random() * 3));
        addBlock(BlockType.GOLD_INGOT, 3 + Math.floor(Math.random() * 4));
      }
      // Remove after death animation
      setTimeout(() => removeEnemy(enemy.id), 800);
    }
  }, [enemy, damageEnemy, addXp, removeEnemy, addBlock, getSelectedBlock]);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Position
    meshRef.current.position.set(enemy.position[0], enemy.position[1], enemy.position[2]);

    // Death animation (sink + shrink)
    if (enemy.isDead) {
      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      meshRef.current.position.y -= elapsed * 0.5;
      meshRef.current.scale.setScalar(Math.max(0, 1 - elapsed * 1.2));
      return;
    }

    // Bounce
    const t = state.clock.elapsedTime;
    meshRef.current.position.y += Math.abs(Math.sin(t * 3 + enemy.position[0])) * 0.08;

    // Face direction of movement
    const dx = enemy.target[0] - enemy.position[0];
    const dz = enemy.target[2] - enemy.position[2];
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      meshRef.current.rotation.y = Math.atan2(dx, dz);
    }

    // Scale: bosses are larger
    meshRef.current.scale.setScalar(enemy.isBoss ? 1.4 : 0.8);
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} onClick={handleClick} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {/* HP bar above enemy */}
      {!enemy.isDead && (
        <EnemyHpBar enemy={enemy} />
      )}
    </group>
  );
}

function EnemyHpBar({ enemy }: { enemy: Enemy }) {
  const groupRef = useRef<THREE.Group>(null);
  const hpFrac = enemy.hp / enemy.maxHp;

  useFrame(() => {
    if (!groupRef.current) return;
    const hpBarHeight = enemy.isBoss ? 2.5 : 1.5;
    groupRef.current.position.set(enemy.position[0], enemy.position[1] + hpBarHeight, enemy.position[2]);
    // Billboard - face camera
    groupRef.current.quaternion.copy(groupRef.current.parent!.parent!.quaternion || new THREE.Quaternion());
  });

  if (hpFrac >= 1) return null;

  return (
    <group ref={groupRef}>
      {/* Background */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      {/* HP fill */}
      <mesh position={[(hpFrac - 1) * 0.4, 0, 0.001]}>
        <planeGeometry args={[0.8 * hpFrac, 0.08]} />
        <meshBasicMaterial color={hpFrac > 0.5 ? '#44cc44' : hpFrac > 0.25 ? '#cccc44' : '#cc4444'} />
      </mesh>
    </group>
  );
}

export function EnemiesRenderer({ biomeType, center }: { biomeType: string; center: [number, number, number] }) {
  const enemies = useCombatStore((s) => s.enemies);
  const spawnEnemy = useCombatStore((s) => s.spawnEnemy);
  const updateEnemy = useCombatStore((s) => s.updateEnemy);
  const takeDamage = useCombatStore((s) => s.takeDamage);
  const spawnedRef = useRef(false);
  const { camera } = useThree();

  // Spawn enemies on mount
  useEffect(() => {
    if (spawnedRef.current) return;
    spawnedRef.current = true;

    // Number of enemies based on biome
    const counts: Record<string, number> = {
      forest: 2,
      desert: 2,
      cave: 4,
      mountains: 2,
      swamp: 3,
      tundra: 2,
    };
    const types: Record<string, Enemy['type'][]> = {
      forest: ['zombie', 'spider'],
      desert: ['skeleton', 'spider'],
      cave: ['zombie', 'skeleton', 'spider', 'creeper'],
      mountains: ['skeleton', 'zombie'],
      swamp: ['zombie', 'spider', 'creeper'],
      tundra: ['skeleton', 'zombie'],
    };

    const enemyCount = counts[biomeType] || 2;
    const pool = types[biomeType] || ['zombie'];

    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 4 + Math.random() * 5;
      const type = pool[Math.floor(Math.random() * pool.length)];
      spawnEnemy(type, [
        center[0] + Math.cos(angle) * radius,
        center[1] + 0.5,
        center[2] + Math.sin(angle) * radius,
      ]);
    }

    // Spawn boss in cave dungeon boss room
    if (biomeType === 'cave') {
      const layout = getLastDungeonLayout();
      if (layout) {
        const bossRoom = layout.rooms.find(r => r.isBossRoom);
        if (bossRoom) {
          const bossType: Enemy['type'] = Math.random() > 0.5 ? 'dragon' : 'golem';
          const bx = bossRoom.x + Math.floor(bossRoom.width / 2);
          const bz = bossRoom.z + Math.floor(bossRoom.depth / 2);
          spawnEnemy(bossType, [bx, bossRoom.y + 1.5, bz]);
        }
      }
    }
  }, [biomeType, center, spawnEnemy]);

  // Enemy AI update
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Camera position as rough player position
    const playerPos = camera.position.clone();
    // Project down to ground level
    playerPos.y = center[1] + 0.5;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;

      const ex = enemy.position[0];
      const ez = enemy.position[2];
      const distToPlayer = Math.sqrt(
        (ex - playerPos.x) ** 2 + (ez - playerPos.z) ** 2
      );

      let tx = enemy.target[0];
      let tz = enemy.target[2];

      // If player is close, chase
      if (distToPlayer < 8) {
        tx = playerPos.x;
        tz = playerPos.z;
      } else {
        // Random wander
        const distToTarget = Math.sqrt((ex - tx) ** 2 + (ez - tz) ** 2);
        if (distToTarget < 0.5) {
          tx = center[0] + (Math.random() - 0.5) * 12;
          tz = center[2] + (Math.random() - 0.5) * 12;
        }
      }

      // Move toward target
      const dx = tx - ex;
      const dz = tz - ez;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) {
        const speed = enemy.speed * 0.016;
        const newX = ex + (dx / dist) * speed;
        const newZ = ez + (dz / dist) * speed;
        updateEnemy(enemy.id, {
          position: [newX, enemy.position[1], newZ],
          target: [tx, enemy.position[1], tz],
        });
      }

      // Attack player if very close
      if (distToPlayer < 1.5 && t - enemy.lastAttackTime > enemy.attackCooldown) {
        takeDamage(enemy.damage);
        updateEnemy(enemy.id, { lastAttackTime: t });
      }
    }
  });

  return (
    <group>
      {enemies.map((e) => (
        <EnemyMesh key={e.id} enemy={e} />
      ))}
    </group>
  );
}
