import { BlockType } from '../voxel/BlockRegistry';

type SoundCategory = 'dirt' | 'stone' | 'sand' | 'wood' | 'glass' | 'snow' | 'gravel' | 'plant';

const BLOCK_SOUNDS: Partial<Record<BlockType, SoundCategory>> = {
  [BlockType.GRASS]: 'dirt',
  [BlockType.DIRT]: 'dirt',
  [BlockType.STONE]: 'stone',
  [BlockType.COBBLESTONE]: 'stone',
  [BlockType.SAND]: 'sand',
  [BlockType.SANDSTONE]: 'stone',
  [BlockType.WOOD]: 'wood',
  [BlockType.LEAVES]: 'plant',
  [BlockType.COAL_ORE]: 'stone',
  [BlockType.IRON_ORE]: 'stone',
  [BlockType.SNOW]: 'snow',
  [BlockType.ICE]: 'glass',
  [BlockType.CACTUS]: 'plant',
  [BlockType.GRAVEL]: 'gravel',
};

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function noise(ctx: AudioContext, duration: number, gain: number): AudioBufferSourceNode {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * gain;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

function playDirt(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.15, 0.8);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800 + Math.random() * 400;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

function playStone(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.12, 1.0);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000 + Math.random() * 1000;
  filter.Q.value = 2;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

function playSand(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.2, 0.6);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000 + Math.random() * 2000;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

function playWood(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
  g.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200 + Math.random() * 60, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.18);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.18);

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15, now);
  g2.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  g2.connect(ctx.destination);
  const n = noise(ctx, 0.1, 0.5);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  n.connect(f);
  f.connect(g2);
  n.start(now);
}

function playGlass(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  g.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200 + Math.random() * 800, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playSnow(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.1, 0.4);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 5000;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

function playGravel(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.15, 0.9);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1500 + Math.random() * 500;
  filter.Q.value = 0.5;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

function playPlant(ctx: AudioContext) {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  g.connect(ctx.destination);

  const src = noise(ctx, 0.08, 0.5);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  src.connect(filter);
  filter.connect(g);
  src.start(now);
}

const PLAYERS: Record<SoundCategory, (ctx: AudioContext) => void> = {
  dirt: playDirt,
  stone: playStone,
  sand: playSand,
  wood: playWood,
  glass: playGlass,
  snow: playSnow,
  gravel: playGravel,
  plant: playPlant,
};

export function playMineSound(blockType: BlockType) {
  try {
    const ctx = getCtx();
    const category = BLOCK_SOUNDS[blockType] ?? 'stone';
    PLAYERS[category](ctx);
  } catch {
    // Audio not available
  }
}

export function playPlaceSound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    g.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Audio not available
  }
}

export function initAudio() {
  const handler = () => {
    getCtx();
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('touchstart', handler);
  };
  document.addEventListener('pointerdown', handler, { once: true });
  document.addEventListener('touchstart', handler, { once: true });
}
