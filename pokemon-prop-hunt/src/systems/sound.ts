type SoundName =
  | 'pokeball_throw'
  | 'pokeball_bounce'
  | 'catch_wiggle'
  | 'catch_success'
  | 'catch_fail'
  | 'pokemon_dodge'
  | 'footsteps'
  | 'round_start'
  | 'round_end'
  | 'victory'
  | 'defeat';

const SOUND_COOLDOWNS: Record<SoundName, number> = {
  pokeball_throw: 200,
  pokeball_bounce: 300,
  catch_wiggle: 500,
  catch_success: 1000,
  catch_fail: 1000,
  pokemon_dodge: 500,
  footsteps: 150,
  round_start: 3000,
  round_end: 3000,
  victory: 5000,
  defeat: 5000,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

class ChiptuneBGM {
  private ctx: AudioContext | null = null;

  private schedulerTimer: number | null = null;

  private isPlaying = false;

  private nextNoteTime = 0;

  private step = 0;

  private readonly lookaheadSeconds = 0.2;

  private readonly checkIntervalMs = 50;

  private readonly sixteenthSeconds = 60 / 130 / 4;

  private readonly melodySteps = [
    330, 0, 392, 0, 523, 0, 659, 0,
    440, 0, 330, 0, 523, 0, 440, 0,
    349, 0, 440, 0, 523, 0, 698, 0,
    392, 0, 494, 0, 587, 0, 784, 0,
  ];

  private readonly bassSteps = [131, 220, 175, 196];

  private outputGain: GainNode | null = null;

  private volume = 0.07;

  setContext(ctx: AudioContext) {
    if (this.ctx === ctx && this.outputGain) {
      return;
    }

    this.ctx = ctx;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.setValueAtTime(this.isPlaying ? this.volume : 0, ctx.currentTime);
    this.outputGain.connect(ctx.destination);
  }

  setVolume(value: number) {
    this.volume = clamp01(value);
    if (!this.ctx || !this.outputGain) {
      return;
    }
    const now = this.ctx.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.linearRampToValueAtTime(this.isPlaying ? this.volume : 0, now + 0.08);
  }

  start() {
    if (!this.ctx || !this.outputGain || this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    const now = this.ctx.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(this.volume, now + 0.2);

    this.schedulerTimer = window.setInterval(() => {
      this.scheduleLookahead();
    }, this.checkIntervalMs);
  }

  stop() {
    if (!this.ctx || !this.outputGain) {
      this.isPlaying = false;
      return;
    }

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    const now = this.ctx.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    this.isPlaying = false;
  }

  private scheduleLookahead() {
    if (!this.ctx || !this.outputGain || !this.isPlaying) {
      return;
    }

    const horizon = this.ctx.currentTime + this.lookaheadSeconds;
    while (this.nextNoteTime < horizon) {
      this.scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.sixteenthSeconds;
      this.step = (this.step + 1) % this.melodySteps.length;
    }
  }

  private scheduleStep(step: number, startTime: number) {
    if (!this.ctx || !this.outputGain) {
      return;
    }

    const melodyFreq = this.melodySteps[step];
    if (melodyFreq > 0) {
      this.scheduleTone(melodyFreq, startTime, 0.09, 0.035, 'square');
    }

    if (step % 8 === 0) {
      const bassFreq = this.bassSteps[Math.floor(step / 8) % this.bassSteps.length];
      this.scheduleTone(bassFreq, startTime, 0.35, 0.05, 'triangle');
    }
  }

  private scheduleTone(
    frequency: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ) {
    if (!this.ctx || !this.outputGain) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const endTime = startTime + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(gain);
    gain.connect(this.outputGain);

    osc.start(startTime);
    osc.stop(endTime);
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;

  private unlocked = false;

  private lastPlayed: Partial<Record<SoundName, number>> = {};

  private bgmRequested = false;

  private readonly bgm = new ChiptuneBGM();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const unlockAudio = () => {
      this.unlocked = true;
      void this.ensureContext();
      if (this.bgmRequested) {
        this.startBGM();
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }

  private ensureContext() {
    if (!this.unlocked) {
      return null;
    }

    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.bgm.setContext(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private scheduleTone(
    ctx: AudioContext,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    offset = 0,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }

  private scheduleSweep(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    offset = 0,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }

  private scheduleNoise(
    ctx: AudioContext,
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    cutoff: number,
    offset = 0,
  ) {
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(duration * sampleRate);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      channelData[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;

    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    const end = start + duration;

    filter.frequency.setValueAtTime(cutoff, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(start);
    source.stop(end);
  }

  play(name: SoundName) {
    const now = performance.now();
    const cooldown = SOUND_COOLDOWNS[name];
    const previous = this.lastPlayed[name] ?? 0;

    if (now - previous < cooldown) {
      return;
    }

    this.lastPlayed[name] = now;

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    switch (name) {
      case 'pokeball_throw':
        this.scheduleNoise(ctx, 0.1, 0.035, 'highpass', 1200);
        this.scheduleSweep(ctx, 600, 200, 0.15, 0.06, 'square');
        break;
      case 'pokeball_bounce':
        this.scheduleTone(ctx, 180, 0.08, 'sine', 0.08);
        break;
      case 'catch_wiggle':
        this.scheduleTone(ctx, 880, 0.04, 'square', 0.05, 0);
        this.scheduleTone(ctx, 880, 0.04, 'square', 0.05, 0.25);
        this.scheduleTone(ctx, 880, 0.04, 'square', 0.05, 0.5);
        break;
      case 'catch_success':
        this.scheduleTone(ctx, 523, 0.1, 'square', 0.07, 0);
        this.scheduleTone(ctx, 659, 0.1, 'square', 0.07, 0.12);
        this.scheduleTone(ctx, 784, 0.12, 'square', 0.07, 0.24);
        this.scheduleTone(ctx, 1047, 0.2, 'square', 0.07, 0.38);
        break;
      case 'catch_fail':
        this.scheduleTone(ctx, 659, 0.1, 'square', 0.06, 0);
        this.scheduleTone(ctx, 523, 0.12, 'square', 0.06, 0.12);
        this.scheduleTone(ctx, 440, 0.15, 'square', 0.06, 0.26);
        this.scheduleTone(ctx, 349, 0.2, 'square', 0.06, 0.43);
        break;
      case 'pokemon_dodge':
        this.scheduleSweep(ctx, 300, 900, 0.08, 0.05, 'square');
        break;
      case 'footsteps':
        this.scheduleTone(ctx, 90, 0.04, 'triangle', 0.03);
        break;
      case 'round_start':
        this.scheduleTone(ctx, 392, 0.08, 'square', 0.08, 0);
        this.scheduleTone(ctx, 494, 0.08, 'square', 0.08, 0.1);
        this.scheduleTone(ctx, 587, 0.1, 'square', 0.08, 0.2);
        this.scheduleTone(ctx, 784, 0.15, 'square', 0.08, 0.32);
        this.scheduleTone(ctx, 587, 0.06, 'square', 0.08, 0.62);
        this.scheduleTone(ctx, 784, 0.2, 'square', 0.08, 0.72);
        break;
      case 'round_end':
        this.scheduleTone(ctx, 784, 0.1, 'square', 0.07, 0);
        this.scheduleTone(ctx, 659, 0.1, 'square', 0.07, 0.12);
        this.scheduleTone(ctx, 523, 0.12, 'square', 0.07, 0.24);
        this.scheduleTone(ctx, 392, 0.25, 'triangle', 0.07, 0.38);
        break;
      case 'victory':
        this.scheduleTone(ctx, 523, 0.08, 'square', 0.08, 0);
        this.scheduleTone(ctx, 659, 0.08, 'square', 0.08, 0.1);
        this.scheduleTone(ctx, 784, 0.08, 'square', 0.08, 0.2);
        this.scheduleTone(ctx, 1047, 0.08, 'square', 0.08, 0.3);
        this.scheduleTone(ctx, 659, 0.1, 'square', 0.08, 0.58);
        this.scheduleTone(ctx, 784, 0.1, 'square', 0.08, 0.7);
        this.scheduleTone(ctx, 1047, 0.1, 'square', 0.08, 0.82);
        this.scheduleTone(ctx, 1318, 0.3, 'square', 0.08, 0.94);
        break;
      case 'defeat':
        this.scheduleTone(ctx, 659, 0.12, 'square', 0.06, 0);
        this.scheduleTone(ctx, 587, 0.12, 'square', 0.06, 0.14);
        this.scheduleTone(ctx, 523, 0.12, 'square', 0.06, 0.28);
        this.scheduleTone(ctx, 494, 0.12, 'square', 0.06, 0.42);
        this.scheduleTone(ctx, 440, 0.3, 'triangle', 0.06, 0.56);
        break;
      default:
        break;
    }
  }

  startBGM() {
    this.bgmRequested = true;
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    this.bgm.setContext(ctx);
    this.bgm.start();
  }

  stopBGM() {
    this.bgmRequested = false;
    this.bgm.stop();
  }

  setBGMVolume(value: number) {
    this.bgm.setVolume(value);
  }
}

export const soundManager = new SoundManager();
