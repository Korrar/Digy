import { describe, it, expect } from 'vitest';
import { BlockType, getBlock } from '../BlockRegistry';
import { buildTNTGeometry } from '../../../components/3d/TNTEntities';

describe('TNT block registration', () => {
  it('should have TNT defined in BlockType enum', () => {
    expect(BlockType.TNT).toBeDefined();
  });

  it('should have isTNT flag set', () => {
    const def = getBlock(BlockType.TNT);
    expect(def.isTNT).toBe(true);
  });

  it('should have correct name', () => {
    const def = getBlock(BlockType.TNT);
    expect(def.name).toBe('TNT');
  });

  it('should have zero hardness (instant break)', () => {
    const def = getBlock(BlockType.TNT);
    expect(def.hardness).toBe(0);
  });

  it('should drop itself', () => {
    const def = getBlock(BlockType.TNT);
    expect(def.drops).toBe(BlockType.TNT);
  });

  it('should have red color', () => {
    const def = getBlock(BlockType.TNT);
    expect(def.color.r).toBeGreaterThan(0.5);
  });
});

describe('TNT entity geometry', () => {
  it('should build valid BufferGeometry with position, normal, color attributes', () => {
    const geo = buildTNTGeometry();
    expect(geo).toBeDefined();
    expect(geo.attributes.position).toBeDefined();
    expect(geo.attributes.normal).toBeDefined();
    expect(geo.attributes.color).toBeDefined();
    expect(geo.index).not.toBeNull();
  });

  it('should have non-zero vertex count', () => {
    const geo = buildTNTGeometry();
    const posCount = geo.attributes.position.count;
    expect(posCount).toBeGreaterThan(0);
  });

  it('should have matching attribute counts', () => {
    const geo = buildTNTGeometry();
    const posCount = geo.attributes.position.count;
    const normCount = geo.attributes.normal.count;
    const colCount = geo.attributes.color.count;
    expect(posCount).toBe(normCount);
    expect(posCount).toBe(colCount);
  });

  it('should have geometry fitting within block bounds (±0.6)', () => {
    const geo = buildTNTGeometry();
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(pos.getX(i));
      const y = Math.abs(pos.getY(i));
      const z = Math.abs(pos.getZ(i));
      expect(x).toBeLessThanOrEqual(0.6);
      expect(y).toBeLessThanOrEqual(0.6);
      expect(z).toBeLessThanOrEqual(0.6);
    }
  });

  it('should have computed bounding sphere', () => {
    const geo = buildTNTGeometry();
    expect(geo.boundingSphere).not.toBeNull();
    expect(geo.boundingSphere!.radius).toBeGreaterThan(0);
  });

  it('should include body, bands, and top parts (multiple geometries merged)', () => {
    const geo = buildTNTGeometry();
    // A single box has 24 verts; we have body + 2 bands + top cylinder = at least 4 parts
    expect(geo.attributes.position.count).toBeGreaterThan(24 * 3);
  });

  it('should have valid index buffer', () => {
    const geo = buildTNTGeometry();
    const idx = geo.index!;
    const posCount = geo.attributes.position.count;
    expect(idx.count).toBeGreaterThan(0);
    // All indices should be within bounds
    for (let i = 0; i < idx.count; i++) {
      expect(idx.getX(i)).toBeGreaterThanOrEqual(0);
      expect(idx.getX(i)).toBeLessThan(posCount);
    }
  });
});
