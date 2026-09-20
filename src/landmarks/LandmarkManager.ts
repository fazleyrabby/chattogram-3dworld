import type { NamedBuilding } from "@/world/Buildings";
import type { Player } from "@/player/Player";
import type { Input } from "@/player/Input";
import type { HUD } from "@/ui/HUD";
import type { LandmarkPanel } from "@/ui/LandmarkPanel";

const INTERACT_RANGE = 22;

/**
 * Proximity interaction for landmarks (spec §31).
 *
 * Finds the nearest named place, shows an `[E] Explore` prompt, opens the info
 * panel on E or from a label click, and closes it on Escape.
 */
export class LandmarkManager {
  constructor(
    private readonly landmarks: NamedBuilding[],
    private readonly panel: LandmarkPanel,
    private readonly hud: HUD,
  ) {}

  update(player: Player, input: Input): void {
    let best: NamedBuilding | null = null;
    let bestDistance = INTERACT_RANGE;
    for (const landmark of this.landmarks) {
      const dx = landmark.x - player.position.x;
      const dz = landmark.z - player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < bestDistance) {
        best = landmark;
        bestDistance = distance;
      }
    }
    this.hud.setPrompt(
      best && !this.panel.isOpen ? `[E] Explore ${best.name}` : null,
    );

    if (input.wasPressed("KeyE") && best) {
      void this.panel.show(best);
    }
    if (input.wasPressed("Escape")) {
      this.panel.hide();
    }
  }

  /** Opens the panel for a landmark by name (used by world-label clicks). */
  selectByName(name: string): void {
    const landmark = this.landmarks.find((item) => item.name === name);
    if (landmark) void this.panel.show(landmark);
  }
}
