import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { RoadGraph } from "@/navigation/RoadGraph";
import type { Player } from "@/player/Player";
import type { HUD } from "@/ui/HUD";

export interface SearchItem {
  name: string;
  kind: "landmark" | "road";
  x?: number;
  z?: number;
  points?: Array<[number, number]>;
}

const ROUTE_WIDTH = 1.6;
const RECOMPUTE_DISTANCE = 18;
const RECOMPUTE_INTERVAL = 1.2;

/**
 * Destination routing (spec extension): given a search result, computes a
 * road-following path from the player's position (Dijkstra over RoadGraph),
 * renders it as a glowing draped ribbon, and reports distance to the HUD/map.
 */
export class Navigation {
  readonly object: THREE.Group;

  private readonly ribbon: THREE.Mesh;
  private readonly marker: THREE.Group;
  private route: Array<[number, number]> = [];
  private destination: SearchItem | null = null;
  private target: { x: number; z: number } | null = null;
  private distance = 0;
  private timer = 0;
  private lastX = Infinity;
  private lastZ = Infinity;

  constructor(
    private readonly graph: RoadGraph,
    private readonly getHeight: HeightProvider,
    private readonly hud: HUD,
  ) {
    this.object = new THREE.Group();
    this.object.name = "Navigation";

    this.ribbon = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0x39d2ff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ribbon.renderOrder = 4;
    this.ribbon.frustumCulled = false;
    this.object.add(this.ribbon);

    this.marker = buildMarker();
    this.marker.visible = false;
    this.object.add(this.marker);
  }

  setDestination(item: SearchItem, player: Player): void {
    this.destination = item;
    this.target = resolveTarget(item, player.position.x, player.position.z);
    this.lastX = Infinity;
    this.timer = 0;
    if (this.target) {
      const y = this.getHeight(this.target.x, this.target.z);
      this.marker.position.set(this.target.x, y, this.target.z);
      this.marker.visible = true;
    }
    this.recompute(player);
  }

  clear(): void {
    this.destination = null;
    this.target = null;
    this.route = [];
    this.ribbon.geometry.dispose();
    this.ribbon.geometry = new THREE.BufferGeometry();
    this.marker.visible = false;
    this.hud.setDestination(null);
  }

  get destinationName(): string | null {
    return this.destination?.name ?? null;
  }

  getRoute(): Array<[number, number]> {
    return this.route;
  }

  getTarget(): { x: number; z: number } | null {
    return this.target;
  }

  update(delta: number, player: Player): void {
    if (!this.target) return;
    this.timer -= delta;
    const moved = Math.hypot(player.position.x - this.lastX, player.position.z - this.lastZ);
    if (this.timer <= 0 && moved > RECOMPUTE_DISTANCE) {
      this.recompute(player);
    }
  }

  private recompute(player: Player): void {
    if (!this.target) return;
    this.timer = RECOMPUTE_INTERVAL;
    this.lastX = player.position.x;
    this.lastZ = player.position.z;

    const path = this.graph.route(
      player.position.x,
      player.position.z,
      this.target.x,
      this.target.z,
    );
    this.route = path ?? [
      [player.position.x, player.position.z],
      [this.target.x, this.target.z],
    ];

    this.distance = 0;
    for (let i = 1; i < this.route.length; i++) {
      this.distance += Math.hypot(
        this.route[i]![0] - this.route[i - 1]![0],
        this.route[i]![1] - this.route[i - 1]![1],
      );
    }

    this.ribbon.geometry.dispose();
    this.ribbon.geometry = buildRibbon(this.route, this.getHeight);
    this.hud.setDestination(`${this.destination?.name ?? "Destination"} · ${formatDistance(this.distance)}`);
  }
}

function resolveTarget(item: SearchItem, px: number, pz: number): { x: number; z: number } | null {
  if (item.kind === "landmark" && item.x !== undefined && item.z !== undefined) {
    return { x: item.x, z: item.z };
  }
  const points = item.points;
  if (!points || points.length === 0) return null;

  let best = points[0]!;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = (point[0] - px) ** 2 + (point[1] - pz) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return { x: best[0], z: best[1] };
}

function buildRibbon(points: Array<[number, number]>, getHeight: HeightProvider): THREE.BufferGeometry {
  const positions: number[] = [];
  const half = ROUTE_WIDTH / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = -dz / len;
    const nz = dx / len;

    const ax = a[0] + nx * half;
    const az = a[1] + nz * half;
    const bx = a[0] - nx * half;
    const bz = a[1] - nz * half;
    const cx = b[0] + nx * half;
    const cz = b[1] + nz * half;
    const dx2 = b[0] - nx * half;
    const dz2 = b[1] - nz * half;

    const y = 0.35;
    positions.push(
      ax, getHeight(ax, az) + y, az,
      bx, getHeight(bx, bz) + y, bz,
      cx, getHeight(cx, cz) + y, cz,
      bx, getHeight(bx, bz) + y, bz,
      dx2, getHeight(dx2, dz2) + y, dz2,
      cx, getHeight(cx, cz) + y, cz,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildMarker(): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.8 }),
  );
  pole.position.y = 3;
  const flag = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 4),
    new THREE.MeshStandardMaterial({
      color: 0x39d2ff,
      emissive: 0x0a5a80,
      emissiveIntensity: 0.6,
      roughness: 0.5,
    }),
  );
  flag.position.y = 6.6;
  flag.rotation.y = Math.PI / 4;
  group.add(pole, flag);
  return group;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
