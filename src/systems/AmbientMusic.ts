// Procedural ambient music & sound system using Web Audio API
// Generates biome-specific ambient sounds and background music

type BiomeAmbience = 'forest' | 'desert' | 'cave' | 'mountains' | 'swamp' | 'tundra' | 'jungle' | 'mushroom' | 'volcanic' | 'savanna' | 'cherry';

interface AmbientLayer {
  type: 'tone' | 'noise' | 'chirp';
  interval: number; // ms between plays
  lastPlayed: number;
  params: any;
}

class AmbientMusicSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private active = false;
  private biome: BiomeAmbience | null = null;
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private ambienceInterval: ReturnType<typeof setInterval> | null = null;
  private layers: AmbientLayer[] = [];
  private musicEnabled = true;
  private initialized = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.4;
      this.musicGain.connect(this.masterGain);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.6;
      this.ambienceGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    const resume = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('touchstart', resume, { once: true });
    window.addEventListener('click', resume, { once: true });
  }

  start(biome: BiomeAmbience) {
    this.init();
    this.stop();
    this.biome = biome;
    this.active = true;
    this.setupLayers(biome);
    this.startAmbienceLoop();
    this.startMusicLoop();
  }

  stop() {
    this.active = false;
    if (this.musicInterval) { clearInterval(this.musicInterval); this.musicInterval = null; }
    if (this.ambienceInterval) { clearInterval(this.ambienceInterval); this.ambienceInterval = null; }
    this.layers = [];
  }

  toggle() {
    this.musicEnabled = !this.musicEnabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.musicEnabled ? 0.15 : 0;
    }
    return this.musicEnabled;
  }

  isEnabled(): boolean {
    return this.musicEnabled;
  }

  private setupLayers(biome: BiomeAmbience) {
    const now = Date.now();
    switch (biome) {
      case 'forest':
        this.layers = [
          { type: 'chirp', interval: 3000, lastPlayed: now, params: { freqBase: 1200, freqRange: 800, duration: 0.15, count: 3 } },
          { type: 'chirp', interval: 5000, lastPlayed: now + 1500, params: { freqBase: 2000, freqRange: 500, duration: 0.1, count: 2 } },
          { type: 'noise', interval: 8000, lastPlayed: now, params: { freq: 400, q: 0.5, duration: 2, volume: 0.04 } }, // wind rustle
        ];
        break;
      case 'desert':
        this.layers = [
          { type: 'noise', interval: 6000, lastPlayed: now, params: { freq: 600, q: 0.3, duration: 3, volume: 0.03 } }, // wind
          { type: 'tone', interval: 10000, lastPlayed: now, params: { freq: 200, duration: 2, volume: 0.02, type: 'sine' } }, // distant hum
        ];
        break;
      case 'cave':
        this.layers = [
          { type: 'tone', interval: 4000, lastPlayed: now, params: { freq: 80, duration: 1.5, volume: 0.03, type: 'sine' } }, // drip echo
          { type: 'noise', interval: 7000, lastPlayed: now + 2000, params: { freq: 200, q: 3, duration: 0.5, volume: 0.05 } }, // water drip
          { type: 'tone', interval: 12000, lastPlayed: now, params: { freq: 50, duration: 4, volume: 0.02, type: 'sine' } }, // deep rumble
        ];
        break;
      case 'mountains':
        this.layers = [
          { type: 'noise', interval: 5000, lastPlayed: now, params: { freq: 800, q: 0.2, duration: 4, volume: 0.04 } }, // wind
          { type: 'tone', interval: 15000, lastPlayed: now, params: { freq: 150, duration: 3, volume: 0.02, type: 'triangle' } }, // echo
        ];
        break;
      case 'swamp':
        this.layers = [
          { type: 'chirp', interval: 2500, lastPlayed: now, params: { freqBase: 300, freqRange: 100, duration: 0.3, count: 1 } }, // frog croak
          { type: 'noise', interval: 4000, lastPlayed: now + 1000, params: { freq: 100, q: 1, duration: 1, volume: 0.03 } }, // bubbles
          { type: 'chirp', interval: 8000, lastPlayed: now + 3000, params: { freqBase: 800, freqRange: 200, duration: 0.1, count: 4 } }, // insects
        ];
        break;
      case 'tundra':
        this.layers = [
          { type: 'noise', interval: 4000, lastPlayed: now, params: { freq: 1200, q: 0.15, duration: 5, volume: 0.05 } }, // howling wind
          { type: 'tone', interval: 20000, lastPlayed: now, params: { freq: 100, duration: 3, volume: 0.015, type: 'sine' } }, // distant howl
        ];
        break;
      case 'jungle':
        this.layers = [
          { type: 'chirp', interval: 2000, lastPlayed: now, params: { freqBase: 1800, freqRange: 1200, duration: 0.12, count: 4 } }, // exotic birds
          { type: 'chirp', interval: 3500, lastPlayed: now + 1000, params: { freqBase: 800, freqRange: 400, duration: 0.2, count: 2 } }, // parrots
          { type: 'noise', interval: 6000, lastPlayed: now, params: { freq: 300, q: 0.4, duration: 3, volume: 0.03 } }, // rustling leaves
          { type: 'chirp', interval: 5000, lastPlayed: now + 2500, params: { freqBase: 400, freqRange: 200, duration: 0.4, count: 1 } }, // monkey calls
        ];
        break;
      case 'mushroom':
        this.layers = [
          { type: 'tone', interval: 4000, lastPlayed: now, params: { freq: 180, duration: 2, volume: 0.02, type: 'sine' } }, // deep hum
          { type: 'chirp', interval: 6000, lastPlayed: now + 2000, params: { freqBase: 500, freqRange: 300, duration: 0.3, count: 2 } }, // spore pops
          { type: 'noise', interval: 8000, lastPlayed: now, params: { freq: 150, q: 1, duration: 1.5, volume: 0.02 } }, // underground rumble
        ];
        break;
      case 'volcanic':
        this.layers = [
          { type: 'noise', interval: 3000, lastPlayed: now, params: { freq: 100, q: 0.3, duration: 4, volume: 0.05 } }, // rumbling
          { type: 'tone', interval: 8000, lastPlayed: now + 3000, params: { freq: 60, duration: 3, volume: 0.04, type: 'sawtooth' } }, // deep eruption
          { type: 'noise', interval: 5000, lastPlayed: now + 1500, params: { freq: 800, q: 2, duration: 0.5, volume: 0.03 } }, // lava hiss
        ];
        break;
      case 'savanna':
        this.layers = [
          { type: 'noise', interval: 7000, lastPlayed: now, params: { freq: 500, q: 0.3, duration: 4, volume: 0.03 } }, // warm wind
          { type: 'chirp', interval: 4000, lastPlayed: now + 2000, params: { freqBase: 1500, freqRange: 600, duration: 0.15, count: 3 } }, // crickets
          { type: 'tone', interval: 15000, lastPlayed: now, params: { freq: 250, duration: 2, volume: 0.02, type: 'triangle' } }, // distant call
        ];
        break;
      case 'cherry':
        this.layers = [
          { type: 'chirp', interval: 3000, lastPlayed: now, params: { freqBase: 1600, freqRange: 600, duration: 0.12, count: 3 } }, // songbirds
          { type: 'noise', interval: 6000, lastPlayed: now + 2000, params: { freq: 500, q: 0.3, duration: 3, volume: 0.02 } }, // gentle breeze
          { type: 'chirp', interval: 8000, lastPlayed: now + 4000, params: { freqBase: 2200, freqRange: 400, duration: 0.08, count: 5 } }, // wind chimes
        ];
        break;
    }
  }

  private startAmbienceLoop() {
    this.ambienceInterval = setInterval(() => {
      if (!this.active || !this.musicEnabled) return;
      const now = Date.now();
      for (const layer of this.layers) {
        if (now - layer.lastPlayed >= layer.interval) {
          layer.lastPlayed = now + Math.random() * layer.interval * 0.3;
          this.playLayer(layer);
        }
      }
    }, 500);
  }

  private playLayer(layer: AmbientLayer) {
    const ctx = this.getCtx();
    const dest = this.ambienceGain!;

    switch (layer.type) {
      case 'tone': {
        const { freq, duration, volume, type } = layer.params;
        const osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq * (0.95 + Math.random() * 0.1);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + duration * 0.2);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        osc.connect(gain).connect(dest);
        osc.start();
        osc.stop(ctx.currentTime + duration);
        break;
      }
      case 'noise': {
        const { freq, q, duration, volume } = layer.params;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = q;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + duration * 0.1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        source.connect(filter).connect(gain).connect(dest);
        source.start();
        source.stop(ctx.currentTime + duration);
        break;
      }
      case 'chirp': {
        const { freqBase, freqRange, duration, count } = layer.params;
        for (let c = 0; c < count; c++) {
          const delay = c * (duration + 0.05);
          const freq = freqBase + Math.random() * freqRange;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ctx.currentTime + delay + duration);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.03, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
          osc.connect(gain).connect(dest);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + duration);
        }
        break;
      }
    }
  }

  // Simple procedural background music: pentatonic melody
  private startMusicLoop() {
    const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16]; // semitones

    const biomeRoot: Record<BiomeAmbience, number> = {
      forest: 220,    // A3
      desert: 185,    // F#3
      cave: 130,      // C3
      mountains: 247,  // B3
      swamp: 165,     // E3
      tundra: 196,    // G3
      jungle: 175,    // F3
      mushroom: 147,  // D3
      volcanic: 110,  // A2
      savanna: 208,   // G#3
      cherry: 262,    // C4
    };

    let noteIndex = 0;
    this.musicInterval = setInterval(() => {
      if (!this.active || !this.musicEnabled || !this.biome) return;

      const ctx = this.getCtx();
      const root = biomeRoot[this.biome] || 220;

      // Play 1-2 notes
      const noteCount = Math.random() < 0.3 ? 2 : 1;
      for (let n = 0; n < noteCount; n++) {
        const semitone = pentatonic[noteIndex % pentatonic.length];
        const freq = root * Math.pow(2, semitone / 12);
        const duration = 1.5 + Math.random() * 2;

        const osc = ctx.createOscillator();
        osc.type = this.biome === 'cave' ? 'sine' : 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

        // Add reverb-like effect with delay
        const delay = ctx.createDelay(0.5);
        delay.delayTime.value = 0.3;
        const delayGain = ctx.createGain();
        delayGain.gain.value = 0.3;

        osc.connect(gain).connect(this.musicGain!);
        gain.connect(delay).connect(delayGain).connect(this.musicGain!);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.5);

        noteIndex += 1 + Math.floor(Math.random() * 3);
      }
    }, 3000 + Math.random() * 2000);
  }
}

export const ambientMusic = new AmbientMusicSystem();
