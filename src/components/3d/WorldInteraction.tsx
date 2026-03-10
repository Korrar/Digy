import { useCallback, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../../stores/worldStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { BlockType, getBlock, isSolid, isToolPickaxe, isFood, isItemType, isStairsItem, getOrientedStairs, isDoorItem, isDoor, isFlat, isChest, isLever, isButton, isCable, isPiston, isPistonHead, isPressurePlate, isRepeater, isRepeaterItem, isComparator, isComparatorItem, getOrientedRepeater, getOrientedComparator, isEnchantingTable } from '../../core/voxel/BlockRegistry';
import { computeRailBlockType, shouldRailUpdate } from '../../core/voxel/ChunkMesher';
import { soundManager } from '../../systems/SoundManager';
import { spawnParticles } from './DiggingParticles';
import { processGravity } from '../../systems/SandPhysics';
import { checkWaterDrain } from '../../systems/WaterFlow';
import { useDevStore } from '../../stores/devStore';
import { propagateCablePower, activatePressurePlate, cycleRepeaterDelay, toggleComparatorMode } from '../../systems/CablePower';
import { useCombatStore } from '../../stores/combatStore';
import { useChestStore } from '../../stores/chestStore';
import { isOnDecorativePlate } from '../../stores/hideoutPlateStore';
import { useFurnaceStore } from '../../stores/furnaceStore';
import { useEnchantmentStore } from '../../stores/enchantmentStore';
import { showFloatingText } from '../ui/FloatingText';

// Tracks cable positions hidden under solid blocks
// Key format: "x,y,z" — when a block is placed on a cable, the cable is hidden;
// when the block is broken, the cable is restored.
const hiddenCables = new Set<string>();

interface WorldInteractionProps {
  mode: 'mine' | 'build' | 'adventure' | 'explore';
}

export function WorldInteraction({ mode }: WorldInteractionProps) {
  const highlightRef = useRef<THREE.Mesh>(null);
  const miningTimeRef = useRef(0);
  const miningBlockRef = useRef<string | null>(null);
  const isPointerDownRef = useRef(false);
  const lastSoundTimeRef = useRef(0);
  const lastEatTimeRef = useRef(0);
  const [miningProgress, setMiningProgress] = useState(0);

  const { raycaster, pointer, camera, scene } = useThree();
  const getBlockW = useWorldStore((s) => s.getBlock);
  const setBlockW = useWorldStore((s) => s.setBlock);
  const addBlock = useInventoryStore((s) => s.addBlock);
  const getSelectedBlock = useInventoryStore((s) => s.getSelectedBlock);
  const removeBlock = useInventoryStore((s) => s.removeBlock);
  const selectedIdx = useInventoryStore((s) => s.selectedHotbarIndex);

  const raycast = useCallback((): {
    blockPos: [number, number, number];
    normal: [number, number, number];
    blockType: BlockType;
  } | null => {
    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.userData.isChunk) {
        meshes.push(obj as THREE.Mesh);
      }
    });

    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    if (!hit.face) return null;

    const normal = hit.face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    normal.applyMatrix3(normalMatrix).normalize();

    const point = hit.point.clone();
    const bx = Math.floor(point.x - normal.x * 0.01);
    const by = Math.floor(point.y - normal.y * 0.01);
    const bz = Math.floor(point.z - normal.z * 0.01);

    const blockType = getBlockW(bx, by, bz);
    if (blockType === BlockType.AIR) return null;

    return {
      blockPos: [bx, by, bz],
      normal: [Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)] as [number, number, number],
      blockType,
    };
  }, [raycaster, pointer, camera, scene, getBlockW]);

  useFrame((state, delta) => {
    const result = raycast();
    const now = state.clock.elapsedTime;

    if (highlightRef.current) {
      if (result) {
        highlightRef.current.visible = true;
        if (mode === 'build') {
          highlightRef.current.position.set(
            result.blockPos[0] + result.normal[0] + 0.5,
            result.blockPos[1] + result.normal[1] + 0.5,
            result.blockPos[2] + result.normal[2] + 0.5
          );
        } else {
          highlightRef.current.position.set(
            result.blockPos[0] + 0.5,
            result.blockPos[1] + 0.5,
            result.blockPos[2] + 0.5
          );
        }

        // Mining with hold
        if (isPointerDownRef.current && mode === 'mine' && result) {
          // Block mining on decorative plates
          if (isOnDecorativePlate(result.blockPos[0], result.blockPos[1], result.blockPos[2])) {
            miningTimeRef.current = 0;
            setMiningProgress(0);
            return;
          }
          const blockKey = result.blockPos.join(',');
          if (miningBlockRef.current !== blockKey) {
            miningBlockRef.current = blockKey;
            miningTimeRef.current = 0;
          }

          const def = getBlock(result.blockType);
          // Tool speed bonus from equipped pickaxe
          const selected = getSelectedBlock();
          let toolMultiplier = 1;
          if (selected && isToolPickaxe(selected)) {
            const toolDef = getBlock(selected);
            toolMultiplier = toolDef.toolSpeed ?? 1;
          }
          miningTimeRef.current += delta * toolMultiplier;
          const hardness = useDevStore.getState().fastMining ? 0.05 : def.hardness;
          const progress = Math.min(miningTimeRef.current / Math.max(hardness, 0.05), 1);
          setMiningProgress(progress);

          // Play dig sound periodically while mining
          if (now - lastSoundTimeRef.current > 0.25) {
            soundManager.playDigSound(result.blockType);
            spawnParticles(result.blockPos, result.blockType, false);
            lastSoundTimeRef.current = now;
          }

          if (progress >= 1) {
            const [bx, by, bz] = result.blockPos;

            // Piston head break: retract piston body below
            if (isPistonHead(result.blockType)) {
              const isSticky = getBlock(result.blockType).isStickyPiston === true;
              setBlockW(bx, by, bz, BlockType.AIR);
              const belowBlock = getBlockW(bx, by - 1, bz);
              if (isPiston(belowBlock)) {
                setBlockW(bx, by - 1, bz, isSticky ? BlockType.STICKY_PISTON : BlockType.PISTON);
              }
            }
            // Extended piston break: remove head above
            else if (isPiston(result.blockType) && getBlock(result.blockType).pistonExtended) {
              const isSticky = getBlock(result.blockType).isStickyPiston === true;
              setBlockW(bx, by, bz, BlockType.AIR);
              const aboveBlock = getBlockW(bx, by + 1, bz);
              if (isPistonHead(aboveBlock)) {
                setBlockW(bx, by + 1, bz, BlockType.AIR);
              }
              addBlock(isSticky ? BlockType.STICKY_PISTON : BlockType.PISTON, 1);
            }
            // Door break: remove both halves, always drop door item
            else if (isDoor(result.blockType)) {
              const doorDef = getBlock(result.blockType);
              const isUpper = doorDef.doorUpper === true;
              setBlockW(bx, by, bz, BlockType.AIR);
              if (isUpper) {
                setBlockW(bx, by - 1, bz, BlockType.AIR);
              } else {
                setBlockW(bx, by + 1, bz, BlockType.AIR);
              }
              addBlock(BlockType.DOOR_OAK, 1); // Always drop the door item
            } else {
              // Restore hidden cable when block above it is broken
              const cableKey = `${bx},${by},${bz}`;
              if (hiddenCables.has(cableKey)) {
                hiddenCables.delete(cableKey);
                setBlockW(bx, by, bz, BlockType.CABLE);
              } else {
                setBlockW(bx, by, bz, BlockType.AIR);
              }
              if (def.drops !== BlockType.AIR) {
                addBlock(def.drops, 1);
              }
            }
            // Leaves have a chance to drop apples
            if (result.blockType === BlockType.LEAVES && Math.random() < 0.15) {
              addBlock(BlockType.APPLE, 1);
            }
            // Chest broken: drop all contents into player inventory
            if (isChest(result.blockType)) {
              const chestStore = useChestStore.getState();
              const chestData = chestStore.chests.get(`${bx},${by},${bz}`);
              if (chestData) {
                for (const slot of chestData.slots) {
                  if (slot) addBlock(slot.blockType, slot.count);
                }
              }
              chestStore.removeChest(bx, by, bz);
            }
            // XP for mining
            useCombatStore.getState().addXp(1);
            // Consume tool durability
            const equippedTool = getSelectedBlock();
            if (equippedTool && isToolPickaxe(equippedTool)) {
              const broke = useInventoryStore.getState().consumeDurability(selectedIdx);
              if (broke) {
                soundManager.playToolBreakSound();
                showFloatingText('Tool broke!', '#ff4444');
              }
            }
            // Play break sound and emit burst particles
            soundManager.playBreakSound(result.blockType);
            spawnParticles(result.blockPos, result.blockType, true);

            // Trigger sand/gravel physics and water flow
            processGravity(bx, by, bz);
            checkWaterDrain(bx, by, bz);

            // If a rail was broken, update neighboring rails (including vertical for slopes)
            if (isFlat(result.blockType)) {
              const neighbors: [number, number, number][] = [
                [bx, by, bz - 1], [bx, by, bz + 1],
                [bx + 1, by, bz], [bx - 1, by, bz],
              ];
              for (const [nx, ny, nz] of neighbors) {
                const nBlock = getBlockW(nx, ny, nz);
                if (isFlat(nBlock) && nBlock !== BlockType.POWERED_RAIL) {
                  if (shouldRailUpdate(getBlockW, nx, ny, nz)) {
                    const newType = computeRailBlockType(getBlockW, nx, ny, nz);
                    if (newType !== nBlock) {
                      setBlockW(nx, ny, nz, newType);
                    }
                  }
                }
              }
              // Update vertical neighbors for slope connections
              const vertNeighbors: [number, number, number][] = [
                [bx, by + 1, bz - 1], [bx, by + 1, bz + 1],
                [bx + 1, by + 1, bz], [bx - 1, by + 1, bz],
                [bx, by - 1, bz - 1], [bx, by - 1, bz + 1],
                [bx + 1, by - 1, bz], [bx - 1, by - 1, bz],
              ];
              for (const [nx, ny, nz] of vertNeighbors) {
                const nBlock = getBlockW(nx, ny, nz);
                if (isFlat(nBlock) && nBlock !== BlockType.POWERED_RAIL) {
                  const newType = computeRailBlockType(getBlockW, nx, ny, nz);
                  if (newType !== nBlock) {
                    setBlockW(nx, ny, nz, newType);
                  }
                }
              }
            }

            miningTimeRef.current = 0;
            miningBlockRef.current = null;
            setMiningProgress(0);
          }
        }
      } else {
        highlightRef.current.visible = false;
        miningBlockRef.current = null;
        miningTimeRef.current = 0;
        setMiningProgress(0);
      }
    }
  });

  const handlePointerDown = useCallback(() => {
    isPointerDownRef.current = true;
    // Interactive blocks work in both build and adventure modes
    if (mode === 'build' || mode === 'adventure') {
      const interactCheck = raycast();
      if (interactCheck) {
        const [bx, by, bz] = interactCheck.blockPos;

        // Block all interactions on decorative plates
        if (isOnDecorativePlate(bx, by, bz)) return;

        // Chest open
        if (isChest(interactCheck.blockType)) {
          useChestStore.getState().openChest(bx, by, bz);
          soundManager.playPlaceSound();
          return;
        }

        // Door toggle
        if (isDoor(interactCheck.blockType)) {
          const doorDef = getBlock(interactCheck.blockType);
          const isUpper = doorDef.doorUpper === true;
          const isOpen = doorDef.doorOpen === true;
          if (isUpper) {
            setBlockW(bx, by, bz, isOpen ? BlockType.DOOR_OAK_TOP : BlockType.DOOR_OAK_TOP_OPEN);
            setBlockW(bx, by - 1, bz, isOpen ? BlockType.DOOR_OAK_BOTTOM : BlockType.DOOR_OAK_BOTTOM_OPEN);
          } else {
            setBlockW(bx, by, bz, isOpen ? BlockType.DOOR_OAK_BOTTOM : BlockType.DOOR_OAK_BOTTOM_OPEN);
            setBlockW(bx, by + 1, bz, isOpen ? BlockType.DOOR_OAK_TOP : BlockType.DOOR_OAK_TOP_OPEN);
          }
          soundManager.playPlaceSound();
          return;
        }

        // Lever toggle
        if (isLever(interactCheck.blockType)) {
          const leverDef = getBlock(interactCheck.blockType);
          const isOn = leverDef.leverOn === true;
          setBlockW(bx, by, bz, isOn ? BlockType.LEVER : BlockType.LEVER_ON);
          soundManager.playPlaceSound();
          propagateCablePower(bx, by, bz, !isOn);
          window.dispatchEvent(new CustomEvent('digy:leverToggle', {
            detail: { x: bx, y: by, z: bz, on: !isOn }
          }));
          return;
        }

        // Button press
        if (isButton(interactCheck.blockType)) {
          soundManager.playPlaceSound();
          window.dispatchEvent(new CustomEvent('digy:buttonPress', {
            detail: { x: bx, y: by, z: bz }
          }));
          return;
        }

        // Pressure plate toggle
        if (isPressurePlate(interactCheck.blockType)) {
          const plateDef = getBlock(interactCheck.blockType);
          const isOn = plateDef.pressurePlateOn === true;
          activatePressurePlate(bx, by, bz, !isOn);
          return;
        }

        // Repeater: cycle delay (1→2→3→4→1)
        if (isRepeater(interactCheck.blockType)) {
          const newDelay = cycleRepeaterDelay(bx, by, bz);
          soundManager.playPlaceSound();
          window.dispatchEvent(new CustomEvent('digy:repeaterDelay', {
            detail: { x: bx, y: by, z: bz, delay: newDelay }
          }));
          return;
        }

        // Comparator: toggle mode (compare ↔ subtract)
        if (isComparator(interactCheck.blockType)) {
          const newMode = toggleComparatorMode(bx, by, bz);
          soundManager.playPlaceSound();
          window.dispatchEvent(new CustomEvent('digy:comparatorMode', {
            detail: { x: bx, y: by, z: bz, mode: newMode }
          }));
          return;
        }
      }

      // Adventure mode: only interactions, no building/placing
      if (mode === 'adventure') return;

      const selectedBlock = getSelectedBlock();
      if (!selectedBlock) return;

      // If it's food, eat it instead of placing (with 1s cooldown)
      if (isFood(selectedBlock)) {
        const now = Date.now();
        if (now - lastEatTimeRef.current < 1000) return; // 1s cooldown
        lastEatTimeRef.current = now;
        const foodDef = getBlock(selectedBlock);
        useCombatStore.getState().heal(foodDef.healAmount ?? 0);
        removeBlock(selectedIdx, 1);
        soundManager.playEatSound();
        return;
      }

      // Furnace interaction - open furnace UI
      if (selectedBlock === null || !isItemType(selectedBlock)) {
        const furnaceCheck = raycast();
        if (furnaceCheck && furnaceCheck.blockType === BlockType.FURNACE) {
          const [fx, fy, fz] = furnaceCheck.blockPos;
          useFurnaceStore.getState().openFurnace(fx, fy, fz);
          return;
        }
      }

      // Enchanting table interaction - open enchanting UI
      if (selectedBlock === null || !isItemType(selectedBlock)) {
        const enchantCheck = raycast();
        if (enchantCheck && isEnchantingTable(enchantCheck.blockType)) {
          useEnchantmentStore.getState().openEnchanting();
          return;
        }
      }

      // Handle minecart placement - place on top of the targeted block
      if (selectedBlock === BlockType.MINECART) {
        const hit = raycast();
        if (!hit) return;
        const [bx, by, bz] = hit.blockPos;
        const surfaceBlock = getBlockW(bx, by, bz);
        const isRail = surfaceBlock === BlockType.RAIL || surfaceBlock === BlockType.POWERED_RAIL;
        // Place minecart on top of the targeted solid/rail block
        if (isSolid(surfaceBlock) || isRail) {
          // Rails are flat - cart sits directly on them; solid blocks - cart sits on top
          const spawnY = isRail ? by : by + 1;
          // Dispatch minecart spawn event
          window.dispatchEvent(new CustomEvent('digy:spawnMinecart', {
            detail: { x: bx + 0.5, y: spawnY + 0.05, z: bz + 0.5, onRail: isRail }
          }));
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
        }
        return;
      }

      // Handle warning light placement - attach to nearby minecart
      if (selectedBlock === BlockType.WARNING_LIGHT) {
        const hit = raycast();
        if (!hit) return;
        const [bx, , bz] = hit.blockPos;
        window.dispatchEvent(new CustomEvent('digy:attachWarningLight', {
          detail: { x: bx + 0.5, z: bz + 0.5 }
        }));
        removeBlock(selectedIdx, 1);
        soundManager.playPlaceSound();
        return;
      }

      // Handle stair placement - orient based on clicked face
      if (isStairsItem(selectedBlock)) {
        const hit = raycast();
        if (!hit) return;
        const [bx, by, bz] = hit.blockPos;
        const px = bx + hit.normal[0];
        const py = by + hit.normal[1];
        const pz = bz + hit.normal[2];
        if (!isSolid(getBlockW(px, py, pz)) && !isOnDecorativePlate(px, py, pz)) {
          // Determine stair direction from face normal (step rises away from clicked face)
          let dir: 'n' | 's' | 'e' | 'w' = 'n';
          const [nx, , nz] = hit.normal;
          if (Math.abs(nx) > Math.abs(nz)) {
            dir = nx > 0 ? 'e' : 'w';
          } else if (Math.abs(nz) > 0) {
            dir = nz > 0 ? 's' : 'n';
          }
          setBlockW(px, py, pz, getOrientedStairs(selectedBlock, dir));
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
        }
        return;
      }

      // Handle repeater placement - orient based on player facing
      if (isRepeaterItem(selectedBlock)) {
        const hit = raycast();
        if (!hit) return;
        const [bx, by, bz] = hit.blockPos;
        const px = bx + hit.normal[0];
        const py = by + hit.normal[1];
        const pz = bz + hit.normal[2];
        if (!isSolid(getBlockW(px, py, pz)) && !isOnDecorativePlate(px, py, pz)) {
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          let dir: 'n' | 's' | 'e' | 'w';
          if (Math.abs(camDir.x) > Math.abs(camDir.z)) {
            dir = camDir.x > 0 ? 'e' : 'w';
          } else {
            dir = camDir.z > 0 ? 's' : 'n';
          }
          setBlockW(px, py, pz, getOrientedRepeater(dir));
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
        }
        return;
      }

      // Handle comparator placement - orient based on player facing
      if (isComparatorItem(selectedBlock)) {
        const hit = raycast();
        if (!hit) return;
        const [bx, by, bz] = hit.blockPos;
        const px = bx + hit.normal[0];
        const py = by + hit.normal[1];
        const pz = bz + hit.normal[2];
        if (!isSolid(getBlockW(px, py, pz)) && !isOnDecorativePlate(px, py, pz)) {
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          let dir: 'n' | 's' | 'e' | 'w';
          if (Math.abs(camDir.x) > Math.abs(camDir.z)) {
            dir = camDir.x > 0 ? 'e' : 'w';
          } else {
            dir = camDir.z > 0 ? 's' : 'n';
          }
          setBlockW(px, py, pz, getOrientedComparator(dir));
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
        }
        return;
      }

      // Handle door placement - places 2-high door
      if (isDoorItem(selectedBlock)) {
        const hit = raycast();
        if (!hit) return;
        const [bx, by, bz] = hit.blockPos;
        const px = bx + hit.normal[0];
        const py = by + hit.normal[1];
        const pz = bz + hit.normal[2];
        // Need 2 empty blocks (bottom and top)
        if (!isSolid(getBlockW(px, py, pz)) && !isSolid(getBlockW(px, py + 1, pz)) && !isOnDecorativePlate(px, py, pz)) {
          setBlockW(px, py, pz, BlockType.DOOR_OAK_BOTTOM);
          setBlockW(px, py + 1, pz, BlockType.DOOR_OAK_TOP);
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
        }
        return;
      }

      // Don't place non-block items
      if (isItemType(selectedBlock)) return;

      const hit = raycast();
      if (!hit) return;

      const [bx, by, bz] = hit.blockPos;
      const px = bx + hit.normal[0];
      const py = by + hit.normal[1];
      const pz = bz + hit.normal[2];

      // Block placing on decorative plates
      if (isOnDecorativePlate(px, py, pz)) return;

      const targetBlock = getBlockW(px, py, pz);
      // Prevent placing rails on existing rails (would cause floating rail glitch)
      if (isFlat(selectedBlock) && isFlat(targetBlock)) return;

      // When placing a solid block on a cable, hide the cable (it persists underneath)
      if (isCable(targetBlock) && isSolid(selectedBlock)) {
        const cableKey = `${px},${py},${pz}`;
        hiddenCables.add(cableKey);
        setBlockW(px, py, pz, selectedBlock);
        removeBlock(selectedIdx, 1);
        soundManager.playPlaceSound();
        return;
      }

      if (!isSolid(targetBlock)) {
        // Rail placement: compute and store correct shape, then update neighbors
        if (selectedBlock === BlockType.RAIL) {
          const hasRailN = isFlat(getBlockW(px, py, pz - 1));
          const hasRailS = isFlat(getBlockW(px, py, pz + 1));
          const hasRailE = isFlat(getBlockW(px + 1, py, pz));
          const hasRailW = isFlat(getBlockW(px - 1, py, pz));
          const railNeighbors = (hasRailN?1:0) + (hasRailS?1:0) + (hasRailE?1:0) + (hasRailW?1:0);
          if (railNeighbors === 0) {
            // No rail neighbors: orient based on camera facing direction
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            if (Math.abs(camDir.x) > Math.abs(camDir.z)) {
              setBlockW(px, py, pz, BlockType.RAIL_EW);
            } else {
              setBlockW(px, py, pz, BlockType.RAIL);
            }
          } else {
            // Place as RAIL first, then compute correct type with neighbors
            setBlockW(px, py, pz, BlockType.RAIL);
            const correctType = computeRailBlockType(getBlockW, px, py, pz);
            if (correctType !== BlockType.RAIL) {
              setBlockW(px, py, pz, correctType);
            }
          }
          // Update neighboring rails at same level
          const neighbors: [number, number, number][] = [
            [px, py, pz - 1], [px, py, pz + 1],
            [px + 1, py, pz], [px - 1, py, pz],
          ];
          for (const [nx, ny, nz] of neighbors) {
            if (isFlat(getBlockW(nx, ny, nz)) && getBlockW(nx, ny, nz) !== BlockType.POWERED_RAIL) {
              if (shouldRailUpdate(getBlockW, nx, ny, nz)) {
                const newType = computeRailBlockType(getBlockW, nx, ny, nz);
                if (newType !== getBlockW(nx, ny, nz)) {
                  setBlockW(nx, ny, nz, newType);
                }
              }
            }
          }
          // Update rails one level above/below for slope connections
          const verticalNeighbors: [number, number, number][] = [
            [px, py + 1, pz - 1], [px, py + 1, pz + 1],
            [px + 1, py + 1, pz], [px - 1, py + 1, pz],
            [px, py - 1, pz - 1], [px, py - 1, pz + 1],
            [px + 1, py - 1, pz], [px - 1, py - 1, pz],
          ];
          for (const [nx, ny, nz] of verticalNeighbors) {
            if (isFlat(getBlockW(nx, ny, nz)) && getBlockW(nx, ny, nz) !== BlockType.POWERED_RAIL) {
              const newType = computeRailBlockType(getBlockW, nx, ny, nz);
              if (newType !== getBlockW(nx, ny, nz)) {
                setBlockW(nx, ny, nz, newType);
              }
            }
          }
          removeBlock(selectedIdx, 1);
          soundManager.playPlaceSound();
          return;
        }
        setBlockW(px, py, pz, selectedBlock);
        // Chest placement: register empty chest
        if (selectedBlock === BlockType.CHEST) {
          useChestStore.getState().createChest(px, py, pz);
        }
        removeBlock(selectedIdx, 1);
        soundManager.playPlaceSound();
      }
    }
  }, [mode, raycast, getSelectedBlock, getBlockW, setBlockW, removeBlock, selectedIdx]);

  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    miningTimeRef.current = 0;
    miningBlockRef.current = null;
    setMiningProgress(0);
  }, []);

  // Expose pointer control for mobile
  (window as any).__digyPointer = {
    startDig: () => { isPointerDownRef.current = true; },
    stopDig: () => {
      isPointerDownRef.current = false;
      miningTimeRef.current = 0;
      miningBlockRef.current = null;
      setMiningProgress(0);
    },
  };

  return (
    <>
      {/* Highlight cube */}
      <mesh ref={highlightRef} visible={false}>
        <boxGeometry args={[1.02, 1.02, 1.02]} />
        <meshBasicMaterial
          color={mode === 'mine' ? '#ff4444' : mode === 'adventure' ? '#4488ff' : '#44ff88'}
          wireframe={false}
          transparent
          opacity={0.25}
          depthTest={true}
        />
      </mesh>

      {/* Invisible interaction plane */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        position={[0, 15, 0]}
        visible={false}
      >
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} visible={false} />
      </mesh>

      {/* Mining progress indicator */}
      {miningProgress > 0 && highlightRef.current?.visible && (
        <mesh position={highlightRef.current.position.clone().add(new THREE.Vector3(0, 0.7, 0))}>
          <planeGeometry args={[miningProgress, 0.1]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      )}
    </>
  );
}
