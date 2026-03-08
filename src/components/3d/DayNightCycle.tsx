import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDevStore } from '../../stores/devStore';
import { updateVoxelShaderUniforms } from '../../core/voxel/VoxelShader';

interface DayNightCycleProps {
  /** Full cycle duration in seconds (default 120 = 2 minutes) */
  cycleDuration?: number;
  /** Callback with current sun intensity (0-1) to update sky color */
  onTimeChange?: (timeOfDay: number, sunIntensity: number) => void;
}

// Brighter baseline values
const DAY_AMBIENT = 0.65;
const NIGHT_AMBIENT = 0.25; // Brighter night (was 0.12)
const DAY_DIRECTIONAL = 0.85;
const NIGHT_DIRECTIONAL = 0.08;
// Golden hour boost
const GOLDEN_AMBIENT = 0.55;
const GOLDEN_DIRECTIONAL = 0.7;

// Warmer, brighter sunset/sunrise colors
const sunColorDay = new THREE.Color(0xfffaf0); // Slightly warm white
const sunColorGolden = new THREE.Color(0xffcc55); // Bright golden
const sunColorSunrise = new THREE.Color(0xffaa44); // Warm orange-gold
const sunColorNight = new THREE.Color(0x334466); // Slightly brighter blue

// Moon colors
const moonColor = new THREE.Color(0xaabbdd); // Brighter cool blue-white
const moonAmbientColor = new THREE.Color(0x667799); // Blue-ish ambient at night

export function DayNightCycle({ cycleDuration = 120, onTimeChange }: DayNightCycleProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const timeRef = useRef(0.15); // Start at morning

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.1); // Clamp to prevent jumps on frame spikes
    const fixedTime = useDevStore.getState().fixedTimeOfDay;

    let t: number;
    if (fixedTime !== null) {
      t = fixedTime;
      timeRef.current = t;
    } else {
      timeRef.current = (timeRef.current + clampedDelta / cycleDuration) % 1;
      t = timeRef.current;
    }

    // t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.sin(sunAngle - Math.PI / 2); // -1 at midnight, 1 at noon
    const sunX = Math.cos(sunAngle - Math.PI / 2) * 30;
    const sunHeight = sunY * 40 + 5;

    // Detect golden hour: when sun is near horizon (sunY between -0.1 and 0.35)
    const isGoldenHour = sunY > -0.1 && sunY < 0.35;
    // Golden intensity peaks when sun is at ~0.1 (just above horizon)
    const goldenFactor = isGoldenHour
      ? 1.0 - Math.abs(sunY - 0.1) / 0.35
      : 0;

    // Sun intensity
    const rawSunIntensity = Math.max(0, sunY);

    // Ambient - brighter at night, with golden hour boost
    let ambientIntensity: number;
    if (sunY >= 0) {
      ambientIntensity = THREE.MathUtils.lerp(GOLDEN_AMBIENT, DAY_AMBIENT, Math.min(1, sunY * 3));
      // Golden hour boost
      ambientIntensity = THREE.MathUtils.lerp(ambientIntensity, GOLDEN_AMBIENT + 0.1, goldenFactor * 0.5);
    } else {
      // Night - smoothly lerp to brighter night ambient
      ambientIntensity = THREE.MathUtils.lerp(NIGHT_AMBIENT, GOLDEN_AMBIENT, Math.max(0, (sunY + 0.1) / 0.1));
    }

    // Directional light intensity
    let directionalIntensity: number;
    if (sunY >= 0) {
      directionalIntensity = THREE.MathUtils.lerp(GOLDEN_DIRECTIONAL, DAY_DIRECTIONAL, Math.min(1, sunY * 2.5));
    } else {
      directionalIntensity = THREE.MathUtils.lerp(NIGHT_DIRECTIONAL, GOLDEN_DIRECTIONAL, Math.max(0, (sunY + 0.15) / 0.15));
    }

    // Sun color - bright golden at sunrise/sunset, warm white at noon
    const sunColor = new THREE.Color();
    if (sunY > 0.35) {
      // Full day - warm white
      sunColor.copy(sunColorDay);
    } else if (sunY > 0.15) {
      // Transition from golden to day
      const blend = (sunY - 0.15) / 0.2;
      sunColor.lerpColors(sunColorGolden, sunColorDay, blend);
    } else if (sunY > -0.05) {
      // Golden hour / sunrise-sunset - bright warm gold
      const blend = (sunY + 0.05) / 0.2;
      sunColor.lerpColors(sunColorSunrise, sunColorGolden, Math.max(0, blend));
    } else {
      // Below horizon - transition to night
      const blend = Math.max(0, (sunY + 0.3) / 0.25);
      sunColor.lerpColors(sunColorNight, sunColorSunrise, blend);
    }

    // Ambient color - warm golden during golden hour, blue-ish at night
    const ambColor = new THREE.Color();
    if (sunY > 0.3) {
      ambColor.setHex(0xffffff);
    } else if (sunY > 0) {
      // Golden hour: warm amber ambient
      const warmAmbient = new THREE.Color(0xffe8c0);
      ambColor.lerpColors(warmAmbient, new THREE.Color(0xffffff), sunY / 0.3);
      // Extra golden tint
      ambColor.lerp(new THREE.Color(0xffdd88), goldenFactor * 0.4);
    } else if (sunY > -0.15) {
      // Twilight - transition from warm to cool
      const blend = (sunY + 0.15) / 0.15;
      ambColor.lerpColors(moonAmbientColor, new THREE.Color(0xffe8c0), blend);
    } else {
      // Night - cool blue ambient (but brighter than before)
      ambColor.copy(moonAmbientColor);
    }

    // Apply to Three.js lights
    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, Math.max(5, sunHeight), 20);
      dirLightRef.current.intensity = directionalIntensity;
      dirLightRef.current.color.copy(sunColor);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = ambientIntensity;
      ambientRef.current.color.copy(ambColor);
    }

    // Moon light - visible when sun is down
    const moonY = -sunY;
    const moonIntensity = Math.max(0, moonY) * 0.35; // Stronger moonlight (was 0.15)
    const moonX = -sunX;
    const moonHeight = moonY * 30 + 5;

    if (moonLightRef.current) {
      moonLightRef.current.position.set(moonX, Math.max(5, moonHeight), -20);
      moonLightRef.current.intensity = moonIntensity;
      moonLightRef.current.color.copy(moonColor);
    }

    const lightDir = new THREE.Vector3(sunX, Math.max(5, sunHeight), 20).normalize();
    const moonDir = new THREE.Vector3(moonX, Math.max(5, moonHeight), -20).normalize();

    // Report sun intensity for sky color - boost during golden hour
    const reportedIntensity = Math.max(rawSunIntensity, goldenFactor * 0.5);

    updateVoxelShaderUniforms({
      ambientColor: ambColor,
      ambientIntensity,
      lightColor: sunColor,
      lightIntensity: directionalIntensity,
      lightDirection: lightDir,
      moonColor: moonColor,
      moonIntensity: moonIntensity,
      moonDirection: moonDir,
      time: state.clock.elapsedTime,
    });

    onTimeChange?.(t, reportedIntensity);
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
      {/* Moon directional light for brighter nights */}
      <directionalLight
        ref={moonLightRef}
        position={[-30, 30, -20]}
        intensity={0}
        color={moonColor}
      />
    </>
  );
}
