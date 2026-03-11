import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkData } from '../ChunkData';
import { BlockType, getBlock } from '../BlockRegistry';
import { generateDungeon } from '../../terrain/DungeonGenerator';

describe('DungeonGenerator', () => {
  let chunk: ChunkData;

  beforeEach(() => {
    chunk = new ChunkData(0, 0);
    // Fill chunk with stone (underground)
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 20; y++) {
          chunk.setBlock(x, y, z, BlockType.STONE);
        }
      }
    }
  });

  describe('generateDungeon layout', () => {
    it('should generate at least one room', () => {
      const layout = generateDungeon(chunk, 42);
      expect(layout.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate rooms within chunk bounds', () => {
      const layout = generateDungeon(chunk, 42);
      for (const room of layout.rooms) {
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.z).toBeGreaterThanOrEqual(0);
        expect(room.x + room.width).toBeLessThanOrEqual(16);
        expect(room.z + room.depth).toBeLessThanOrEqual(16);
        expect(room.y).toBeGreaterThanOrEqual(1);
        expect(room.y + room.height).toBeLessThan(20);
      }
    });

    it('should create corridors connecting rooms', () => {
      const layout = generateDungeon(chunk, 42);
      if (layout.rooms.length >= 2) {
        expect(layout.corridors.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should carve air spaces in rooms', () => {
      const layout = generateDungeon(chunk, 42);
      const room = layout.rooms[0];
      // Inside the room should be air
      const cx = room.x + Math.floor(room.width / 2);
      const cz = room.z + Math.floor(room.depth / 2);
      const cy = room.y + 1; // one block above floor
      expect(chunk.getBlock(cx, cy, cz)).toBe(BlockType.AIR);
    });

    it('should place floor blocks in rooms', () => {
      const layout = generateDungeon(chunk, 42);
      const room = layout.rooms[0];
      const floorBlock = chunk.getBlock(room.x + 1, room.y, room.z + 1);
      // Floor should be mossy stone bricks or cracked stone bricks
      expect([
        BlockType.MOSSY_STONE_BRICKS,
        BlockType.CRACKED_STONE_BRICKS,
        BlockType.STONE_BRICKS,
      ]).toContain(floorBlock);
    });

    it('should use dungeon-specific wall blocks', () => {
      const layout = generateDungeon(chunk, 42);
      const room = layout.rooms[0];
      // Walls should be stone_bricks, mossy_stone_bricks, or cracked_stone_bricks
      const wallBlock = chunk.getBlock(room.x, room.y + 1, room.z);
      expect([
        BlockType.MOSSY_STONE_BRICKS,
        BlockType.CRACKED_STONE_BRICKS,
        BlockType.STONE_BRICKS,
      ]).toContain(wallBlock);
    });
  });

  describe('dungeon loot', () => {
    it('should place chest in boss room', () => {
      const layout = generateDungeon(chunk, 42);
      const bossRoom = layout.rooms.find(r => r.isBossRoom);
      if (bossRoom) {
        let hasChest = false;
        for (let x = bossRoom.x; x < bossRoom.x + bossRoom.width; x++) {
          for (let z = bossRoom.z; z < bossRoom.z + bossRoom.depth; z++) {
            if (chunk.getBlock(x, bossRoom.y + 1, z) === BlockType.CHEST) {
              hasChest = true;
            }
          }
        }
        expect(hasChest).toBe(true);
      }
    });

    it('should place torches in rooms for lighting', () => {
      const layout = generateDungeon(chunk, 42);
      let hasTorch = false;
      for (const room of layout.rooms) {
        for (let x = room.x; x < room.x + room.width; x++) {
          for (let z = room.z; z < room.z + room.depth; z++) {
            for (let y = room.y; y < room.y + room.height; y++) {
              if (chunk.getBlock(x, y, z) === BlockType.TORCH) {
                hasTorch = true;
              }
            }
          }
        }
      }
      expect(hasTorch).toBe(true);
    });
  });

  describe('dungeon traps', () => {
    it('should place spike traps in some rooms', () => {
      // Test multiple seeds to find one with spikes
      let foundSpikes = false;
      for (let seed = 0; seed < 20; seed++) {
        const testChunk = new ChunkData(0, 0);
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y < 20; y++) {
              testChunk.setBlock(x, y, z, BlockType.STONE);
            }
          }
        }
        const layout = generateDungeon(testChunk, seed);
        for (const room of layout.rooms) {
          for (let x = room.x; x < room.x + room.width; x++) {
            for (let z = room.z; z < room.z + room.depth; z++) {
              if (testChunk.getBlock(x, room.y + 1, z) === BlockType.SPIKE_TRAP) {
                foundSpikes = true;
              }
            }
          }
        }
        if (foundSpikes) break;
      }
      expect(foundSpikes).toBe(true);
    });

    it('should place arrow traps (dispensers) in corridors or rooms', () => {
      let foundArrowTrap = false;
      for (let seed = 0; seed < 20; seed++) {
        const testChunk = new ChunkData(0, 0);
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y < 20; y++) {
              testChunk.setBlock(x, y, z, BlockType.STONE);
            }
          }
        }
        generateDungeon(testChunk, seed);
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y < 20; y++) {
              if (testChunk.getBlock(x, y, z) === BlockType.ARROW_TRAP) {
                foundArrowTrap = true;
              }
            }
          }
        }
        if (foundArrowTrap) break;
      }
      expect(foundArrowTrap).toBe(true);
    });
  });

  describe('boss room', () => {
    it('should mark one room as boss room', () => {
      const layout = generateDungeon(chunk, 42);
      const bossRooms = layout.rooms.filter(r => r.isBossRoom);
      expect(bossRooms.length).toBe(1);
    });

    it('should place spawner block in boss room', () => {
      const layout = generateDungeon(chunk, 42);
      const bossRoom = layout.rooms.find(r => r.isBossRoom);
      expect(bossRoom).toBeDefined();
      if (bossRoom) {
        let hasSpawner = false;
        for (let x = bossRoom.x; x < bossRoom.x + bossRoom.width; x++) {
          for (let z = bossRoom.z; z < bossRoom.z + bossRoom.depth; z++) {
            for (let y = bossRoom.y; y < bossRoom.y + bossRoom.height; y++) {
              if (chunk.getBlock(x, y, z) === BlockType.SPAWNER) {
                hasSpawner = true;
              }
            }
          }
        }
        expect(hasSpawner).toBe(true);
      }
    });

    it('boss room should be larger than regular rooms', () => {
      const layout = generateDungeon(chunk, 42);
      const bossRoom = layout.rooms.find(r => r.isBossRoom);
      const normalRooms = layout.rooms.filter(r => !r.isBossRoom);
      if (bossRoom && normalRooms.length > 0) {
        const bossArea = bossRoom.width * bossRoom.depth;
        const avgNormalArea = normalRooms.reduce((sum, r) => sum + r.width * r.depth, 0) / normalRooms.length;
        expect(bossArea).toBeGreaterThanOrEqual(avgNormalArea);
      }
    });
  });

  describe('new block types', () => {
    it('MOSSY_STONE_BRICKS should be registered', () => {
      const def = getBlock(BlockType.MOSSY_STONE_BRICKS);
      expect(def.name).toBe('Mossy Stone Bricks');
    });

    it('CRACKED_STONE_BRICKS should be registered', () => {
      const def = getBlock(BlockType.CRACKED_STONE_BRICKS);
      expect(def.name).toBe('Cracked Stone Bricks');
    });

    it('SPAWNER should be registered and emit light', () => {
      const def = getBlock(BlockType.SPAWNER);
      expect(def.name).toBe('Spawner');
      expect(def.emitsLight).toBe(true);
    });

    it('SPIKE_TRAP should be registered', () => {
      const def = getBlock(BlockType.SPIKE_TRAP);
      expect(def.name).toBe('Spike Trap');
    });

    it('ARROW_TRAP should be registered', () => {
      const def = getBlock(BlockType.ARROW_TRAP);
      expect(def.name).toBe('Arrow Trap');
    });
  });

  describe('deterministic generation', () => {
    it('should produce same layout for same seed', () => {
      const chunk1 = new ChunkData(0, 0);
      const chunk2 = new ChunkData(0, 0);
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          for (let y = 0; y < 20; y++) {
            chunk1.setBlock(x, y, z, BlockType.STONE);
            chunk2.setBlock(x, y, z, BlockType.STONE);
          }
        }
      }
      const layout1 = generateDungeon(chunk1, 123);
      const layout2 = generateDungeon(chunk2, 123);
      expect(layout1.rooms.length).toBe(layout2.rooms.length);
      for (let i = 0; i < layout1.rooms.length; i++) {
        expect(layout1.rooms[i].x).toBe(layout2.rooms[i].x);
        expect(layout1.rooms[i].z).toBe(layout2.rooms[i].z);
      }
    });

    it('should produce different layout for different seed', () => {
      const chunk1 = new ChunkData(0, 0);
      const chunk2 = new ChunkData(0, 0);
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          for (let y = 0; y < 20; y++) {
            chunk1.setBlock(x, y, z, BlockType.STONE);
            chunk2.setBlock(x, y, z, BlockType.STONE);
          }
        }
      }
      const layout1 = generateDungeon(chunk1, 100);
      const layout2 = generateDungeon(chunk2, 999);
      // At least something should differ (rooms positions or count)
      const sameCount = layout1.rooms.length === layout2.rooms.length;
      let samePositions = true;
      if (sameCount) {
        for (let i = 0; i < layout1.rooms.length; i++) {
          if (layout1.rooms[i].x !== layout2.rooms[i].x || layout1.rooms[i].z !== layout2.rooms[i].z) {
            samePositions = false;
            break;
          }
        }
      }
      expect(!sameCount || !samePositions).toBe(true);
    });
  });
});
