import { BlockType } from '../core/voxel/BlockRegistry';

type SoundCategory = 'dirt' | 'stone' | 'sand' | 'wood' | 'glass' | 'snow' | 'gravel' | 'metal';

const blockSoundMap: Partial<Record<BlockType, SoundCategory>> = {
  [BlockType.GRASS]: 'dirt',
  [BlockType.DIRT]: 'dirt',
  [BlockType.STONE]: 'stone',
  [BlockType.COBBLESTONE]: 'stone',
  [BlockType.SAND]: 'sand',
  [BlockType.SANDSTONE]: 'sand',
  [BlockType.WOOD]: 'wood',
  [BlockType.LEAVES]: 'grass' as SoundCategory,
  [BlockType.COAL_ORE]: 'stone',
  [BlockType.IRON_ORE]: 'metal',
  [BlockType.SNOW]: 'snow',
  [BlockType.ICE]: 'glass',
  [BlockType.CACTUS]: 'wood',
  [BlockType.GRAVEL]: 'gravel',
  [BlockType.JUNGLE_WOOD]: 'wood',
  [BlockType.JUNGLE_LEAVES]: 'grass' as SoundCategory,
  [BlockType.CHERRY_WOOD]: 'wood',
  [BlockType.CHERRY_LEAVES]: 'grass' as SoundCategory,
  [BlockType.ACACIA_WOOD]: 'wood',
  [BlockType.ACACIA_LEAVES]: 'grass' as SoundCategory,
  [BlockType.BASALT]: 'stone',
  [BlockType.OBSIDIAN]: 'stone',
  [BlockType.MAGMA]: 'stone',
  [BlockType.MYCELIUM]: 'dirt',
  [BlockType.MOSS]: 'dirt',
  [BlockType.SAVANNA_GRASS]: 'dirt',
  [BlockType.MUSHROOM_BLOCK_RED]: 'wood',
  [BlockType.MUSHROOM_BLOCK_BROWN]: 'wood',
  [BlockType.GIANT_MUSHROOM_STEM]: 'wood',
  [BlockType.PLANKS]: 'wood',
  [BlockType.GLASS]: 'glass',
  [BlockType.STICKY_PISTON]: 'stone',
  [BlockType.STICKY_PISTON_HEAD]: 'stone',
  [BlockType.STICKY_PISTON_EXTENDED]: 'stone',
  [BlockType.CLAY]: 'dirt',
  [BlockType.MUD]: 'dirt',
  [BlockType.GOLD_ORE]: 'metal',
  [BlockType.DIAMOND_ORE]: 'stone',
  [BlockType.STONE_BRICKS]: 'stone',
};

// Procedural sound generation using Web Audio API
export class SoundManager {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private minecartNodes: { sources: OscillatorNode[]; gains: GainNode[] } | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    // Touch/click to resume audio context
    const resume = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('touchstart', resume, { once: true });
    window.addEventListener('click', resume, { once: true });
  }

  private noise(duration: number, volume: number, filterFreq: number, filterQ: number): void {
    const ctx = this.getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  private tone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine'): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playDigSound(blockType: BlockType): void {
    this.init();
    const category = blockSoundMap[blockType] || 'stone';
    // Add slight randomization for variety
    const pitchVar = 0.9 + Math.random() * 0.2;

    switch (category) {
      case 'dirt':
        this.noise(0.12, 0.15, 300 * pitchVar, 1.5);
        this.tone(80 * pitchVar, 0.08, 0.05, 'sine');
        break;
      case 'stone':
        this.noise(0.1, 0.2, 2000 * pitchVar, 2);
        this.tone(200 * pitchVar, 0.06, 0.08, 'square');
        break;
      case 'sand':
        this.noise(0.15, 0.12, 4000 * pitchVar, 0.5);
        break;
      case 'wood':
        this.tone(400 * pitchVar, 0.1, 0.1, 'triangle');
        this.tone(800 * pitchVar, 0.05, 0.05, 'sine');
        break;
      case 'glass':
        this.tone(2000 * pitchVar, 0.15, 0.08, 'sine');
        this.tone(3000 * pitchVar, 0.1, 0.04, 'sine');
        break;
      case 'snow':
        this.noise(0.2, 0.08, 6000 * pitchVar, 0.3);
        break;
      case 'gravel':
        this.noise(0.1, 0.18, 1500 * pitchVar, 1);
        this.noise(0.05, 0.1, 800 * pitchVar, 2);
        break;
      case 'metal':
        this.tone(600 * pitchVar, 0.12, 0.12, 'square');
        this.tone(1200 * pitchVar, 0.08, 0.06, 'sine');
        break;
      default:
        this.noise(0.1, 0.15, 1000 * pitchVar, 1);
    }
  }

  playBreakSound(blockType: BlockType): void {
    this.init();
    const category = blockSoundMap[blockType] || 'stone';
    const pitchVar = 0.85 + Math.random() * 0.3;

    switch (category) {
      case 'dirt':
        this.noise(0.2, 0.25, 400 * pitchVar, 1);
        this.tone(60 * pitchVar, 0.15, 0.08, 'sine');
        break;
      case 'stone':
        this.noise(0.15, 0.3, 1500 * pitchVar, 2.5);
        this.tone(150 * pitchVar, 0.1, 0.12, 'square');
        break;
      case 'sand':
        this.noise(0.25, 0.2, 3000 * pitchVar, 0.5);
        break;
      case 'wood':
        this.tone(300 * pitchVar, 0.15, 0.15, 'triangle');
        this.noise(0.1, 0.1, 1000 * pitchVar, 2);
        break;
      case 'glass':
        this.tone(3000 * pitchVar, 0.2, 0.1, 'sine');
        this.tone(4500 * pitchVar, 0.15, 0.06, 'sine');
        this.noise(0.1, 0.15, 6000, 0.5);
        break;
      case 'snow':
        this.noise(0.3, 0.12, 5000 * pitchVar, 0.3);
        break;
      case 'gravel':
        this.noise(0.15, 0.25, 1200 * pitchVar, 1.5);
        break;
      case 'metal':
        this.tone(500 * pitchVar, 0.2, 0.15, 'square');
        this.tone(1000 * pitchVar, 0.15, 0.08, 'sine');
        break;
      default:
        this.noise(0.15, 0.2, 1000 * pitchVar, 1.5);
    }
  }

  playPlaceSound(): void {
    this.init();
    const pitchVar = 0.9 + Math.random() * 0.2;
    this.tone(300 * pitchVar, 0.08, 0.1, 'triangle');
    this.noise(0.06, 0.1, 800, 2);
  }

  playMinecartRiding(speed: number = 1): void {
    this.init();
    if (this.minecartNodes) return; // already playing

    const ctx = this.getCtx();
    const sources: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.06;
    masterGain.connect(ctx.destination);

    // Metallic rattling - low frequency rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 40 * speed;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.4;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 200;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(masterGain);
    rumble.start();
    sources.push(rumble);
    gains.push(rumbleGain);

    // Clickety-clack oscillation (simulates rail joints)
    const clack = ctx.createOscillator();
    clack.type = 'square';
    clack.frequency.value = 8 * speed; // clicks per second
    const clackGain = ctx.createGain();
    clackGain.gain.value = 0.15;
    const clackFilter = ctx.createBiquadFilter();
    clackFilter.type = 'bandpass';
    clackFilter.frequency.value = 800;
    clackFilter.Q.value = 2;
    clack.connect(clackFilter).connect(clackGain).connect(masterGain);
    clack.start();
    sources.push(clack);
    gains.push(clackGain);

    // High metallic whine
    const whine = ctx.createOscillator();
    whine.type = 'sine';
    whine.frequency.value = 600 * speed;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.08;
    whine.connect(whineGain).connect(masterGain);
    whine.start();
    sources.push(whine);
    gains.push(whineGain);

    this.minecartNodes = { sources, gains };
  }

  playFootstep(blockType: BlockType): void {
    this.init();
    const category = blockSoundMap[blockType] || 'stone';
    const pitchVar = 0.85 + Math.random() * 0.3;

    switch (category) {
      case 'dirt':
        this.noise(0.06, 0.06, 250 * pitchVar, 1);
        break;
      case 'stone':
        this.noise(0.04, 0.08, 1800 * pitchVar, 2.5);
        this.tone(150 * pitchVar, 0.03, 0.03, 'square');
        break;
      case 'sand':
        this.noise(0.08, 0.05, 3500 * pitchVar, 0.4);
        break;
      case 'wood':
        this.tone(350 * pitchVar, 0.05, 0.06, 'triangle');
        break;
      case 'glass':
        this.tone(1800 * pitchVar, 0.04, 0.04, 'sine');
        break;
      case 'snow':
        this.noise(0.1, 0.04, 5000 * pitchVar, 0.2);
        break;
      case 'gravel':
        this.noise(0.06, 0.07, 1200 * pitchVar, 1.2);
        break;
      case 'metal':
        this.tone(500 * pitchVar, 0.05, 0.06, 'square');
        break;
      default:
        this.noise(0.05, 0.05, 800 * pitchVar, 1);
    }
  }

  playPistonExtend(): void {
    this.init();
    this.tone(150, 0.1, 0.12, 'square');
    this.noise(0.08, 0.08, 600, 2);
    this.tone(200, 0.05, 0.06, 'sine');
  }

  playPistonRetract(): void {
    this.init();
    this.tone(120, 0.08, 0.1, 'square');
    this.noise(0.06, 0.06, 400, 1.5);
  }

  stopMinecartRiding(): void {
    if (!this.minecartNodes) return;
    const ctx = this.ctx;
    if (!ctx) return;

    // Fade out
    for (const gain of this.minecartNodes.gains) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    }
    const nodes = this.minecartNodes;
    setTimeout(() => {
      for (const source of nodes.sources) {
        try { source.stop(); } catch { /* already stopped */ }
      }
    }, 350);
    this.minecartNodes = null;
  }
}

export const soundManager = new SoundManager();
