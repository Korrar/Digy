import { useGameStore } from './stores/gameStore';
import { MenuScene } from './scenes/MenuScene';
import { BiomeScene } from './scenes/BiomeScene';
import { HideoutScene } from './scenes/HideoutScene';

function App() {
  const scene = useGameStore((s) => s.scene);

  switch (scene) {
    case 'menu':
      return <MenuScene />;
    case 'biome':
      return <BiomeScene />;
    case 'hideout':
      return <HideoutScene />;
  }
}

export default App;
