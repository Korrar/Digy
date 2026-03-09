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

## Przed commitem - obowiązkowe sprawdzenia

**ZAWSZE** przed każdym commitem uruchom:
1. `npx tsc --noEmit` - sprawdzenie TypeScript (zero błędów wymagane)
2. `npx vitest run` - uruchomienie testów (wszystkie muszą przechodzić)

Jeśli którekolwiek z powyższych failuje, **nie commituj** - napraw błędy najpierw.

### Typowe błędy TS do unikania
- **Redeklarkacja zmiennych** w tym samym bloku (`const result` użyte wielokrotnie w jednym `if` - użyj różnych nazw: `hit`, `doorCheck`, itp.)
- **Nieużywane importy** - usuwaj importy których nie używasz (`TS6133`)
- **Brakujące typy** - w plikach testowych importuj `* as THREE from 'three'` jeśli używasz `THREE.BufferGeometry`

## Tory i wagoniki
- Tory renderowane proceduralnie w `ChunkMesher.ts` (ties + metal rails)
- Zakręcone tory: 4 kierunki (curve_ne, curve_nw, curve_se, curve_sw)
- Wagoniki: fizyka + snap do torów w `Minecarts.tsx`
- Powered rails: boost prędkości

## Bloki budowlane
- Płyty (slabs): pół-bloki renderowane w ChunkMesher, `isSlab` flag
- Ogrodzenia (fences): auto-łączenie z sąsiadami, `isFence` flag
- Schody (stairs): 4 orientacje (N/S/E/W), `stairDir` property, orientowane przy stawianiu na podstawie klikniętej ściany
- Drzwi (doors): 2-blokowe (góra+dół), otwieranie/zamykanie w trybie build, `isDoor` flag
- Nowe typy bloków dodawane w `BlockRegistry.ts` (enum + register + helper functions)
- Rendering niestandardowych kształtów w `ChunkMesher.ts` (przed sekcją "Normal cube rendering")
- Specjalna logika stawiania w `WorldInteraction.tsx` (schody orientacja, drzwi 2-high)

## Checklist dodawania nowego bloku/itemu
1. **BlockRegistry.ts** - dodaj enum value, `register()` call, ewentualne flagi (`isTNT`, `isPressurePlate`, itp.), helper function (`isTNT()`)
2. **ChunkMesher.ts** - jeśli blok ma niestandardowy kształt, dodaj rendering przed "Normal cube rendering"
3. **DevTools.tsx** - dodaj blok do odpowiedniej kategorii (`redstone`, `rails`, `building`, `tools`)
4. **craftingStore.ts** - dodaj recepturę craftingu
5. **WorldInteraction.tsx** - jeśli blok wymaga specjalnej logiki interakcji (kliknięcie, stawianie)
6. **CablePower.ts** - jeśli blok reaguje na zasilanie kablowe (TNT, pistons)
7. **Minecarts.tsx** - jeśli blok ma interakcję z wagonkami (detector rail)

## Redstone / kable / zasilanie
- Dźwignia (lever): toggle ON/OFF, propaguje zasilanie przez kable
- Przycisk (button): jednorazowy sygnał
- Pressure plate: toggle ON/OFF po kliknięciu, propaguje zasilanie jak dźwignia
- Kable: BFS propagacja zasilania (max 16 bloków), `CABLE` → `CABLE_POWERED`
- TNT: eksploduje gdy zasilony (promień 3 bloki), łańcuchowe detonacje
- Detector rail: aktywuje się gdy wagonik przejeżdża, wysyła sygnał na 1.5s
- Tłoki (pistons): pchają blok nad sobą, sticky pistons ciągną przy cofaniu
