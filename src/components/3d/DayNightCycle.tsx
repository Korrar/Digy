import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DayNightCycleProps {
  /** Full cycle duration in seconds (default 120 = 2 minutes) */
  cycleDuration?: number;
  /** Callback with current sun intensity (0-1) to update sky color */
  onTimeChange?: (timeOfDay: number, sunIntensity: number) => void;
}

const DAY_AMBIENT = 0.6;
const NIGHT_AMBIENT = 0.12;
const DAY_DIRECTIONAL = 0.8;
const NIGHT_DIRECTIONAL = 0.05;

const sunColorDay = new THREE.Color(0xffffff);
const sunColorSunset = new THREE.Color(0xff8844);
const sunColorNight = new THREE.Color(0x223366);

export function DayNightCycle({ cycleDuration = 120, onTimeChange }: DayNightCycleProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const timeRef = useRef(0.15); // Start at morning

  useFrame((_, delta) => {
    timeRef.current = (timeRef.current + delta / cycleDuration) % 1;
    const t = timeRef.current;

    // t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    // Sun angle follows a sine curve
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.sin(sunAngle - Math.PI / 2); // -1 at midnight, 1 at noon
    const sunX = Math.cos(sunAngle - Math.PI / 2) * 30;
    const sunHeight = sunY * 40 + 5;

    // Sun intensity based on height
    const sunIntensity = Math.max(0, sunY);
    const ambientIntensity = THREE.MathUtils.lerp(NIGHT_AMBIENT, DAY_AMBIENT, Math.max(0, sunY * 1.5));
    const directionalIntensity = THREE.MathUtils.lerp(NIGHT_DIRECTIONAL, DAY_DIRECTIONAL, sunIntensity);

    // Sun color - warm at sunrise/sunset, white at noon, blue at night
    const sunColor = new THREE.Color();
    if (sunY > 0.3) {
      sunColor.copy(sunColorDay);
    } else if (sunY > 0) {
      sunColor.lerpColors(sunColorSunset, sunColorDay, sunY / 0.3);
    } else {
      sunColor.lerpColors(sunColorNight, sunColorSunset, Math.max(0, (sunY + 0.3) / 0.3));
    }

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, Math.max(5, sunHeight), 20);
      dirLightRef.current.intensity = directionalIntensity;
      dirLightRef.current.color.copy(sunColor);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = ambientIntensity;
      // Tint ambient blue at night
      if (sunY < 0) {
        ambientRef.current.color.setHex(0x4466aa);
      } else if (sunY < 0.2) {
        ambientRef.current.color.lerpColors(
          new THREE.Color(0x4466aa),
          new THREE.Color(0xffffff),
          sunY / 0.2
        );
      } else {
        ambientRef.current.color.setHex(0xffffff);
      }
    }

    onTimeChange?.(t, Math.max(0, sunY));
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={DAY_AMBIENT} />
      <directionalLight
        ref={dirLightRef}
        position={[30, 40, 20]}
        intensity={DAY_DIRECTIONAL}
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
