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
};

// Procedural sound generation using Web Audio API
class SoundManager {
  private ctx: AudioContext | null = null;
  private initialized = false;

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
}

export const soundManager = new SoundManager();
