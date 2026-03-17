/**
 * Sub-voxel system: each block can be subdivided into a grid of smaller voxels
 * for advanced destruction and mining mechanics.
 *
 * SUB_VOXEL_RES = 4 means each block is a 4×4×4 = 64 sub-voxel grid.
 * Grids are lazily allocated - only damaged blocks have a grid in memory.
 */

export const SUB_VOXEL_RES = 4;
const GRID_SIZE = SUB_VOXEL_RES * SUB_VOXEL_RES * SUB_VOXEL_RES; // 64

export type SubVoxelGrid = Uint8Array;

/**
 * Integer hash key for block coordinates. Uses bit packing for fast, allocation-free lookups.
 * Supports coordinates in range [-512, 511] for x/z and [0, 1023] for y.
 */
function svKey(wx: number, wy: number, wz: number): number {
  return ((wx + 512) << 20) | ((wy & 0x3FF) << 10) | ((wz + 512) & 0x3FF);
}

function svIndex(sx: number, sy: number, sz: number): number {
  return sy * SUB_VOXEL_RES * SUB_VOXEL_RES + sz * SUB_VOXEL_RES + sx;
}

/** Object pool for SubVoxelGrid arrays to reduce GC pressure */
const gridPool: SubVoxelGrid[] = [];
const MAX_POOL_SIZE = 64;

function allocGrid(): SubVoxelGrid {
  const grid = gridPool.pop();
  if (grid) {
    grid.fill(1);
    return grid;
  }
  const newGrid = new Uint8Array(GRID_SIZE);
  newGrid.fill(1);
  return newGrid;
}

function releaseGrid(grid: SubVoxelGrid): void {
  if (gridPool.length < MAX_POOL_SIZE) {
    gridPool.push(grid);
  }
}

export class SubVoxelStore {
  private grids: Map<number, SubVoxelGrid> = new Map();

  /** Check if a block has an allocated sub-voxel grid (i.e. has been damaged) */
  hasGrid(wx: number, wy: number, wz: number): boolean {
    return this.grids.has(svKey(wx, wy, wz));
  }

  /** Get raw grid data for mesh building. Returns null if block has no grid (fully solid). */
  getGrid(wx: number, wy: number, wz: number): SubVoxelGrid | null {
    return this.grids.get(svKey(wx, wy, wz)) ?? null;
  }

  /** Allocate a fully solid sub-voxel grid for a block. */
  initializeBlock(wx: number, wy: number, wz: number): SubVoxelGrid {
    const key = svKey(wx, wy, wz);
    let grid = this.grids.get(key);
    if (!grid) {
      grid = allocGrid();
      this.grids.set(key, grid);
    }
    return grid;
  }

  /** Get a single sub-voxel value. Returns 1 (solid) for blocks without a grid. */
  getSubVoxel(wx: number, wy: number, wz: number, sx: number, sy: number, sz: number): number {
    const grid = this.grids.get(svKey(wx, wy, wz));
    if (!grid) return 1; // no grid = fully solid
    return grid[svIndex(sx, sy, sz)];
  }

  /** Set a single sub-voxel value. Auto-initializes grid if needed. */
  setSubVoxel(wx: number, wy: number, wz: number, sx: number, sy: number, sz: number, value: number): void {
    const key = svKey(wx, wy, wz);
    let grid = this.grids.get(key);
    if (!grid) {
      grid = allocGrid();
      this.grids.set(key, grid);
    }
    grid[svIndex(sx, sy, sz)] = value;

    // Cleanup: remove grid if block is fully destroyed
    if (value === 0 && this.countSolidGrid(grid) === 0) {
      this.grids.delete(key);
      releaseGrid(grid);
    }
  }

  /**
   * Remove a single sub-voxel. Returns true if the block became fully empty.
   * Auto-initializes grid if needed.
   */
  removeSubVoxel(wx: number, wy: number, wz: number, sx: number, sy: number, sz: number): boolean {
    const key = svKey(wx, wy, wz);
    let grid = this.grids.get(key);
    if (!grid) {
      grid = allocGrid();
      this.grids.set(key, grid);
    }
    grid[svIndex(sx, sy, sz)] = 0;

    const solid = this.countSolidGrid(grid);
    if (solid === 0) {
      this.grids.delete(key);
      releaseGrid(grid);
      return true;
    }
    return false;
  }

  /**
   * Remove sub-voxels within a spherical radius inside a single block.
   * Center is in sub-voxel coordinates (0-3).
   * Returns the count of sub-voxels removed.
   */
  removeRadius(
    wx: number, wy: number, wz: number,
    centerSx: number, centerSy: number, centerSz: number,
    radius: number
  ): number {
    const key = svKey(wx, wy, wz);
    let grid = this.grids.get(key);
    if (!grid) {
      grid = allocGrid();
      this.grids.set(key, grid);
    }

    let removed = 0;
    const r2 = radius * radius;

    for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
      for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
        for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
          const idx = svIndex(sx, sy, sz);
          if (grid[idx] === 0) continue;

          const dx = sx - centerSx;
          const dy = sy - centerSy;
          const dz = sz - centerSz;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            grid[idx] = 0;
            removed++;
          }
        }
      }
    }

    if (this.countSolidGrid(grid) === 0) {
      this.grids.delete(key);
      releaseGrid(grid);
    }

    return removed;
  }

  /**
   * Remove sub-voxels in a world-space spherical radius, potentially across multiple blocks.
   * Center coordinates are in world-space (fractional: e.g. 5.75 = block 5, sub-voxel 3).
   * Returns array of {wx, wy, wz, count} for each affected block.
   */
  removeRadiusWorld(
    centerWx: number, centerWy: number, centerWz: number,
    worldRadius: number
  ): Array<{ wx: number; wy: number; wz: number; count: number }> {
    const results: Array<{ wx: number; wy: number; wz: number; count: number }> = [];
    const subVoxelSize = 1.0 / SUB_VOXEL_RES;

    // Determine range of blocks affected
    const minBx = Math.floor(centerWx - worldRadius);
    const maxBx = Math.floor(centerWx + worldRadius);
    const minBy = Math.floor(centerWy - worldRadius);
    const maxBy = Math.floor(centerWy + worldRadius);
    const minBz = Math.floor(centerWz - worldRadius);
    const maxBz = Math.floor(centerWz + worldRadius);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        for (let bz = minBz; bz <= maxBz; bz++) {
          const key = svKey(bx, by, bz);
          let grid = this.grids.get(key);
          if (!grid) {
            grid = allocGrid();
            this.grids.set(key, grid);
          }

          let count = 0;
          for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
            for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
              for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
                const idx = svIndex(sx, sy, sz);
                if (grid[idx] === 0) continue;

                // World position of sub-voxel center
                const svWx = bx + (sx + 0.5) * subVoxelSize;
                const svWy = by + (sy + 0.5) * subVoxelSize;
                const svWz = bz + (sz + 0.5) * subVoxelSize;

                const dx = svWx - centerWx;
                const dy = svWy - centerWy;
                const dz = svWz - centerWz;

                if (dx * dx + dy * dy + dz * dz <= worldRadius * worldRadius) {
                  grid[idx] = 0;
                  count++;
                }
              }
            }
          }

          if (count > 0) {
            if (this.countSolidGrid(grid) === 0) {
              this.grids.delete(key);
              releaseGrid(grid);
            }
            results.push({ wx: bx, wy: by, wz: bz, count });
          } else {
            // No sub-voxels removed in this block - clean up if we allocated unnecessarily
            if (this.countSolidGrid(grid) === GRID_SIZE) {
              this.grids.delete(key);
              releaseGrid(grid);
            }
          }
        }
      }
    }

    return results;
  }

  /** Count solid sub-voxels in a block. Returns 64 for blocks without a grid. */
  countSolid(wx: number, wy: number, wz: number): number {
    const grid = this.grids.get(svKey(wx, wy, wz));
    if (!grid) return GRID_SIZE;
    return this.countSolidGrid(grid);
  }

  /** Whether the block is fully solid (no damage). */
  isFullBlock(wx: number, wy: number, wz: number): boolean {
    return !this.grids.has(svKey(wx, wy, wz));
  }

  /** Get damage ratio: 0 = undamaged, 1 = fully destroyed. */
  getDamageRatio(wx: number, wy: number, wz: number): number {
    const grid = this.grids.get(svKey(wx, wy, wz));
    if (!grid) return 0;
    const solid = this.countSolidGrid(grid);
    return 1 - solid / GRID_SIZE;
  }

  /** Remove the sub-voxel grid for a single block (used when collapsing unstable blocks). */
  clearBlock(wx: number, wy: number, wz: number): void {
    const key = svKey(wx, wy, wz);
    const grid = this.grids.get(key);
    if (grid) {
      this.grids.delete(key);
      releaseGrid(grid);
    }
  }

  /** Clear all grids. */
  clear(): void {
    this.grids.clear();
  }

  /** Count of active grids (for debugging/stats). */
  get activeGridCount(): number {
    return this.grids.size;
  }

  private countSolidGrid(grid: SubVoxelGrid): number {
    let count = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      if (grid[i] !== 0) count++;
    }
    return count;
  }
}
