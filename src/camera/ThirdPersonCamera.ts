import * as THREE from "three";
import type { Input } from "@/player/Input";

const MIN_PITCH = 0.12;
const MAX_PITCH = 1.25;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 40;

/**
 * Third-person orbit camera (spec §26). Follows a target with smoothing,
 * supports drag rotation and wheel zoom. Camera collision (§28) comes later.
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;

  yaw = Math.PI;
  pitch = 0.55;
  distance = 12;

  private readonly currentTarget = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number, private readonly rotateSpeed = 0.005) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 12000);
  }

  handleInput(input: Input): void {
    const pointer = input.consumePointerDelta();
    this.yaw -= pointer.x * this.rotateSpeed;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - pointer.y * this.rotateSpeed,
      MIN_PITCH,
      MAX_PITCH,
    );

    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      this.distance = THREE.MathUtils.clamp(
        this.distance + wheel * 0.02,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    }
  }

  update(delta: number, target: THREE.Vector3): void {
    this.desiredTarget.copy(target);

    const cosPitch = Math.cos(this.pitch);
    this.desiredPosition.set(
      target.x + Math.sin(this.yaw) * cosPitch * this.distance,
      target.y + Math.sin(this.pitch) * this.distance,
      target.z + Math.cos(this.yaw) * cosPitch * this.distance,
    );

    if (!this.initialized) {
      this.currentTarget.copy(this.desiredTarget);
      this.camera.position.copy(this.desiredPosition);
      this.initialized = true;
    } else {
      const targetLerp = 1 - Math.exp(-12 * delta);
      const positionLerp = 1 - Math.exp(-9 * delta);
      this.currentTarget.lerp(this.desiredTarget, targetLerp);
      this.camera.position.lerp(this.desiredPosition, positionLerp);
    }

    this.camera.lookAt(this.currentTarget);
  }

  /** Jumps the follow smoothing (used after a teleport). */
  snap(): void {
    this.initialized = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
