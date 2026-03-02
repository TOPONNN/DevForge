import { Howler } from 'howler';

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

class SoundManager {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx) {
      const audioContext = Howler.ctx;
      this.ctx = audioContext ?? new window.AudioContext();
    }
    return this.ctx;
  }

  private scheduleTone(frequency: number, duration: number, type: OscillatorType, volume: number, offset = 0) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + offset;
    const end = start + duration;

    osc.frequency.setValueAtTime(frequency, start);
    osc.type = type;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }

  private scheduleSweep(startFreq: number, endFreq: number, duration: number, volume: number, type: OscillatorType) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), end);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }

  private scheduleNoise(duration: number, volume: number, filterType: BiquadFilterType, cutoff: number) {
    const ctx = this.getContext();
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
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  play(name: SoundName) {
    if (this.getContext().state === 'suspended') {
      void this.getContext().resume();
    }

    switch (name) {
      case 'pokeball_throw':
        this.scheduleNoise(0.18, 0.12, 'highpass', 900);
        this.scheduleSweep(900, 180, 0.2, 0.08, 'triangle');
        break;
      case 'pokeball_bounce':
        this.scheduleTone(140, 0.12, 'sine', 0.2);
        this.scheduleTone(90, 0.16, 'triangle', 0.12, 0.03);
        break;
      case 'catch_wiggle':
        this.scheduleTone(800, 0.05, 'square', 0.08);
        this.scheduleTone(680, 0.06, 'square', 0.08, 0.06);
        break;
      case 'catch_success':
        this.scheduleTone(440, 0.12, 'triangle', 0.08);
        this.scheduleTone(554, 0.14, 'triangle', 0.08, 0.12);
        this.scheduleTone(740, 0.22, 'triangle', 0.1, 0.24);
        break;
      case 'catch_fail':
        this.scheduleTone(520, 0.12, 'sawtooth', 0.09);
        this.scheduleTone(360, 0.14, 'sawtooth', 0.08, 0.1);
        this.scheduleTone(220, 0.2, 'triangle', 0.08, 0.24);
        break;
      case 'pokemon_dodge':
        this.scheduleNoise(0.12, 0.1, 'bandpass', 750);
        this.scheduleSweep(260, 700, 0.08, 0.06, 'sine');
        break;
      case 'footsteps':
        this.scheduleTone(110, 0.06, 'triangle', 0.05);
        this.scheduleNoise(0.04, 0.05, 'lowpass', 300);
        break;
      case 'round_start':
        this.scheduleTone(392, 0.18, 'square', 0.09);
        this.scheduleTone(523, 0.18, 'square', 0.09, 0.16);
        this.scheduleTone(659, 0.24, 'triangle', 0.1, 0.34);
        break;
      case 'round_end':
        this.scheduleTone(523, 0.15, 'triangle', 0.08);
        this.scheduleTone(440, 0.2, 'triangle', 0.08, 0.14);
        this.scheduleTone(349, 0.3, 'triangle', 0.1, 0.32);
        break;
      case 'victory':
        this.scheduleTone(523, 0.12, 'square', 0.08);
        this.scheduleTone(659, 0.12, 'square', 0.08, 0.1);
        this.scheduleTone(784, 0.14, 'triangle', 0.09, 0.2);
        this.scheduleTone(1047, 0.28, 'triangle', 0.1, 0.32);
        break;
      case 'defeat':
        this.scheduleTone(440, 0.14, 'sawtooth', 0.07);
        this.scheduleTone(370, 0.16, 'sawtooth', 0.07, 0.12);
        this.scheduleTone(294, 0.18, 'triangle', 0.08, 0.26);
        this.scheduleTone(220, 0.32, 'triangle', 0.08, 0.42);
        break;
      default:
        break;
    }
  }
}

export const soundManager = new SoundManager();
