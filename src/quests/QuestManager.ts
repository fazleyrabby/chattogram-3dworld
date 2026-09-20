import type { NamedBuilding } from "@/world/Buildings";
import type { HUD } from "@/ui/HUD";
import type { QuestBeacon } from "@/world/QuestBeacon";
import type { Quest, QuestStop } from "@/quests/quest";

/**
 * Tracks quest progress (spec §75). Stops are completed when the landmark is
 * discovered (player walks within range). The current objective drives the HUD
 * tracker, the world beacon and the minimap marker.
 */
export class QuestManager {
  private readonly done = new Set<string>();

  constructor(
    private readonly quest: Quest,
    private readonly landmarks: NamedBuilding[],
    private readonly hud: HUD,
    private readonly beacon: QuestBeacon,
  ) {
    this.refresh();
  }

  get total(): number {
    return this.quest.stops.length;
  }

  get completed(): number {
    return this.done.size;
  }

  currentStop(): QuestStop | null {
    return this.quest.stops.find((stop) => !this.done.has(stop.landmark)) ?? null;
  }

  currentLandmark(): NamedBuilding | null {
    const stop = this.currentStop();
    if (!stop) return null;
    return this.landmarks.find((l) => l.name === stop.landmark) ?? null;
  }

  /** Called by the discovery system when a landmark is first reached. */
  notifyDiscovered(name: string): void {
    const isStop = this.quest.stops.some((stop) => stop.landmark === name);
    if (!isStop || this.done.has(name)) return;
    this.done.add(name);
    this.refresh();
  }

  update(): void {
    this.beacon.setTarget(this.currentLandmark());
  }

  private refresh(): void {
    const current = this.currentStop();
    this.hud.setQuest(
      this.quest.title,
      current ? current.landmark : null,
      this.done.size,
      this.total,
    );
  }
}
