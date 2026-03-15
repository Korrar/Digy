import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { VillageBiome } from '../../terrain/biomes/VillageBiome';
import { createBiome, BIOME_LIST, type BiomeType } from '../../terrain/biomes';
import { useNPCStore, generateHouseBlueprint, generateBridgeBlueprint } from '../../../stores/npcStore';

describe('Village biome', () => {
  it('should have correct config', () => {
    const biome = new VillageBiome(42);
    expect(biome.config.type).toBe('village');
    expect(biome.config.name).toBe('Wioska');
    expect(biome.config.skyColor).toBe('#90c8f0');
  });

  it('should be creatable via createBiome factory', () => {
    const biome = createBiome('village', 42);
    expect(biome).toBeDefined();
    expect(biome.config.type).toBe('village');
  });

  it('should be listed in BIOME_LIST', () => {
    const village = BIOME_LIST.find((b) => b.type === 'village');
    expect(village).toBeDefined();
    expect(village!.name).toBe('Wioska');
  });

  it('should generate terrain with grass blocks', () => {
    const biome = new VillageBiome(42);
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasGrass = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.GRASS) {
            hasGrass = true;
            break;
          }
        }
        if (hasGrass) break;
      }
      if (hasGrass) break;
    }
    expect(hasGrass).toBe(true);
  });

  it('should generate gravel paths in center chunk', () => {
    const biome = new VillageBiome(42);
    // Center chunk (0,0) covers world x=0..15, z=0..15 - near village center at (8,8)
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasGravel = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.GRAVEL) {
            hasGravel = true;
            break;
          }
        }
        if (hasGravel) break;
      }
      if (hasGravel) break;
    }
    expect(hasGravel).toBe(true);
  });

  it('should have flat center terrain for building', () => {
    const biome = new VillageBiome(42);
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    // Center chunk is the village center - should be flat
    const heights: number[] = [];
    for (let x = 2; x < 14; x += 3) {
      for (let z = 2; z < 14; z += 3) {
        for (let y = 31; y >= 0; y--) {
          const bt = chunk.getBlock(x, y, z);
          if (bt !== BlockType.AIR && bt !== BlockType.WATER && bt !== BlockType.TALL_GRASS &&
              bt !== BlockType.FLOWER_RED && bt !== BlockType.FLOWER_YELLOW &&
              bt !== BlockType.FERN && bt !== BlockType.MUSHROOM &&
              bt !== BlockType.WOOD && bt !== BlockType.LEAVES) {
            heights.push(y);
            break;
          }
        }
      }
    }
    expect(heights.length).toBeGreaterThan(0);
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    // Center of village should be relatively flat (max 3 block difference)
    expect(max - min).toBeLessThanOrEqual(3);
  });

  it('should have a river with water blocks', () => {
    const biome = new VillageBiome(42);
    // Generate multiple chunks to find the river
    let hasRiverWater = false;
    for (let cx = -1; cx <= 1 && !hasRiverWater; cx++) {
      for (let cz = -1; cz <= 1 && !hasRiverWater; cz++) {
        const chunk = new ChunkData(cx, cz);
        biome.generate(chunk);
        for (let x = 0; x < 16 && !hasRiverWater; x++) {
          for (let z = 0; z < 16 && !hasRiverWater; z++) {
            // River water is at WATER_LEVEL (y=3) with sand below
            if (chunk.getBlock(x, 3, z) === BlockType.WATER &&
                chunk.getBlock(x, 2, z) === BlockType.SAND) {
              hasRiverWater = true;
            }
          }
        }
      }
    }
    expect(hasRiverWater).toBe(true);
  });

  it('should have trees at edge chunks (forest zone)', () => {
    const biome = new VillageBiome(42);
    // Chunk (1, 1) covers world x=16..31, z=16..31 - transition/forest zone
    const chunk = new ChunkData(1, 1);
    biome.generate(chunk);

    let hasWood = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.WOOD) {
            hasWood = true;
            break;
          }
        }
        if (hasWood) break;
      }
      if (hasWood) break;
    }
    expect(hasWood).toBe(true);
  });

  it('should not use island mask (no ocean surrounding)', () => {
    const biome = new VillageBiome(42);
    // Center chunk should have solid terrain everywhere (not surrounded by water)
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let solidCount = 0;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 31; y >= 0; y--) {
          const bt = chunk.getBlock(x, y, z);
          if (bt === BlockType.GRASS || bt === BlockType.DIRT || bt === BlockType.STONE ||
              bt === BlockType.SAND || bt === BlockType.GRAVEL) {
            solidCount++;
            break;
          }
        }
      }
    }
    // Most of center chunk should have solid terrain (not ocean)
    expect(solidCount).toBeGreaterThan(200);
  });

  it('should include all biome types in createBiome', () => {
    const biomeTypes: BiomeType[] = [
      'forest', 'desert', 'cave', 'mountains', 'swamp', 'tundra',
      'jungle', 'mushroom', 'volcanic', 'savanna', 'cherry', 'village',
    ];
    for (const type of biomeTypes) {
      const biome = createBiome(type, 42);
      expect(biome).toBeDefined();
      expect(biome.config.type).toBe(type);
    }
  });
});

describe('NPC Store', () => {
  it('should spawn village NPCs with physics fields', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const state = useNPCStore.getState();

    expect(state.npcs.length).toBe(6);
    const roles = state.npcs.map((n) => n.role);
    expect(roles).toContain('lumberjack');
    expect(roles).toContain('miner');
    expect(roles).toContain('builder');
    expect(roles).toContain('farmer');

    // Check physics fields exist
    for (const npc of state.npcs) {
      expect(npc.velocity).toEqual([0, 0, 0]);
      expect(npc.grounded).toBe(false);
    }

    state.clearNPCs();
  });

  it('should spawn build projects', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const state = useNPCStore.getState();

    expect(state.buildProjects.length).toBe(4);
    expect(state.buildProjects[0].completed).toBe(false);
    expect(state.buildProjects[0].placedCount).toBe(0);
    expect(state.buildProjects[0].blocks.length).toBeGreaterThan(0);

    state.clearNPCs();
  });

  it('should clear NPCs and saplings', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    store.addSapling(5, 11, 5, 100);
    store.clearNPCs();
    const state = useNPCStore.getState();

    expect(state.npcs.length).toBe(0);
    expect(state.buildProjects.length).toBe(0);
    expect(state.saplings.length).toBe(0);
  });

  it('should update NPC state', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const npc = useNPCStore.getState().npcs[0];

    store.updateNPC(npc.id, { state: 'gathering' });
    const updated = useNPCStore.getState().npcs.find((n) => n.id === npc.id);
    expect(updated!.state).toBe('gathering');

    store.clearNPCs();
  });

  it('should track build project completion', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const project = useNPCStore.getState().buildProjects[0];

    store.completeBuildBlock(project.id);
    const updated = useNPCStore.getState().buildProjects.find((p) => p.id === project.id);
    expect(updated!.placedCount).toBe(1);

    store.clearNPCs();
  });

  it('should initialize NPCs near center position', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const state = useNPCStore.getState();

    for (const npc of state.npcs) {
      const [x, , z] = npc.position;
      expect(Math.abs(x - 8)).toBeLessThan(10);
      expect(Math.abs(z - 8)).toBeLessThan(10);
    }

    state.clearNPCs();
  });

  it('should apply knockback to NPC', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const npc = useNPCStore.getState().npcs[0];

    store.applyKnockback(npc.id, 3, 5, -2);
    const updated = useNPCStore.getState().npcs.find((n) => n.id === npc.id);
    expect(updated!.velocity[0]).toBe(3);
    expect(updated!.velocity[1]).toBe(5);
    expect(updated!.velocity[2]).toBe(-2);
    expect(updated!.grounded).toBe(false);

    store.clearNPCs();
  });
});

describe('House Blueprint', () => {
  it('should generate blueprint with floor, walls, and roof', () => {
    const project = generateHouseBlueprint(0, 0, 0, 0);

    expect(project.blocks.length).toBeGreaterThan(20);
    expect(project.completed).toBe(false);
    expect(project.placedCount).toBe(0);

    const types = new Set(project.blocks.map((b) => b.type));
    expect(types.has(BlockType.PLANKS)).toBe(true);
    expect(types.has(BlockType.GLASS)).toBe(true);
    expect(types.has(BlockType.WOOD)).toBe(true);
    expect(types.has(BlockType.TORCH)).toBe(true);
  });

  it('should create different sized houses for different variants', () => {
    const house0 = generateHouseBlueprint(0, 0, 0, 0);
    const house1 = generateHouseBlueprint(0, 0, 0, 1);

    expect(house0.blocks.length).not.toBe(house1.blocks.length);
  });
});

describe('Bridge Blueprint', () => {
  it('should generate bridge with planks deck and wood railings', () => {
    const bridge = generateBridgeBlueprint(5, 10, 4, 8, 0);

    expect(bridge.blocks.length).toBeGreaterThan(0);
    expect(bridge.completed).toBe(false);
    expect(bridge.placedCount).toBe(0);
    expect(bridge.id).toContain('bridge_');

    const types = new Set(bridge.blocks.map((b) => b.type));
    expect(types.has(BlockType.PLANKS)).toBe(true);
    expect(types.has(BlockType.WOOD)).toBe(true);
  });

  it('should span the correct X range', () => {
    const bridge = generateBridgeBlueprint(5, 10, 4, 8, 0);
    const xs = bridge.blocks.map((b) => b.x);
    expect(Math.min(...xs)).toBe(4);  // startX - 1
    expect(Math.max(...xs)).toBe(11); // endX + 1
  });
});

describe('Sapling Tracking', () => {
  it('should add and remove saplings', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);

    store.addSapling(5, 11, 5, 100);
    store.addSapling(10, 11, 10, 105);
    expect(useNPCStore.getState().saplings.length).toBe(2);

    store.removeSapling(5, 11, 5);
    expect(useNPCStore.getState().saplings.length).toBe(1);
    expect(useNPCStore.getState().saplings[0].x).toBe(10);

    store.clearNPCs();
  });

  it('should track planted time', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);

    store.addSapling(5, 11, 5, 42.5);
    const sapling = useNPCStore.getState().saplings[0];
    expect(sapling.plantedAt).toBe(42.5);
    expect(sapling.x).toBe(5);
    expect(sapling.y).toBe(11);
    expect(sapling.z).toBe(5);

    store.clearNPCs();
  });

  it('should support new NPC states', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    const npc = useNPCStore.getState().npcs[0];

    store.updateNPC(npc.id, { state: 'planting' });
    expect(useNPCStore.getState().npcs.find((n) => n.id === npc.id)!.state).toBe('planting');

    store.updateNPC(npc.id, { state: 'farming' });
    expect(useNPCStore.getState().npcs.find((n) => n.id === npc.id)!.state).toBe('farming');

    store.clearNPCs();
  });
});
