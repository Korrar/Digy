# Plan: System Voxelowego Świata z Zaawansowanym Niszczeniem

## Podsumowanie

Transformacja obecnego systemu blokowego (1 blok = 1 jednostka) w system gdzie każdy blok składa się z siatki mniejszych voxeli (np. 4×4×4 = 64 voxele na blok). Pozwoli to na:
- Częściowe niszczenie bloków (odłupywanie kawałków)
- Realistyczne kopanie (stopniowe drążenie tuneli)
- Deformację terenu (kratery od eksplozji)
- Efekty wizualne zniszczeń (pęknięcia, fragmenty)

---

## Faza 1: Nowa warstwa danych - SubVoxelData

### 1.1 Nowy plik: `src/core/voxel/SubVoxelData.ts`

**Koncepcja:** Każdy blok (BlockType) może opcjonalnie posiadać siatkę sub-voxeli. Gdy blok jest "pełny", nie przechowujemy sub-voxeli (oszczędność pamięci). Dopiero gdy gracz zaczyna kopać/niszczyć, alokujemy siatkę sub-voxeli dla tego bloku.

```
SUB_VOXEL_RES = 4  // 4×4×4 = 64 sub-voxeli na blok
```

**Struktury danych:**
- `SubVoxelGrid`: `Uint8Array(64)` - 1 bajt per sub-voxel (0 = pusty, 1 = pełny, 2-255 = warianty materiału)
- `SubVoxelStore`: `Map<string, SubVoxelGrid>` - klucz: `"wx,wy,wz"` (współrzędne bloku świata)
- Pełny blok nie ma wpisu w mapie (domyślnie wszystkie sub-voxele = pełne)
- Blok z częściowym zniszczeniem ma wpis z maską uszkodzeń
- Gdy wszystkie sub-voxele = 0, blok staje się AIR

**Metody:**
- `getSubVoxel(wx, wy, wz, sx, sy, sz): number` - pobierz sub-voxel
- `setSubVoxel(wx, wy, wz, sx, sy, sz, value): void` - ustaw sub-voxel
- `initializeBlock(wx, wy, wz): SubVoxelGrid` - stwórz pełną siatkę dla bloku
- `removeSubVoxel(wx, wy, wz, sx, sy, sz): void` - usuń sub-voxel, sprawdź czy blok pusty
- `removeRadius(wx, wy, wz, radius): RemovedVoxels[]` - zniszcz sub-voxele w promieniu (eksplozje)
- `countSolid(wx, wy, wz): number` - ile sub-voxeli jest pełnych (0-64)
- `isFullBlock(wx, wy, wz): boolean` - czy blok jest w pełni nienaruszony

### 1.2 Modyfikacja `ChunkData.ts`

- Dodanie pola `subVoxels: SubVoxelStore` do ChunkData
- Nowa metoda `hasSubVoxelDamage(x, y, z): boolean`
- Nowa metoda `getSubVoxelGrid(x, y, z): SubVoxelGrid | null`

### 1.3 Testy (TDD - RED phase)

Plik: `src/core/voxel/__tests__/SubVoxelData.test.ts`
- "should return full grid for uninitialized block"
- "should track individual sub-voxel removal"
- "should convert block to AIR when all sub-voxels removed"
- "should remove sub-voxels in radius for explosions"
- "should report correct solid count"
- "should handle edge cases at block boundaries"

---

## Faza 2: SubVoxel Mesher - Renderowanie sub-voxeli

### 2.1 Nowy plik: `src/core/voxel/SubVoxelMesher.ts`

**Koncepcja:** Oddzielny mesher dla bloków z uszkodzeniami. Generuje geometrię na poziomie sub-voxeli zamiast pełnych ścian bloku.

**Algorytm:**
1. Dla każdego bloku z wpisem w SubVoxelStore:
   - Iteruj po siatce 4×4×4
   - Dla każdego pełnego sub-voxela sprawdź 6 sąsiadów
   - Generuj ścianki tylko na granicach pełne↔puste
   - Skaluj pozycje: sub-voxel ma rozmiar 0.25 × 0.25 × 0.25
2. Greedy meshing na poziomie sub-voxeli (łączenie sąsiednich ścianek w większe quady)
3. Kolory dziedziczone z bloku rodzica z lekką wariancją (ciemniejsze na krawędziach zniszczenia)

**Optymalizacja - Greedy meshing:**
- Łączenie sąsiednich sub-voxel face'ów w większe quady
- Redukcja vertex count o ~60-80%
- Osobny pass greedy meshing per face direction (6 passes)

### 2.2 Integracja z `ChunkMesher.ts`

W głównej pętli meshera, przed renderowaniem normalnego bloku:
```
if (chunk.hasSubVoxelDamage(x, y, z)) {
    // Użyj SubVoxelMesher zamiast normalnego renderowania
    SubVoxelMesher.buildDamagedBlock(chunk, x, y, z, ...)
    continue; // Pomiń normalne renderowanie tego bloku
}
```

### 2.3 Sąsiedztwo między sub-voxelami i blokami

- Sub-voxel na krawędzi bloku sprawdza sąsiedni blok:
  - Jeśli sąsiad jest pełnym solidnym blokiem → nie renderuj ścianki
  - Jeśli sąsiad ma sub-voxele → sprawdź konkretny sub-voxel sąsiada
  - Jeśli sąsiad to AIR → renderuj ściankę

### 2.4 Testy

Plik: `src/core/voxel/__tests__/SubVoxelMesher.test.ts`
- "should generate no geometry for full undamaged block" (bo nie ma wpisu)
- "should generate correct faces for single removed sub-voxel"
- "should handle sub-voxel faces at block boundaries"
- "should apply greedy meshing to reduce vertex count"
- "should inherit color from parent block"

---

## Faza 3: System kopania z sub-voxelami

### 3.1 Modyfikacja `WorldInteraction.tsx` - Precyzyjne kopanie

**Nowy system kopania:**
1. Raycast trafia w blok → oblicz dokładny punkt trafienia
2. Punkt trafienia → przelicz na współrzędne sub-voxela (sx, sy, sz)
3. Zamiast niszczyć cały blok, usuń sub-voxele w małym promieniu wokół punktu trafienia
4. Promień zależy od narzędzia:
   - Ręka: 1 sub-voxel naraz
   - Drewniany kilof: promień 1 (do 7 sub-voxeli)
   - Kamienny kilof: promień 1.5 (do 19 sub-voxeli)
   - Żelazny kilof: promień 2 (do ~33 sub-voxeli)
   - Diamentowy kilof: promień 2 (szybciej) lub cały blok naraz (opcja)
5. Gdy countSolid() == 0 → blok staje się AIR, drop itemów

**Feedback wizualny:**
- Cząsteczki lecą z punktu trafienia (nie ze środka bloku)
- Kolor cząsteczek = kolor bloku
- Dźwięk kopania zmienia ton w miarę postępu zniszczenia

### 3.2 Modyfikacja eksplozji TNT

- Obecny system: promień 3, ustawia bloki na AIR
- Nowy system:
  - Sferyczny promień zniszczeń na poziomie sub-voxeli
  - Bloki bliżej centrum → więcej sub-voxeli zniszczonych
  - Bloki na krawędzi → częściowe zniszczenia (krater z nierównymi krawędziami)
  - Losowość: nie idealnie okrągły krater, dodaj noise

### 3.3 Testy

Plik: `src/core/voxel/__tests__/VoxelMining.test.ts`
- "should remove sub-voxels at hit point"
- "should convert block to AIR when fully mined"
- "should create irregular crater from TNT explosion"
- "should drop items proportionally to removed sub-voxels"
- "should respect tool mining radius"

---

## Faza 4: Fizyka i grawitacja sub-voxeli

### 4.1 Nowy plik: `src/core/voxel/VoxelPhysics.ts`

**Flood-fill stability check:**
- Po usunięciu sub-voxeli, sprawdź czy pozostałe sub-voxele w bloku są "połączone"
- Jeśli grupa sub-voxeli jest odłączona od reszty (np. wisi w powietrzu) → odpada
- Odpadające fragmenty → cząsteczki lub mini-entity z grawitacją

**Algorytm:**
1. Po każdym usunięciu sub-voxela, uruchom flood-fill od dołu bloku
2. Sub-voxele niepołączone z "podłożem" tworzą fragment
3. Fragment spada jako cząsteczka/entity
4. Opcjonalnie: sprawdzanie stabilności między blokami (blok z <25% sub-voxeli nie utrzyma bloku powyżej)

### 4.2 Testy

Plik: `src/core/voxel/__tests__/VoxelPhysics.test.ts`
- "should detect disconnected sub-voxel groups"
- "should trigger gravity on unsupported fragments"
- "should maintain connected sub-voxels"
- "should collapse block with insufficient support"

---

## Faza 5: Efekty wizualne zniszczeń

### 5.1 Shader zniszczeń w `VoxelShader.ts`

- Nowy atrybut `damageLevel` (0.0 - 1.0) per vertex
- Im więcej sub-voxeli brakuje, tym ciemniejsze/brudniejsze krawędzie
- Pęknięcia: linie na teksturze w kierunku zniszczenia
- Opcjonalnie: wewnętrzny kolor bloku (ciemniejszy) widoczny po odkopaniu

### 5.2 Cząsteczki zniszczeń

- Modyfikacja istniejącego systemu cząsteczek
- Małe kosteczki (rozmiar sub-voxela) odlatujące od punktu kopania
- Fizyka cząsteczek: grawitacja + odbicia od terenu
- Zanikanie po 1-2 sekundach

### 5.3 Dźwięki

- Dźwięk kopania zmienia pitch z postępem zniszczenia (wyższy = bliżej zniszczenia)
- Dźwięk pękania przy odpadaniu fragmentów
- Różne dźwięki dla różnych materiałów (kamień, drewno, piasek)

---

## Faza 6: Optymalizacja wydajności

### 6.1 LOD (Level of Detail)

- Bliskie bloki (< 8 bloków od gracza): pełna rozdzielczość sub-voxeli (4×4×4)
- Średnia odległość (8-16): uproszczona geometria (2×2×2 sub-voxele)
- Daleko (> 16): normalny rendering blokowy (bez sub-voxeli)
- Tylko uszkodzone bloki używają sub-voxel renderingu (nieuszkodzone = normalne bloki)

### 6.2 Lazy allocation

- Sub-voxel grid alokowana TYLKO gdy blok jest po raz pierwszy uszkodzony
- Pełne bloki nie zajmują dodatkowej pamięci
- Szacunkowe zużycie: max ~100-500 uszkodzonych bloków × 64 bajtów = 6-32 KB

### 6.3 Mesh caching

- Przebudowa meshu sub-voxeli tylko dla zmienionych bloków
- Geometria sub-voxeli w osobnym BufferGeometry (nie przebudowuje całego chunku)
- Opcjonalnie: instanced rendering dla sub-voxeli tego samego typu

### 6.4 Dirty tracking

- Flaga `subVoxelDirty` per blok
- Rebuild geometrii sub-voxeli tylko dla zmienionych bloków
- Batch rebuild: przebuduj max N bloków per frame

---

## Faza 7: Integracja i polish

### 7.1 Kompatybilność wsteczna

- Bloki specjalne (drzwi, tory, ogrodzenia, mechanizmy) → domyślnie niszczone w całości (bez sub-voxeli)
- Sub-voxele tylko dla bloków "terenu": stone, dirt, grass, sand, wood, bricks, itp.
- Flaga `supportsSubVoxels: boolean` w BlockDefinition

### 7.2 UI feedback

- Pasek postępu kopania → zastąpiony wizualnym zniszczeniem bloku
- Crosshair zmienia kolor gdy celuje w uszkodzony blok
- Tooltip: "65% zniszczony" przy patrzeniu na uszkodzony blok

### 7.3 DevTools rozszerzenie

- Nowy tryb: "Voxel Brush" - malowanie/usuwanie sub-voxeli
- Podgląd siatki sub-voxeli
- Statystyki: ile sub-voxel gridów jest aktywnych

---

## Kolejność implementacji (rekomendowana)

| Krok | Faza | Opis | Szacowana złożoność |
|------|------|------|---------------------|
| 1 | 1.3 | Testy SubVoxelData (RED) | Niska |
| 2 | 1.1-1.2 | SubVoxelData + integracja ChunkData (GREEN) | Średnia |
| 3 | 2.4 | Testy SubVoxelMesher (RED) | Niska |
| 4 | 2.1-2.3 | SubVoxelMesher + integracja (GREEN) | Wysoka |
| 5 | 3.3 | Testy kopania (RED) | Niska |
| 6 | 3.1-3.2 | System kopania + eksplozje (GREEN) | Wysoka |
| 7 | 4.2 | Testy fizyki (RED) | Niska |
| 8 | 4.1 | Fizyka sub-voxeli (GREEN) | Średnia |
| 9 | 5.1-5.3 | Efekty wizualne | Średnia |
| 10 | 6.1-6.4 | Optymalizacja | Wysoka |
| 11 | 7.1-7.3 | Integracja i polish | Średnia |

## Ryzyka i mitygacje

1. **Wydajność** - Sub-voxele 4× więcej geometrii per blok
   - Mitygacja: lazy allocation, LOD, osobne BufferGeometry dla uszkodzeń

2. **Pamięć** - Dodatkowe 64 bajtów per uszkodzony blok
   - Mitygacja: Tylko uszkodzone bloki mają sub-voxele, limit aktywnych gridów

3. **Złożoność meshera** - Sąsiedztwo sub-voxeli między blokami
   - Mitygacja: Cross-block neighbor query (analogicznie do istniejącego systemu chunks)

4. **Kompatybilność** - Specjalne bloki (drzwi, tory) trudne do sub-voxelizacji
   - Mitygacja: Flaga `supportsSubVoxels`, specjalne bloki niszczone w całości
