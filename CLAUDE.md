# Digy - Wytyczne dla Claude Code

## Podejście TDD (Test-Driven Development)

Stosujemy TDD przy implementacji nowych funkcji i naprawie bugów:

1. **RED** - Najpierw napisz test, który failuje (opisuje oczekiwane zachowanie)
2. **GREEN** - Zaimplementuj minimalny kod, żeby test przeszedł
3. **REFACTOR** - Oczyść kod zachowując zielone testy

### Struktura testów
- Framework: **Vitest**
- Testy jednostkowe: `src/core/voxel/__tests__/*.test.ts`
- Uruchamianie: `npx vitest run`
- Uruchamianie jednego pliku: `npx vitest run src/core/voxel/__tests__/nazwa.test.ts`

### Konwencje testów
- Testy w `describe()` grupowane tematycznie
- Nazwy testów w języku angielskim, opisowe (np. "should render curved rail within block bounds")
- Testuj geometrię przez sprawdzanie atrybutów `BufferGeometry` (positions, normals, colors)
- Używaj `ChunkData` do ustawiania bloków w chunku testowym

## Stack technologiczny
- React 19 + TypeScript + Vite
- React Three Fiber (R3F) + Three.js + Drei
- Zustand (state management)
- Rapier WASM (physics)
- Web Audio API (proceduralne dźwięki)
- simplex-noise (generacja terenu)

## Architektura
- `src/components/3d/` - Komponenty 3D (R3F)
- `src/components/ui/` - Komponenty UI (React)
- `src/core/voxel/` - System voxeli (BlockRegistry, ChunkMesher, ChunkData)
- `src/stores/` - Zustand stores
- `src/systems/` - Systemy gry (SoundManager, AmbientMusic)
- `src/scenes/` - Sceny gry
- `src/utils/` - Stałe i narzędzia

## Dźwięki
- Cały system audio jest proceduralny (Web Audio API)
- `SoundManager` - dźwięki kopania, łamania, stawiania bloków
- `AmbientMusic` - muzyka ambientowa per biom
- Kategorie dźwięków: dirt, stone, sand, wood, glass, snow, gravel, metal

## Tory i wagoniki
- Tory renderowane proceduralnie w `ChunkMesher.ts` (ties + metal rails)
- Zakręcone tory: 4 kierunki (curve_ne, curve_nw, curve_se, curve_sw)
- Wagoniki: fizyka + snap do torów w `Minecarts.tsx`
- Powered rails: boost prędkości
