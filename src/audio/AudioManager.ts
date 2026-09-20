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
