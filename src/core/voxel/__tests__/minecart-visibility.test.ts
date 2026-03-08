import { describe, it, expect } from 'vitest';
import { buildMinecartGeometry } from '../../../components/3d/Minecarts';

describe('Minecart visibility', () => {
  it('should export buildMinecartGeometry for creating visible cart mesh', () => {
    expect(typeof buildMinecartGeometry).toBe('function');
  });

  it('should produce geometry with vertices (not empty)', () => {
    const geo = buildMinecartGeometry();
    expect(geo.attributes.position.count).toBeGreaterThan(0);
  });

  it('should have vertex colors for material rendering', () => {
    const geo = buildMinecartGeometry();
    expect(geo.attributes.color).toBeDefined();
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count);
  });

  it('should have normals for lighting', () => {
    const geo = buildMinecartGeometry();
    expect(geo.attributes.normal).toBeDefined();
    expect(geo.attributes.normal.count).toBe(geo.attributes.position.count);
  });

  it('should have reasonable bounding box (not degenerate)', () => {
    const geo = buildMinecartGeometry();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    // Cart should be roughly 0.7 wide, 0.5 tall, 0.5 deep
    const sizeX = box.max.x - box.min.x;
    const sizeY = box.max.y - box.min.y;
    const sizeZ = box.max.z - box.min.z;
    expect(sizeX).toBeGreaterThan(0.3);
    expect(sizeY).toBeGreaterThan(0.2);
    expect(sizeZ).toBeGreaterThan(0.2);
  });
});
