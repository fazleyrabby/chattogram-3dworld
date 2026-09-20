import * as THREE from "three";
import type { NamedBuilding } from "@/world/Buildings";
import type { HeightProvider } from "@/geography/WorldHeight";

/**
 * A tall glowing beacon marking the current quest objective so it can be found
 * from across the district (spec §75).
 */
export class QuestBeacon {
  readonly object: THREE.Group;

  private readonly beam: THREE.Mesh;
  private readonly diamond: THREE.Mesh;
  private time = 0;

  constructor(private readonly getHeight: HeightProvider) {
    this.object = new THREE.Group();
    this.object.name = "QuestBeacon";
    this.object.visible = false;

    const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true);
    beamGeo.translate(0, 30, 0);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd54a,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.object.add(this.beam);

    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffd54a,
        emissive: 0xffb300,
        emissiveIntensity: 0.8,
        roughness: 0.4,
      }),
    );
    this.object.add(this.diamond);
  }

  setTarget(landmark: NamedBuilding | null): void {
    if (!landmark) {
      this.object.visible = false;
      return;
    }
    const y = this.getHeight(landmark.x, landmark.z);
    this.object.position.set(landmark.x, y, landmark.z);
    this.diamond.position.y = landmark.height + 6;
    this.object.visible = true;
  }

  update(delta: number): void {
    if (!this.object.visible) return;
    this.time += delta;
    this.diamond.rotation.y += delta * 1.2;
    this.diamond.position.y += Math.sin(this.time * 2) * 0.01;
  }
}
