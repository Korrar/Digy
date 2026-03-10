import { useGameStore } from './stores/gameStore';
import { MenuScene } from './scenes/MenuScene';
import { BiomeScene } from './scenes/BiomeScene';
import { HideoutScene } from './scenes/HideoutScene';
import { ARScene } from './scenes/ARScene';

function App() {
  const scene = useGameStore((s) => s.scene);

  switch (scene) {
    case 'menu':
      return <MenuScene />;
    case 'biome':
      return <BiomeScene />;
    case 'hideout':
      return <HideoutScene />;
    case 'ar':
      return <ARScene />;
  }
}

export default App;
