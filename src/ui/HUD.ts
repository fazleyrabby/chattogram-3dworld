import type { Player } from "@/player/Player";
import { localToGeo } from "@/geography/Projection";

/**
 * Minimal heads-up display (spec §56). Kept deliberately small for Milestone 1;
 * landmark prompts and the minimap arrive in later milestones.
 */
export class HUD {
  private readonly fpsEl: HTMLSpanElement;
  private readonly coordEl: HTMLSpanElement;
  private readonly promptEl: HTMLDivElement;
  private readonly clockEl: HTMLSpanElement;
  private readonly gpsEl: HTMLDivElement;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hud__title">CHATTAGRAM</div>
      <div class="hud__stats">
        <span data-fps>--</span> FPS &middot;
        <span data-coord>--</span> &middot;
        <span data-clock>--:--</span>
      </div>
      <div class="hud__gps" data-gps hidden></div>
      <div class="hud__prompt" hidden></div>
      <div class="hud__controls">
        WASD Move &middot; Mouse Drag Camera &middot; Wheel Zoom &middot; Shift Sprint &middot; Space Jump<br />
        Riding: W Accelerate &middot; S Brake / Reverse &middot; A/D Steer &middot; Space Handbrake<br />
        E Explore &middot; C Car &middot; B Bicycle &middot; F Ride &middot; M Minimap &middot; T Fast-forward time &middot; L My location &middot; G GPS track
      </div>
    `;

    this.fpsEl = root.querySelector("[data-fps]") as HTMLSpanElement;
    this.coordEl = root.querySelector("[data-coord]") as HTMLSpanElement;
    this.promptEl = root.querySelector(".hud__prompt") as HTMLDivElement;
    this.clockEl = root.querySelector("[data-clock]") as HTMLSpanElement;
    this.gpsEl = root.querySelector("[data-gps]") as HTMLDivElement;
  }

  setClock(label: string): void {
    if (this.clockEl.textContent !== label) this.clockEl.textContent = label;
  }

  /** Shows a GPS status line, or hides it when null. */
  setGps(text: string | null): void {
    if (!text) {
      if (!this.gpsEl.hidden) this.gpsEl.hidden = true;
      return;
    }
    if (this.gpsEl.textContent !== text) this.gpsEl.textContent = text;
    if (this.gpsEl.hidden) this.gpsEl.hidden = false;
  }

  /** Shows or hides the contextual interaction prompt (spec §56). */
  setPrompt(text: string | null): void {
    if (!text) {
      if (!this.promptEl.hidden) this.promptEl.hidden = true;
      return;
    }
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
    if (this.promptEl.hidden) this.promptEl.hidden = false;
  }

  update(delta: number, player: Player): void {
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsEl.textContent = String(fps);
      this.fpsAccum = 0;
      this.fpsFrames = 0;

      const geo = localToGeo({ x: player.position.x, z: player.position.z });
      this.coordEl.textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
    }
  }
}
