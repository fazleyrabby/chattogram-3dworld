import * as THREE from "three";

export const PLAYER_HALF_HEIGHT = 0.9;
export const PLAYER_RADIUS = 0.35;

/**
 * Player avatar and kinematic state (spec §24, §29).
 *
 * Milestone 1 uses a simple capsule avatar. A rigged/animated GLB replaces the
 * mesh here in a later milestone, without changing the controller contract.
 * `position` is the feet position; `object` is the renderable group at that point.
 */
export class Player {
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();

  onGround = true;
  facing = 0;

  constructor() {
    this.position = new THREE.Vector3();

    this.object = new THREE.Group();
    this.object.name = "Player";

    const capsuleLength = PLAYER_HALF_HEIGHT * 2 - PLAYER_RADIUS * 2;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, capsuleLength, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x2f80ed, roughness: 0.55 }),
    );
    body.position.y = PLAYER_HALF_HEIGHT;
    body.castShadow = true;
    body.name = "Body";
    this.object.add(body);

    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 }),
    );
    nose.position.set(0, PLAYER_HALF_HEIGHT, PLAYER_RADIUS + 0.14);
    nose.castShadow = true;
    nose.name = "Facing";
    this.object.add(nose);
  }

  /** Copies simulation state onto the renderable group. */
  sync(): void {
    this.object.position.copy(this.position);
    this.object.rotation.y = this.facing;
  }

  /** Eye/torso target used by the camera. */
  getCameraTarget(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      this.position.x,
      this.position.y + PLAYER_HALF_HEIGHT,
      this.position.z,
    );
  }
}
