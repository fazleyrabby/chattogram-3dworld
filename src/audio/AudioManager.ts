/**
 * Audio layer (spec §57).
 *
 * Milestone: procedurally synthesized footsteps (no asset files). The same
 * AudioContext/master bus will host city ambience, birds, traffic and
 * environmental loops later, so everything routes through here.
 *
 * Browsers block audio until a user gesture, so resume() must be called from a
 * click/keypress handler.
 */
export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private muted = false;
  private humGain?: GainNode;
  private ambienceTimer = 1.5;

  /** Creates/resumes the audio context. Call from a user gesture. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.noise = this.createNoiseBuffer();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  get isReady(): boolean {
    return this.ctx?.state === "running";
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Starts the continuous city ambience (spec §57): a low traffic hum plus
   * randomly scheduled horns and bird chirps. Safe to call repeatedly.
   */
  startAmbience(): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noise;
    if (!ctx || !master || !noise || this.humGain) return;

    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 320;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(master);
    source.start();

    this.humGain = gain;
  }

  /** Drives ambience events; call each frame. `isNight` scales the hum down. */
  updateAmbience(delta: number, isNight: boolean): void {
    if (!this.ctx || !this.humGain || this.muted) return;
    this.humGain.gain.setTargetAtTime(isNight ? 0.028 : 0.06, this.ctx.currentTime, 0.5);

    this.ambienceTimer -= delta;
    if (this.ambienceTimer > 0) return;
    this.ambienceTimer = (isNight ? 2.5 : 1.2) + Math.random() * (isNight ? 4 : 3);

    const roll = Math.random();
    if (!isNight && roll < 0.45) this.bird();
    else if (roll < 0.8) this.horn();
    else this.bird();
  }

  /** A short two-tone horn. */
  horn(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    gain.connect(master);

    for (const freq of [392, 466]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  /** A quick bird chirp. */
  bird(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const base = 1800 + Math.random() * 700;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.07);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * A soft footstep. `intensity` (0..1) scales loudness/brightness so walking and
   * sprinting differ.
   */
  footstep(intensity = 0.4): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noise;
    if (!ctx || !master || !noise || this.muted) return;

    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = noise;
    // Randomize within a stride so steps don't sound mechanical.
    source.playbackRate.value = 0.85 + Math.random() * 0.25;
    const offset = Math.random() * (noise.duration - 0.25);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 520 + intensity * 900;
    lowpass.Q.value = 0.7;

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 90;

    const gain = ctx.createGain();
    const peak = 0.22 + intensity * 0.5;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13 + intensity * 0.05);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(master);

    source.start(now, offset, 0.25);
    source.stop(now + 0.25);
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const length = Math.floor(ctx.sampleRate * 1.0);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
