import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_COUNT = 300;
const SKY_RADIUS = 200;

/** Starry night sky - visible when sun intensity is low */
export function StarrySky({ sunIntensity }: { sunIntensity: number }) {
  const meshRef = useRef<THREE.Points>(null);

  const { geometry } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute stars on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // upper 45 degrees
      const r = SKY_RADIUS;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi); // always above
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Slight color variation (white to blue-white)
      const warmth = Math.random();
      colors[i * 3] = 0.9 + warmth * 0.1;
      colors[i * 3 + 1] = 0.9 + warmth * 0.1;
      colors[i * 3 + 2] = 1.0;

      starSizes[i] = 1.0 + Math.random() * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { geometry: geo };
  }, []);

  // Twinkle animation + visibility based on sun
  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.PointsMaterial;

    // Fade stars: fully visible at night (sunIntensity < 0.1), gone during day
    const visibility = Math.max(0, 1.0 - sunIntensity * 5.0);
    mat.opacity = visibility * 0.9;
    mat.visible = visibility > 0.01;

    // Gentle twinkle
    const t = state.clock.elapsedTime;
    const sizeAttr = geometry.attributes.position;
    if (sizeAttr) {
      mat.size = 2.0 + Math.sin(t * 0.5) * 0.3;
    }

    // Slow rotation (sky rotation)
    meshRef.current.rotation.y = t * 0.003;
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0}
        size={2}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  );
}
