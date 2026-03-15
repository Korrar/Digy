import { describe, it, expect } from 'vitest';
import { BlockType } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { VillageBiome } from '../../terrain/biomes/VillageBiome';
import { createBiome, BIOME_LIST, type BiomeType } from '../../terrain/biomes';
import { useNPCStore, generateHouseBlueprint } from '../../../stores/npcStore';

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

  it('should generate gravel paths in center', () => {
    const biome = new VillageBiome(42);
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

  it('should have very flat center terrain for building', () => {
    const biome = new VillageBiome(42);
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    // Check center area (4-12 range = center zone)
    const heights: number[] = [];
    for (let x = 5; x < 11; x += 2) {
      for (let z = 5; z < 11; z += 2) {
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
    // Center of village should be very flat (max 2 block difference)
    expect(max - min).toBeLessThanOrEqual(2);
  });

  it('should have trees at edges (forest zone)', () => {
    const biome = new VillageBiome(42);
    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    // Check if there are wood blocks (trees) anywhere in the chunk
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

  it('should clear NPCs', () => {
    const store = useNPCStore.getState();
    store.spawnVillageNPCs(8, 10, 8);
    store.clearNPCs();
    const state = useNPCStore.getState();

    expect(state.npcs.length).toBe(0);
    expect(state.buildProjects.length).toBe(0);
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
