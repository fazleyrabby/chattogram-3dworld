import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { RoadData } from "@/world/Roads";
import { buildPaths, samplePath, type Path } from "@/world/RoadPath";

const COUNT = 90;
const SIDEWALK = 1.3;
const MIN_SPEED = 1.0;
const MAX_SPEED = 1.7;
const SHIRTS = [0xd94f4f, 0x4f7fd9, 0x4fd98a, 0xd9c14f, 0xd97f4f, 0x9a4fd9, 0xf0f0f0];

interface Walker {
  path: number;
  distance: number;
  side: number;
  dir: number;
  speed: number;
  phase: number;
}

/**
 * Simple cartoon pedestrians walking the sidewalks (spec §43).
 *
 * Instanced: legs, torso and head are three InstancedMeshes sharing per-instance
 * matrices, updated each frame. Shirts vary via instanceColor. No skeletal
 * animation — a bob sells the walk at street distance.
 */
export class Pedestrians {
  readonly object: THREE.Group;

  private readonly paths: Path[];
  private readonly walkers: Walker[] = [];
  private readonly lower: THREE.InstancedMesh;
  private readonly torso: THREE.InstancedMesh;
  private readonly head: THREE.InstancedMesh;

  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly position = new THREE.Vector3();
  private time = 0;

  constructor(roads: RoadData[], private readonly getHeight: HeightProvider) {
    this.object = new THREE.Group();
    this.object.name = "Pedestrians";
    this.paths = buildPaths(roads);

    const legsGeo = mergeGeometries([
      new THREE.BoxGeometry(0.16, 0.72, 0.17).translate(0.11, 0.36, 0),
      new THREE.BoxGeometry(0.16, 0.72, 0.17).translate(-0.11, 0.36, 0),
    ])!;
    const torsoGeo = new THREE.CapsuleGeometry(0.2, 0.5, 4, 10).translate(0, 1.16, 0);
    const headGeo = new THREE.SphereGeometry(0.16, 12, 10).translate(0, 1.72, 0);

    const legsMat = new THREE.MeshStandardMaterial({ color: 0x33384a, roughness: 0.9 });
    const torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcf9b74, roughness: 0.8 });

    this.lower = new THREE.InstancedMesh(legsGeo, legsMat, COUNT);
    this.torso = new THREE.InstancedMesh(torsoGeo, torsoMat, COUNT);
    this.head = new THREE.InstancedMesh(headGeo, headMat, COUNT);

    const color = new THREE.Color();
    for (const mesh of [this.lower, this.torso, this.head]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    }
    for (let i = 0; i < COUNT; i++) {
      color.setHex(SHIRTS[i % SHIRTS.length]!);
      this.torso.setColorAt(i, color);
    }
    if (this.torso.instanceColor) this.torso.instanceColor.needsUpdate = true;

    this.object.add(this.lower, this.torso, this.head);

    for (let i = 0; i < COUNT; i++) {
      if (this.paths.length === 0) break;
      this.walkers.push({
        path: i % this.paths.length,
        distance: Math.random() * 1e6,
        side: Math.random() < 0.5 ? 1 : -1,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(delta: number): void {
    this.time += delta;
    for (let i = 0; i < this.walkers.length; i++) {
      const walker = this.walkers[i]!;
      const path = this.paths[walker.path]!;
      walker.distance += walker.speed * delta;
      const d = ((walker.distance % (path.total * 2)) + path.total * 2) % (path.total * 2);
      const along = d <= path.total ? d : path.total * 2 - d;
      const forward = d <= path.total ? 1 : -1;

      const sample = samplePath(path, along);
      const nx = -Math.sin(sample.yaw) * 0;
      const offset = this.sidewalkOffset(path, walker.side) + 0.2;
      const dirX = Math.sin(sample.yaw);
      const dirZ = Math.cos(sample.yaw);
      const px = sample.x + -dirZ * offset;
      const pz = sample.z + dirX * offset;

      this.quat.setFromAxisAngle(UP, sample.yaw + (forward < 0 ? Math.PI : 0));
      const bob = Math.abs(Math.sin(this.time * 6 + walker.phase)) * 0.05;
      this.position.set(px, this.getHeight(px, pz) + bob, pz);
      this.matrix.compose(this.position, this.quat, this.scale);
      this.lower.setMatrixAt(i, this.matrix);
      this.torso.setMatrixAt(i, this.matrix);
      this.head.setMatrixAt(i, this.matrix);
      void nx;
      void walker.dir;
    }
    this.lower.instanceMatrix.needsUpdate = true;
    this.torso.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }

  private sidewalkOffset(path: Path, side: number): number {
    void path;
    return SIDEWALK * side;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
