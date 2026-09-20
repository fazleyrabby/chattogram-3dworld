import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";

const ROADS_PATH = "/world/chattogram/roads/roads.json";
// Roads sit almost flush with the terrain so the avatar stands on them. A small
// lift plus polygon offset avoids z-fighting without visibly raising the surface.
const SURFACE_OFFSET = 0.05;
const CENTER_LINE_WIDTH = 0.5;
const CENTER_LINE_TYPES = new Set(["motorway", "trunk", "primary", "secondary"]);

interface RoadData {
  id: string;
  type: string;
  name?: string;
  bridge: boolean;
  tunnel: boolean;
  width: number;
  points: Array<[number, number]>;
}

interface RoadsFile {
  attribution: string;
  roads: RoadData[];
}

type Point = [number, number];

/**
 * Real OSM road network rendered as 3D ribbons draped on the terrain (spec §10,
 * §11). All asphalt and all center lines are merged into single geometries to
 * keep draw calls low (spec §38).
 */
export class Roads {
  readonly object: THREE.Group;

  private constructor(object: THREE.Group) {
    this.object = object;
  }

  static async load(getHeight: HeightProvider): Promise<Roads> {
    const response = await fetch(ROADS_PATH);
    if (!response.ok) throw new Error(`Failed to load roads: ${response.status}`);
    const data = (await response.json()) as RoadsFile;

    const group = new THREE.Group();
    group.name = "Roads";

    const asphalt = { positions: [] as number[], indices: [] as number[] };
    const markings = { positions: [] as number[], indices: [] as number[] };

    for (const road of data.roads) {
      if (road.points.length < 2) continue;
      const half = road.width / 2;
      const { left, right } = offsetPolyline(road.points, half);
      addRibbon(asphalt, left, right, getHeight, SURFACE_OFFSET);

      if (CENTER_LINE_TYPES.has(road.type)) {
        const line = offsetPolyline(road.points, CENTER_LINE_WIDTH / 2);
        addRibbon(markings, line.left, line.right, getHeight, SURFACE_OFFSET + 0.05);
      }
    }

    const asphaltMesh = buildMesh(asphalt, 0x2b2b30, 0);
    asphaltMesh.name = "RoadAsphalt";
    asphaltMesh.receiveShadow = true;
    group.add(asphaltMesh);

    const markingMesh = buildMesh(markings, 0xd8d8cc, 1);
    markingMesh.name = "RoadMarkings";
    group.add(markingMesh);

    return new Roads(group);
  }
}

function offsetPolyline(points: Point[], half: number): { left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1] ?? points[i]!;
    const next = points[i + 1] ?? points[i]!;
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz);
    const nx = len > 1e-6 ? -dz / len : 0;
    const nz = len > 1e-6 ? dx / len : 0;
    const [x, z] = points[i]!;
    left.push([x + nx * half, z + nz * half]);
    right.push([x - nx * half, z - nz * half]);
  }
  return { left, right };
}

interface Buffers {
  positions: number[];
  indices: number[];
}

function addRibbon(
  buffers: Buffers,
  left: Point[],
  right: Point[],
  getHeight: HeightProvider,
  yOffset: number,
): void {
  const base = buffers.positions.length / 3;
  for (let i = 0; i < left.length; i++) {
    const [lx, lz] = left[i]!;
    const [rx, rz] = right[i]!;
    buffers.positions.push(lx, getHeight(lx, lz) + yOffset, lz);
    buffers.positions.push(rx, getHeight(rx, rz) + yOffset, rz);
  }
  for (let i = 0; i < left.length - 1; i++) {
    const a = base + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    buffers.indices.push(a, b, c, b, d, c);
  }
}

function buildMesh(buffers: Buffers, color: number, renderOrder: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(buffers.positions), 3),
  );
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  return mesh;
}
