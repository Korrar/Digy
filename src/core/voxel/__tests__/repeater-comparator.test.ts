import { describe, it, expect } from 'vitest';
import { BlockType, getBlock, isSolid, isRepeater, isRepeaterItem, isComparator, isComparatorItem, getOrientedRepeater, getOrientedComparator } from '../BlockRegistry';

describe('Repeater block registration', () => {
  it('should have REPEATER inventory item defined', () => {
    expect(BlockType.REPEATER).toBeDefined();
  });

  it('should have correct name for inventory item', () => {
    const def = getBlock(BlockType.REPEATER);
    expect(def.name).toBe('Repeater');
  });

  it('should be an item (non-placeable directly)', () => {
    const def = getBlock(BlockType.REPEATER);
    expect(def.isItem).toBe(true);
  });

  it('should have repeater icon', () => {
    const def = getBlock(BlockType.REPEATER);
    expect(def.icon).toBe('repeater');
  });
});

describe('Repeater placed blocks (4 directions)', () => {
  const directions: { type: BlockType; dir: 'n' | 's' | 'e' | 'w' }[] = [
    { type: BlockType.REPEATER_N, dir: 'n' },
    { type: BlockType.REPEATER_S, dir: 's' },
    { type: BlockType.REPEATER_E, dir: 'e' },
    { type: BlockType.REPEATER_W, dir: 'w' },
  ];

  for (const { type, dir } of directions) {
    it(`should have REPEATER_${dir.toUpperCase()} defined with correct direction`, () => {
      expect(type).toBeDefined();
      const def = getBlock(type);
      expect(def.isRepeater).toBe(true);
      expect(def.repeaterDir).toBe(dir);
      expect(def.repeaterOn).toBeUndefined();
    });

    it(`should be transparent and not solid for direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.transparent).toBe(true);
      expect(isSolid(type)).toBe(false);
    });

    it(`should drop REPEATER inventory item for direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.drops).toBe(BlockType.REPEATER);
    });
  }
});

describe('Repeater ON states', () => {
  const onDirections: { type: BlockType; dir: 'n' | 's' | 'e' | 'w' }[] = [
    { type: BlockType.REPEATER_N_ON, dir: 'n' },
    { type: BlockType.REPEATER_S_ON, dir: 's' },
    { type: BlockType.REPEATER_E_ON, dir: 'e' },
    { type: BlockType.REPEATER_W_ON, dir: 'w' },
  ];

  for (const { type, dir } of onDirections) {
    it(`should have REPEATER_${dir.toUpperCase()}_ON with repeaterOn=true`, () => {
      const def = getBlock(type);
      expect(def.isRepeater).toBe(true);
      expect(def.repeaterDir).toBe(dir);
      expect(def.repeaterOn).toBe(true);
    });

    it(`should drop REPEATER for ON state direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.drops).toBe(BlockType.REPEATER);
    });
  }
});

describe('Repeater helper functions', () => {
  it('isRepeater should return true for all repeater block types', () => {
    expect(isRepeater(BlockType.REPEATER_N)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_S)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_E)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_W)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_N_ON)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_S_ON)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_E_ON)).toBe(true);
    expect(isRepeater(BlockType.REPEATER_W_ON)).toBe(true);
  });

  it('isRepeater should return false for non-repeater blocks', () => {
    expect(isRepeater(BlockType.STONE)).toBe(false);
    expect(isRepeater(BlockType.CABLE)).toBe(false);
    expect(isRepeater(BlockType.LEVER)).toBe(false);
  });

  it('isRepeaterItem should return true only for inventory repeater', () => {
    expect(isRepeaterItem(BlockType.REPEATER)).toBe(true);
    expect(isRepeaterItem(BlockType.REPEATER_N)).toBe(false);
  });

  it('getOrientedRepeater should return correct oriented type', () => {
    expect(getOrientedRepeater('n')).toBe(BlockType.REPEATER_N);
    expect(getOrientedRepeater('s')).toBe(BlockType.REPEATER_S);
    expect(getOrientedRepeater('e')).toBe(BlockType.REPEATER_E);
    expect(getOrientedRepeater('w')).toBe(BlockType.REPEATER_W);
  });
});

describe('Comparator block registration', () => {
  it('should have COMPARATOR inventory item defined', () => {
    expect(BlockType.COMPARATOR).toBeDefined();
  });

  it('should have correct name for inventory item', () => {
    const def = getBlock(BlockType.COMPARATOR);
    expect(def.name).toBe('Comparator');
  });

  it('should be an item (non-placeable directly)', () => {
    const def = getBlock(BlockType.COMPARATOR);
    expect(def.isItem).toBe(true);
  });

  it('should have comparator icon', () => {
    const def = getBlock(BlockType.COMPARATOR);
    expect(def.icon).toBe('comparator');
  });
});

describe('Comparator placed blocks (4 directions)', () => {
  const directions: { type: BlockType; dir: 'n' | 's' | 'e' | 'w' }[] = [
    { type: BlockType.COMPARATOR_N, dir: 'n' },
    { type: BlockType.COMPARATOR_S, dir: 's' },
    { type: BlockType.COMPARATOR_E, dir: 'e' },
    { type: BlockType.COMPARATOR_W, dir: 'w' },
  ];

  for (const { type, dir } of directions) {
    it(`should have COMPARATOR_${dir.toUpperCase()} defined with correct direction`, () => {
      expect(type).toBeDefined();
      const def = getBlock(type);
      expect(def.isComparator).toBe(true);
      expect(def.comparatorDir).toBe(dir);
      expect(def.comparatorOn).toBeUndefined();
    });

    it(`should be transparent and not solid for direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.transparent).toBe(true);
      expect(isSolid(type)).toBe(false);
    });

    it(`should drop COMPARATOR inventory item for direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.drops).toBe(BlockType.COMPARATOR);
    });
  }
});

describe('Comparator ON states', () => {
  const onDirections: { type: BlockType; dir: 'n' | 's' | 'e' | 'w' }[] = [
    { type: BlockType.COMPARATOR_N_ON, dir: 'n' },
    { type: BlockType.COMPARATOR_S_ON, dir: 's' },
    { type: BlockType.COMPARATOR_E_ON, dir: 'e' },
    { type: BlockType.COMPARATOR_W_ON, dir: 'w' },
  ];

  for (const { type, dir } of onDirections) {
    it(`should have COMPARATOR_${dir.toUpperCase()}_ON with comparatorOn=true`, () => {
      const def = getBlock(type);
      expect(def.isComparator).toBe(true);
      expect(def.comparatorDir).toBe(dir);
      expect(def.comparatorOn).toBe(true);
    });

    it(`should drop COMPARATOR for ON state direction ${dir}`, () => {
      const def = getBlock(type);
      expect(def.drops).toBe(BlockType.COMPARATOR);
    });
  }
});

describe('Comparator helper functions', () => {
  it('isComparator should return true for all comparator block types', () => {
    expect(isComparator(BlockType.COMPARATOR_N)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_S)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_E)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_W)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_N_ON)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_S_ON)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_E_ON)).toBe(true);
    expect(isComparator(BlockType.COMPARATOR_W_ON)).toBe(true);
  });

  it('isComparator should return false for non-comparator blocks', () => {
    expect(isComparator(BlockType.STONE)).toBe(false);
    expect(isComparator(BlockType.CABLE)).toBe(false);
    expect(isComparator(BlockType.REPEATER_N)).toBe(false);
  });

  it('isComparatorItem should return true only for inventory comparator', () => {
    expect(isComparatorItem(BlockType.COMPARATOR)).toBe(true);
    expect(isComparatorItem(BlockType.COMPARATOR_N)).toBe(false);
  });

  it('getOrientedComparator should return correct oriented type', () => {
    expect(getOrientedComparator('n')).toBe(BlockType.COMPARATOR_N);
    expect(getOrientedComparator('s')).toBe(BlockType.COMPARATOR_S);
    expect(getOrientedComparator('e')).toBe(BlockType.COMPARATOR_E);
    expect(getOrientedComparator('w')).toBe(BlockType.COMPARATOR_W);
  });
});
