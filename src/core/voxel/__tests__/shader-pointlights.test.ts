import { describe, it, expect } from 'vitest';
import { createVoxelMaterial, updateVoxelShaderUniforms } from '../VoxelShader';

describe('VoxelShader point light support', () => {
  it('should have pointLights uniform array', () => {
    const mat = createVoxelMaterial();
    expect(mat.uniforms.pointLightPositions).toBeDefined();
    expect(mat.uniforms.pointLightColors).toBeDefined();
    expect(mat.uniforms.pointLightCount).toBeDefined();
  });

  it('should support up to 16 point lights', () => {
    const mat = createVoxelMaterial();
    const positions = mat.uniforms.pointLightPositions.value;
    expect(positions.length).toBe(16 * 3); // 16 lights × 3 floats (x,y,z)
  });

  it('should update point lights via updateVoxelShaderUniforms', () => {
    const mat = createVoxelMaterial();
    const lights = [
      { position: [5, 10, 5], color: [1, 0.7, 0.2], intensity: 0.6, distance: 12 },
    ];
    updateVoxelShaderUniforms({ pointLights: lights }, mat);
    expect(mat.uniforms.pointLightCount.value).toBe(1);
  });

  it('fragment shader should contain pointLight calculations', () => {
    const mat = createVoxelMaterial();
    // The fragment shader source should contain point light logic
    expect(mat.fragmentShader).toContain('pointLightPositions');
    expect(mat.fragmentShader).toContain('pointLightColors');
  });
});
