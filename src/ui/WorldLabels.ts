import * as THREE from "three";
import type { NamedBuilding } from "@/world/Buildings";
import type { HeightProvider } from "@/geography/WorldHeight";

const MAX_DISTANCE = 400;
const FADE_START = 260;
const MAX_VISIBLE = 12;

interface LabelItem {
  name: string;
  world: THREE.Vector3;
  el: HTMLDivElement;
  distance: number;
}

/**
 * Floating world labels for authentic/named buildings (spec §16, §33).
 *
 * HTML overlay projected from world space: labels fade with distance, only the
 * nearest few show, and they never capture pointer events.
 */
export class WorldLabels {
  private readonly container: HTMLDivElement;
  private readonly items: LabelItem[] = [];
  private readonly projected = new THREE.Vector3();

  constructor(
    buildings: NamedBuilding[],
    getHeight: HeightProvider,
    onSelect?: (name: string) => void,
  ) {
    this.container = document.createElement("div");
    this.container.className = "world-labels";
    document.body.appendChild(this.container);

    for (const building of buildings) {
      const el = document.createElement("div");
      el.className = "world-label";
      el.textContent = building.name;
      if (onSelect) {
        el.classList.add("world-label--clickable");
        el.addEventListener("click", () => onSelect(building.name));
      }
      this.container.appendChild(el);

      this.items.push({
        name: building.name,
        world: new THREE.Vector3(
          building.x,
          getHeight(building.x, building.z) + building.height + 3,
          building.z,
        ),
        el,
        distance: Infinity,
      });
    }
  }

  update(camera: THREE.Camera): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const item of this.items) {
      item.distance = camera.position.distanceTo(item.world);
    }

    const visible = this.items
      .filter((item) => item.distance < MAX_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_VISIBLE);
    const visibleSet = new Set(visible);

    for (const item of this.items) {
      if (!visibleSet.has(item)) {
        if (item.el.style.display !== "none") item.el.style.display = "none";
        continue;
      }

      this.projected.copy(item.world).project(camera);
      if (this.projected.z > 1) {
        item.el.style.display = "none";
        continue;
      }

      const x = (this.projected.x * 0.5 + 0.5) * width;
      const y = (-this.projected.y * 0.5 + 0.5) * height;
      const opacity =
        item.distance <= FADE_START
          ? 1
          : 1 - (item.distance - FADE_START) / (MAX_DISTANCE - FADE_START);

      item.el.style.display = "block";
      item.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      item.el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    }
  }
}
