import * as THREE from 'three';
import { getAtlasTexture } from './TextureAtlas';

const MAX_POINT_LIGHTS = 16;

const vertexShader = /* glsl */ `
attribute float aSparkle;
attribute vec3 aOreColor;
attribute float aIsWater;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;
varying float vSparkle;
varying vec3 vOreColor;
varying vec2 vUv;
varying float vIsWater;

uniform float uTime;

void main() {
  vColor = color;
  vNormal = normalize(normalMatrix * normal);
  vSparkle = aSparkle;
  vOreColor = aOreColor;
  vUv = uv;
  vIsWater = aIsWater;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);

  // Animated water: vertex displacement waves
  if (aIsWater > 0.5 && normal.y > 0.5) {
    float wave1 = sin(worldPos.x * 2.0 + uTime * 1.5) * 0.04;
    float wave2 = sin(worldPos.z * 2.5 + uTime * 1.8) * 0.03;
    float wave3 = sin((worldPos.x + worldPos.z) * 1.5 + uTime * 1.2) * 0.02;
    worldPos.y += wave1 + wave2 + wave3 - 0.1;
  }

  vWorldPosition = worldPos.xyz;

  vec4 mvPosition = viewMatrix * worldPos;
  vFogDepth = -mvPosition.z;

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 ambientLightColor;
uniform float ambientLightIntensity;
uniform vec3 directionalLightColor;
uniform float directionalLightIntensity;
uniform vec3 directionalLightDirection;
uniform vec3 moonLightColor;
uniform float moonLightIntensity;
uniform vec3 moonLightDirection;
uniform float uTime;
uniform sampler2D uAtlas;

// Point lights (torches, lamps)
uniform vec3 pointLightPositions[${MAX_POINT_LIGHTS}];
uniform vec3 pointLightColors[${MAX_POINT_LIGHTS}];
uniform int pointLightCount;

// Fog
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;
varying float vSparkle;
varying vec3 vOreColor;
varying vec2 vUv;
varying float vIsWater;

// Hash for sparkle
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  // Sample texture atlas
  vec4 texColor = texture2D(uAtlas, vUv);

  // Ambient
  vec3 ambient = ambientLightColor * ambientLightIntensity;

  // Diffuse (directional light - sun)
  float diff = max(dot(vNormal, directionalLightDirection), 0.0);
  vec3 diffuse = directionalLightColor * directionalLightIntensity * diff;

  // Moon light
  float moonDiff = max(dot(vNormal, moonLightDirection), 0.0);
  vec3 moonLight = moonLightColor * moonLightIntensity * moonDiff;

  // Hemisphere-like fill from below (subtle)
  float hemi = dot(vNormal, vec3(0.0, -1.0, 0.0)) * 0.5 + 0.5;
  vec3 hemiFill = vec3(0.06, 0.05, 0.08) * hemi;

  // Point light contributions (torches, lamps)
  vec3 pointLightTotal = vec3(0.0);
  for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
    if (i >= pointLightCount) break;
    vec3 lightPos = pointLightPositions[i];
    vec3 lightCol = pointLightColors[i];
    vec3 toLight = lightPos - vWorldPosition;
    float dist = length(toLight);
    // distance = 12.0 for torches, quadratic falloff with decay=2
    float attenuation = 1.0 / (1.0 + 0.15 * dist + 0.05 * dist * dist);
    // Clamp range: no contribution beyond ~12 blocks
    attenuation *= max(0.0, 1.0 - dist / 14.0);
    float nDotL = max(dot(vNormal, normalize(toLight)), 0.0);
    // Add both diffuse and ambient contribution (so all nearby faces light up)
    float contribution = nDotL * 0.7 + 0.3;
    pointLightTotal += lightCol * attenuation * contribution;
  }

  // Minimum light floor to prevent pitch black
  vec3 totalLight = ambient + diffuse + moonLight + hemiFill + pointLightTotal;
  totalLight = max(totalLight, vec3(0.08, 0.07, 0.12));

  // Multiply texture color by vertex color (AO/brightness) and lighting
  vec3 baseColor = texColor.rgb * vColor;
  vec3 color = baseColor * totalLight;

  // Sparkle effect for ores
  if (vSparkle > 0.0) {
    // Persistent subtle ore sheen (always visible, not animated)
    vec3 sheenPos = floor(vWorldPosition * 6.0) * 0.167;
    float sheenHash = hash(sheenPos);
    float sheen = smoothstep(0.4, 0.8, sheenHash) * 0.15;
    color += vOreColor * sheen * vSparkle;

    // Animated sparkle points per block face
    vec3 sparklePos = floor(vWorldPosition * 4.0) * 0.25;
    float sparkleHash = hash(sparklePos);
    float sparklePhase = sparkleHash * 6.28318 + uTime * 3.0;
    float sparkleBrightness = pow(max(0.0, sin(sparklePhase)), 16.0);
    float sparkleThreshold = step(0.7, sparkleHash);
    // Tint sparkle with ore color (bright white core + colored halo)
    vec3 sparkleColor = mix(vOreColor, vec3(1.0), 0.4);
    color += sparkleColor * sparkleBrightness * vSparkle * sparkleThreshold * 0.8;
  }

  // Animated water: shimmer + flow effect
  if (vIsWater > 0.5) {
    float shimmer = sin(vWorldPosition.x * 3.0 + uTime * 2.0) * sin(vWorldPosition.z * 3.5 + uTime * 1.7) * 0.08;
    color += vec3(shimmer * 0.3, shimmer * 0.5, shimmer);
    // Slight transparency via darker bottom-faces
    float fresnel = abs(dot(vNormal, vec3(0.0, 1.0, 0.0)));
    color *= 0.85 + 0.15 * fresnel;
  }

  // Tone mapping (simple Reinhard)
  color = color / (color + vec3(1.0));

  // Fog
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  color = mix(color, fogColor, fogFactor);

  // Water slight transparency
  float alpha = vIsWater > 0.5 ? 0.8 : 1.0;
  gl_FragColor = vec4(color, alpha);
}
`;

export function createVoxelMaterial(): THREE.ShaderMaterial {
  const pointLightPositions = new Float32Array(MAX_POINT_LIGHTS * 3);
  const pointLightColors = new Float32Array(MAX_POINT_LIGHTS * 3);

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      ambientLightColor: { value: new THREE.Color(0xffffff) },
      ambientLightIntensity: { value: 0.6 },
      directionalLightColor: { value: new THREE.Color(0xffffff) },
      directionalLightIntensity: { value: 0.8 },
      directionalLightDirection: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      moonLightColor: { value: new THREE.Color(0x8899cc) },
      moonLightIntensity: { value: 0.0 },
      moonLightDirection: { value: new THREE.Vector3(-0.5, 0.4, -0.3).normalize() },
      uTime: { value: 0.0 },
      uAtlas: { value: getAtlasTexture() },
      fogColor: { value: new THREE.Color(0x87CEEB) },
      fogNear: { value: 30.0 },
      fogFar: { value: 80.0 },
      pointLightPositions: { value: pointLightPositions },
      pointLightColors: { value: pointLightColors },
      pointLightCount: { value: 0 },
    },
  });
}

// Singleton material instance shared by all chunks
let _material: THREE.ShaderMaterial | null = null;

export function getVoxelMaterial(): THREE.ShaderMaterial {
  if (!_material) {
    _material = createVoxelMaterial();
  }
  return _material;
}

export interface PointLightData {
  position: number[];
  color: number[];
  intensity: number;
  distance: number;
}

export function updateVoxelShaderUniforms(params: {
  ambientColor?: THREE.Color;
  ambientIntensity?: number;
  lightColor?: THREE.Color;
  lightIntensity?: number;
  lightDirection?: THREE.Vector3;
  moonColor?: THREE.Color;
  moonIntensity?: number;
  moonDirection?: THREE.Vector3;
  time?: number;
  fogColor?: THREE.Color;
  fogNear?: number;
  fogFar?: number;
  pointLights?: PointLightData[];
}, mat?: THREE.ShaderMaterial) {
  const m = mat || getVoxelMaterial();
  if (params.ambientColor) m.uniforms.ambientLightColor.value.copy(params.ambientColor);
  if (params.ambientIntensity !== undefined) m.uniforms.ambientLightIntensity.value = params.ambientIntensity;
  if (params.lightColor) m.uniforms.directionalLightColor.value.copy(params.lightColor);
  if (params.lightIntensity !== undefined) m.uniforms.directionalLightIntensity.value = params.lightIntensity;
  if (params.lightDirection) m.uniforms.directionalLightDirection.value.copy(params.lightDirection).normalize();
  if (params.moonColor) m.uniforms.moonLightColor.value.copy(params.moonColor);
  if (params.moonIntensity !== undefined) m.uniforms.moonLightIntensity.value = params.moonIntensity;
  if (params.moonDirection) m.uniforms.moonLightDirection.value.copy(params.moonDirection).normalize();
  if (params.time !== undefined) m.uniforms.uTime.value = params.time;
  if (params.fogColor) m.uniforms.fogColor.value.copy(params.fogColor);
  if (params.fogNear !== undefined) m.uniforms.fogNear.value = params.fogNear;
  if (params.fogFar !== undefined) m.uniforms.fogFar.value = params.fogFar;

  // Update point lights
  if (params.pointLights) {
    const positions = m.uniforms.pointLightPositions.value as Float32Array;
    const colors = m.uniforms.pointLightColors.value as Float32Array;
    const count = Math.min(params.pointLights.length, MAX_POINT_LIGHTS);
    m.uniforms.pointLightCount.value = count;

    for (let i = 0; i < count; i++) {
      const light = params.pointLights[i];
      positions[i * 3] = light.position[0];
      positions[i * 3 + 1] = light.position[1];
      positions[i * 3 + 2] = light.position[2];
      colors[i * 3] = light.color[0] * light.intensity;
      colors[i * 3 + 1] = light.color[1] * light.intensity;
      colors[i * 3 + 2] = light.color[2] * light.intensity;
    }
  }
}
