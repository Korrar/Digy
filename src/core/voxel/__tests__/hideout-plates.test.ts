import { describe, it, expect } from 'vitest';
import { PLATE_TEMPLATES, applyPlateTemplate, PLATE_POSITIONS } from '../../hideout/HideoutPlates';
import { BlockType } from '../BlockRegistry';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../utils/constants';

describe('Hideout Decorative Plates', () => {
  describe('PLATE_TEMPLATES registry', () => {
    it('should have at least 6 plate templates', () => {
      expect(PLATE_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    });

    it('should have unique IDs for all templates', () => {
      const ids = PLATE_TEMPLATES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have name and description for every template', () => {
      for (const t of PLATE_TEMPLATES) {
        expect(t.name.length).toBeGreaterThan(0);
        expect(t.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Plate generation', () => {
    for (const template of PLATE_TEMPLATES) {
      describe(`template: ${template.id}`, () => {
        it('should generate valid block data array', () => {
          const data = template.generate();
          expect(data.length).toBeGreaterThan(0);
          expect(data[0].length).toBe(32);
          expect(data[0][0].length).toBe(32);
        });

        it('should have ground layer (stone at y=0, dirt at y=1, surface at y=2)', () => {
          const data = template.generate();
          // Check some ground blocks exist
          let hasStone = false;
          let hasDirt = false;
          let hasSurface = false;
          for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
              if (data[0][z][x] === BlockType.STONE) hasStone = true;
              if (data[1][z][x] === BlockType.DIRT) hasDirt = true;
              if (data[2][z][x] !== BlockType.AIR) hasSurface = true;
            }
          }
          expect(hasStone).toBe(true);
          expect(hasDirt).toBe(true);
          expect(hasSurface).toBe(true);
        });

        it('should not have structures higher than 8 blocks (max y index 7)', () => {
          const data = template.generate();
          // Data should not exceed MAX_HEIGHT (8)
          expect(data.length).toBeLessThanOrEqual(8);
        });

        it('should have some decorative blocks above ground level', () => {
          const data = template.generate();
          let hasDecoration = false;
          for (let y = 3; y < data.length; y++) {
            for (let z = 0; z < 32; z++) {
              for (let x = 0; x < 32; x++) {
                if (data[y][z][x] !== BlockType.AIR) {
                  hasDecoration = true;
                  break;
                }
              }
              if (hasDecoration) break;
            }
            if (hasDecoration) break;
          }
          expect(hasDecoration).toBe(true);
        });
      });
    }
  });

  describe('applyPlateTemplate', () => {
    it('should produce exactly 4 chunks for a 2x2 plate', () => {
      const template = PLATE_TEMPLATES[0];
      const chunks = applyPlateTemplate(template, 0, 0);
      expect(chunks.length).toBe(4);
    });

    it('should place chunks at the correct chunk coordinates', () => {
      const template = PLATE_TEMPLATES[0];
      const originCx = 2;
      const originCz = -2;
      const chunks = applyPlateTemplate(template, originCx, originCz);

      const coords = chunks.map((c) => ({ cx: c.cx, cz: c.cz }));
      expect(coords).toContainEqual({ cx: 2, cz: -2 });
      expect(coords).toContainEqual({ cx: 2, cz: -1 });
      expect(coords).toContainEqual({ cx: 3, cz: -2 });
      expect(coords).toContainEqual({ cx: 3, cz: -1 });
    });

    it('should have non-air blocks in generated chunks', () => {
      const template = PLATE_TEMPLATES[0];
      const chunks = applyPlateTemplate(template, 0, 0);

      let totalNonAir = 0;
      for (const chunk of chunks) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
              if (chunk.getBlock(x, y, z) !== BlockType.AIR) {
                totalNonAir++;
              }
            }
          }
        }
      }
      // At minimum we expect ground layer: 32*32*3 = 3072 blocks
      expect(totalNonAir).toBeGreaterThan(3000);
    });

    it('should correctly map template data to chunk-local coordinates', () => {
      const template = PLATE_TEMPLATES[0];
      const chunks = applyPlateTemplate(template, 0, 0);

      // Chunk at (0,0) should have ground blocks
      const chunk00 = chunks.find((c) => c.cx === 0 && c.cz === 0)!;
      expect(chunk00).toBeDefined();
      expect(chunk00.getBlock(0, 0, 0)).toBe(BlockType.STONE);
      expect(chunk00.getBlock(0, 1, 0)).toBe(BlockType.DIRT);
    });
  });

  describe('PLATE_POSITIONS', () => {
    it('should have 8 positions around the main plate', () => {
      expect(PLATE_POSITIONS.length).toBe(8);
    });

    it('should have all cardinal and diagonal directions', () => {
      const labels = PLATE_POSITIONS.map((p) => p.label);
      expect(labels).toContain('N');
      expect(labels).toContain('S');
      expect(labels).toContain('E');
      expect(labels).toContain('W');
      expect(labels).toContain('NE');
      expect(labels).toContain('NW');
      expect(labels).toContain('SE');
      expect(labels).toContain('SW');
    });

    it('should not overlap with the main platform (chunks 0,0 to 1,1)', () => {
      for (const pos of PLATE_POSITIONS) {
        // Each position is a 2x2 chunk block
        const chunks = [
          { cx: pos.originCx, cz: pos.originCz },
          { cx: pos.originCx + 1, cz: pos.originCz },
          { cx: pos.originCx, cz: pos.originCz + 1 },
          { cx: pos.originCx + 1, cz: pos.originCz + 1 },
        ];
        for (const c of chunks) {
          const isMainPlatform = c.cx >= 0 && c.cx <= 1 && c.cz >= 0 && c.cz <= 1;
          expect(isMainPlatform).toBe(false);
        }
      }
    });
  });
});
