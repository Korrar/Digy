# Digy - Mapa Projektu i Specjalizacje

## Architektura Ogolna

```
src/
├── components/
│   ├── 3d/          # Komponenty Three.js / R3F (rendering 3D)
│   └── ui/          # Komponenty React (interfejs uzytkownika)
├── core/
│   ├── voxel/       # Silnik voxeli (bloki, meshing, shadery, atlas tekstur)
│   └── terrain/     # Generacja terenu i biomow
│       └── biomes/  # Klasy biomow (11 typow)
├── scenes/          # Glowne sceny gry (Menu, Biom, Kryjowka)
├── stores/          # Stan gry (Zustand) - 8 storow
├── systems/         # Systemy gry (dzwiek, fizyka, kable)
└── utils/           # Stale i narzedzia
```

---

## 1. Silnik Voxeli (`src/core/voxel/`)

### Pliki
| Plik | Odpowiedzialnosc |
|------|-----------------|
| `BlockRegistry.ts` | Definicje ~110 typow blokow (enum + register), kolory, wlasciwosci, flagi |
| `ChunkData.ts` | Struktura danych chunka (16x32x16), get/setBlock |
| `ChunkMesher.ts` | Generacja geometrii z ChunkData → BufferGeometry (1268 linii) |
| `TextureAtlas.ts` | Proceduralne tekstury 16x16, atlas na canvasie |
| `VoxelShader.ts` | GLSL vertex+fragment shader (oswietlenie, animacje, efekty) |

### ChunkMesher - Sciezki renderowania
1. **Normalne kostki** - 6 scian, face culling, ambient occlusion, atlas UV
2. **Crossed-quad flora** - 4 diagonalne quady (trawa, kwiaty, grzyby)
3. **Pochodnie** - patyk + 3 pary skrzyzowanych quadow plomienia
4. **Tory** - proceduralne polaczenia, zakrzywione szyny
5. **Polbloki (slabs)** - polowa wysokosci
6. **Ogrodzenia** - centralny slupek + automatyczne laczniki
7. **Schody** - 4 orientacje (N/S/E/W), rampa
8. **Drzwi** - 2-blokowe, otwieranie/zamykanie
9. **Skrzynie** - mniejszy box + pokrywka
10. **Dzwignie/Przyciski** - elementy scianne
11. **Kable** - cienki drut + laczniki
12. **Tlocki** - baza + wysuwany trzpien
13. **Tabliczki** - panel na slupku

### Kategorie blokow
- **Teren**: grass, dirt, stone, sand, sandstone, snow, ice, water, lava, gravel, clay, mud
- **Rudy**: coal, iron, gold, diamond (z efektem sparkle)
- **Drewno/Liscie**: oak, jungle, cherry, acacia (biome-specific)
- **Grzyby**: mycelium, red/brown cap, stem
- **Wulkan**: basalt, obsidian, magma
- **Budowlane**: planks, glass, stone_bricks, bookshelf, cobblestone
- **Specjalne ksztalty**: slabs, fences, stairs, doors, chest
- **Transport**: rail, rail_ew, rail_curve_*, powered_rail, minecart
- **Redstone**: lever, button, cable, piston, warning_light
- **Narzedzia**: pickaxe (wood/stone/iron/diamond), sword (wood/stone/iron/diamond)
- **Zasoby**: coal, iron_ingot, gold_ingot, diamond, stick
- **Jedzenie**: apple, bread, raw_meat, cooked_meat

---

## 2. Generacja Terenu (`src/core/terrain/`)

### Pliki
| Plik | Odpowiedzialnosc |
|------|-----------------|
| `NoiseGenerator.ts` | Simplex noise + FBM, seeded PRNG |
| `StructureGenerator.ts` | Proceduralne budowle (kabiny, studnie, latarnie) |
| `biomes/BiomeBase.ts` | Klasa bazowa biomow (maska wyspy, kalkulacja wysokosci) |
| `biomes/index.ts` | Factory `createBiome()`, lista BIOME_LIST |

### 11 Biomow
| Biom | Plik | Charakterystyka |
|------|------|----------------|
| Las | `ForestBiome.ts` | Drzewa oak, trawa, kwiaty |
| Pustynia | `DesertBiome.ts` | Piasek, piaskowiec, kaktusy |
| Jaskinia | `CaveBiome.ts` | Kamien, rudy, lawa, grzyby |
| Gory | `MountainBiome.ts` | Wysokie skaly, rudy, snieg |
| Bagno | `SwampBiome.ts` | Bloto, woda, lilie |
| Tundra | `TundraBiome.ts` | Snieg, lod, rzadkie drzewa |
| Dzungla | `JungleBiome.ts` | Gestde drzewa jungle, pnacza, bambus |
| Grzyby | `MushroomBiome.ts` | Mycelium, gigantyczne grzyby |
| Wulkan | `VolcanicBiome.ts` | Bazalt, obsydian, magma, lawa |
| Sawanna | `SavannaBiome.ts` | Akacje, zlota trawa |
| Wisniowy Gaj | `CherryBiome.ts` | Wisnie, rozowe liscie i platki |

---

## 3. Rendering 3D (`src/components/3d/`)

| Plik | Odpowiedzialnosc |
|------|-----------------|
| `VoxelWorld.tsx` | Zarzadzanie wszystkimi chunkami, renderowanie mesh-y |
| `ChunkMesh.tsx` | Pojedynczy chunk - BufferGeometry + VoxelShader material |
| `WorldInteraction.tsx` | Logika kopania/stawiania, raycast, specjalna logika blokow |
| `BlockHighlight.tsx` | Podswietlenie celowanego bloku + pasek postep kopania |
| `BlockLights.tsx` | Zbieranie swiatl emitujacych (pochodnie, lampy, lawa) → shader |
| `DayNightCycle.tsx` | Cykl dnia/nocy (120s), swiatlo sloneczne/ksiezycowe |
| `DiggingParticles.tsx` | Czasteczki przy kopaniu (InstancedMesh, grawitacja) |
| `AmbientParticles.tsx` | Dym z pochodni, iskry z lawy, iskry z torow, embery |
| `Fireflies.ts` | Swietliki per biom |
| `Animals.ts` | Zwierzeta per biom (proste AI) |
| `Weather.ts` | Deszcz/snieg |
| `StarrySky.tsx` | Nocne niebo z gwiazdami |
| `Minecarts.tsx` | Fizyka wagonikow, snap do torow, powered rails boost |
| `Enemies.tsx` | Wrogowie (zombie, szkielet, pajak, creeper) |
| `Tappables.tsx` | Klikalne obiekty do zbierania (skrzynki, krysztaly) |

---

## 4. Interfejs Uzytkownika (`src/components/ui/`)

| Plik | Odpowiedzialnosc |
|------|-----------------|
| `HUD.tsx` | Gorny pasek: nazwa biomu, tryb, muzyka, crafting, ekwipunek |
| `Hotbar.tsx` | 9 slotow na dole ekranu, klawisze 1-9, scroll |
| `InventoryPanel.tsx` | Pelny ekwipunek 9x4 + hotbar, drag & drop |
| `CraftingPanel.tsx` | Przegladarka receptur, kategorie, wymagania |
| `ChestPanel.tsx` | UI skrzyni (2x9 slotow), przenoszenie przedmiotow |
| `HealthBar.tsx` | 10 polowek serduszek, kolorowe ostrzezenia |
| `LootPopup.tsx` | Powiadomienie o zebranych przedmiotach |
| `MobileControls.tsx` | Dotykowy joystick + przyciski akcji |
| `Icons.tsx` | Biblioteka ikon SVG (bloki, narzedzia, itemy) |
| `DevTools.tsx` | Panel debugowania (czas dnia, seed, chunki) |

---

## 5. Sceny Gry (`src/scenes/`)

| Plik | Odpowiedzialnosc |
|------|-----------------|
| `MenuScene.tsx` | Menu glowne - wybor biomu, wejscie do kryjowki, crafting |
| `BiomeScene.tsx` | Glowna scena gry - integruje wszystkie systemy 3D i UI |
| `HideoutScene.tsx` | Kryjowka - bezpieczna strefa, budowanie, tryb mine/build/explore |

---

## 6. Stan Gry - Zustand Stores (`src/stores/`)

| Store | Plik | Odpowiedzialnosc |
|-------|------|-----------------|
| `useGameStore` | `gameStore.ts` | Nawigacja scen (menu/biom/kryjowka), aktualny biom |
| `useWorldStore` | `worldStore.ts` | Chunki, bloki, generacja swiata, setBlock/getBlock |
| `useInventoryStore` | `inventoryStore.ts` | 36 slotow ekwipunku, hotbar, stackowanie |
| `useChestStore` | `chestStore.ts` | Skrzynie (27 slotow), loot per biom |
| `useCraftingStore` | `craftingStore.ts` | 50+ receptur, kolejka craftingu, sloty |
| `useCombatStore` | `combatStore.ts` | HP gracza, XP, level, 4 typy wrogow |
| `useDevStore` | `devStore.ts` | DevTools: czas dnia, fast mining |
| `useTappablesStore` | `tappablesStore.ts` | Klikalne obiekty, loot per biom |

---

## 7. Systemy (`src/systems/`)

| System | Plik | Odpowiedzialnosc |
|--------|------|-----------------|
| `SoundManager` | `SoundManager.ts` | Proceduralne dzwieki (Web Audio API): kopanie, lamanie, stawianie, kroki, minecart |
| `AmbientMusic` | `AmbientMusic.ts` | Muzyka per biom (pentatoniczna), warstwy ambientu |
| `WaterFlow` | `WaterFlow.ts` | Fizyka wody (BFS, grawitacja + rozplyw do 5 blokow) |
| `SandPhysics` | `SandPhysics.ts` | Grawitacja piasku i zwiru |
| `CablePower` | `CablePower.ts` | Propagacja mocy: dzwignie → kable → tlocki/powered rails |

---

## 8. Stale (`src/utils/constants.ts`)

```
CHUNK_SIZE = 16          CHUNK_HEIGHT = 32
RENDER_DISTANCE = 3      BIOME_PLATE_SIZE = 16
CAMERA_MIN/MAX_DISTANCE = 8/40
MINING_CLICK_DURATION = 0.3s
INVENTORY_SIZE = 36      HOTBAR_SIZE = 9
HIDEOUT_SIZE = 24        HIDEOUT_HEIGHT = 20
```

---

## 9. Pipeline Renderowania

```
BlockRegistry (definicje blokow)
        ↓
BiomeGenerator → ChunkData (siatka 16x32x16)
        ↓
ChunkMesher → BufferGeometry (pozycje, normalne, kolory, UV, flagi)
        ↓
TextureAtlas → proceduralne tekstury 16x16 w jednym atlasie
        ↓
VoxelShader → GLSL (oswietlenie, animacje, efekty)
        ↓
BlockLights → point lights (pochodnie, lampy, lawa) → uniforms do shadera
        ↓
DayNightCycle → swiatlo kierunkowe/ambient → uniforms do shadera
```

### Shader - glowne efekty
- **Oswietlenie**: ambient + directional (slonce/ksiezyc) + do 16 point lights
- **Animacja wody**: 3 fale sinusoidalne na wierzcholkach
- **Animacja plomienia**: wieloczestotliwosciowy ruch z zaleznoscia od wysokosci
- **Sparkle rud**: hash-based migotanie per wierzcholek
- **Lawa**: samoemisyjna, plynace wzory magmy
- **Kable**: jasny niebieski glow gdy zasilone
- **Mgla**: liniowa mgla z kolorem nieba

---

## 10. Wrogowie (combatStore)

| Typ | HP | Obrazenia | Szybkosc | Cooldown |
|-----|-----|-----------|---------|---------|
| Zombie | 10 | 1.5 | 0.3 | 1.5s |
| Szkielet | 8 | 2.0 | 0.25 | 1.5s |
| Pajak | 8 | 1.0 | 0.5 | 1.5s |
| Creeper | 10 | 4.0 | 0.35 | 3.0s |

---

## 11. Crafting - Kategorie Receptur

- **Narzedzia**: kije, kilof (drewno/kamien/zelazo/diament), miecz
- **Bloki**: deski, stol, piec, kamienne cegly, pochodnia, skrzynia
- **Schody/Drzwi/Ogrodzenia**: oak stairs, cobble stairs, drzwi, ogrodzenie
- **Transport**: tory (8x), powered rail (4x), wagonik
- **Wytop**: zelazo, zloto, szklo, pieczone mieso
- **Redstone**: dzwignia, przycisk, lampa, warning light, kabel

---

## 12. Dzwiek - Kategorie Blokow

| Kategoria | Bloki | Charakter dzwieku |
|-----------|-------|------------------|
| dirt | grass, dirt, mud, mycelium | mieki thud |
| stone | stone, cobble, ore, basalt, obsydian | ostry crack |
| sand | sand, sandstone, gravel, soul_sand | szelest |
| wood | wood, planks, fences, doors, chests | knock |
| glass | glass, ice | dzwiek |
| snow | snow | cichy crunch |
| metal | rails, iron, powered_rail | metaliczny ring |

---

## 13. Tryby Gry

| Tryb | Opis | Dostepny w |
|------|------|-----------|
| Mine | Kopanie blokow, zbieranie zasobow | Biom, Kryjowka |
| Build | Stawianie blokow z ekwipunku | Kryjowka |
| Explore | Obserwacja bez interakcji | Kryjowka |

---

## 14. Kluczowe Zaleznosci Miedzy Systemami

```
WorldInteraction → worldStore.setBlock() → ChunkMesher rebuild
                 → SandPhysics (gravity blocks)
                 → WaterFlow (water spread)
                 → CablePower (lever/cable/piston)
                 → SoundManager (dig/break/place sounds)
                 → inventoryStore (add/remove blocks)

BiomeScene → worldStore.generateWorld()
           → createBiome() → BiomeBase.generate()
           → StructureGenerator (kabiny, studnie)
           → tappablesStore.spawnTappables()
           → combatStore (enemy spawning)
           → ambientMusic.start(biome)

ChunkMesh → ChunkMesher.buildMesh()
          → TextureAtlas.getAtlasUV()
          → VoxelShader (material)
          → BlockLights (point lights uniforms)
```

---

## 15. Testy (`src/core/voxel/__tests__/`)

Framework: **Vitest**

Pokryte obszary:
- Rendering blokow (geometria, normalne, kolory)
- Tory i zakrzywione polaczenia
- System lamp i swiatel
- Fizyka wagonikow
- Tryb eksploracji kryjowki
- Shader point lights
- Niezaleznosc od framerate
- Nowe biomy i bloki
- Dzwignie i przyciski
- Lawa i kable
- Warning lights
