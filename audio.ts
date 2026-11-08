/**
 * San Fermín Run - Realistic Web Audio Engine
 * High fidelity procedural & recorded sound design for authentic Pamplona encierro ambiance.
 */

const MERCADERES_AUDIO_SRC = new URL('../assets/audio/mercaderes_jaleo.mp3', import.meta.url).href;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private crowdNode: AudioNode | null = null;
  private crowdGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private mercaderesGain: GainNode | null = null;
  private mercaderesFilter1: BiquadFilterNode | null = null;
  private mercaderesFilter2: BiquadFilterNode | null = null;
  private mercaderesAudio: HTMLAudioElement | null = null;
  private isInitialized: boolean = false;
  private lastHoofTime: number = 0;
  private lastFootstepTime: number = 0;

  constructor() {
    // Check localStorage for sound preference
    const saved = localStorage.getItem('sanfermin_muted');
    this.isMuted = saved === 'true';
  }

  public init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.mercaderesAudio) {
        try {
          this.mercaderesAudio = new Audio(MERCADERES_AUDIO_SRC);
          this.mercaderesAudio.loop = true;
          this.mercaderesAudio.volume = 0;
          this.mercaderesAudio.preload = 'auto';
        } catch (e) {
          console.warn('Could not load mercaderes audio element', e);
        }
      }
      if (!this.isInitialized) {
        this.isInitialized = true;
        this.startCrowdAmbiance();
      }
    } catch {
      console.warn('AudioContext not supported');
    }
  }

  public ensureRunning() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.mercaderesAudio && !this.isMuted && this.mercaderesAudio.volume > 0.02 && this.mercaderesAudio.paused) {
      this.mercaderesAudio.play().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('sanfermin_muted', String(muted));
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setValueAtTime(muted ? 0 : 0.12, this.ctx.currentTime);
    }
    if (this.mercaderesGain && this.ctx) {
      this.mercaderesGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (this.mercaderesAudio) {
      if (muted) {
        this.mercaderesAudio.volume = 0;
        this.mercaderesAudio.pause();
      }
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Chupinazo (Festival opening rocket launch + explosive boom)
  public playChupinazo() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Whistle rocket launch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.8);
    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.9);

    // 2. Heavy explosive boom at apex
    setTimeout(() => {
      if (this.isMuted || !this.ctx) return;
      const t = this.ctx.currentTime;
      // Low sub rumble
      const boom = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boom.type = 'triangle';
      boom.frequency.setValueAtTime(110, t);
      boom.frequency.exponentialRampToValueAtTime(30, t + 1.2);
      boomGain.gain.setValueAtTime(0.4, t);
      boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      boom.connect(boomGain);
      boomGain.connect(this.ctx.destination);
      boom.start(t);
      boom.stop(t + 1.6);

      // Noise burst for explosion crack
      const bufferSize = this.ctx.sampleRate * 1.0;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.2));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(150, t + 0.8);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.35, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(t);
    }, 780);
  }

  // Realistic human footstep on stone cobblestone
  public playFootstep() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootstepTime < 0.15) return;
    this.lastFootstepTime = now;

    // High grit click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Thunderous Bull Hooves galloping on cobblestones
  public playHoofBeat(intensity: number = 0.5) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHoofTime < 0.1) return;
    this.lastHoofTime = now;

    const volume = Math.min(0.4, Math.max(0.05, intensity * 0.35));

    // Deep heavy low-end thud of 600kg fighting bull
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(85, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.1);
    subGain.gain.setValueAtTime(volume, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.13);

    // Stone horseshoe / hoof impact crack
    const stoneOsc = this.ctx.createOscillator();
    const stoneGain = this.ctx.createGain();
    stoneOsc.type = 'triangle';
    stoneOsc.frequency.setValueAtTime(450, now);
    stoneOsc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
    stoneGain.gain.setValueAtTime(volume * 0.6, now);
    stoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    stoneOsc.connect(stoneGain);
    stoneGain.connect(this.ctx.destination);
    stoneOsc.start(now);
    stoneOsc.stop(now + 0.06);
  }

  // Bull angry snort / breath exhaling steam
  public playBullSnort() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.3);
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // Jump leap sound (air whoosh + athletic push)
  public playJump() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Slide sound (cloth drag and stone friction)
  public playSlide() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // Adrenaline Sprint Dash
  public playDash() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Stumble collision sound
  public playStumble() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Wood crack / impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Tense Heartbeat when bull is dangerously close (< 4m)
  public playHeartbeat() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Stop street fiesta music and mute it completely (e.g. for Game Over)
  public stopMusic() {
    if (this.mercaderesAudio) {
      this.mercaderesAudio.volume = 0;
      this.mercaderesAudio.pause();
      this.mercaderesAudio.currentTime = 0;
    }
    if (this.mercaderesGain && this.ctx) {
      this.mercaderesGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  // Defeat / Caught by the bull
  public playGameOver() {
    this.stopMusic();

    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Heavy crash impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  // Background Pamplona crowd murmurs & cheers
  private startCrowdAmbiance() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Paul Kellet's filter for rich full-spectrum pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // Normalize buffer to 0.95 full scale so it has rich audible power
    let peak = 0;
    for (let i = 0; i < bufferSize; i++) {
      if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
    }
    if (peak > 0) {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (data[i] / peak) * 0.95;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // 1. Warm street ambient murmur layer
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.ambientFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx.currentTime);

    noise.connect(this.ambientFilter);
    this.ambientFilter.connect(this.crowdGain);
    this.crowdGain.connect(this.ctx.destination);

    // 2. Specialized Calle Mercaderes dense balcony crowd roar layer (resonant vocal formants)
    this.mercaderesFilter1 = this.ctx.createBiquadFilter();
    this.mercaderesFilter1.type = 'bandpass';
    this.mercaderesFilter1.frequency.setValueAtTime(580, this.ctx.currentTime);
    this.mercaderesFilter1.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.mercaderesFilter2 = this.ctx.createBiquadFilter();
    this.mercaderesFilter2.type = 'bandpass';
    this.mercaderesFilter2.frequency.setValueAtTime(1250, this.ctx.currentTime);
    this.mercaderesFilter2.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.mercaderesGain = this.ctx.createGain();
    this.mercaderesGain.gain.setValueAtTime(0, this.ctx.currentTime);

    noise.connect(this.mercaderesFilter1);
    this.mercaderesFilter1.connect(this.mercaderesGain);

    noise.connect(this.mercaderesFilter2);
    this.mercaderesFilter2.connect(this.mercaderesGain);

    this.mercaderesGain.connect(this.ctx.destination);

    noise.start();
    this.crowdNode = noise;
  }

  public updateCrowdExcitement(speedFactor: number, dangerFactor: number, mercaderesIntensity: number = 0) {
    this.ensureRunning();

    // 1. Play real human crowd "jaleo" (authentic cheering, whistling, yelling & applause)
    if (this.mercaderesAudio) {
      if (this.isMuted || mercaderesIntensity <= 0.01) {
        this.mercaderesAudio.volume = 0;
        if (!this.mercaderesAudio.paused && mercaderesIntensity <= 0.001) {
          this.mercaderesAudio.pause();
        }
      } else {
        const targetVol = Math.max(0, Math.min(1.0, mercaderesIntensity * 0.90));
        this.mercaderesAudio.volume = targetVol;
        if (this.mercaderesAudio.paused) {
          this.mercaderesAudio.play().catch(() => {});
        }
      }
    }

    // 2. Synthesized ambient street murmur
    if (!this.ctx || !this.ambientFilter || !this.crowdGain || this.isMuted) return;
    const targetFreq = 650 + speedFactor * 350 + dangerFactor * 450;
    const targetVol = 0.08 + speedFactor * 0.06 + dangerFactor * 0.08;
    this.ambientFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.2);
    this.crowdGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.2);

    // Dynamic Calle Mercaderes crowd roar swell
    if (this.mercaderesGain) {
      const targetMercaderesVol = this.isMuted ? 0 : mercaderesIntensity * 0.35;
      this.mercaderesGain.gain.setTargetAtTime(targetMercaderesVol, this.ctx.currentTime, 0.18);
    }
  }

  // Authentic collective Pamplona balcony cheer / shout surge for Calle Mercaderes
  public playCrowdCheer(intensity: number = 1.0) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 1.3 + Math.random() * 0.5;

    // 1. Resonant vocal chorus ("¡Aupa! / ¡Ooooh!")
    const rootFreq = 220 + Math.random() * 50;
    const pitches = [rootFreq * 0.98, rootFreq * 1.02, rootFreq * 1.48];

    const vocalGain = this.ctx.createGain();
    const peakVol = 0.28 * Math.min(1.0, intensity);
    vocalGain.gain.setValueAtTime(0.001, now);
    vocalGain.gain.exponentialRampToValueAtTime(peakVol, now + 0.22);
    vocalGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const vocalFilter = this.ctx.createBiquadFilter();
    vocalFilter.type = 'bandpass';
    vocalFilter.frequency.setValueAtTime(720, now);
    vocalFilter.frequency.exponentialRampToValueAtTime(880, now + 0.3);
    vocalFilter.frequency.exponentialRampToValueAtTime(620, now + duration);
    vocalFilter.Q.setValueAtTime(3.5, now);

    vocalGain.connect(this.ctx.destination);
    vocalFilter.connect(vocalGain);

    for (const pitch of pitches) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.06, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.94, now + duration);
      osc.connect(vocalFilter);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // 2. Turbulent Crowd Roar Wash & Applause
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.85;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1150, now);
    noiseFilter.Q.setValueAtTime(2.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.22 * Math.min(1.0, intensity), now + 0.25);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + duration + 0.05);
  }
}

export const sound = new SoundEngine();
