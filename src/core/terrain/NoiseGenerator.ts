import { createNoise2D, createNoise3D } from 'simplex-noise';

export class NoiseGenerator {
  private noise2D: ReturnType<typeof createNoise2D>;
  private noise3D: ReturnType<typeof createNoise3D>;
  readonly seed: number;

  constructor(seed: number = Math.random() * 10000) {
    this.seed = seed;
    // Create seeded PRNG
    const prng = this.createSeededRandom(seed);
    this.noise2D = createNoise2D(prng);
    this.noise3D = createNoise3D(prng);
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  get2D(x: number, z: number, scale: number = 1): number {
    return this.noise2D(x * scale, z * scale);
  }

  get3D(x: number, y: number, z: number, scale: number = 1): number {
    return this.noise3D(x * scale, y * scale, z * scale);
  }

  // Fractal Brownian Motion for more natural terrain
  fbm2D(x: number, z: number, octaves: number = 4, lacunarity: number = 2, persistence: number = 0.5, scale: number = 0.02): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}
