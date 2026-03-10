import { describe, it, expect } from 'vitest';
import { BlockType, isFlat, isRailSlope, getRailSlopeDir, getRailSlopeBlock } from '../BlockRegistry';
import { computeRailBlockType, computeRailShape, getRailConnections, buildChunkMesh } from '../ChunkMesher';
import { ChunkData } from '../ChunkData';
import { CHUNK_SIZE } from '../../../utils/constants';

/** Helper: create a getBlockAt function from a map of positions */
function makeGetBlock(blocks: Map<string, BlockType>) {
  return (x: number, y: number, z: number): BlockType => {
    return blocks.get(`${x},${y},${z}`) ?? BlockType.AIR;
  };
}

describe('Rail Slopes', () => {
  describe('BlockRegistry slope types', () => {
    it('should have 4 slope rail types registered as flat', () => {
      expect(isFlat(BlockType.RAIL_SLOPE_N)).toBe(true);
      expect(isFlat(BlockType.RAIL_SLOPE_S)).toBe(true);
      expect(isFlat(BlockType.RAIL_SLOPE_E)).toBe(true);
      expect(isFlat(BlockType.RAIL_SLOPE_W)).toBe(true);
    });

    it('should identify slope rails correctly', () => {
      expect(isRailSlope(BlockType.RAIL_SLOPE_N)).toBe(true);
      expect(isRailSlope(BlockType.RAIL_SLOPE_S)).toBe(true);
      expect(isRailSlope(BlockType.RAIL_SLOPE_E)).toBe(true);
      expect(isRailSlope(BlockType.RAIL_SLOPE_W)).toBe(true);
      expect(isRailSlope(BlockType.RAIL)).toBe(false);
      expect(isRailSlope(BlockType.RAIL_EW)).toBe(false);
    });

    it('should return correct slope direction', () => {
      expect(getRailSlopeDir(BlockType.RAIL_SLOPE_N)).toBe('n');
      expect(getRailSlopeDir(BlockType.RAIL_SLOPE_S)).toBe('s');
      expect(getRailSlopeDir(BlockType.RAIL_SLOPE_E)).toBe('e');
      expect(getRailSlopeDir(BlockType.RAIL_SLOPE_W)).toBe('w');
      expect(getRailSlopeDir(BlockType.RAIL)).toBe(null);
    });

    it('should get slope block by direction', () => {
      expect(getRailSlopeBlock('n')).toBe(BlockType.RAIL_SLOPE_N);
      expect(getRailSlopeBlock('s')).toBe(BlockType.RAIL_SLOPE_S);
      expect(getRailSlopeBlock('e')).toBe(BlockType.RAIL_SLOPE_E);
      expect(getRailSlopeBlock('w')).toBe(BlockType.RAIL_SLOPE_W);
    });
  });

  describe('getRailConnections for slopes', () => {
    it('should return NS connections for N/S slopes', () => {
      expect(getRailConnections(BlockType.RAIL_SLOPE_N)).toEqual([[0, -1], [0, 1]]);
      expect(getRailConnections(BlockType.RAIL_SLOPE_S)).toEqual([[0, -1], [0, 1]]);
    });

    it('should return EW connections for E/W slopes', () => {
      expect(getRailConnections(BlockType.RAIL_SLOPE_E)).toEqual([[1, 0], [-1, 0]]);
      expect(getRailConnections(BlockType.RAIL_SLOPE_W)).toEqual([[1, 0], [-1, 0]]);
    });
  });

  describe('computeRailShape for slopes', () => {
    it('should return slope shape from stored slope block type', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL_SLOPE_N);
      const get = makeGetBlock(blocks);
      expect(computeRailShape(get, 5, 3, 5)).toBe('slope_n');
    });

    it('should return slope_s for south slope', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL_SLOPE_S);
      const get = makeGetBlock(blocks);
      expect(computeRailShape(get, 5, 3, 5)).toBe('slope_s');
    });

    it('should return slope_e for east slope', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL_SLOPE_E);
      const get = makeGetBlock(blocks);
      expect(computeRailShape(get, 5, 3, 5)).toBe('slope_e');
    });

    it('should return slope_w for west slope', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL_SLOPE_W);
      const get = makeGetBlock(blocks);
      expect(computeRailShape(get, 5, 3, 5)).toBe('slope_w');
    });
  });

  describe('computeRailBlockType slope detection', () => {
    it('should create slope_n when rail has neighbor rail above to the north', () => {
      // Setup: rail at (5,3,5), solid block at (5,3,4), rail at (5,4,4)
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('5,3,4', BlockType.STONE); // solid block to the north at same level
      blocks.set('5,4,4', BlockType.RAIL);  // rail above the solid block
      blocks.set('5,3,6', BlockType.RAIL);  // rail to south (opposite direction)

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL_SLOPE_N);
    });

    it('should create slope_s when rail has neighbor rail above to the south', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('5,3,6', BlockType.STONE);
      blocks.set('5,4,6', BlockType.RAIL);
      blocks.set('5,3,4', BlockType.RAIL);

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL_SLOPE_S);
    });

    it('should create slope_e when rail has neighbor rail above to the east', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('6,3,5', BlockType.STONE);
      blocks.set('6,4,5', BlockType.RAIL);
      blocks.set('4,3,5', BlockType.RAIL);

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL_SLOPE_E);
    });

    it('should create slope_w when rail has neighbor rail above to the west', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('4,3,5', BlockType.STONE);
      blocks.set('4,4,5', BlockType.RAIL);
      blocks.set('6,3,5', BlockType.RAIL);

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL_SLOPE_W);
    });

    it('should NOT create slope when neighbor is air (not solid)', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      // No solid block at (5,3,4), just air
      blocks.set('5,4,4', BlockType.RAIL); // rail floating above

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      // Should be normal rail, not slope
      expect(result).toBe(BlockType.RAIL);
    });

    it('should still create flat rail when no elevation difference', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('5,3,4', BlockType.RAIL); // flat neighbor to north
      blocks.set('5,3,6', BlockType.RAIL); // flat neighbor to south

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL); // Normal NS rail
    });

    it('should create slope even with only one connection (no opposite rail)', () => {
      const blocks = new Map<string, BlockType>();
      blocks.set('5,3,5', BlockType.RAIL);
      blocks.set('5,3,4', BlockType.STONE);
      blocks.set('5,4,4', BlockType.RAIL);
      // No rail to south

      const get = makeGetBlock(blocks);
      const result = computeRailBlockType(get, 5, 3, 5);
      expect(result).toBe(BlockType.RAIL_SLOPE_N);
    });
  });

  describe('Slope rail rendering shape', () => {
    it('should produce slope geometry in chunk mesher', () => {
      const chunk = new ChunkData(0, 0);
      // Place solid ground
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          chunk.setBlock(x, 0, z, BlockType.STONE);
        }
      }
      // Place a slope rail
      chunk.setBlock(5, 1, 5, BlockType.RAIL_SLOPE_N);

      const geometry = buildChunkMesh(chunk);
      const positions = geometry.getAttribute('position');

      // Should have vertices (the slope rail contributes vertices)
      expect(positions.count).toBeGreaterThan(0);

      // Check that some vertices have Y > 1.5 (slope goes up to ~2.14 from base 1)
      let hasElevatedVertex = false;
      for (let i = 0; i < positions.count; i++) {
        if (positions.getY(i) > 1.5) {
          hasElevatedVertex = true;
          break;
        }
      }
      expect(hasElevatedVertex).toBe(true);
    });
  });
});
