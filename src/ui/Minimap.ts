import type { BuildingData, NamedBuilding } from "@/world/Buildings";
import type { RoadData } from "@/world/Roads";
import type { Player } from "@/player/Player";

const SIZE = 240;
const SPAN = 520; // meters across the minimap view
const MARGIN = 300; // meters of extra static map around buildings

/**
 * Canvas2D minimap (spec §55, MVP-core).
 *
 * Reuses the same world vectors as the 3D scene (roads + buildings) — no second
 * data pipeline. The static world is rendered once to an offscreen canvas; each
 * frame only a player-centred crop is blitted, with named-place labels and a
 * facing arrow drawn on top.
 */
export class Minimap {
  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly staticMap: HTMLCanvasElement;

  private readonly minX: number;
  private readonly maxZ: number;
  private readonly staticW: number;
  private readonly staticH: number;
  private readonly scale: number;
  private readonly named: NamedBuilding[];

  private visible = true;
  private gps: { x: number; z: number } | null = null;

  constructor(
    parent: HTMLElement,
    buildings: BuildingData[],
    roads: RoadData[],
    named: NamedBuilding[],
  ) {
    this.named = named;

    // World-local extent of the populated area.
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const b of buildings) {
      for (const [x, z] of b.ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    if (!Number.isFinite(minX)) {
      minX = -1000;
      maxX = 1000;
      minZ = -1000;
      maxZ = 1000;
    }
    this.minX = minX - MARGIN;
    this.maxZ = maxZ + MARGIN;
    this.staticW = Math.ceil(maxX - minX + MARGIN * 2);
    this.staticH = Math.ceil(maxZ - minZ + MARGIN * 2);
    this.scale = SIZE / SPAN;

    this.staticMap = this.renderStatic(buildings, roads);

    this.container = document.createElement("div");
    this.container.className = "minimap";
    this.canvas = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.width = `${SIZE}px`;
    this.canvas.style.height = `${SIZE}px`;
    this.container.appendChild(this.canvas);
    parent.appendChild(this.container);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Minimap: 2D context unavailable");
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);
  }

  /** world-local (x, z) -> static canvas pixel (px, py), north-up. */
  private toStatic(x: number, z: number): [number, number] {
    return [x - this.minX, this.maxZ - z];
  }

  private renderStatic(buildings: BuildingData[], roads: RoadData[]): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.staticW;
    canvas.height = this.staticH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    ctx.fillStyle = "#cdd5c2";
    ctx.fillRect(0, 0, this.staticW, this.staticH);

    // Buildings
    ctx.fillStyle = "#b7ab97";
    for (const b of buildings) {
      ctx.beginPath();
      for (let i = 0; i < b.ring.length; i++) {
        const [x, z] = b.ring[i]!;
        const [px, py] = this.toStatic(x, z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Roads: casing then fill (map style)
    for (const pass of [0, 1]) {
      for (const road of roads) {
        if (road.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < road.points.length; i++) {
          const [x, z] = road.points[i]!;
          const [px, py] = this.toStatic(x, z);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        const w = Math.max(2, road.width);
        ctx.lineWidth = pass === 0 ? w + 2 : w;
        ctx.strokeStyle = pass === 0 ? "#a9a49a" : "#f7f5f0";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    }

    return canvas;
  }

  /** Shows the device's real position marker on the map. */
  setGps(point: { x: number; z: number } | null): void {
    this.gps = point;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "block" : "none";
    return this.visible;
  }

  update(player: Player): void {
    if (!this.visible) return;
    const ctx = this.ctx;

    const [pcx, pcy] = this.toStatic(player.position.x, player.position.z);
    const sx = clamp(pcx - SPAN / 2, 0, Math.max(0, this.staticW - SPAN));
    const sy = clamp(pcy - SPAN / 2, 0, Math.max(0, this.staticH - SPAN));

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.staticMap, sx, sy, SPAN, SPAN, 0, 0, SIZE, SIZE);

    // Named place markers + labels
    ctx.font = "600 10px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    let drawn = 0;
    for (const place of this.named) {
      const [mx, my] = this.toStatic(place.x, place.z);
      const dx = (mx - sx) * this.scale;
      const dy = (my - sy) * this.scale;
      if (dx < 4 || dy < 4 || dx > SIZE - 4 || dy > SIZE - 4) continue;
      if (drawn++ > 8) break;

      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.arc(dx, dy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      const label = place.name.length > 18 ? `${place.name.slice(0, 17)}…` : place.name;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(16,22,30,0.82)";
      ctx.fillRect(dx + 4, dy - 7, w + 8, 14);
      ctx.fillStyle = "#f4f7fa";
      ctx.fillText(label, dx + 8, dy + 0.5);
    }

    // Device GPS marker
    if (this.gps) {
      const [gx, gy] = this.toStatic(this.gps.x, this.gps.z);
      const dx = (gx - sx) * this.scale;
      const dy = (gy - sy) * this.scale;
      if (dx >= 0 && dy >= 0 && dx <= SIZE && dy <= SIZE) {
        ctx.strokeStyle = "#1f9d55";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player arrow (facing +Z is forward; screen y is inverted)
    const px = (pcx - sx) * this.scale;
    const py = (pcy - sy) * this.scale;
    const dir = player.facing;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(dir), Math.cos(dir)));
    ctx.fillStyle = "#2f80ed";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Compass
    ctx.fillStyle = "rgba(16,22,30,0.75)";
    ctx.beginPath();
    ctx.arc(SIZE - 16, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f7fa";
    ctx.textAlign = "center";
    ctx.fillText("N", SIZE - 16, 16.5);
    ctx.textAlign = "left";
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
