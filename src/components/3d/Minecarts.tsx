import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, isFlat } from '../../core/voxel/BlockRegistry';
import { soundManager } from '../../systems/SoundManager';

interface Minecart {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onRail: boolean;
}

let cartIdCounter = 0;

export function buildMinecartGeometry(): THREE.BufferGeometry {
  const allPos: number[] = [];
  const allNorm: number[] = [];
  const allCol: number[] = [];
  const allIdx: number[] = [];
  let vOff = 0;

  const bodyColor = new THREE.Color(0x666666);
  const wheelColor = new THREE.Color(0x444444);
  const insideColor = new THREE.Color(0x555555);

  // Cart body - wider and lower profile, horizontal plank look
  const bottom = new THREE.BoxGeometry(0.7, 0.05, 0.55);
  bottom.translate(0, 0.14, 0);

  // Sides - short horizontal planks (wider than tall)
  const sideL = new THREE.BoxGeometry(0.05, 0.18, 0.55);
  sideL.translate(-0.35, 0.25, 0);
  const sideR = new THREE.BoxGeometry(0.05, 0.18, 0.55);
  sideR.translate(0.35, 0.25, 0);
  const sideF = new THREE.BoxGeometry(0.7, 0.18, 0.05);
  sideF.translate(0, 0.25, 0.275);
  const sideB = new THREE.BoxGeometry(0.7, 0.18, 0.05);
  sideB.translate(0, 0.25, -0.275);

  const parts: [THREE.BufferGeometry, THREE.Color][] = [
    [bottom, insideColor],
    [sideL, bodyColor], [sideR, bodyColor],
    [sideF, bodyColor], [sideB, bodyColor],
  ];

  // 4 wheels - lower, closer to ground
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.28, 0.07, -0.2], [0.28, 0.07, -0.2],
    [-0.28, 0.07, 0.2], [0.28, 0.07, 0.2],
  ];
  for (const wp of wheelPositions) {
    const w = wheelGeo.clone();
    w.translate(wp[0], wp[1], wp[2]);
    parts.push([w, wheelColor]);
  }

  // Axles
  const axleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
  axleGeo.rotateZ(Math.PI / 2);
  const a1 = axleGeo.clone();
  a1.translate(0, 0.07, -0.2);
  const a2 = axleGeo.clone();
  a2.translate(0, 0.07, 0.2);
  parts.push([a1, wheelColor], [a2, wheelColor]);

  for (const [geo, col] of parts) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const idx = geo.index!;
    for (let i = 0; i < pos.count; i++) {
      allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      allNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      const v = (Math.random() - 0.5) * 0.04;
      allCol.push(
        Math.max(0, Math.min(1, col.r + v)),
        Math.max(0, Math.min(1, col.g + v)),
        Math.max(0, Math.min(1, col.b + v)),
      );
    }
    for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
    vOff += pos.count;
    geo.dispose();
  }
  wheelGeo.dispose();
  axleGeo.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  merged.setIndex(allIdx);
  merged.computeBoundingSphere();
  return merged;
}

function MinecartMesh({ cart, onPush }: { cart: Minecart; onPush: (id: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentRotY = useRef(0);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.copy(cart.position);

    // Face direction of velocity with smooth interpolation for curves
    if (cart.velocity.lengthSq() > 0.0001) {
      const targetY = Math.atan2(cart.velocity.x, cart.velocity.z);
      // Smooth lerp for rotation (handles angle wrapping)
      let diff = targetY - currentRotY.current;
      // Wrap to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentRotY.current += diff * 0.25;
      meshRef.current.rotation.y = currentRotY.current;
    }
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    onPush(cart.id);
    soundManager.playDigSound(BlockType.IRON_ORE);
  }, [cart.id, onPush]);

  const geometry = useMemo(() => buildMinecartGeometry(), []);

  return (
    <mesh ref={meshRef} geometry={geometry} onClick={handleClick} castShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

export function MinecartRenderer({ center: _center }: { center: [number, number, number] }) {
  const cartsRef = useRef<Minecart[]>([]);
  const [, setCartVersion] = useState(0);
  const getBlock = useWorldStore((s) => s.getBlock);
  const { camera } = useThree();

  // Listen for minecart spawn events from WorldInteraction
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      cartsRef.current.push({
        id: cartIdCounter++,
        position: new THREE.Vector3(detail.x, detail.y, detail.z),
        velocity: new THREE.Vector3(0, 0, 0),
        onRail: detail.onRail ?? false,
      });
      setCartVersion((v) => v + 1);
    };
    window.addEventListener('digy:spawnMinecart', handler);
    return () => window.removeEventListener('digy:spawnMinecart', handler);
  }, []);

  // Check if position is on a rail (regular or powered)
  const isOnRail = useCallback((x: number, y: number, z: number) => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    // Check at cart level and one below (rail is flat, cart sits just above it)
    const by = Math.floor(y);
    const block = getBlock(bx, by, bz);
    if (block === BlockType.RAIL || block === BlockType.POWERED_RAIL) return true;
    const blockBelow = getBlock(bx, by - 1, bz);
    return blockBelow === BlockType.RAIL || blockBelow === BlockType.POWERED_RAIL;
  }, [getBlock]);

  // Check if position is on a powered rail
  const isOnPoweredRail = useCallback((x: number, y: number, z: number) => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const by = Math.floor(y);
    if (getBlock(bx, by, bz) === BlockType.POWERED_RAIL) return true;
    return getBlock(bx, by - 1, bz) === BlockType.POWERED_RAIL;
  }, [getBlock]);

  // Get terrain height at position (rails are flat, not full blocks)
  const getTerrainHeight = useCallback((x: number, z: number): number => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = 24; y >= 0; y--) {
      const block = getBlock(bx, y, bz);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        // Rail blocks are flat - return rail surface height, not full block top
        if (isFlat(block)) {
          return y + 0.14; // rail surface height
        }
        return y + 1;
      }
    }
    return 1;
  }, [getBlock]);

  // Push a minecart in the direction from camera
  const handlePush = useCallback((cartId: number) => {
    const cart = cartsRef.current.find((c) => c.id === cartId);
    if (!cart) return;

    // Push direction = from camera to cart
    const dir = cart.position.clone().sub(camera.position);
    dir.y = 0;
    dir.normalize();

    // Apply impulse
    cart.velocity.addScaledVector(dir, 0.12);
  }, [camera]);

  // Get rail shape at block position for steering
  const getRailShape = useCallback((bx: number, by: number, bz: number): 'ns' | 'ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw' => {
    const block = getBlock(bx, by, bz);
    const isPowered = block === BlockType.POWERED_RAIL;

    const hasN = isFlat(getBlock(bx, by, bz - 1));
    const hasS = isFlat(getBlock(bx, by, bz + 1));
    const hasE = isFlat(getBlock(bx + 1, by, bz));
    const hasW = isFlat(getBlock(bx - 1, by, bz));

    if (!isPowered) {
      if (hasN && hasE && !hasS && !hasW) return 'curve_ne';
      if (hasN && hasW && !hasS && !hasE) return 'curve_nw';
      if (hasS && hasE && !hasN && !hasW) return 'curve_se';
      if (hasS && hasW && !hasN && !hasE) return 'curve_sw';
    }

    if ((hasE || hasW) && !hasN && !hasS) return 'ew';
    return 'ns';
  }, [getBlock]);

  // Track whether any cart is moving on rails for sound
  const wasRidingRef = useRef(false);

  // Physics update
  useFrame(() => {
    const friction = 0.97;
    const gravity = 0.015;
    const railFriction = 0.995; // Less friction on rails

    for (const cart of cartsRef.current) {
      const onRail = isOnRail(cart.position.x, cart.position.y, cart.position.z);
      cart.onRail = onRail;

      // Apply friction
      const f = onRail ? railFriction : friction;
      cart.velocity.x *= f;
      cart.velocity.z *= f;

      // Rail steering: constrain velocity direction based on rail shape
      if (onRail && cart.velocity.lengthSq() > 0.00001) {
        const bx = Math.floor(cart.position.x);
        const bz = Math.floor(cart.position.z);
        // Find the rail block (at cart level or one below)
        let by = Math.floor(cart.position.y);
        const blk = getBlock(bx, by, bz);
        if (blk !== BlockType.RAIL && blk !== BlockType.POWERED_RAIL) by -= 1;
        const shape = getRailShape(bx, by, bz);
        const speed = Math.sqrt(cart.velocity.x * cart.velocity.x + cart.velocity.z * cart.velocity.z);

        if (shape === 'ns') {
          // Constrain to Z axis
          cart.velocity.x *= 0.8;
        } else if (shape === 'ew') {
          // Constrain to X axis
          cart.velocity.z *= 0.8;
        } else {
          // Curved rail: steer the cart along the arc
          // Arc-based steering: advance position along the circular arc
          const localX = cart.position.x - bx;
          const localZ = cart.position.z - bz;

          // Get curve pivot (center of curvature at block corner)
          let pivotX: number, pivotZ: number;
          switch (shape) {
            case 'curve_ne': pivotX = 1; pivotZ = 0; break;
            case 'curve_nw': pivotX = 0; pivotZ = 0; break;
            case 'curve_se': pivotX = 1; pivotZ = 1; break;
            case 'curve_sw': pivotX = 0; pivotZ = 1; break;
          }

          const dx = localX - pivotX;
          const dz = localZ - pivotZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 0.01) {
            const idealR = 0.5;

            // Snap position to ideal radius
            const snappedX = pivotX + (dx / dist) * idealR;
            const snappedZ = pivotZ + (dz / dist) * idealR;

            // Current angle on the arc
            const angle = Math.atan2(dz, dx);

            // Determine rotation direction from current velocity
            const tangentX = -Math.sin(angle);
            const tangentZ = Math.cos(angle);
            const dot = tangentX * cart.velocity.x + tangentZ * cart.velocity.z;
            const sign = dot >= 0 ? 1 : -1;

            // Advance angle: angular_speed = linear_speed / radius
            const angularSpeed = speed / idealR;
            const nextAngle = angle + sign * angularSpeed;

            // Next position on arc
            const nextX = pivotX + Math.cos(nextAngle) * idealR;
            const nextZ = pivotZ + Math.sin(nextAngle) * idealR;

            // Set velocity as chord from snapped position to next arc position
            cart.velocity.x = nextX - snappedX;
            cart.velocity.z = nextZ - snappedZ;

            // Apply snapped position (velocity will advance it along the arc)
            cart.position.x = bx + snappedX;
            cart.position.z = bz + snappedZ;
          }
        }
      }

      // Powered rail boost
      const onPowered = isOnPoweredRail(cart.position.x, cart.position.y, cart.position.z);
      if (onPowered && cart.velocity.lengthSq() > 0.00001) {
        const boostDir = cart.velocity.clone().normalize();
        cart.velocity.addScaledVector(boostDir, 0.04);
        // Cap max speed on powered rail
        const speed = Math.sqrt(cart.velocity.x * cart.velocity.x + cart.velocity.z * cart.velocity.z);
        if (speed > 0.35) {
          cart.velocity.x = (cart.velocity.x / speed) * 0.35;
          cart.velocity.z = (cart.velocity.z / speed) * 0.35;
        }
      }

      // Apply slope gravity
      const terrainAhead = getTerrainHeight(
        cart.position.x + cart.velocity.x * 2,
        cart.position.z + cart.velocity.z * 2
      );
      const terrainHere = getTerrainHeight(cart.position.x, cart.position.z);
      const slope = terrainHere - terrainAhead;

      if (Math.abs(slope) > 0 && cart.velocity.lengthSq() > 0.00001) {
        // Accelerate downhill, decelerate uphill
        const dir = cart.velocity.clone().normalize();
        cart.velocity.addScaledVector(dir, slope * gravity);
      }

      // Move
      cart.position.x += cart.velocity.x;
      cart.position.z += cart.velocity.z;

      // Snap to terrain height
      const targetY = getTerrainHeight(cart.position.x, cart.position.z);
      if (onRail) {
        cart.position.y = targetY - 0.02;
      } else {
        // Gravity: fall to terrain
        if (cart.position.y > targetY + 0.05) {
          cart.velocity.y = (cart.velocity.y || 0) - gravity;
          cart.position.y += cart.velocity.y;
        } else {
          cart.position.y = targetY - 0.02;
          cart.velocity.y = 0;
        }
      }

      // Stop very slow carts
      if (cart.velocity.lengthSq() < 0.00001) {
        cart.velocity.set(0, 0, 0);
      }

      // Keep in reasonable bounds (multi-chunk world)
      cart.position.x = Math.max(-64, Math.min(128, cart.position.x));
      cart.position.z = Math.max(-64, Math.min(128, cart.position.z));
    }

    // Minecart riding sound: play when any cart moves on rails
    const anyRiding = cartsRef.current.some(
      (c) => c.onRail && c.velocity.lengthSq() > 0.001
    );
    if (anyRiding && !wasRidingRef.current) {
      soundManager.playMinecartRiding();
    } else if (!anyRiding && wasRidingRef.current) {
      soundManager.stopMinecartRiding();
    }
    wasRidingRef.current = anyRiding;
  });

  // Cleanup riding sound on unmount
  useEffect(() => {
    return () => { soundManager.stopMinecartRiding(); };
  }, []);

  return (
    <group>
      {/* Render minecarts */}
      {cartsRef.current.map((cart) => (
        <MinecartMesh key={cart.id} cart={cart} onPush={handlePush} />
      ))}
    </group>
  );
}
