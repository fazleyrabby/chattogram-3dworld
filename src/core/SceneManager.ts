import * as THREE from "three";

const SKY_COLOR = 0x9fc4e8;

/**
 * Owns the Three.js scene and its atmospheric settings (spec §36, §40).
 */
export class SceneManager {
  readonly scene: THREE.Scene;

  private readonly sky = new THREE.Color(SKY_COLOR);

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = this.sky;
    this.scene.fog = new THREE.Fog(SKY_COLOR, 300, 3600);
  }

  /** Extends or restores the fog distance (e.g. for the globe overview). */
  setFogFar(far: number): void {
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.far = far;
  }

  /** Retints the sky and fog (day/night, spec §34). */
  setSky(color: THREE.Color): void {
    this.sky.copy(color);
    this.scene.background = this.sky;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(color);
    }
  }
}
