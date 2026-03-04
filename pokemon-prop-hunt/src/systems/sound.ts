import { Howl } from 'howler';

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

type Mp3SoundName = Exclude<SoundName, 'footsteps'>;

/**
 * Sound file paths and volumes for each game event.
 *
 * pokeball_throw  → Pokeball Open (포켓볼 열리는 소리)
 * pokeball_bounce → Pokémon plink (통통 튀는 효과음)
 * catch_wiggle    → Pokeball Waiting (포켓볼 흔들림 소리)
 * catch_success   → Caught a Pokemon! (포획 성공 팡파레)
 * catch_fail      → Pokeball ComeBack (포켓볼 튕겨나가는 소리)
 * pokemon_dodge   → Pokeball Return (회피 스워시 소리)
 * round_start     → Pokemon Battle (배틀 시작 팡파레)
 * round_end       → Classic Pokemon Heal (회복 징글)
 * victory         → Pokemon Battle Win (승리 테마)
 * defeat          → Low Health Pokémon (패배 긴장감 사운드)
 */
const SOUND_CONFIG: Record<Mp3SoundName, { path: string; volume: number }> = {
  pokeball_throw: { path: '/sounds/pokeball_throw.mp3', volume: 0.5 },
  pokeball_bounce: { path: '/sounds/pokeball_bounce.mp3', volume: 0.4 },
  catch_wiggle: { path: '/sounds/catch_wiggle.mp3', volume: 0.4 },
  catch_success: { path: '/sounds/catch_success.mp3', volume: 0.6 },
  catch_fail: { path: '/sounds/catch_fail.mp3', volume: 0.5 },
  pokemon_dodge: { path: '/sounds/pokemon_dodge.mp3', volume: 0.4 },
  round_start: { path: '/sounds/round_start.mp3', volume: 0.5 },
  round_end: { path: '/sounds/round_end.mp3', volume: 0.5 },
  victory: { path: '/sounds/victory.mp3', volume: 0.6 },
  defeat: { path: '/sounds/defeat.mp3', volume: 0.5 },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/* ------------------------------------------------------------------ */
/*  ChiptuneBGM — procedural 8-bit background music (unchanged)       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  SoundManager — Howler.js MP3 playback + synthesized footsteps     */
/* ------------------------------------------------------------------ */

class SoundManager {
  private ctx: AudioContext | null = null;

  private unlocked = false;

  private lastPlayed: Partial<Record<SoundName, number>> = {};

  private bgmRequested = false;

  private readonly bgm = new ChiptuneBGM();

  private readonly howls = new Map<Mp3SoundName, Howl>();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    // Preload all MP3 sound effects via Howler
    for (const [name, config] of Object.entries(SOUND_CONFIG) as [Mp3SoundName, { path: string; volume: number }][]) {
      this.howls.set(
        name,
        new Howl({
          src: [config.path],
          volume: config.volume,
          preload: true,
        }),
      );
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

  /**
   * Footsteps fire at 150ms intervals — too frequent for MP3 playback.
   * Kept as a lightweight Web Audio oscillator for performance.
   */
  private playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    const end = start + 0.04;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.03, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }

  play(name: SoundName) {
    const now = performance.now();
    const cooldown = SOUND_COOLDOWNS[name];
    const previous = this.lastPlayed[name] ?? 0;

    if (now - previous < cooldown) {
      return;
    }

    this.lastPlayed[name] = now;

    // Footsteps stay synthesized for performance
    if (name === 'footsteps') {
      this.playFootstep();
      return;
    }

    const howl = this.howls.get(name);
    if (howl) {
      howl.play();
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
