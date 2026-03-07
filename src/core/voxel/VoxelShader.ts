import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;

void main() {
  vColor = color;
  vNormal = normalize(normalMatrix * normal);

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

// Fog
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogDepth;

void main() {
  // Ambient
  vec3 ambient = ambientLightColor * ambientLightIntensity;

  // Diffuse (directional light)
  float diff = max(dot(vNormal, directionalLightDirection), 0.0);
  vec3 diffuse = directionalLightColor * directionalLightIntensity * diff;

  // Hemisphere-like fill from below (subtle)
  float hemi = dot(vNormal, vec3(0.0, -1.0, 0.0)) * 0.5 + 0.5;
  vec3 hemiFill = vec3(0.05, 0.04, 0.06) * hemi;

  vec3 totalLight = ambient + diffuse + hemiFill;
  vec3 color = vColor * totalLight;

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
  if (params.fogColor) mat.uniforms.fogColor.value.copy(params.fogColor);
  if (params.fogNear !== undefined) mat.uniforms.fogNear.value = params.fogNear;
  if (params.fogFar !== undefined) mat.uniforms.fogFar.value = params.fogFar;
}
