import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getVoxelMaterial } from '../../core/voxel/VoxelShader';

interface WaterPlaneProps {
  waterLevel?: number;
  size?: number;
  position?: [number, number];
  color?: string;
}

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Multiple wave layers for organic look
    float wave1 = sin(pos.x * 0.8 + uTime * 1.2) * cos(pos.z * 0.6 + uTime * 0.8) * 0.15;
    float wave2 = sin(pos.x * 1.5 + pos.z * 1.2 + uTime * 2.0) * 0.08;
    float wave3 = cos(pos.x * 2.5 - uTime * 1.5) * sin(pos.z * 2.0 + uTime * 1.8) * 0.04;
    float wave4 = sin(pos.x * 0.3 + uTime * 0.5) * cos(pos.z * 0.4 + uTime * 0.3) * 0.2;

    pos.y += wave1 + wave2 + wave3 + wave4;
    vWaveHeight = wave1 + wave2 + wave3 + wave4;

    // Compute wave normals via partial derivatives
    float dx = cos(pos.x * 0.8 + uTime * 1.2) * 0.8 * cos(pos.z * 0.6 + uTime * 0.8) * 0.15
             + cos(pos.x * 1.5 + pos.z * 1.2 + uTime * 2.0) * 1.5 * 0.08
             + -sin(pos.x * 2.5 - uTime * 1.5) * 2.5 * sin(pos.z * 2.0 + uTime * 1.8) * 0.04
             + cos(pos.x * 0.3 + uTime * 0.5) * 0.3 * cos(pos.z * 0.4 + uTime * 0.3) * 0.2;

    float dz = sin(pos.x * 0.8 + uTime * 1.2) * (-sin(pos.z * 0.6 + uTime * 0.8)) * 0.6 * 0.15
             + cos(pos.x * 1.5 + pos.z * 1.2 + uTime * 2.0) * 1.2 * 0.08
             + cos(pos.x * 2.5 - uTime * 1.5) * cos(pos.z * 2.0 + uTime * 1.8) * 2.0 * 0.04
             + sin(pos.x * 0.3 + uTime * 0.5) * (-sin(pos.z * 0.4 + uTime * 0.3)) * 0.4 * 0.2;

    vNormal = normalize(vec3(-dx, 1.0, -dz));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = viewMatrix * worldPos;
    vFogDepth = -mvPosition.z;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFogDepth;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // Fresnel effect - edges are more reflective
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    fresnel = mix(0.1, 0.9, fresnel);

    // Sun reflection (specular highlight on water)
    vec3 reflectDir = reflect(-uSunDirection, normal);
    float sunSpec = pow(max(dot(viewDir, reflectDir), 0.0), 256.0) * 2.0;
    float sunGlare = pow(max(dot(viewDir, reflectDir), 0.0), 16.0) * 0.3;

    // Sky reflection approximation
    vec3 skyReflect = reflect(-viewDir, normal);
    float skyGradient = skyReflect.y * 0.5 + 0.5;
    vec3 skyColor = mix(uFogColor, vec3(0.5, 0.7, 1.0), skyGradient);

    // Water depth color variation
    float depthMix = smoothstep(-0.2, 0.2, vWaveHeight);
    vec3 waterBase = mix(uDeepColor, uWaterColor, depthMix);

    // Caustic patterns
    float caustic1 = sin(vWorldPosition.x * 3.0 + uTime * 2.0) *
                     cos(vWorldPosition.z * 3.0 + uTime * 1.5) * 0.5 + 0.5;
    float caustic2 = sin(vWorldPosition.x * 5.0 - uTime * 1.0) *
                     cos(vWorldPosition.z * 4.0 + uTime * 2.5) * 0.5 + 0.5;
    float caustics = caustic1 * caustic2 * 0.12;

    // Diffuse lighting
    float NdotL = max(dot(normal, uSunDirection), 0.0);

    // Combine: blend water color with sky reflection based on fresnel
    vec3 color = mix(waterBase, skyColor, fresnel);
    color += uSunColor * uSunIntensity * NdotL * 0.15;
    color += vec3(caustics) * uSunIntensity;
    color += uSunColor * (sunSpec + sunGlare) * uSunIntensity;

    // Foam at wave peaks
    float foam = smoothstep(0.28, 0.42, vWaveHeight);
    color = mix(color, vec3(0.9, 0.95, 1.0), foam * 0.35);

    // Tone mapping
    color = color / (color + vec3(1.0));

    // Fog
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    color = mix(color, uFogColor, fogFactor);

    // Alpha: more transparent when looking straight down, opaque at edges
    float alpha = mix(0.6, 0.88, fresnel);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function WaterPlane({
  waterLevel = 3.4,
  size = 80,
  position = [8, 8],
  color = '#2a6090',
}: WaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(color) },
        uDeepColor: { value: new THREE.Color(color).multiplyScalar(0.4) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfff4e0) },
        uSunIntensity: { value: 0.9 },
        uFogColor: { value: new THREE.Color(0x87ceeb) },
        uFogNear: { value: 30.0 },
        uFogFar: { value: 80.0 },
      },
    });
  }, [color]);

  useFrame((state) => {
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;

    // Sync with the voxel shader uniforms for consistent lighting
    const voxMat = getVoxelMaterial();
    material.uniforms.uSunDirection.value.copy(voxMat.uniforms.directionalLightDirection.value);
    material.uniforms.uSunColor.value.copy(voxMat.uniforms.directionalLightColor.value);
    material.uniforms.uSunIntensity.value = voxMat.uniforms.directionalLightIntensity.value;
    material.uniforms.uFogColor.value.copy(voxMat.uniforms.fogColor.value);
  });

  return (
    <mesh
      ref={meshRef}
      material={material}
      position={[position[0], waterLevel, position[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[size, size, 128, 128]} />
    </mesh>
  );
}
