import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { BlockType } from '../../core/voxel/BlockRegistry';
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

  // Cart body (open top trapezoid)
  const bottom = new THREE.BoxGeometry(0.7, 0.06, 0.5);
  bottom.translate(0, 0.28, 0);

  // Sides
  const sideL = new THREE.BoxGeometry(0.06, 0.3, 0.5);
  sideL.translate(-0.35, 0.43, 0);
  const sideR = new THREE.BoxGeometry(0.06, 0.3, 0.5);
  sideR.translate(0.35, 0.43, 0);
  const sideF = new THREE.BoxGeometry(0.7, 0.3, 0.06);
  sideF.translate(0, 0.43, 0.25);
  const sideB = new THREE.BoxGeometry(0.7, 0.3, 0.06);
  sideB.translate(0, 0.43, -0.25);

  const parts: [THREE.BufferGeometry, THREE.Color][] = [
    [bottom, insideColor],
    [sideL, bodyColor], [sideR, bodyColor],
    [sideF, bodyColor], [sideB, bodyColor],
  ];

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.3, 0.12, -0.2], [0.3, 0.12, -0.2],
    [-0.3, 0.12, 0.2], [0.3, 0.12, 0.2],
  ];
  for (const wp of wheelPositions) {
    const w = wheelGeo.clone();
    w.translate(wp[0], wp[1], wp[2]);
    parts.push([w, wheelColor]);
  }

  // Axles
  const axleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4);
  axleGeo.rotateZ(Math.PI / 2);
  const a1 = axleGeo.clone();
  a1.translate(0, 0.12, -0.2);
  const a2 = axleGeo.clone();
  a2.translate(0, 0.12, 0.2);
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

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.copy(cart.position);

    // Face direction of velocity
    if (cart.velocity.lengthSq() > 0.0001) {
      meshRef.current.rotation.y = Math.atan2(cart.velocity.x, cart.velocity.z);
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

export function MinecartRenderer({ center }: { center: [number, number, number] }) {
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
    const by = Math.floor(y - 0.3); // check below cart
    const bz = Math.floor(z);
    const block = getBlock(bx, by, bz);
    return block === BlockType.RAIL || block === BlockType.POWERED_RAIL;
  }, [getBlock]);

  // Check if position is on a powered rail
  const isOnPoweredRail = useCallback((x: number, y: number, z: number) => {
    const bx = Math.floor(x);
    const by = Math.floor(y - 0.3);
    const bz = Math.floor(z);
    return getBlock(bx, by, bz) === BlockType.POWERED_RAIL;
  }, [getBlock]);

  // Get terrain height at position
  const getTerrainHeight = useCallback((x: number, z: number): number => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = 24; y >= 0; y--) {
      const block = getBlock(bx, y, bz);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
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
        cart.position.y = targetY + 0.05;
      } else {
        // Gravity: fall to terrain
        if (cart.position.y > targetY + 0.1) {
          cart.velocity.y = (cart.velocity.y || 0) - gravity;
          cart.position.y += cart.velocity.y;
        } else {
          cart.position.y = targetY + 0.05;
          cart.velocity.y = 0;
        }
      }

      // Stop very slow carts
      if (cart.velocity.lengthSq() < 0.00001) {
        cart.velocity.set(0, 0, 0);
      }

      // Keep in bounds
      cart.position.x = Math.max(-1, Math.min(17, cart.position.x));
      cart.position.z = Math.max(-1, Math.min(17, cart.position.z));
    }
  });

  // Spawn an initial test cart
  useEffect(() => {
    if (cartsRef.current.length === 0) {
      const terrainY = getTerrainHeight(center[0], center[2]);
      cartsRef.current.push({
        id: cartIdCounter++,
        position: new THREE.Vector3(center[0], terrainY + 0.05, center[2]),
        velocity: new THREE.Vector3(0, 0, 0),
        onRail: false,
      });
      setCartVersion((v) => v + 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      {/* Render minecarts */}
      {cartsRef.current.map((cart) => (
        <MinecartMesh key={cart.id} cart={cart} onPush={handlePush} />
      ))}
    </group>
  );
}
