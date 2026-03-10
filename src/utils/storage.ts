import { openDB } from 'idb';

const DB_NAME = 'digy';
const DB_VERSION = 1;
const STORE_NAME = 'hideout';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export interface SavedChunk {
  cx: number;
  cz: number;
  blocks: number[];
}

export async function saveHideout(chunks: SavedChunk[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, chunks, 'hideout-data');
  } catch (e) {
    console.warn('Failed to save hideout:', e);
  }
}

export async function loadHideout(): Promise<SavedChunk[] | null> {
  try {
    const db = await getDB();
    return await db.get(STORE_NAME, 'hideout-data') ?? null;
  } catch (e) {
    console.warn('Failed to load hideout:', e);
    return null;
  }
}

export async function clearHideout(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, 'hideout-data');
  } catch (e) {
    console.warn('Failed to clear hideout:', e);
  }
}

// AR persistence - save/load placed model positions
export interface ARModelPosition {
  id: string; // 'hideout' | 'biome'
  matrixElements: number[]; // 16-element array from Matrix4
  scale: number;
  rotation: number;
}

export async function saveARPositions(positions: ARModelPosition[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, positions, 'ar-positions');
  } catch (e) {
    console.warn('Failed to save AR positions:', e);
  }
}

export async function loadARPositions(): Promise<ARModelPosition[] | null> {
  try {
    const db = await getDB();
    return await db.get(STORE_NAME, 'ar-positions') ?? null;
  } catch (e) {
    console.warn('Failed to load AR positions:', e);
    return null;
  }
}
