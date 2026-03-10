import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType, isFlat, isDetectorRail, getRailSlopeDir } from '../../core/voxel/BlockRegistry';
import { computeRailShape } from '../../core/voxel/ChunkMesher';
import { soundManager } from '../../systems/SoundManager';
import { isPoweredRailActive, activateDetectorRail } from '../../systems/CablePower';
import { CHUNK_HEIGHT } from '../../utils/constants';

interface Minecart {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onRail: boolean;
  hasWarningLight: boolean;
}

let cartIdCounter = 0;

// Expose minecart positions globally so BlockLights can add warning light illumination
export interface MinecartLightInfo {
  x: number;
  y: number;
  z: number;
  hasWarningLight: boolean;
}
export const minecartLightsRef: { current: MinecartLightInfo[] } = { current: [] };

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

// Build warning light geometry (two small beacon domes on the minecart sides)
export function buildWarningLightGeometry(): THREE.BufferGeometry {
  const allPos: number[] = [];
  const allNorm: number[] = [];
  const allCol: number[] = [];
  const allIdx: number[] = [];
  let vOff = 0;

  const baseColor = new THREE.Color(0x444444);
  const lensColor = new THREE.Color(0xffcc00);

  // Two light housings on left and right sides of the cart
  const positions = [
    [-0.25, 0.38, 0],  // left
    [0.25, 0.38, 0],   // right
  ];

  for (const pos of positions) {
    // Base mount (small dark box)
    const mount = new THREE.BoxGeometry(0.08, 0.04, 0.08);
    mount.translate(pos[0], pos[1] - 0.02, pos[2]);

    // Lens dome (small sphere-like cylinder)
    const lens = new THREE.CylinderGeometry(0.05, 0.06, 0.06, 8);
    lens.translate(pos[0], pos[1] + 0.03, pos[2]);

    const parts: [THREE.BufferGeometry, THREE.Color][] = [
      [mount, baseColor],
      [lens, lensColor],
    ];

    for (const [geo, col] of parts) {
      const p = geo.attributes.position;
      const n = geo.attributes.normal;
      const idx = geo.index!;
      for (let i = 0; i < p.count; i++) {
        allPos.push(p.getX(i), p.getY(i), p.getZ(i));
        allNorm.push(n.getX(i), n.getY(i), n.getZ(i));
        allCol.push(col.r, col.g, col.b);
      }
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + vOff);
      vOff += p.count;
      geo.dispose();
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(allNorm, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  merged.setIndex(allIdx);
  merged.computeBoundingSphere();
  return merged;
}

function MinecartMesh({ cart, onPush }: { cart: Minecart; onPush: (id: number) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const currentRotY = useRef(0);
  const lightLeftRef = useRef<THREE.PointLight>(null);
  const lightRightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(cart.position);

    // Face direction of velocity with smooth interpolation for curves
    if (cart.velocity.lengthSq() > 0.0001) {
      const targetY = Math.atan2(cart.velocity.x, cart.velocity.z);
      // Smooth lerp for rotation (handles angle wrapping)
      let diff = targetY - currentRotY.current;
      // Wrap to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentRotY.current += diff * 0.25;
      groupRef.current.rotation.y = currentRotY.current;
    }

    // Animate warning lights: alternate flashing at ~2Hz
    if (cart.hasWarningLight && lightLeftRef.current && lightRightRef.current) {
      const t = state.clock.elapsedTime;
      // Flash cycle: 2Hz alternating between left and right
      const phase = (t * 4) % 2; // 0-2 range, 4 = 2Hz * 2 lights
      const leftOn = phase < 1;
      lightLeftRef.current.intensity = leftOn ? 2.0 : 0.1;
      lightRightRef.current.intensity = leftOn ? 0.1 : 2.0;
    }
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation?.();
    onPush(cart.id);
    soundManager.playDigSound(BlockType.IRON_ORE);
  }, [cart.id, onPush]);

  const geometry = useMemo(() => buildMinecartGeometry(), []);
  const warningGeo = useMemo(() => cart.hasWarningLight ? buildWarningLightGeometry() : null, [cart.hasWarningLight]);

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} onClick={handleClick} castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {cart.hasWarningLight && warningGeo && (
        <>
          <mesh geometry={warningGeo} castShadow>
            <meshLambertMaterial vertexColors />
          </mesh>
          {/* Left warning light */}
          <pointLight
            ref={lightLeftRef}
            position={[-0.25, 0.45, 0]}
            color="#ffcc00"
            intensity={2.0}
            distance={8}
            decay={2}
          />
          {/* Right warning light */}
          <pointLight
            ref={lightRightRef}
            position={[0.25, 0.45, 0]}
            color="#ffcc00"
            intensity={0.1}
            distance={8}
            decay={2}
          />
        </>
      )}
    </group>
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
        hasWarningLight: detail.hasWarningLight ?? false,
      });
      setCartVersion((v) => v + 1);
    };
    window.addEventListener('digy:spawnMinecart', handler);

    // Listen for warning light attachment to existing minecarts
    const warningHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { x, z } = detail;
      // Find closest minecart within 1.5 blocks
      let closest: Minecart | null = null;
      let closestDist = 1.5;
      for (const cart of cartsRef.current) {
        const dx = cart.position.x - x;
        const dz = cart.position.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) {
          closestDist = dist;
          closest = cart;
        }
      }
      if (closest && !closest.hasWarningLight) {
        closest.hasWarningLight = true;
        setCartVersion((v) => v + 1);
      }
    };
    window.addEventListener('digy:attachWarningLight', warningHandler);

    return () => {
      window.removeEventListener('digy:spawnMinecart', handler);
      window.removeEventListener('digy:attachWarningLight', warningHandler);
    };
  }, []);

  // Check if position is on a rail (regular or powered)
  const isOnRail = useCallback((x: number, y: number, z: number) => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    // Check at cart level and one below (rail is flat, cart sits just above it)
    const by = Math.floor(y);
    const block = getBlock(bx, by, bz);
    if (isFlat(block)) return true;
    const blockBelow = getBlock(bx, by - 1, bz);
    return isFlat(blockBelow);
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
  // For slope rails, interpolates height based on position within the block
  const getTerrainHeight = useCallback((x: number, z: number): number => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const localX = x - bx;
    const localZ = z - bz;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = getBlock(bx, y, bz);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        if (isFlat(block)) {
          // Slope rail: interpolate height
          const slopeDir = getRailSlopeDir(block);
          if (slopeDir) {
            let t: number;
            switch (slopeDir) {
              case 'n': t = 1 - localZ; break; // ascending toward -Z: low at z=1, high at z=0
              case 's': t = localZ; break;      // ascending toward +Z: low at z=0, high at z=1
              case 'e': t = localX; break;      // ascending toward +X: low at x=0, high at x=1
              case 'w': t = 1 - localX; break;  // ascending toward -X: low at x=1, high at x=0
            }
            return y + 0.14 + t; // rail surface + interpolated slope (0 to 1 block)
          }
          return y + 0.14;
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

  // Get rail shape at block position using shared Minecraft-style rules
  const getRailShape = useCallback((bx: number, by: number, bz: number) => {
    return computeRailShape(getBlock, bx, by, bz) ?? 'ns';
  }, [getBlock]);

  // Track whether any cart is moving on rails for sound
  const wasRidingRef = useRef(false);
  // Track active detector rails to prevent re-triggering every frame
  const activeDetectorRails = useRef(new Set<string>());

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
        if (!isFlat(blk)) by -= 1;
        const shape = getRailShape(bx, by, bz);
        const speed = Math.sqrt(cart.velocity.x * cart.velocity.x + cart.velocity.z * cart.velocity.z);

        if (shape === 'ns' || shape === 'slope_n' || shape === 'slope_s') {
          // Constrain to Z axis
          cart.velocity.x *= 0.8;
        } else if (shape === 'ew' || shape === 'slope_e' || shape === 'slope_w') {
          // Constrain to X axis
          cart.velocity.z *= 0.8;
        } else {
          // Curved rail: steer the cart along the arc
          const localX = cart.position.x - bx;
          const localZ = cart.position.z - bz;

          // Get curve pivot (center of curvature at block corner)
          let pivotX = 0, pivotZ = 0;
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

      // Powered rail boost (only if rail is powered by cable or adjacent lever)
      const onPowered = isOnPoweredRail(cart.position.x, cart.position.y, cart.position.z);
      const railBx = Math.floor(cart.position.x);
      const railBz = Math.floor(cart.position.z);
      const railBy = Math.floor(cart.position.y);
      const railActive = onPowered && (
        isPoweredRailActive(railBx, railBy, railBz) ||
        isPoweredRailActive(railBx, railBy - 1, railBz)
      );
      if (railActive && cart.velocity.lengthSq() > 0.00001) {
        const boostDir = cart.velocity.clone().normalize();
        cart.velocity.addScaledVector(boostDir, 0.04);
        // Cap max speed on powered rail
        const speed = Math.sqrt(cart.velocity.x * cart.velocity.x + cart.velocity.z * cart.velocity.z);
        if (speed > 0.35) {
          cart.velocity.x = (cart.velocity.x / speed) * 0.35;
          cart.velocity.z = (cart.velocity.z / speed) * 0.35;
        }
      }

      // Detector rail: activate once when minecart enters, deactivate when it leaves
      const detBx = Math.floor(cart.position.x);
      const detBz = Math.floor(cart.position.z);
      const detBy = Math.floor(cart.position.y);
      const detBlock = getBlock(detBx, detBy, detBz);
      const detBlockBelow = getBlock(detBx, detBy - 1, detBz);
      let detRailKey: string | null = null;
      if (isDetectorRail(detBlock)) {
        detRailKey = `${detBx},${detBy},${detBz}`;
      } else if (isDetectorRail(detBlockBelow)) {
        detRailKey = `${detBx},${detBy - 1},${detBz}`;
      }
      if (detRailKey && !activeDetectorRails.current.has(detRailKey)) {
        // First frame on this detector rail - activate it
        activeDetectorRails.current.add(detRailKey);
        const [drx, dry, drz] = detRailKey.split(',').map(Number);
        if (getBlock(drx, dry, drz) === BlockType.DETECTOR_RAIL) {
          activateDetectorRail(drx, dry, drz, true);
          const capturedKey = detRailKey;
          setTimeout(() => {
            activeDetectorRails.current.delete(capturedKey);
            const s = useWorldStore.getState();
            if (s.getBlock(drx, dry, drz) === BlockType.DETECTOR_RAIL_ON) {
              activateDetectorRail(drx, dry, drz, false);
            }
          }, 1500);
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

      // Remove carts that fall or go too far out of bounds
      if (cart.position.y < -10 || cart.position.x < -128 || cart.position.x > 256 || cart.position.z < -128 || cart.position.z > 256) {
        cart.velocity.set(0, 0, 0);
        // Mark for removal
        (cart as any)._remove = true;
      }
    }

    // Remove out-of-bounds carts
    const beforeCount = cartsRef.current.length;
    cartsRef.current = cartsRef.current.filter((c) => !(c as any)._remove);
    if (cartsRef.current.length !== beforeCount) setCartVersion((v) => v + 1);

    // Cart-to-cart collisions: elastic bounce
    const carts = cartsRef.current;
    for (let i = 0; i < carts.length; i++) {
      for (let j = i + 1; j < carts.length; j++) {
        const a = carts[i];
        const b = carts[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dy = b.position.y - a.position.y;
        const distSq = dx * dx + dz * dz;
        const minDist = 0.8; // cart collision radius
        if (distSq < minDist * minDist && distSq > 0.0001 && Math.abs(dy) < 0.5) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;

          // Separate overlapping carts
          const overlap = (minDist - dist) * 0.5;
          a.position.x -= nx * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.z += nz * overlap;

          // Elastic collision: swap velocity components along collision normal
          const relVelN = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz;
          if (relVelN > 0) {
            // Equal mass elastic collision
            a.velocity.x -= relVelN * nx;
            a.velocity.z -= relVelN * nz;
            b.velocity.x += relVelN * nx;
            b.velocity.z += relVelN * nz;

            soundManager.playDigSound(BlockType.IRON_ORE);
          }
        }
      }
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

    // Update global minecart lights for BlockLights shader integration
    minecartLightsRef.current = cartsRef.current.map((c) => ({
      x: c.position.x,
      y: c.position.y,
      z: c.position.z,
      hasWarningLight: c.hasWarningLight,
    }));
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
