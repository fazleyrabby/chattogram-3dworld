/**
 * Audio (spec §57).
 *
 * Ambience is a real street recording (traffic, horns and sellers), looped on the
 * master bus, with a synthesized fallback if it cannot be decoded. Footsteps are
 * still synthesized. Everything routes through one AudioContext/master gain so
 * more layers (birds, interior, weather) can be added later.
 *
 * Ambience credit: "Sounds of Traffic and Sellers" by Ready Street, via Wikimedia
 * Commons, licensed CC BY-SA 4.0. See docs/references.md.
 */
const AMBIENCE_URL = "/audio/ambience-street.ogg";

export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private muted = false;

  private ambienceBuffer?: AudioBuffer;
  private ambienceGain?: GainNode;
  private ambienceStarted = false;

  /** Creates the context without resuming (safe before a user gesture). */
  ensureContext(): void {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.noise = this.createNoiseBuffer();
  }

  /** Resumes the context. Call from a user gesture. */
  resume(): void {
    this.ensureContext();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  get isReady(): boolean {
    return this.ctx?.state === "running";
  }

  /** Preloads and decodes the real ambience recording. */
  async loadAmbience(url = AMBIENCE_URL): Promise<void> {
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      this.ambienceBuffer = await this.ctx.decodeAudioData(data);
    } catch {
      // Keep the synthesized fallback.
    }
  }

  /** Starts the ambience bed (real recording, else synthesized hum). */
  startAmbience(): void {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.ambienceStarted) return;
    this.ambienceStarted = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    this.ambienceGain = gain;

    if (this.ambienceBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = this.ambienceBuffer;
      source.loop = true;
      // Soften the recording so it sits under the game, not on top of it.
      const warm = ctx.createBiquadFilter();
      warm.type = "lowpass";
      warm.frequency.value = 5200;
      source.connect(warm);
      warm.connect(gain);
      source.start();
    } else if (this.noise) {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 260;
      source.connect(lowpass);
      lowpass.connect(gain);
      source.start();
    }

    gain.gain.setTargetAtTime(0.08, ctx.currentTime, 1.5);
  }

  /** Keeps the ambience subtle and level with the time of day. */
  updateAmbience(_delta: number, isNight: boolean): void {
    if (!this.ctx || !this.ambienceGain || this.muted) return;
    this.ambienceGain.gain.setTargetAtTime(isNight ? 0.05 : 0.09, this.ctx.currentTime, 1.0);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** A soft footstep (synthesized). `intensity` 0..1 scales loudness/brightness. */
  footstep(intensity = 0.4): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noise;
    if (!ctx || !master || !noise || this.muted) return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
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
