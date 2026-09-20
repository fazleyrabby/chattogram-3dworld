import * as THREE from "three";
import type { Input } from "@/player/Input";
import type { HeightProvider } from "@/geography/WorldHeight";

const MIN_DISTANCE = 500;
const MAX_DISTANCE = 4500;
const MIN_PITCH = 0.15;
const MAX_PITCH = 1.45;

/**
 * Detached "globe overview" camera (spec §5, Jalan KL-style overview): orbits the
 * whole district so it reads as a small world you can spin, then click a spot to
 * travel there. Independent of the player — the main camera is swapped in Game.
 */
export class OverviewCamera {
  readonly camera: THREE.PerspectiveCamera;

  yaw = Math.PI * 0.75;
  pitch = 1.02;
  distance = 1250;

  private readonly focus = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private initialized = false;

  constructor(
    aspect: number,
    private readonly getHeight: HeightProvider,
    private readonly rotateSpeed = 0.005,
  ) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 1, 20000);
    this.focus.set(0, 0, 0);
    this.focus.y = this.getHeight(0, 0);
  }

  handleInput(input: Input): void {
    const pointer = input.consumePointerDelta();
    this.yaw -= pointer.x * this.rotateSpeed;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + pointer.y * this.rotateSpeed,
      MIN_PITCH,
      MAX_PITCH,
    );
    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      this.distance = THREE.MathUtils.clamp(
        this.distance + wheel * 3,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    }
  }

  update(delta: number): void {
    this.focus.y = this.getHeight(0, 0);
    const cosPitch = Math.cos(this.pitch);
    this.desired.set(
      this.focus.x + Math.sin(this.yaw) * cosPitch * this.distance,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * cosPitch * this.distance,
    );
    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.initialized = true;
    } else {
      const lerp = 1 - Math.exp(-8 * delta);
      this.camera.position.lerp(this.desired, lerp);
    }
    this.camera.lookAt(this.focus);
  }

  /** Jumps to the orbit position on next update. */
  snap(): void {
    this.initialized = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Raycasts a screen point against the terrain; returns a world [x,z] or null. */
  pickGround(clientX: number, clientY: number, canvas: HTMLCanvasElement, terrain: THREE.Object3D): [number, number] | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObject(terrain, true);
    if (hits.length === 0) return null;
    const point = hits[0]!.point;
    return [point.x, point.z];
  }
}
