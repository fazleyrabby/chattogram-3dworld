import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { RoadData } from "@/world/Roads";
import { buildPaths, samplePath, type Path } from "@/world/RoadPath";

const UP = new THREE.Vector3(0, 1, 0);

type VehicleKind = "car" | "cng" | "rickshaw";

const COUNTS: Record<VehicleKind, number> = { car: 22, cng: 14, rickshaw: 16 };
const COLORS: Record<VehicleKind, number[]> = {
  car: [0xcf4b3a, 0x2f6fb0, 0xdddddd, 0x3a3f45, 0x2e8b57, 0xd8b23a],
  cng: [0x1f8a4c, 0x178a4c],
  rickshaw: [0x2f6fb0, 0xc0392b, 0x2e8b57, 0xd98c2b],
};

const SPEEDS: Record<VehicleKind, [number, number]> = {
  car: [7, 11],
  cng: [5, 7.5],
  rickshaw: [3, 4.5],
};

interface Mover {
  path: number;
  distance: number;
  dir: number;
  speed: number;
}

/**
 * Cartoonish moving traffic (spec §42): cars, CNG auto-rickshaws and cycle
 * rickshaws driving the major roads. Each type is one InstancedMesh; per-instance
 * matrices are updated along the road paths. Not physical traffic — ambience.
 */
export class Traffic {
  readonly object: THREE.Group;

  private readonly paths: Path[];
  private readonly meshes: Record<VehicleKind, THREE.InstancedMesh>;
  private readonly movers: Record<VehicleKind, Mover[]>;

  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly position = new THREE.Vector3();

  constructor(roads: RoadData[], private readonly getHeight: HeightProvider) {
    this.object = new THREE.Group();
    this.object.name = "Traffic";
    this.paths = buildPaths(roads, 60);

    this.meshes = {
      car: makeInstanced(buildCar(), COUNTS.car),
      cng: makeInstanced(buildCng(), COUNTS.cng),
      rickshaw: makeInstanced(buildRickshaw(), COUNTS.rickshaw),
    };
    this.movers = { car: [], cng: [], rickshaw: [] };

    const color = new THREE.Color();
    for (const kind of Object.keys(this.meshes) as VehicleKind[]) {
      const mesh = this.meshes[kind];
      const palette = COLORS[kind];
      for (let i = 0; i < COUNTS[kind]; i++) {
        color.setHex(palette[i % palette.length]!);
        mesh.setColorAt(i, color);
        const [minS, maxS] = SPEEDS[kind];
        this.movers[kind].push({
          path: this.paths.length ? i % this.paths.length : 0,
          distance: Math.random() * 1e6,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: minS + Math.random() * (maxS - minS),
        });
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.object.add(mesh);
    }

    // Park everything until the first update so nothing sits at the origin.
    this.update(0, false);
  }

  update(delta: number, isNight: boolean): void {
    for (const kind of Object.keys(this.meshes) as VehicleKind[]) {
      const mesh = this.meshes[kind];
      const movers = this.movers[kind];
      if (this.paths.length === 0) continue;

      for (let i = 0; i < movers.length; i++) {
        const mover = movers[i]!;
        const path = this.paths[mover.path]!;
        mover.distance += mover.speed * delta;

        const cycle = path.total * 2;
        const d = ((mover.distance % cycle) + cycle) % cycle;
        const along = d <= path.total ? d : path.total * 2 - d;
        const forward = d <= path.total ? 1 : -1;

        const sample = samplePath(path, along);
        const lane = path.width * 0.26;
        const off = lane * forward;
        const dirX = Math.sin(sample.yaw);
        const dirZ = Math.cos(sample.yaw);
        const px = sample.x + -dirZ * off;
        const pz = sample.z + dirX * off;

        this.quat.setFromAxisAngle(UP, sample.yaw + (forward < 0 ? Math.PI : 0));
        this.position.set(px, this.getHeight(px, pz) + 0.05, pz);
        this.matrix.compose(this.position, this.quat, this.scale);
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Headlights (emissive) at night are approximated by brightening colors.
    for (const kind of ["car", "cng"] as VehicleKind[]) {
      const mat = this.meshes[kind].material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = isNight ? 0.15 : 0;
    }
  }
}

function makeInstanced(geometry: THREE.BufferGeometry, count: number): THREE.InstancedMesh {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function wheel(x: number, y: number, z: number, radius: number, width: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, width, 10);
  geo.rotateZ(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
}

function buildCar(): THREE.BufferGeometry {
  return mergeGeometries([
    new THREE.BoxGeometry(1.7, 0.6, 3.8).translate(0, 0.6, 0),
    new THREE.BoxGeometry(1.55, 0.55, 1.9).translate(0, 1.15, -0.1),
    wheel(0.85, 0.34, 1.25, 0.34, 0.22),
    wheel(-0.85, 0.34, 1.25, 0.34, 0.22),
    wheel(0.85, 0.34, -1.25, 0.34, 0.22),
    wheel(-0.85, 0.34, -1.25, 0.34, 0.22),
  ])!;
}

function buildCng(): THREE.BufferGeometry {
  return mergeGeometries([
    new THREE.BoxGeometry(1.3, 1.2, 2.2).translate(0, 0.95, 0),
    new THREE.BoxGeometry(1.4, 0.14, 1.3).translate(0, 1.66, -0.2),
    wheel(0, 0.32, 1.0, 0.32, 0.2),
    wheel(0.6, 0.3, -0.9, 0.3, 0.18),
    wheel(-0.6, 0.3, -0.9, 0.3, 0.18),
  ])!;
}

function buildRickshaw(): THREE.BufferGeometry {
  return mergeGeometries([
    new THREE.BoxGeometry(1.05, 0.55, 1.5).translate(0, 0.85, -0.1),
    new THREE.BoxGeometry(1.25, 0.12, 1.8).translate(0, 1.75, -0.1),
    new THREE.BoxGeometry(0.5, 0.7, 0.5).translate(0, 0.7, 1.05),
    wheel(0, 0.32, 1.2, 0.32, 0.1),
    wheel(0.62, 0.34, -0.7, 0.34, 0.08),
    wheel(-0.62, 0.34, -0.7, 0.34, 0.08),
  ])!;
}
