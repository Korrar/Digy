import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSparkle;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;
varying float vSparkle;

void main() {
  vColor = color;
  vNormal = normalize(normalMatrix * normal);
  vSparkle = aSparkle;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
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

// Fog
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;
varying float vSparkle;

// Hash for sparkle
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
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
  vec3 hemiFill = vec3(0.05, 0.04, 0.06) * hemi;

  vec3 totalLight = ambient + diffuse + moonLight + hemiFill;
  vec3 color = vColor * totalLight;

  // Sparkle effect for ores
  if (vSparkle > 0.0) {
    // Multiple sparkle points per block face
    vec3 sparklePos = floor(vWorldPosition * 4.0) * 0.25;
    float sparkleHash = hash(sparklePos);
    // Animated sparkle using time
    float sparklePhase = sparkleHash * 6.28318 + uTime * 3.0;
    float sparkleBrightness = pow(max(0.0, sin(sparklePhase)), 16.0);
    // Only some vertices sparkle at a time
    float sparkleThreshold = step(0.7, sparkleHash);
    color += vec3(1.0, 0.95, 0.8) * sparkleBrightness * vSparkle * sparkleThreshold * 0.8;
  }

  // Tone mapping (simple Reinhard)
  color = color / (color + vec3(1.0));

  // Fog
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  color = mix(color, fogColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createVoxelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: true,
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
      fogColor: { value: new THREE.Color(0x87CEEB) },
      fogNear: { value: 30.0 },
      fogFar: { value: 80.0 },
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
}) {
  const mat = getVoxelMaterial();
  if (params.ambientColor) mat.uniforms.ambientLightColor.value.copy(params.ambientColor);
  if (params.ambientIntensity !== undefined) mat.uniforms.ambientLightIntensity.value = params.ambientIntensity;
  if (params.lightColor) mat.uniforms.directionalLightColor.value.copy(params.lightColor);
  if (params.lightIntensity !== undefined) mat.uniforms.directionalLightIntensity.value = params.lightIntensity;
  if (params.lightDirection) mat.uniforms.directionalLightDirection.value.copy(params.lightDirection).normalize();
  if (params.moonColor) mat.uniforms.moonLightColor.value.copy(params.moonColor);
  if (params.moonIntensity !== undefined) mat.uniforms.moonLightIntensity.value = params.moonIntensity;
  if (params.moonDirection) mat.uniforms.moonLightDirection.value.copy(params.moonDirection).normalize();
  if (params.time !== undefined) mat.uniforms.uTime.value = params.time;
  if (params.fogColor) mat.uniforms.fogColor.value.copy(params.fogColor);
  if (params.fogNear !== undefined) mat.uniforms.fogNear.value = params.fogNear;
  if (params.fogFar !== undefined) mat.uniforms.fogFar.value = params.fogFar;
}
