import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";

const BUILDINGS_PATH = "/world/chattogram/buildings/buildings.json";

const TYPE_COLORS: Record<string, number> = {
  residential: 0xcabfae,
  commercial: 0xd6cfc0,
  industrial: 0x9aa0a6,
  office: 0xb9c2ce,
  school: 0xd7c39c,
  university: 0xcbb896,
  hospital: 0xd8d3cb,
  religious: 0xc9b592,
  government: 0xc7bda6,
  warehouse: 0xa8a49c,
  hotel: 0xd9d3c6,
  stadium: 0xc3c6c9,
  unknown: 0xc2bbaf,
};

export interface NamedBuilding {
  name: string;
  x: number;
  z: number;
  height: number;
}

interface BuildingData {
  id: string;
  type: string;
  name?: string;
  height: number;
  ring: Array<[number, number]>;
}

interface BuildingsFile {
  buildings: BuildingData[];
}

type Vec3 = [number, number, number];

/**
 * Procedural buildings from real OSM footprints (spec §12–15).
 *
 * Each footprint is extruded to its estimated height and draped on the terrain.
 * Everything is merged into one geometry for a single draw call (§38). Named
 * buildings are collected for world labels (§16, §33).
 */
export class Buildings {
  readonly object: THREE.Mesh;
  readonly named: NamedBuilding[];

  private constructor(object: THREE.Mesh, named: NamedBuilding[]) {
    this.object = object;
    this.named = named;
  }

  static async load(getHeight: HeightProvider): Promise<Buildings> {
    const response = await fetch(BUILDINGS_PATH);
    if (!response.ok) throw new Error(`Failed to load buildings: ${response.status}`);
    const data = (await response.json()) as BuildingsFile;

    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const named: NamedBuilding[] = [];

    for (const building of data.buildings) {
      const ring = building.ring;
      if (ring.length < 3) continue;

      color.setHex(TYPE_COLORS[building.type] ?? TYPE_COLORS.unknown!);
      const base = ring.map(([x, z]) => getHeight(x, z));
      const top = base.map((y) => y + building.height);
      const centroid = ringCentroid(ring);

      // Walls (quads).
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const a = ring[i]!;
        const b = ring[j]!;
        addWall(positions, colors, color, a, b, base[i]!, base[j]!, top[i]!, top[j]!, centroid);
      }

      // Roof (triangulated).
      const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
      let faces: number[][] = [];
      if (ring.length === 3) {
        faces = [[0, 1, 2]];
      } else {
        try {
          faces = THREE.ShapeUtils.triangulateShape(contour, []);
        } catch {
          faces = [];
        }
      }
      for (const face of faces) {
        const i0 = face[0]!;
        const i1 = face[1]!;
        const i2 = face[2]!;
        addRoofTriangle(
          positions,
          colors,
          color,
          [ring[i0]![0], top[i0]!, ring[i0]![1]],
          [ring[i1]![0], top[i1]!, ring[i1]![1]],
          [ring[i2]![0], top[i2]!, ring[i2]![1]],
        );
      }

      if (building.name) {
        named.push({
          name: building.name,
          x: centroid[0],
          z: centroid[1],
          height: building.height,
        });
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Buildings";
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return new Buildings(mesh, named);
  }
}

function push(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  p: Vec3,
): void {
  positions.push(p[0], p[1], p[2]);
  colors.push(color.r, color.g, color.b);
}

function addWall(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  a: [number, number],
  b: [number, number],
  ay: number,
  by: number,
  aty: number,
  bty: number,
  centroid: [number, number],
): void {
  const p0: Vec3 = [a[0], ay, a[1]];
  const p1: Vec3 = [b[0], by, b[1]];
  const p2: Vec3 = [b[0], bty, b[1]];
  const p3: Vec3 = [a[0], aty, a[1]];

  // Flip winding if the normal points toward the footprint centroid.
  const n = faceNormal(p0, p1, p2);
  const midX = (a[0] + b[0]) / 2;
  const midZ = (a[1] + b[1]) / 2;
  const outward = n[0] * (midX - centroid[0]) + n[2] * (midZ - centroid[1]) >= 0;

  const tri = (x: Vec3, y: Vec3, z: Vec3): void => {
    if (outward) {
      push(positions, colors, color, x);
      push(positions, colors, color, y);
      push(positions, colors, color, z);
    } else {
      push(positions, colors, color, x);
      push(positions, colors, color, z);
      push(positions, colors, color, y);
    }
  };
  tri(p0, p1, p2);
  tri(p0, p2, p3);
}

function addRoofTriangle(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
): void {
  const n = faceNormal(p0, p1, p2);
  if (n[1] >= 0) {
    push(positions, colors, color, p0);
    push(positions, colors, color, p1);
    push(positions, colors, color, p2);
  } else {
    push(positions, colors, color, p0);
    push(positions, colors, color, p2);
    push(positions, colors, color, p1);
  }
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

function ringCentroid(ring: Array<[number, number]>): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  return [x / ring.length, z / ring.length];
}
