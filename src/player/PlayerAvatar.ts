import type * as THREE from "three";

/**
 * Contract for a player avatar. Both the procedural fallback and the Blender
 * GLB implement this, so the controller never depends on a specific model.
 */
export interface PlayerAvatar {
  readonly object: THREE.Object3D;

  /**
   * @param phase     walk-cycle phase in radians
   * @param intensity 0 = idle, 1 = full run
   * @param airborne  true while jumping/falling
   */
  animate(phase: number, intensity: number, airborne: boolean): void;

  /** Seated riding pose with pedalling. `phase` drives the pedal cycle. */
  animateRiding(phase: number): void;
}
