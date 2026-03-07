import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DayNightCycleProps {
  /** Full cycle duration in seconds */
  cycleDuration?: number;
  /** Base ambient intensity (biome default) */
  baseAmbient?: number;
}

const DAY_COLOR = new THREE.Color(0xfff4e0);
const SUNSET_COLOR = new THREE.Color(0xff8844);
const NIGHT_COLOR = new THREE.Color(0x2233aa);
const MOON_COLOR = new THREE.Color(0x6688cc);

export function DayNightCycle({ cycleDuration = 120, baseAmbient = 0.6 }: DayNightCycleProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // 0..1 representing time of day (0=noon, 0.25=sunset, 0.5=midnight, 0.75=sunrise)
    const phase = (time % cycleDuration) / cycleDuration;
    const angle = phase * Math.PI * 2;

    // Sun position - orbits around
    const sunX = Math.cos(angle) * 40;
    const sunY = Math.sin(angle) * 40;
    const sunZ = 20;

    if (sunRef.current) {
      sunRef.current.position.set(sunX, sunY, sunZ);

      // Sun intensity based on height (0 when below horizon)
      const heightFactor = Math.max(0, Math.sin(angle));
      const sunIntensity = heightFactor * 0.9;
      sunRef.current.intensity = sunIntensity;

      // Sun color shifts
      const tmp = new THREE.Color();
      if (heightFactor > 0.3) {
        tmp.copy(DAY_COLOR);
      } else if (heightFactor > 0) {
        tmp.copy(SUNSET_COLOR).lerp(DAY_COLOR, heightFactor / 0.3);
      } else {
        tmp.copy(MOON_COLOR);
      }
      sunRef.current.color.copy(tmp);
    }

    if (ambientRef.current) {
      // Ambient follows day/night
      const heightFactor = Math.sin(angle);
      if (heightFactor > 0) {
        // Day
        const dayAmbient = baseAmbient * (0.5 + 0.5 * heightFactor);
        ambientRef.current.intensity = dayAmbient;
        ambientRef.current.color.lerpColors(SUNSET_COLOR, DAY_COLOR, Math.min(heightFactor * 3, 1));
      } else {
        // Night
        const nightAmbient = baseAmbient * 0.2;
        ambientRef.current.intensity = nightAmbient;
        ambientRef.current.color.copy(NIGHT_COLOR);
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={baseAmbient} />
      <directionalLight
        ref={sunRef}
        position={[30, 40, 20]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
    </>
  );
}
