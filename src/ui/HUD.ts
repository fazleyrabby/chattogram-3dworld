import type { Player } from "@/player/Player";
import { localToGeo } from "@/geography/Projection";

/**
 * Minimal heads-up display (spec §56). Kept deliberately small for Milestone 1;
 * landmark prompts and the minimap arrive in later milestones.
 */
export class HUD {
  private readonly fpsEl: HTMLSpanElement;
  private readonly coordEl: HTMLSpanElement;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hud__title">CHATTAGRAM</div>
      <div class="hud__stats">
        <span data-fps>--</span> FPS &middot;
        <span data-coord>--</span>
      </div>
      <div class="hud__controls">
        WASD Move &middot; Mouse Drag Camera &middot; Wheel Zoom &middot; Shift Sprint &middot; Space Jump
      </div>
    `;

    this.fpsEl = root.querySelector("[data-fps]") as HTMLSpanElement;
    this.coordEl = root.querySelector("[data-coord]") as HTMLSpanElement;
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
