# Digy - Analiza techniczna gry typu Minecraft Earth (Web)

## 1. Koncept gry

Gra webowa 3D w stylu Minecraft Earth:
- **Biomy** - gracz wchodzi w różne biomy (las, pustynia, jaskinia, góry, itp.)
- **Kopanie bloków** - w biomach generowane są bloki do wykopania
- **Ekwipunek** - wykopane bloki trafiają do inventory gracza
- **Kryjówka (Hideout)** - osobna przestrzeń do budowania z zebranych bloków
- **Backend (później)** - zapis budowli i danych gracza

---

## 2. Porównanie bibliotek 3D

### Three.js
| Aspekt | Ocena |
|--------|-------|
| Wydajność voxeli | ★★★★★ |
| Ekosystem | ★★★★★ (5M+ pobrań/tydzień) |
| Rozmiar bundla | ~168 KB gzip |
| Wsparcie WebGPU | Tak (od r171, zero-config) |
| Projekty voxelowe | Bardzo wiele (Voxelize, mc.js, itp.) |
| Mobile | ★★★★☆ |
| Krzywa uczenia | Średnia - niskopoziomowe API |

### Babylon.js
| Aspekt | Ocena |
|--------|-------|
| Wydajność voxeli | ★★★★☆ |
| Ekosystem | ★★★★☆ |
| Rozmiar bundla | ~300+ KB gzip (większy) |
| Wsparcie WebGPU | Tak |
| Projekty voxelowe | Kilka, mniej niż Three.js |
| Mobile | ★★★☆☆ (wolniejszy first-frame) |
| Krzywa uczenia | Łatwiejsza - "batteries included" |

### PlayCanvas
| Aspekt | Ocena |
|--------|-------|
| Wydajność voxeli | ★★★★☆ |
| Ekosystem | ★★★☆☆ |
| Rozmiar bundla | ~150 KB |
| Wsparcie WebGPU | Tak |
| Projekty voxelowe | Mało |
| Mobile | ★★★★★ |
| Krzywa uczenia | Łatwa (edytor wizualny) |

### React Three Fiber (R3F)
| Aspekt | Ocena |
|--------|-------|
| Wydajność voxeli | ★★★★★ (to Three.js pod spodem) |
| Ekosystem | ★★★★★ (Three.js + React + drei) |
| Rozmiar bundla | ~168 KB + React |
| Wsparcie WebGPU | Tak (przez Three.js) |
| Projekty voxelowe | Wiele |
| Mobile | ★★★★☆ |
| Krzywa uczenia | Niska dla programistów React |

---

## 3. REKOMENDACJA: Three.js + React Three Fiber (R3F)

### Dlaczego R3F?

1. **Deklaratywne podejście** - komponenty React do zarządzania sceną 3D
2. **Największy ekosystem** - biblioteka `@react-three/drei` dostarcza gotowe rozwiązania
3. **Stan aplikacji** - Zustand/Jotai do zarządzania inventory, biomami, stanem gry
4. **Udowodniony w voxelach** - Three.js ma najwięcej projektów voxelowych w sieci
5. **WebGPU ready** - Three.js r171+ z zero-config WebGPU
6. **Łatwa integracja z UI** - React dla HUD, inventory, menu
7. **Przyszły backend** - łatwa integracja z Next.js/API routes

### Stos technologiczny

```
Frontend:
├── React 19 + TypeScript
├── @react-three/fiber (R3F) - renderer 3D
├── @react-three/drei - helpery 3D
├── @react-three/rapier - fizyka (Rapier WASM)
├── Zustand - state management (inventory, game state)
├── Vite - bundler
└── Web Workers - generowanie chunków w tle

Storage (tymczasowy, przed backendem):
├── IndexedDB (via idb) - zapis budowli w kryjówce
└── localStorage - ustawienia gracza

Przyszły Backend:
├── Node.js / Next.js API
├── PostgreSQL / MongoDB
└── WebSocket - multiplayer (opcja)
```

---

## 4. Architektura gry

### 4.1 Struktura modułów

```
src/
├── main.tsx                    # Entry point
├── App.tsx                     # Router: Biom vs Kryjówka
│
├── core/
│   ├── voxel/
│   │   ├── ChunkManager.ts     # Zarządzanie chunkami 16x16x16
│   │   ├── ChunkMesher.ts      # Greedy meshing - optymalizacja mesh
│   │   ├── BlockRegistry.ts    # Definicje bloków i ich właściwości
│   │   └── VoxelRaycaster.ts   # Raycast do wskazywania bloków
│   ├── terrain/
│   │   ├── NoiseGenerator.ts   # Simplex/Perlin noise (Web Worker)
│   │   ├── BiomeGenerator.ts   # Generowanie terenu wg biomu
│   │   └── biomes/
│   │       ├── ForestBiome.ts
│   │       ├── DesertBiome.ts
│   │       ├── CaveBiome.ts
│   │       └── MountainBiome.ts
│   └── physics/
│       └── PlayerController.ts  # FPS kontroler + kolizje
│
├── game/
│   ├── inventory/
│   │   ├── InventoryStore.ts    # Zustand store
│   │   └── InventorySlot.ts     # Logika slotów
│   ├── mining/
│   │   ├── MiningSystem.ts      # Kopanie bloków (progress bar, tool check)
│   │   └── BlockDrops.ts        # Co dropuje z danego bloku
│   ├── building/
│   │   ├── BuildingSystem.ts    # Stawianie bloków w kryjówce
│   │   └── HideoutManager.ts   # Zapis/odczyt budowli (IndexedDB)
│   └── biomes/
│       └── BiomeManager.ts      # Przełączanie biomów, spawn
│
├── scenes/
│   ├── BiomeScene.tsx           # Scena biomu (eksploracja + kopanie)
│   ├── HideoutScene.tsx         # Scena kryjówki (budowanie)
│   └── MenuScene.tsx            # Menu główne
│
├── components/
│   ├── 3d/
│   │   ├── VoxelWorld.tsx       # R3F komponent świata
│   │   ├── Player.tsx           # Model gracza + kamera FPS
│   │   ├── Block.tsx            # Pojedynczy blok (do animacji)
│   │   └── Sky.tsx              # Skybox per biom
│   └── ui/
│       ├── HUD.tsx              # Crosshair, paski życia
│       ├── Hotbar.tsx           # Pasek szybkiego dostępu
│       ├── InventoryPanel.tsx   # Pełny ekwipunek
│       ├── BiomeSelector.tsx    # Wybór biomu
│       └── MiningProgress.tsx   # Postęp kopania
│
├── stores/
│   ├── gameStore.ts             # Główny stan gry
│   ├── inventoryStore.ts        # Stan inventory
│   └── worldStore.ts            # Stan świata/chunków
│
└── utils/
    ├── textures.ts              # Ładowanie tekstur bloków
    ├── constants.ts             # Stałe gry
    └── storage.ts               # IndexedDB wrapper
```

### 4.2 System Chunków i Greedy Meshing

Kluczowy element wydajności - zamiast renderować każdy blok jako osobny mesh:

```
Naiwne podejście:    1 blok = 12 trójkątów × 4096 bloków = 49,152 trójkątów/chunk
Greedy meshing:      Łączy sąsiednie ściany → ~500-2000 trójkątów/chunk
```

**Greedy Meshing** - algorytm łączący sąsiednie widoczne ściany bloków tego samego
typu w większe prostokąty. Redukcja geometrii o 90-95%.

### 4.3 Web Workers

Generowanie terenu i meshing przeniesione do Web Workerów:
- **TerrainWorker** - generuje noise i mapę bloków dla chunka
- **MeshWorker** - wykonuje greedy meshing i zwraca gotową geometrię
- Główny wątek tylko renderuje - zero lagów UI

### 4.4 Flow gry

```
[Menu Główne]
      │
      ├──→ [Wybór Biomu] ──→ [Scena Biomu]
      │                         │
      │                         ├── Eksploracja terenu 3D
      │                         ├── Kopanie bloków (LPM przytrzymaj)
      │                         ├── Bloki → Inventory
      │                         └── [Powrót do menu]
      │
      └──→ [Kryjówka] ──→ [Scena Budowania]
                              │
                              ├── Płaska/wybrana platforma
                              ├── Stawianie bloków z inventory (PPM)
                              ├── Niszczenie postawionych bloków (LPM)
                              ├── Autozapis do IndexedDB
                              └── [Powrót do menu]
```

---

## 5. Typy bloków (początkowe)

| Blok | Biom | Rzadkość | Tekstura |
|------|------|----------|----------|
| Dirt | Las, Góry | Częsty | Brązowy |
| Grass | Las | Częsty | Zielony top/brązowy |
| Stone | Jaskinia, Góry | Częsty | Szary |
| Sand | Pustynia | Częsty | Żółty |
| Wood (Oak) | Las | Średni | Drewniany |
| Leaves | Las | Średni | Zielony przezroczysty |
| Coal Ore | Jaskinia | Rzadki | Szary + czarne punkty |
| Iron Ore | Jaskinia, Góry | Rzadki | Szary + beżowe punkty |
| Sandstone | Pustynia | Średni | Jasno-żółty |
| Snow | Góry | Częsty | Biały |
| Ice | Góry | Średni | Jasnoniebieski |
| Cactus | Pustynia | Rzadki | Zielony ciemny |

---

## 6. Biomy

### Las (Forest)
- Teren: pagórkowaty, trawa + dirt
- Generowane: drzewa (oak), kwiaty, kamienie
- Bloki: grass, dirt, wood, leaves, stone

### Pustynia (Desert)
- Teren: płaski z wydmami
- Generowane: kaktusy, skały piaskowe
- Bloki: sand, sandstone, cactus

### Jaskinia (Cave)
- Teren: zamknięta przestrzeń, tunel
- Generowane: rudy, stalagmity
- Bloki: stone, coal_ore, iron_ore

### Góry (Mountains)
- Teren: wysoki, stromy
- Generowane: śnieg na szczytach, kamienie
- Bloki: stone, snow, ice, dirt, iron_ore

---

## 7. Plan implementacji (fazy)

### Faza 1 - Fundament (MVP)
- [x] Wybór technologii (R3F + Three.js)
- [ ] Setup projektu (Vite + React + R3F)
- [ ] System chunków z greedy meshing
- [ ] Podstawowy teren (flat + noise)
- [ ] Kontroler gracza FPS (WASD + mysz)
- [ ] Raycast na bloki (podświetlenie)
- [ ] Kopanie bloków (LPM)
- [ ] Podstawowy inventory (hotbar)

### Faza 2 - Biomy i Kopanie
- [ ] System biomów (4 biomy)
- [ ] Generator terenu per biom (noise)
- [ ] Pełny ekwipunek z UI
- [ ] System dropów z bloków
- [ ] Animacja kopania
- [ ] Web Workers dla generowania terenu

### Faza 3 - Kryjówka i Budowanie
- [ ] Scena kryjówki (osobna mapa)
- [ ] System stawiania bloków
- [ ] Zapis/odczyt z IndexedDB
- [ ] Selektor biomu w menu
- [ ] Skybox per biom

### Faza 4 - Polish
- [ ] Dźwięki (kopanie, stawianie, chodzenie)
- [ ] Cząsteczki (kopanie, ambient per biom)
- [ ] Oświetlenie (ambient occlusion)
- [ ] Mobile touch controls
- [ ] Optymalizacja (LOD, frustum culling)

### Faza 5 - Backend (przyszłość)
- [ ] API do zapisu/odczytu budowli
- [ ] Autentykacja gracza
- [ ] Synchronizacja inventory
- [ ] Multiplayer (opcja)

---

## 8. Kluczowe zależności npm

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "@react-three/rapier": "^2.0.0",
    "three": "^0.172.0",
    "zustand": "^5.0.0",
    "simplex-noise": "^4.0.0",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@types/three": "^0.172.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

---

## 9. Podsumowanie decyzji

| Decyzja | Wybór | Powód |
|---------|-------|-------|
| Renderer 3D | Three.js + R3F | Największy ekosystem, udowodniony w voxelach |
| UI Framework | React 19 | Deklaratywny UI, łatwy HUD/inventory |
| State Mgmt | Zustand | Lekki, idealny z R3F |
| Fizyka | Rapier (WASM) | Najszybsza fizyka webowa |
| Bundler | Vite | Szybki dev + HMR |
| Noise | simplex-noise | Generowanie terenu |
| Storage | IndexedDB (idb) | Zapis budowli offline |
| Meshing | Greedy meshing | 90-95% redukcja geometrii |
| Threading | Web Workers | Generowanie terenu bez blokowania UI |
