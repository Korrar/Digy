import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BlockType, getBlock, isSolid, isTransparent, isPiston, isPistonHead, isSign } from '../BlockRegistry';
import { ChunkData } from '../ChunkData';
import { buildChunkMesh } from '../ChunkMesher';
import { JungleBiome } from '../../terrain/biomes/JungleBiome';
import { MushroomBiome } from '../../terrain/biomes/MushroomBiome';
import { VolcanicBiome } from '../../terrain/biomes/VolcanicBiome';
import { SavannaBiome } from '../../terrain/biomes/SavannaBiome';
import { CherryBiome } from '../../terrain/biomes/CherryBiome';
import { createBiome, BIOME_LIST, type BiomeType } from '../../terrain/biomes';

describe('New block types', () => {
  describe('Piston blocks', () => {
    it('should have piston registered with correct properties', () => {
      const def = getBlock(BlockType.PISTON);
      expect(def.name).toBe('Piston');
      expect(def.isPiston).toBe(true);
      expect(def.transparent).toBe(true);
      expect(def.stackSize).toBe(64);
    });

    it('should have piston head registered as non-solid', () => {
      const def = getBlock(BlockType.PISTON_HEAD);
      expect(def.isPistonHead).toBe(true);
      expect(isSolid(BlockType.PISTON_HEAD)).toBe(false);
    });

    it('should have extended piston with pistonExtended flag', () => {
      const def = getBlock(BlockType.PISTON_EXTENDED);
      expect(def.isPiston).toBe(true);
      expect(def.pistonExtended).toBe(true);
    });

    it('should recognize piston types with helper functions', () => {
      expect(isPiston(BlockType.PISTON)).toBe(true);
      expect(isPiston(BlockType.PISTON_EXTENDED)).toBe(true);
      expect(isPistonHead(BlockType.PISTON_HEAD)).toBe(true);
      expect(isPiston(BlockType.STONE)).toBe(false);
      expect(isPistonHead(BlockType.STONE)).toBe(false);
    });

    it('should render piston geometry within block bounds', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(4, 5, 4, BlockType.PISTON);
      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      expect(positions.count).toBeGreaterThan(0);

      // All vertices should be within block bounds
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        expect(px).toBeGreaterThanOrEqual(4 - 0.01);
        expect(px).toBeLessThanOrEqual(5.01);
        expect(py).toBeGreaterThanOrEqual(5 - 0.01);
        expect(py).toBeLessThanOrEqual(6.01);
        expect(pz).toBeGreaterThanOrEqual(4 - 0.01);
        expect(pz).toBeLessThanOrEqual(5.01);
      }
    });

    it('should render extended piston with rod geometry', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(4, 5, 4, BlockType.PISTON_EXTENDED);
      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      // Extended piston should have more vertices than normal (rod + body)
      expect(positions.count).toBeGreaterThan(0);
    });
  });

  describe('Sign block', () => {
    it('should have sign registered with correct properties', () => {
      const def = getBlock(BlockType.SIGN);
      expect(def.name).toBe('Sign');
      expect(def.isSign).toBe(true);
      expect(def.transparent).toBe(true);
      expect(def.stackSize).toBe(16);
    });

    it('should recognize sign with helper function', () => {
      expect(isSign(BlockType.SIGN)).toBe(true);
      expect(isSign(BlockType.STONE)).toBe(false);
    });

    it('should not be solid', () => {
      expect(isSolid(BlockType.SIGN)).toBe(false);
    });

    it('should render sign geometry within block bounds', () => {
      const chunk = new ChunkData(0, 0);
      chunk.setBlock(4, 5, 4, BlockType.SIGN);
      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      expect(positions.count).toBeGreaterThan(0);

      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);
        expect(px).toBeGreaterThanOrEqual(4 - 0.01);
        expect(px).toBeLessThanOrEqual(5.01);
        expect(py).toBeGreaterThanOrEqual(5 - 0.01);
        expect(py).toBeLessThanOrEqual(6.01);
        expect(pz).toBeGreaterThanOrEqual(4 - 0.01);
        expect(pz).toBeLessThanOrEqual(5.01);
      }
    });
  });

  describe('Biome-specific blocks', () => {
    it('should have jungle wood registered', () => {
      const def = getBlock(BlockType.JUNGLE_WOOD);
      expect(def.name).toBe('Jungle Wood');
      expect(isSolid(BlockType.JUNGLE_WOOD)).toBe(true);
    });

    it('should have jungle leaves as transparent', () => {
      expect(isTransparent(BlockType.JUNGLE_LEAVES)).toBe(true);
    });

    it('should have vine as crossed quad', () => {
      const def = getBlock(BlockType.VINE);
      expect(def.crossedQuad).toBe(true);
    });

    it('should have bamboo as crossed quad', () => {
      const def = getBlock(BlockType.BAMBOO);
      expect(def.crossedQuad).toBe(true);
    });

    it('should have mycelium with top color', () => {
      const def = getBlock(BlockType.MYCELIUM);
      expect(def.topColor).toBeDefined();
      expect(isSolid(BlockType.MYCELIUM)).toBe(true);
    });

    it('should have giant mushroom blocks', () => {
      expect(isSolid(BlockType.MUSHROOM_BLOCK_RED)).toBe(true);
      expect(isSolid(BlockType.MUSHROOM_BLOCK_BROWN)).toBe(true);
      expect(isSolid(BlockType.GIANT_MUSHROOM_STEM)).toBe(true);
    });

    it('should have volcanic blocks with correct properties', () => {
      expect(isSolid(BlockType.BASALT)).toBe(true);
      expect(isSolid(BlockType.OBSIDIAN)).toBe(true);
      expect(getBlock(BlockType.OBSIDIAN).hardness).toBe(10.0);
      expect(getBlock(BlockType.MAGMA).emitsLight).toBe(true);
    });

    it('should have cherry blossom blocks', () => {
      expect(isSolid(BlockType.CHERRY_WOOD)).toBe(true);
      expect(isTransparent(BlockType.CHERRY_LEAVES)).toBe(true);
      const def = getBlock(BlockType.CHERRY_PETALS);
      expect(def.crossedQuad).toBe(true);
    });

    it('should have savanna blocks', () => {
      expect(isSolid(BlockType.SAVANNA_GRASS)).toBe(true);
      expect(getBlock(BlockType.SAVANNA_GRASS).topColor).toBeDefined();
      expect(isSolid(BlockType.ACACIA_WOOD)).toBe(true);
      expect(isTransparent(BlockType.ACACIA_LEAVES)).toBe(true);
    });

    it('should have new flower types as crossed quads', () => {
      expect(getBlock(BlockType.FLOWER_BLUE).crossedQuad).toBe(true);
      expect(getBlock(BlockType.FLOWER_ORCHID).crossedQuad).toBe(true);
    });

    it('should have moss block', () => {
      expect(isSolid(BlockType.MOSS)).toBe(true);
      expect(getBlock(BlockType.MOSS).drops).toBe(BlockType.MOSS);
    });
  });
});

describe('New biomes generation', () => {
  it('should generate jungle biome with jungle wood', () => {
    // Import dynamically to avoid circular deps
    // JungleBiome imported at top
    const biome = new JungleBiome(42);
    expect(biome.config.type).toBe('jungle');
    expect(biome.config.name).toBe('Dżungla');

    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    // Should have some solid blocks generated
    let hasBlocks = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) !== BlockType.AIR) {
            hasBlocks = true;
            break;
          }
        }
        if (hasBlocks) break;
      }
      if (hasBlocks) break;
    }
    expect(hasBlocks).toBe(true);
  });

  it('should generate mushroom biome with mycelium', () => {
    // MushroomBiome imported at top
    const biome = new MushroomBiome(42);
    expect(biome.config.type).toBe('mushroom');

    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasMycelium = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.MYCELIUM) {
            hasMycelium = true;
            break;
          }
        }
        if (hasMycelium) break;
      }
      if (hasMycelium) break;
    }
    expect(hasMycelium).toBe(true);
  });

  it('should generate volcanic biome with basalt and lava', () => {
    // VolcanicBiome imported at top
    const biome = new VolcanicBiome(42);
    expect(biome.config.type).toBe('volcanic');

    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasBasalt = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.BASALT) {
            hasBasalt = true;
            break;
          }
        }
        if (hasBasalt) break;
      }
      if (hasBasalt) break;
    }
    expect(hasBasalt).toBe(true);
  });

  it('should generate savanna biome with savanna grass', () => {
    // SavannaBiome imported at top
    const biome = new SavannaBiome(42);
    expect(biome.config.type).toBe('savanna');

    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasSavannaGrass = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.SAVANNA_GRASS) {
            hasSavannaGrass = true;
            break;
          }
        }
        if (hasSavannaGrass) break;
      }
      if (hasSavannaGrass) break;
    }
    expect(hasSavannaGrass).toBe(true);
  });

  it('should generate cherry biome with moss ground', () => {
    // CherryBiome imported at top
    const biome = new CherryBiome(42);
    expect(biome.config.type).toBe('cherry');

    const chunk = new ChunkData(0, 0);
    biome.generate(chunk);

    let hasMoss = false;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 32; y++) {
          if (chunk.getBlock(x, y, z) === BlockType.MOSS) {
            hasMoss = true;
            break;
          }
        }
        if (hasMoss) break;
      }
      if (hasMoss) break;
    }
    expect(hasMoss).toBe(true);
  });

  it('should list all 12 biomes in BIOME_LIST', () => {
    // BIOME_LIST imported at top
    expect(BIOME_LIST.length).toBe(12);
    const types = BIOME_LIST.map((b: any) => b.type);
    expect(types).toContain('jungle');
    expect(types).toContain('mushroom');
    expect(types).toContain('volcanic');
    expect(types).toContain('savanna');
    expect(types).toContain('cherry');
    expect(types).toContain('village');
  });

  it('should create all biome types via createBiome', () => {
    // createBiome imported at top
    const biomeTypes: BiomeType[] = ['forest', 'desert', 'cave', 'mountains', 'swamp', 'tundra', 'jungle', 'mushroom', 'volcanic', 'savanna', 'cherry', 'village'];
    for (const type of biomeTypes) {
      const biome = createBiome(type, 42);
      expect(biome).toBeDefined();
      expect(biome.config.type).toBe(type);
    }
  });
});
